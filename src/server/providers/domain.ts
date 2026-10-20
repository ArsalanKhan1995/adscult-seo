import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  assertLabsLocationCode,
  assertLanguageForLocation,
} from "@/server/lib/market";
import {
  parseResearchTargetOrThrow,
  toRelativePath,
} from "@/server/lib/domainUtils";
import {
  buildRankedKeywordsScopeFilter,
  buildRelevantPagesScopeFilter,
} from "@/server/lib/dataforseo/researchScopeFilters";
import { executeProviderOperation } from "./operation";
import { computeHasMore } from "./pagination";
import { normalizeDomainKeyword } from "./dataforseo/domain-keyword";
import {
  buildKeywordFilters,
  buildOrderBy,
} from "./dataforseo/domain-keyword-filters";
import { buildPageFilters } from "./dataforseo/domain-page-filters";
import {
  domainKeywordSchema,
  domainPageSchema,
  domainMetricsSchema,
  type DomainMarketRequest,
  type DomainKeywordsRequest,
  type DomainPagesRequest,
} from "./contracts/domain";
import {
  domainCompetitorSchema,
  type DomainCompetitorsRequest,
} from "./contracts/domain";

function market(input: DomainMarketRequest) {
  assertLabsLocationCode(input.locationCode);
  assertLanguageForLocation(input.locationCode, input.languageCode);
  const target = parseResearchTargetOrThrow(input.domain, input.scope);
  return {
    target,
    scope: {
      target: target.display,
      researchScope: target.scope,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
      searchEngine: "google" as const,
      trafficUnit: "estimated_monthly_visits" as const,
      cpcCurrency: "USD" as const,
    },
  };
}

export function fetchDomainOverview(
  customer: BillingCustomerContext,
  input: DomainMarketRequest,
) {
  const { target, scope } = market(input);
  return executeProviderOperation(
    customer,
    "domain.overview",
    async (client, warnings) => {
      const rows = await client.domain.rankOverview({
        target: target.hostname,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
        creditFeature: input.creditFeature,
      });
      const organic = rows[0]?.metrics?.organic;
      if (target.scope !== "subdomains")
        warnings.push(
          "Overview metrics cover the hostname and all subdomains; they cannot be narrowed to the requested scope.",
        );
      return {
        ...domainMetricsSchema.parse({
          organicTraffic: organic?.etv != null ? Math.round(organic.etv) : null,
          organicKeywords:
            organic?.count != null ? Math.round(organic.count) : null,
        }),
        scope: { ...scope, metricScope: "subdomains" as const },
      };
    },
  );
}

export function fetchDomainKeywords(
  customer: BillingCustomerContext,
  input: DomainKeywordsRequest,
) {
  const { target, scope } = market(input);
  const filters = buildKeywordFilters(
    input.filters,
    input.search,
    buildRankedKeywordsScopeFilter(target),
    input.excludeBrandTerms,
  );
  return executeProviderOperation(
    customer,
    "domain.keywords",
    async (client, warnings) => {
      const response = await client.domain.rankedKeywords({
        target: target.hostname,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
        limit: input.limit,
        offset: input.offset,
        orderBy: buildOrderBy(input.sortMode, input.sortOrder),
        filters: filters.length ? filters : undefined,
        creditFeature: input.creditFeature,
        itemTypes: input.resultTypes,
      });
      const receivedCount = response.receivedCount ?? response.items.length;
      const items = response.items.flatMap((item) => {
        const normalized = normalizeDomainKeyword(item);
        return normalized ? [domainKeywordSchema.parse(normalized)] : [];
      });
      if (items.length !== receivedCount)
        warnings.push(
          "Some ranked keyword rows were invalid or lacked a keyword and were omitted; pagination uses the original row count.",
        );
      return {
        items,
        totalCount: response.totalCount,
        receivedCount,
        offset: input.offset,
        limit: input.limit,
        hasMore: computeHasMore(
          input.offset,
          receivedCount,
          response.totalCount,
          input.limit,
        ),
        scope: { ...scope, positionKind: "absolute" as const },
      };
    },
  );
}

export function fetchDomainPages(
  customer: BillingCustomerContext,
  input: DomainPagesRequest,
) {
  const { target, scope } = market(input);
  const filters = buildPageFilters(
    input.filters,
    input.search,
    buildRelevantPagesScopeFilter(target),
  );
  const sortField =
    input.sortMode === "traffic"
      ? "metrics.organic.etv"
      : "metrics.organic.count";
  return executeProviderOperation(
    customer,
    "domain.pages",
    async (client, warnings) => {
      const response = await client.domain.relevantPages({
        target: target.hostname,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
        limit: input.limit,
        offset: input.offset,
        orderBy: [`${sortField},${input.sortOrder}`],
        filters: filters.length ? filters : undefined,
        creditFeature: input.creditFeature,
      });
      const items = response.items.flatMap((item) => {
        if (!item.page_address) return [];
        const organic = item.metrics?.organic;
        return [
          domainPageSchema.parse({
            page: item.page_address,
            relativePath: toRelativePath(item.page_address),
            organicTraffic:
              organic?.etv != null ? Math.round(organic.etv) : null,
            keywords: organic?.count != null ? Math.round(organic.count) : null,
          }),
        ];
      });
      if (items.length !== response.items.length)
        warnings.push(
          "Some page rows had no URL and were omitted; pagination uses the original row count.",
        );
      return {
        items,
        totalCount: z
          .number()
          .nonnegative()
          .nullable()
          .parse(response.totalCount),
        receivedCount: response.items.length,
        offset: input.offset,
        limit: input.limit,
        hasMore: computeHasMore(
          input.offset,
          response.items.length,
          response.totalCount,
          input.limit,
        ),
        scope,
      };
    },
  );
}

export function fetchDomainCompetitors(
  customer: BillingCustomerContext,
  input: DomainCompetitorsRequest,
) {
  assertLabsLocationCode(input.locationCode);
  assertLanguageForLocation(input.locationCode, input.languageCode);
  return executeProviderOperation(
    customer,
    "domain.competitors",
    async (client, warnings) => {
      const response = await client.labs.serpCompetitors({
        ...input,
        itemTypes: input.resultTypes,
      });
      const items = response.flatMap((item) =>
        item.domain
          ? [
              domainCompetitorSchema.parse({
                domain: item.domain,
                averagePosition: item.avg_position ?? null,
                medianPosition: item.median_position ?? null,
                visibility: item.visibility ?? null,
                traffic: item.etv ?? null,
                keywordCount: item.keywords_count ?? null,
              }),
            ]
          : [],
      );
      if (items.length !== response.length)
        warnings.push("Some competitor rows had no domain and were omitted.");
      return {
        items,
        receivedCount: response.length,
        totalCount: null,
        hasMore: response.length === input.limit,
        limit: input.limit,
        offset: input.offset ?? 0,
        scope: {
          keywords: input.keywords,
          locationCode: input.locationCode,
          languageCode: input.languageCode,
          searchEngine: "google",
          includeSubdomains: input.includeSubdomains ?? null,
          resultTypes: input.resultTypes ?? null,
          trafficUnit: "estimated_monthly_visits",
        },
      };
    },
  );
}
