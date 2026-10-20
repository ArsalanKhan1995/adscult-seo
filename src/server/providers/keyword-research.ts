import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { CreditFeature } from "@/shared/billing-credit-features";
import {
  assertLabsLocationCode,
  assertLanguageForLocation,
} from "@/server/lib/market";
import { fetchAdsSearchVolumeForKeywords } from "@/server/lib/dataforseo/keyword-metrics";
import { executeProviderOperation } from "./operation";
import {
  fetchResearchRowsBySource,
  fetchGoogleAdsResearchRows,
  mapAdsKeywordItems,
} from "./dataforseo/keyword-research";
import {
  keywordResearchRowSchema,
  type KeywordResearchRequest,
} from "./contracts/keyword-research";

function metricScope(input: { locationCode: number; languageCode: string }) {
  return {
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    cpcCurrency: "USD" as const,
    competitionScale: "0-1" as const,
    volumeUnit: "monthly_searches" as const,
  };
}

export function fetchKeywordResearch(
  customer: BillingCustomerContext,
  input: KeywordResearchRequest,
) {
  assertLabsLocationCode(input.locationCode);
  assertLanguageForLocation(input.locationCode, input.languageCode);
  const operations = {
    related: "keywords.related",
    suggestions: "keywords.suggestions",
    ideas: "keywords.ideas",
  } as const;
  return executeProviderOperation(
    customer,
    operations[input.source],
    async (client) => ({
      rows: z
        .array(keywordResearchRowSchema)
        .parse(await fetchResearchRowsBySource(input, client)),
      scope: {
        ...metricScope(input),
        metricSource: "dataforseo_labs",
        clickstreamRequested: input.includeClickstreamData ?? false,
      },
    }),
  );
}

export function fetchGoogleAdsKeywordResearch(
  customer: BillingCustomerContext,
  input: Omit<KeywordResearchRequest, "source">,
) {
  assertLanguageForLocation(input.locationCode, input.languageCode);
  return executeProviderOperation(
    customer,
    "keywords.adsIdeas",
    async (client) => ({
      rows: z
        .array(keywordResearchRowSchema)
        .parse(await fetchGoogleAdsResearchRows(input, client)),
      scope: {
        ...metricScope(input),
        metricSource: "google_ads",
        difficultyAvailable: false,
        intentAvailable: false,
      },
    }),
  );
}

export function fetchLocalKeywordVolumes(
  customer: BillingCustomerContext,
  input: {
    keywords: string[];
    locationCode: number;
    languageCode: string;
    locationName: string;
    creditFeature?: CreditFeature;
  },
) {
  assertLanguageForLocation(input.locationCode, input.languageCode);
  return executeProviderOperation(
    customer,
    "keywords.adsVolume",
    async (client) => ({
      rows: z
        .array(keywordResearchRowSchema)
        .parse(
          mapAdsKeywordItems(
            await fetchAdsSearchVolumeForKeywords(client, input),
          ),
        ),
      scope: {
        ...metricScope(input),
        locationName: input.locationName,
        metricSource: "google_ads",
        difficultyAvailable: false,
        intentAvailable: false,
      },
    }),
  );
}
