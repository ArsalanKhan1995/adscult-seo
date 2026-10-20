import { z } from "zod";
import type { ResearchScope } from "@/shared/researchScope";
import type { CreditFeature } from "@/shared/billing-credit-features";
import type { DomainKeywordsFilters } from "@/types/schemas/domain";

export type DomainKeywordsSortMode =
  | "rank"
  | "traffic"
  | "volume"
  | "score"
  | "cpc";
export type DomainKeywordsSortOrder = "asc" | "desc";
export interface DomainMarketRequest {
  domain: string;
  scope?: ResearchScope;
  locationCode: number;
  languageCode: string;
  creditFeature?: CreditFeature;
}
export interface DomainKeywordsRequest extends DomainMarketRequest {
  limit: number;
  offset: number;
  sortMode: DomainKeywordsSortMode;
  sortOrder: DomainKeywordsSortOrder;
  filters: DomainKeywordsFilters;
  search?: string;
  excludeBrandTerms?: string[];
  resultTypes?: Array<
    | "organic"
    | "paid"
    | "featured_snippet"
    | "local_pack"
    | "ai_overview_reference"
  >;
}
export interface DomainPagesRequest extends Omit<
  DomainKeywordsRequest,
  "sortMode"
> {
  sortMode: "traffic" | "keywords";
}

export const domainKeywordSchema = z.object({
  keyword: z.string(),
  // Existing presentation uses absolute position. Keep organic position
  // separate so a feature cannot accidentally substitute one for the other.
  position: z.number().nullable(),
  absolutePosition: z.number().nullable(),
  organicPosition: z.number().nullable(),
  resultType: z.string().nullable(),
  intent: z.string().nullable(),
  searchVolume: z.number().nonnegative().nullable(),
  traffic: z.number().nonnegative().nullable(),
  cpc: z.number().nonnegative().nullable(),
  url: z.string().nullable(),
  relativeUrl: z.string().nullable(),
  keywordDifficulty: z.number().min(0).max(100).nullable(),
});
export type DomainKeyword = z.infer<typeof domainKeywordSchema>;

export const domainPageSchema = z.object({
  page: z.string(),
  relativePath: z.string().nullable(),
  organicTraffic: z.number().nonnegative().nullable(),
  keywords: z.number().nonnegative().nullable(),
});

export const domainMetricsSchema = z.object({
  organicTraffic: z.number().nonnegative().nullable(),
  organicKeywords: z.number().nonnegative().nullable(),
});

export interface DomainCompetitorsRequest extends Omit<
  DomainMarketRequest,
  "domain" | "scope"
> {
  keywords: string[];
  resultTypes?: Array<"organic" | "paid" | "featured_snippet" | "local_pack">;
  includeSubdomains?: boolean;
  limit: number;
  offset?: number;
}
export const domainCompetitorSchema = z.object({
  domain: z.string(),
  averagePosition: z.number().nullable(),
  medianPosition: z.number().nullable(),
  visibility: z.number().nullable(),
  traffic: z.number().nonnegative().nullable(),
  keywordCount: z.number().nonnegative().nullable(),
});
