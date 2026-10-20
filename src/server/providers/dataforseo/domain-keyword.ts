import { z } from "zod";
import { type DomainRankedKeywordItem } from "@/server/lib/dataforseo";
import { toRelativePath } from "@/server/lib/domainUtils";

function roundedMetric(value: number | null | undefined) {
  return value == null ? null : Math.round(value);
}

export function normalizeDomainKeyword(item: DomainRankedKeywordItem) {
  const keywordData = item.keyword_data;
  const keywordInfo = keywordData?.keyword_info;
  const keywordProperties = keywordData?.keyword_properties;
  const rankedSerpElement = item.ranked_serp_element;
  const serpItem = rankedSerpElement?.serp_item;

  const keyword = keywordData?.keyword ?? item.keyword;
  if (!keyword) return null;

  const url = serpItem?.url ?? rankedSerpElement?.url ?? null;

  const relativeUrl =
    serpItem?.relative_url ??
    rankedSerpElement?.relative_url ??
    (url ? toRelativePath(url) : null);

  const position =
    serpItem?.rank_absolute ??
    rankedSerpElement?.rank_absolute ??
    (typeof item.rank_absolute === "number" ? item.rank_absolute : null);

  const traffic = serpItem?.etv ?? rankedSerpElement?.etv ?? null;

  const keywordDifficulty =
    keywordProperties?.keyword_difficulty ??
    keywordInfo?.keyword_difficulty ??
    null;
  const absolutePosition = roundedMetric(position);

  return {
    keyword,
    position: absolutePosition,
    absolutePosition,
    organicPosition:
      serpItem?.type === "organic" && typeof serpItem.rank_group === "number"
        ? serpItem.rank_group
        : null,
    resultType: typeof serpItem?.type === "string" ? serpItem.type : null,
    intent:
      z
        .object({ main_intent: z.string().nullish() })
        .nullish()
        .parse(keywordData?.search_intent_info)?.main_intent ?? null,
    searchVolume: roundedMetric(keywordInfo?.search_volume),
    traffic,
    cpc: keywordInfo?.cpc ?? null,
    url,
    relativeUrl,
    keywordDifficulty: roundedMetric(keywordDifficulty),
  };
}
