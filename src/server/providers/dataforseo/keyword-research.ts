import type { KeywordResearchRequest } from "@/server/providers/contracts/keyword-research";
import type { KeywordResearchRow as EnrichedKeyword } from "@/types/keywords";
import { normalizeMonthlySearches } from "@/server/providers/dataforseo/normalize-monthly-searches";
import {
  type AdsKeywordIdeaItem,
  type LabsKeywordDataItem,
} from "@/server/lib/dataforseo";
import type { createDataforseoClient } from "@/server/lib/dataforseo";
import {
  normalizeIntent,
  normalizeKeyword,
} from "@/shared/keyword-normalization";

function mapKeywordDataItems(items: LabsKeywordDataItem[]): EnrichedKeyword[] {
  const rows: EnrichedKeyword[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const keyword = item.keyword;
    if (!keyword) continue;

    const normalized = normalizeKeyword(keyword);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    // The clickstream-normalized block only exists when the caller opted into
    // clickstream data (it doubles the request cost); prefer it when present.
    const keywordInfo =
      item.keyword_info_normalized_with_clickstream?.search_volume != null
        ? item.keyword_info_normalized_with_clickstream
        : item.keyword_info;

    rows.push({
      keyword: normalized,
      searchVolume: keywordInfo?.search_volume ?? null,
      trend: normalizeMonthlySearches(keywordInfo?.monthly_searches),
      cpc: item.keyword_info?.cpc ?? null,
      competition: item.keyword_info?.competition ?? null,
      keywordDifficulty: item.keyword_properties?.keyword_difficulty ?? null,
      intent: normalizeIntent(item.search_intent_info?.main_intent),
    });
  }

  return rows;
}

/**
 * Google Ads items carry volume / CPC / paid competition but no keyword
 * difficulty or search intent (those are Labs-only).
 */
export function mapAdsKeywordItems(
  items: AdsKeywordIdeaItem[],
): EnrichedKeyword[] {
  const rows: EnrichedKeyword[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const keyword = item.keyword;
    if (!keyword) continue;

    const normalized = normalizeKeyword(keyword);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    rows.push({
      keyword: normalized,
      searchVolume: item.search_volume ?? null,
      trend: normalizeMonthlySearches(item.monthly_searches),
      cpc: item.cpc ?? null,
      competition:
        item.competition_index != null ? item.competition_index / 100 : null,
      keywordDifficulty: null,
      intent: "unknown",
    });
  }

  return rows;
}

/** Research rows for countries DataForSEO Labs doesn't support. */
export async function fetchGoogleAdsResearchRows(
  params: Omit<KeywordResearchRequest, "source">,
  dataforseo: ReturnType<typeof createDataforseoClient>,
): Promise<EnrichedKeyword[]> {
  return mapAdsKeywordItems(
    await dataforseo.keywords.adsIdeas({
      keyword: params.seedKeyword,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      limit: params.resultLimit,
      creditFeature: params.creditFeature,
    }),
  );
}

async function fetchRelatedRows(
  params: Omit<KeywordResearchRequest, "source">,
  dataforseo: ReturnType<typeof createDataforseoClient>,
) {
  const items = await dataforseo.keywords.related({
    keyword: params.seedKeyword,
    locationCode: params.locationCode,
    languageCode: params.languageCode,
    limit: params.resultLimit,
    depth: 3,
    includeClickstreamData: params.includeClickstreamData,
    ignoreSynonyms: params.ignoreSynonyms,
    creditFeature: params.creditFeature,
  });

  // Related items wrap the keyword payload one level deeper; unwrap and reuse
  // the same mapper as suggestions/ideas.
  return mapKeywordDataItems(
    items
      .map((item) => item.keyword_data)
      .filter((data): data is NonNullable<typeof data> => data != null),
  );
}

export async function fetchResearchRowsBySource(
  params: KeywordResearchRequest,
  dataforseo: ReturnType<typeof createDataforseoClient>,
): Promise<EnrichedKeyword[]> {
  if (params.source === "related") {
    return fetchRelatedRows(params, dataforseo);
  }

  if (params.source === "suggestions") {
    return mapKeywordDataItems(
      await dataforseo.keywords.suggestions({
        keyword: params.seedKeyword,
        locationCode: params.locationCode,
        languageCode: params.languageCode,
        limit: params.resultLimit,
        includeClickstreamData: params.includeClickstreamData,
        ignoreSynonyms: params.ignoreSynonyms,
        creditFeature: params.creditFeature,
      }),
    );
  }

  return mapKeywordDataItems(
    await dataforseo.keywords.ideas({
      keyword: params.seedKeyword,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      limit: params.resultLimit,
      includeClickstreamData: params.includeClickstreamData,
      ignoreSynonyms: params.ignoreSynonyms,
      creditFeature: params.creditFeature,
    }),
  );
}
