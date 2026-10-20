import type { BillingCustomerContext } from "@/server/billing/subscription";
import { executeProviderOperation } from "./operation";
import {
  SERP_ANALYSIS_DEPTH,
  serpRowSchema,
  type SerpRequest,
} from "./contracts/serp";

export function fetchSerp(
  customer: BillingCustomerContext,
  input: SerpRequest,
) {
  // Keep the existing transport's depth bounds. Deeper crawls replace the
  // snapshot; Google does not provide an offset for subsequent pages.
  const depth = Math.min(100, Math.max(10, input.depth ?? SERP_ANALYSIS_DEPTH));
  const device = input.device ?? "desktop";
  return executeProviderOperation(
    customer,
    "serp.live",
    async (client, warnings) => {
      const items = await client.serp.live({ ...input, depth, device });
      const rows = items.map((item) =>
        serpRowSchema.parse({
          resultType: item.type,
          absolutePosition: item.rank_absolute ?? null,
          groupPosition: item.rank_group ?? null,
          organicPosition:
            item.type === "organic" ? (item.rank_group ?? null) : null,
          title: item.title ?? null,
          url: item.url ?? null,
          domain: item.domain ?? null,
          description: item.description ?? null,
          estimatedMonthlyVisits: item.etv ?? null,
          estimatedPaidTrafficCost: item.estimated_paid_traffic_cost ?? null,
          referringDomains: item.backlinks_info?.referring_domains ?? null,
          backlinks: item.backlinks_info?.backlinks ?? null,
        }),
      );
      if (
        rows.some(
          (row) => row.resultType === "organic" && row.organicPosition === null,
        )
      ) {
        warnings.push(
          "Some organic results have no organic position; absolute positions remain separate.",
        );
      }
      return {
        rows,
        scope: {
          keyword: input.keyword,
          engine: "google" as const,
          locationCode: input.locationCode,
          languageCode: input.languageCode,
          locationName: input.locationName ?? null,
          device,
          depth,
          trafficCostCurrency: "USD" as const,
          trafficUnit: "estimated_monthly_visits" as const,
        },
        pagination: {
          returnedCount: rows.length,
          totalCount: null,
          cursor: null,
        },
      };
    },
  );
}
