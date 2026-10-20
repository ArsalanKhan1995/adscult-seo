import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { CreditFeature } from "@/shared/billing-credit-features";
import type {
  BacklinksLookupInput,
  BacklinksSpamFilterOptions,
} from "@/types/schemas/backlinks";
import { normalizeBacklinksTarget } from "@/server/lib/dataforseo";
import { executeProviderOperation } from "./operation";
import {
  mapBacklinksRows,
  mapReferringDomainsRows,
} from "./dataforseo/backlinks-mappers";
import {
  profileBacklinksOverview,
  profileBacklinksRowsPage,
  profileReferringDomainsPage,
  profileTopPagesPage,
} from "./dataforseo/backlinks-profile";
import {
  backlinksOverviewSchema,
  backlinksRowsPageResultSchema,
  referringDomainsPageResultSchema,
  topPagesPageResultSchema,
  type BacklinksRowsPageServiceInput,
  type ReferringDomainsPageServiceInput,
  type TopPagesPageServiceInput,
} from "./contracts/backlinks";

function semantics(input: BacklinksLookupInput) {
  const target = normalizeBacklinksTarget(input.target, { scope: input.scope });
  return {
    scope: {
      target: target.displayTarget,
      researchScope: target.scope,
      includeSubdomains: target.includeSubdomains,
    },
    metricDefinitions: {
      rank: "dataforseo_backlinks_rank_0_100",
      spamScore: "dataforseo_backlinks_spam_score_0_100",
      backlinks: "live_external_backlinks",
    },
  };
}

export function fetchBacklinksOverview(
  customer: BillingCustomerContext,
  input: BacklinksLookupInput,
  creditFeature?: CreditFeature,
) {
  return executeProviderOperation(
    customer,
    "backlinks.summary",
    async (client, warnings) => {
      const result = await profileBacklinksOverview(
        input,
        client,
        creditFeature,
      );
      if (result.overview.scope === "subfolder")
        warnings.push(
          "Subfolder totals use filtered link counts; authority, spam scores and history are unavailable for this scope.",
        );
      else if (result.overview.scope === "exact_url")
        warnings.push("Backlink history is unavailable for an exact URL.");
      else
        warnings.push(
          "Backlink history includes subdomains, independently of summary scope.",
        );
      return { overview: backlinksOverviewSchema.parse(result.overview) };
    },
    semantics(input),
  );
}

export function fetchBacklinksPage(
  customer: BillingCustomerContext,
  input: BacklinksRowsPageServiceInput,
  spamOptions?: BacklinksSpamFilterOptions,
) {
  return executeProviderOperation(
    customer,
    "backlinks.rows",
    async (client) =>
      backlinksRowsPageResultSchema.parse(
        await profileBacklinksRowsPage(input, client, spamOptions),
      ),
    semantics(input),
  );
}

export function fetchReferringDomainsPage(
  customer: BillingCustomerContext,
  input: ReferringDomainsPageServiceInput,
  spamOptions?: BacklinksSpamFilterOptions,
) {
  return executeProviderOperation(
    customer,
    "backlinks.referringDomains",
    async (client) =>
      referringDomainsPageResultSchema.parse(
        await profileReferringDomainsPage(input, client, spamOptions),
      ),
    semantics(input),
  );
}

export function fetchBacklinkPages(
  customer: BillingCustomerContext,
  input: TopPagesPageServiceInput,
) {
  return executeProviderOperation(
    customer,
    "backlinks.pages",
    async (client) =>
      topPagesPageResultSchema.parse(await profileTopPagesPage(input, client)),
    semantics(input),
  );
}

export function fetchBacklinkActivity(
  customer: BillingCustomerContext,
  input: { domain: string; kind: "new" | "lost" | "all" },
) {
  const scope = { target: input.domain, scope: "subdomains" } as const;
  return executeProviderOperation(
    customer,
    "backlinks.rows",
    async (client) => {
      const target = normalizeBacklinksTarget(input.domain, {
        scope: "subdomains",
      });
      const dateFrom = new Date(Date.now() - 7 * 86400_000)
        .toISOString()
        .slice(0, 10);
      const response = await client.backlinks.rows({
        target: target.apiTarget,
        includeSubdomains: true,
        limit: 25,
        mode: "one_per_domain",
        status: input.kind === "lost" ? "lost" : "live",
        hideSpam: false,
        orderBy: [input.kind === "lost" ? "last_seen,desc" : "first_seen,desc"],
        filters:
          input.kind === "all"
            ? undefined
            : [
                [
                  input.kind === "lost" ? "last_seen" : "first_seen",
                  ">=",
                  `${dateFrom} 00:00:00 +00:00`,
                ],
              ],
      });
      return {
        rows: backlinksRowsPageResultSchema.shape.rows.parse(
          mapBacklinksRows(response.items),
        ),
        dateFrom: input.kind === "all" ? null : dateFrom,
        limit: 25,
      };
    },
    semantics(scope),
  );
}

export function fetchReferringDomainActivity(
  customer: BillingCustomerContext,
  domain: string,
) {
  const scope = { target: domain, scope: "subdomains" } as const;
  return executeProviderOperation(
    customer,
    "backlinks.referringDomains",
    async (client) => {
      const target = normalizeBacklinksTarget(domain, { scope: "subdomains" });
      const dateFrom = new Date(Date.now() - 7 * 86400_000)
        .toISOString()
        .slice(0, 10);
      const response = await client.backlinks.referringDomains({
        target: target.apiTarget,
        includeSubdomains: true,
        limit: 25,
        hideSpam: false,
        orderBy: ["first_seen,desc"],
        filters: [["first_seen", ">=", `${dateFrom} 00:00:00 +00:00`]],
      });
      return {
        rows: referringDomainsPageResultSchema.shape.rows.parse(
          mapReferringDomainsRows(response.items),
        ),
        dateFrom,
        limit: 25,
      };
    },
    semantics(scope),
  );
}
