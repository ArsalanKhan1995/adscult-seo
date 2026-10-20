import { waitUntil } from "cloudflare:workers";
import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { fetchDomainPages } from "@/server/providers/domain";
import { unwrapProviderResult } from "@/server/providers/operation";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import { parseResearchTargetOrThrow } from "@/server/lib/domainUtils";
import type { ResearchScope } from "@/shared/researchScope";
import type { DomainKeywordsFilters } from "@/types/schemas/domain";

const DOMAIN_PAGES_PAGE_TTL_SECONDS = 12 * 60 * 60;

type DomainPagesSortMode = "traffic" | "keywords";
type DomainPagesSortOrder = "asc" | "desc";

const domainPagesPageResultSchema = z.object({
  domain: z.string(),
  page: z.number(),
  pageSize: z.number(),
  totalCount: z.number().nullable(),
  hasMore: z.boolean(),
  pages: z.array(
    z.object({
      page: z.string(),
      relativePath: z.string().nullable(),
      organicTraffic: z.number().nullable(),
      keywords: z.number().nullable(),
    }),
  ),
  fetchedAt: z.string(),
});

type DomainPagesPageResult = z.infer<typeof domainPagesPageResultSchema>;

export async function getPagesPage(
  input: {
    projectId: string;
    domain: string;
    scope?: ResearchScope;
    locationCode: number;
    languageCode: string;
    page: number;
    pageSize: number;
    sortMode: DomainPagesSortMode;
    sortOrder: DomainPagesSortOrder;
    filters: DomainKeywordsFilters;
    search?: string;
  },
  billingCustomer: BillingCustomerContext,
): Promise<DomainPagesPageResult> {
  const target = parseResearchTargetOrThrow(input.domain, input.scope);
  const offset = (input.page - 1) * input.pageSize;

  const cacheKey = await buildCacheKey("domain:pages-page", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    domain: target.hostname,
    scope: target.scope,
    path: target.path,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    page: input.page,
    pageSize: input.pageSize,
    sortMode: input.sortMode,
    sortOrder: input.sortOrder,
    filters: input.filters,
    search: input.search,
  });

  const cachedRaw = await getCached(cacheKey);
  const cached = domainPagesPageResultSchema.safeParse(cachedRaw);
  if (cached.success) {
    return cached.data;
  }

  const response = unwrapProviderResult(
    await fetchDomainPages(billingCustomer, {
      ...input,
      limit: input.pageSize,
      offset,
    }),
  );
  const pages = response.items;
  const { totalCount, hasMore } = response;

  const result: DomainPagesPageResult = {
    domain: target.hostname,
    page: input.page,
    pageSize: input.pageSize,
    totalCount,
    hasMore,
    pages,
    fetchedAt: new Date().toISOString(),
  };

  // waitUntil, not void: workerd cancels unregistered pending I/O once the
  // response is sent, so a fire-and-forget put never persists the cache.
  waitUntil(
    setCached(cacheKey, result, DOMAIN_PAGES_PAGE_TTL_SECONDS).catch(
      (error) => {
        console.error("domain.pages-page.cache-write failed:", error);
      },
    ),
  );

  return result;
}
