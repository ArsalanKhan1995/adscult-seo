import { z } from "zod";
import type { CreditFeature } from "@/shared/billing-credit-features";
export type KeywordResearchRequest = {
  seedKeyword: string;
  locationCode: number;
  languageCode: string;
  resultLimit: number;
  source: "related" | "suggestions" | "ideas";
  includeClickstreamData?: boolean;
  ignoreSynonyms?: boolean;
  // Attribute the DataForSEO spend to a specific feature (e.g. "agent");
  // defaults to the path-derived feature when omitted.
  creditFeature?: CreditFeature;
};

export const keywordResearchRowSchema = z.object({
  keyword: z.string(),
  searchVolume: z.number().nullable(),
  trend: z.array(
    z.object({
      year: z.number(),
      month: z.number(),
      searchVolume: z.number().nullable(),
    }),
  ),
  cpc: z.number().nullable(),
  competition: z.number().nullable(),
  keywordDifficulty: z.number().nullable(),
  intent: z.enum([
    "informational",
    "commercial",
    "transactional",
    "navigational",
    "unknown",
  ]),
});
