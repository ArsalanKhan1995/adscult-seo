import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { fetchRankCheckTaskResult } from "@/server/lib/dataforseo";
import {
  executeProviderOperation,
  normalizeProviderFailure,
} from "./operation";
import {
  rankCheckResultSchema,
  type RankCheckRequest,
  type RankTaskRequest,
} from "./contracts/rank-check";

function rankScope(input: Omit<RankTaskRequest, "tasks">) {
  return {
    engine: "google" as const,
    targetDomain: input.targetDomain,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    locationName: input.locationName ?? null,
    depth: Math.min(100, Math.max(10, input.depth)),
    positionSemantics: "organic_rank_with_absolute_fallback" as const,
  };
}

export function fetchRankChecks(
  customer: BillingCustomerContext,
  inputs: RankCheckRequest[],
) {
  return executeProviderOperation(
    customer,
    "serp.rankCheck",
    async (client, warnings) => {
      // Keep one credit reservation/settlement for the entire batch. Calling a
      // per-keyword metered method here would change the billing contract.
      const settled = await client.serp.rankCheckBatch(inputs);
      const items = inputs.map((input, inputIndex) => {
        const outcome = settled[inputIndex];
        let result;
        try {
          if (!outcome || outcome.status === "rejected") {
            throw (
              outcome?.reason ?? new SyntaxError("Missing rank-check outcome")
            );
          }
          result = {
            ok: true as const,
            data: rankCheckResultSchema.parse(outcome.value),
          };
        } catch (cause) {
          result = {
            ok: false as const,
            error: normalizeProviderFailure(cause),
          };
        }
        return {
          inputIndex,
          keywordId: input.keywordId,
          keyword: input.keyword,
          device: input.device,
          scope: rankScope(input),
          result,
        };
      });
      const failed = items.filter((item) => !item.result.ok).length;
      if (failed)
        warnings.push(
          `Rank checks unavailable for ${failed} of ${inputs.length} inputs.`,
        );
      return { items };
    },
  );
}

export function postRankTasks(
  customer: BillingCustomerContext,
  input: RankTaskRequest,
) {
  return executeProviderOperation(
    customer,
    "serp.rankTaskPost",
    async (client, warnings) => {
      const tasks = z
        .array(
          z.object({
            taskId: z.string(),
            keywordId: z.string(),
            keyword: z.string(),
            device: z.enum(["desktop", "mobile"]),
          }),
        )
        .parse(await client.serp.rankCheckTaskPost(input));
      if (tasks.length < input.tasks.length)
        warnings.push("Some rank-check tasks were not accepted.");
      return {
        tasks,
        requestedCount: input.tasks.length,
        scope: rankScope(input),
      };
    },
  );
}

const rankTaskOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("failed"), message: z.string() }),
  z.object({ status: z.literal("completed"), result: rankCheckResultSchema }),
]);

export function collectRankTask(
  customer: BillingCustomerContext,
  input: {
    taskId: string;
    keywordId: string;
    keyword: string;
    targetDomain: string;
  },
) {
  // Collection is free. The transport resolves the persisted task reference,
  // and workflow scopes retain the configuration captured when work started.
  return executeProviderOperation(customer, "serp.rankTaskGet", async () => {
    const outcome = rankTaskOutcomeSchema.parse(
      await fetchRankCheckTaskResult(input),
    );
    return outcome.status === "failed"
      ? { ...outcome, message: "UPSTREAM_UNAVAILABLE" }
      : outcome;
  });
}
