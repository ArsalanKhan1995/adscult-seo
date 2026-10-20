import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { CreditFeature } from "@/shared/billing-credit-features";
import type {
  BacklinksLookupInput,
  BacklinksSpamFilterOptions,
} from "@/types/schemas/backlinks";
import {
  fetchBacklinksOverview,
  fetchBacklinksPage,
  fetchReferringDomainsPage,
  fetchBacklinkPages,
} from "@/server/providers/backlinks";
import { unwrapProviderResult } from "@/server/providers/operation";
import {
  backlinksOverviewSchema,
  backlinksRowsPageResultSchema,
  referringDomainsPageResultSchema,
  topPagesPageResultSchema,
  type BacklinksRowsPageServiceInput,
  type ReferringDomainsPageServiceInput,
  type TopPagesPageServiceInput,
} from "@/server/providers/contracts/backlinks";
export type {
  BacklinksRowsPageServiceInput,
  ReferringDomainsPageServiceInput,
  TopPagesPageServiceInput,
} from "@/server/providers/contracts/backlinks";

export type BacklinksCache = {
  get(key: string): Promise<unknown>;
  set(key: string, data: unknown, ttlSeconds: number): Promise<void>;
};
const TTL_SECONDS = 6 * 60 * 60;

async function readThrough<T>(
  cache: BacklinksCache,
  key: string,
  schema: z.ZodType<T>,
  load: () => Promise<T>,
): Promise<T> {
  const cached = schema.safeParse(await cache.get(key));
  if (cached.success) return cached.data;
  const data = await load();
  await cache
    .set(key, data, TTL_SECONDS)
    .catch((error: unknown) =>
      console.error("backlinks.cache-write failed:", error),
    );
  return data;
}

export function profileBacklinksOverview(
  cache: BacklinksCache,
  cacheKey: string,
  input: BacklinksLookupInput,
  customer: BillingCustomerContext,
  creditFeature?: CreditFeature,
) {
  return readThrough(
    cache,
    cacheKey,
    z.object({ overview: backlinksOverviewSchema }),
    async () =>
      unwrapProviderResult(
        await fetchBacklinksOverview(customer, input, creditFeature),
      ),
  );
}
export function profileBacklinksRowsPage(
  cache: BacklinksCache,
  cacheKey: string,
  input: BacklinksRowsPageServiceInput,
  customer: BillingCustomerContext,
  spamOptions?: BacklinksSpamFilterOptions,
) {
  return readThrough(cache, cacheKey, backlinksRowsPageResultSchema, async () =>
    unwrapProviderResult(
      await fetchBacklinksPage(customer, input, spamOptions),
    ),
  );
}
export function profileReferringDomainsPage(
  cache: BacklinksCache,
  cacheKey: string,
  input: ReferringDomainsPageServiceInput,
  customer: BillingCustomerContext,
  spamOptions?: BacklinksSpamFilterOptions,
) {
  return readThrough(
    cache,
    cacheKey,
    referringDomainsPageResultSchema,
    async () =>
      unwrapProviderResult(
        await fetchReferringDomainsPage(customer, input, spamOptions),
      ),
  );
}
export function profileTopPagesPage(
  cache: BacklinksCache,
  cacheKey: string,
  input: TopPagesPageServiceInput,
  customer: BillingCustomerContext,
) {
  return readThrough(cache, cacheKey, topPagesPageResultSchema, async () =>
    unwrapProviderResult(await fetchBacklinkPages(customer, input)),
  );
}
