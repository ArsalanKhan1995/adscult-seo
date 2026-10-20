import type { BillingCustomerContext } from "@/server/billing/subscription";
import { storedLighthousePayloadSchema } from "@/server/lib/lighthouseStoredPayload";
import { executeProviderOperation } from "./operation";

export function fetchLighthouse(
  customer: BillingCustomerContext,
  input: { url: string; strategy: "mobile" | "desktop" },
) {
  return executeProviderOperation(
    customer,
    "audit.lighthouse",
    async (client) => {
      // The existing parser already reduces the multi-MB report into a compact,
      // validated report. Preserve its storage format and memory/charge handling.
      const report = storedLighthousePayloadSchema.parse(
        await client.lighthouse.live(input),
      );
      return {
        report,
        scope: {
          requestedUrl: input.url,
          finalUrl: report.metadata.finalUrl,
          device: input.strategy,
          lighthouseVersion: report.metadata.lighthouseVersion,
          scoreScale: "0-100" as const,
          timingUnit: "milliseconds" as const,
          cumulativeLayoutShiftUnit: "dimensionless" as const,
        },
      };
    },
  );
}
