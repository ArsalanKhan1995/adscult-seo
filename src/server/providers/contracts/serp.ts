import { z } from "zod";

export const SERP_ANALYSIS_DEPTH = 20;

export interface SerpRequest {
  keyword: string;
  locationCode: number;
  languageCode: string;
  locationName?: string;
  device?: "desktop" | "mobile";
  depth?: number;
}

const position = z.number().int().positive().nullable();
export const serpRowSchema = z.object({
  resultType: z.string(),
  absolutePosition: position,
  organicPosition: position,
  groupPosition: position,
  title: z.string().nullable(),
  url: z.string().nullable(),
  domain: z.string().nullable(),
  description: z.string().nullable(),
  estimatedMonthlyVisits: z.number().nonnegative().nullable(),
  estimatedPaidTrafficCost: z.number().nonnegative().nullable(),
  referringDomains: z.number().int().nonnegative().nullable(),
  backlinks: z.number().int().nonnegative().nullable(),
});
export type SerpRow = z.infer<typeof serpRowSchema>;

export const serpScopeSchema = z.object({
  keyword: z.string(),
  engine: z.literal("google"),
  locationCode: z.number().int(),
  languageCode: z.string(),
  locationName: z.string().nullable(),
  device: z.enum(["desktop", "mobile"]),
  depth: z.number().int().min(10).max(100),
  trafficCostCurrency: z.literal("USD"),
  trafficUnit: z.literal("estimated_monthly_visits"),
});

export const serpProvenanceSchema = z.object({
  provider: z.enum(["dataforseo", "treg"]),
  upstreamVendor: z.string(),
  operation: z.literal("serp.live"),
  settingsRevision: z.number().int(),
  fetchedAt: z.string(),
  warnings: z.array(z.string()),
});
