import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { KeywordResearchRequest } from "@/server/providers/contracts/keyword-research";
import {
  fetchKeywordResearch,
  fetchGoogleAdsKeywordResearch,
} from "@/server/providers/keyword-research";
import { unwrapProviderResult } from "@/server/providers/operation";

export async function fetchResearchRowsBySource(
  params: KeywordResearchRequest,
  customer: BillingCustomerContext,
) {
  return unwrapProviderResult(await fetchKeywordResearch(customer, params))
    .rows;
}
export async function fetchGoogleAdsResearchRows(
  params: Omit<KeywordResearchRequest, "source">,
  customer: BillingCustomerContext,
) {
  return unwrapProviderResult(
    await fetchGoogleAdsKeywordResearch(customer, params),
  ).rows;
}
