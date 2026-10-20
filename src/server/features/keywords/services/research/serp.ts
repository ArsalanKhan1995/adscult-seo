import { waitUntil } from "cloudflare:workers";
import {
  SERP_ANALYSIS_DEPTH,
  serpScopeSchema,
  serpProvenanceSchema,
  type SerpRow,
} from "@/server/providers/contracts/serp";
import { fetchSerp } from "@/server/providers/serp";
import { AppError } from "@/server/lib/errors";
import { unwrapProviderResult } from "@/server/providers/operation";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import type { SerpResultItem } from "@/types/keywords";
import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { normalizeKeyword } from "./helpers";
import { assertLocalResearchLocation } from "./local-volume";

const SERP_CACHE_TTL_SECONDS = 12 * 60 * 60;

type SerpAnalysisReason = "no_organic_results";

type SerpAnalysisResult = {
  requestedKeyword: string;
  items: SerpResultItem[];
  /** SERP depth this snapshot was crawled at — how deep the results go. */
  depth: number;
  reason?: SerpAnalysisReason;
  scope?: z.infer<typeof serpScopeSchema>;
  provenance?: z.infer<typeof serpProvenanceSchema>;
};

const serpResultItemSchema = z.object({
  rank: z.number().int(),
  title: z.string(),
  url: z.string(),
  domain: z.string(),
  description: z.string(),
  etv: z.number().nullable(),
  estimatedPaidTrafficCost: z.number().nullable(),
  referringDomains: z.number().nullable(),
  backlinks: z.number().nullable(),
  isNew: z.boolean(),
  rankChange: z.number().nullable(),
});

const serpCacheSchema = z.object({
  requestedKeyword: z.string(),
  items: z.array(serpResultItemSchema),
  // Entries written before depth was tracked don't say how deep they went, so
  // they're treated as the shallow floor: worst case a user re-buys a deeper
  // crawl once, rather than being shown 20 results as if they were 100.
  depth: z.number().int().default(SERP_ANALYSIS_DEPTH),
  reason: z.enum(["no_organic_results"]).optional(),
  scope: serpScopeSchema.optional(),
  provenance: serpProvenanceSchema.optional(),
});

function mapOrganicSerpItems(items: SerpRow[]): SerpResultItem[] {
  return items
    .filter(
      (item) =>
        item.resultType === "organic" &&
        (item.organicPosition ?? item.absolutePosition) !== null,
    )
    .map((item) => ({
      // The presentation contract requires a known rank; unranked rows are omitted.
      rank: (item.organicPosition ?? item.absolutePosition)!,
      title: item.title ?? "",
      url: item.url ?? "",
      domain: item.domain ?? "",
      description: item.description ?? "",
      etv: item.estimatedMonthlyVisits,
      estimatedPaidTrafficCost: item.estimatedPaidTrafficCost,
      referringDomains: item.referringDomains,
      backlinks: item.backlinks,
      isNew: false,
      rankChange: null,
    }));
}

async function getSerpLiveAnalysis(
  input: {
    projectId: string;
    keyword: string;
    locationCode: number;
    languageCode: string;
    depth: number;
    locationName?: string;
  },
  billingCustomer: BillingCustomerContext,
): Promise<SerpAnalysisResult> {
  const keyword = normalizeKeyword(input.keyword);
  const { depth } = input;
  if (input.locationName) {
    await assertLocalResearchLocation(input.locationCode, input.locationName);
  }

  const cacheKey = await buildCacheKey("serp:analysis", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    keyword,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    locationName: input.locationName,
  });

  // Depth lives in the cached value, not the key: DataForSEO has no offset, so
  // a deeper crawl re-fetches the head too. A depth-100 snapshot therefore also
  // answers depth-20 requests, and a deeper request replaces the entry rather
  // than appending to it.
  const cachedRaw = await getCached(cacheKey);
  const cached = serpCacheSchema.safeParse(cachedRaw);
  if (cached.success && cached.data.depth >= depth) {
    return cached.data;
  }

  const batch = await fetchSerp(billingCustomer, {
    keyword,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    locationName: input.locationName,
    depth,
  });
  const response = unwrapProviderResult(batch);

  const items = mapOrganicSerpItems(response.rows);
  if (
    items.length === 0 &&
    response.rows.some((row) => row.resultType === "organic")
  ) {
    // Missing positions are an incomplete response, not evidence of an empty SERP.
    throw new AppError("UPSTREAM_UNAVAILABLE");
  }
  const result: SerpAnalysisResult = {
    requestedKeyword: keyword,
    items,
    depth,
    scope: response.scope,
    provenance: serpProvenanceSchema.parse(batch.meta),
  };
  if (items.length === 0) {
    result.reason = "no_organic_results";
  }

  // DataForSEO reports "no results" transiently, and a deeper crawl overwrites
  // the same key. Without this guard one empty re-crawl would evict a good
  // snapshot and, being the deeper entry, answer every shallower request with
  // nothing for the rest of the TTL.
  if (items.length === 0 && cached.success && cached.data.items.length > 0) {
    return result;
  }

  // waitUntil, not void: workerd cancels unregistered pending I/O once the
  // response is sent, so a fire-and-forget put never persists the cache.
  waitUntil(
    setCached(cacheKey, result, SERP_CACHE_TTL_SECONDS).catch((error) => {
      console.error("keywords.serp.cache-write failed:", error);
    }),
  );

  return result;
}

export const getSerpAnalysis = getSerpLiveAnalysis;
