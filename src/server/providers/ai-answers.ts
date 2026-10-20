import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  fetchAiTrackingTaskResult,
  type AiTrackingAnswer,
} from "@/server/lib/dataforseo";
import { DataforseoChargedTaskError } from "@/server/lib/dataforseo/envelope";
import { AppError, asAppError } from "@/server/lib/errors";
import { aiEngineUsesModelApi, type AiEngine } from "@/shared/ai-visibility";
import {
  parseDataforseoAnswer,
  parseLlmResponseAnswer,
} from "./dataforseo/ai-evidence";
import type { AiAnswerOutcome, AiAnswerRequest } from "./contracts/ai-answer";
import { executeProviderOperation } from "./operation";
import { executeProviderTaskOperation } from "./task-operation";

function normalizeAnswer(
  outcome: AiTrackingAnswer,
  engine: AiEngine,
): AiAnswerOutcome {
  if (outcome.status === "failed") return { ...outcome, message: outcome.code };
  const answer = parseDataforseoAnswer(outcome.result, engine);
  return answer
    ? { status: "completed", answer }
    : {
        status: "failed",
        code: "INTERNAL_ERROR",
        message: "INTERNAL_ERROR",
        retryable: false,
      };
}

export function fetchAiAnswers(
  customer: BillingCustomerContext,
  inputs: AiAnswerRequest[],
) {
  return executeProviderOperation(
    customer,
    "ai.trackingLive",
    async (client, warnings) => {
      // Preserve the existing single credit hold and settlement for this batch.
      const settled = await client.aiSearch.trackingLiveBatch(inputs);
      const items = inputs.map((input, inputIndex) => {
        const entry = settled[inputIndex];
        let outcome: AiAnswerOutcome;
        if (entry?.status === "fulfilled")
          outcome = normalizeAnswer(entry.value, input.engine);
        else {
          const code = asAppError(entry?.reason)?.code ?? "INTERNAL_ERROR";
          outcome = { status: "failed", code, message: code, retryable: false };
        }
        return {
          inputIndex,
          tag: input.task.tag,
          engine: input.engine,
          outcome,
          scope: {
            locationCode: input.locationCode,
            languageCode: input.languageCode,
          },
        };
      });
      if (items.some((item) => item.outcome.status === "failed"))
        warnings.push("Some AI answers are unavailable.");
      return { items };
    },
  );
}

export function postAiTasks(
  customer: BillingCustomerContext,
  input: {
    engine: AiEngine;
    tasks: Array<{ tag: string; prompt: string }>;
    locationCode: number;
    languageCode: string;
  },
) {
  return executeProviderOperation(
    customer,
    "ai.trackingPost",
    async (client, warnings) => {
      const tasks = z
        .array(z.object({ tag: z.string(), taskId: z.string() }))
        .parse(await client.aiSearch.trackingTaskPost(input));
      if (tasks.length < input.tasks.length)
        warnings.push("Some AI tasks were not accepted.");
      return {
        tasks,
        scope: {
          engine: input.engine,
          locationCode: input.locationCode,
          languageCode: input.languageCode,
        },
      };
    },
  );
}

export function collectAiTask(
  customer: BillingCustomerContext,
  input: { engine: AiEngine; taskId: string },
) {
  const roots = {
    chatgpt: "/v3/ai_optimization/chat_gpt/llm_scraper",
    gemini: "/v3/ai_optimization/gemini/llm_scraper",
    google_ai_overview: "/v3/serp/google/organic",
  };
  if (aiEngineUsesModelApi(input.engine))
    throw new AppError("VALIDATION_ERROR");
  // Only the three scraper engines submit tasks. Model API calls are live.
  const root = roots[input.engine];
  return executeProviderTaskOperation(
    customer,
    "ai.trackingGet",
    `${root}/task_get/advanced/${encodeURIComponent(input.taskId)}`,
    async () => {
      const outcome = await fetchAiTrackingTaskResult(input);
      return outcome.status === "pending"
        ? outcome
        : normalizeAnswer(outcome, input.engine);
    },
  );
}

export function fetchAiModelAnswer(
  customer: BillingCustomerContext,
  input: {
    modelSlug: "chat_gpt" | "claude" | "gemini" | "perplexity";
    modelName: string;
    userPrompt: string;
    webSearch: boolean;
    webSearchCountryCode?: string;
    maxOutputTokens: number;
  },
) {
  return executeProviderOperation(
    customer,
    "ai.response",
    async (client): Promise<AiAnswerOutcome> => {
      try {
        const result = await client.aiSearch.llmResponse(input);
        return { status: "completed", answer: parseLlmResponseAnswer(result) };
      } catch (cause) {
        // Only a returned, settled task failure permits the existing bounded
        // workflow retry. Ambiguous timeouts/transport failures never do.
        if (
          cause instanceof DataforseoChargedTaskError &&
          cause.code === "UPSTREAM_UNAVAILABLE"
        ) {
          return {
            status: "failed",
            code: cause.code,
            message: cause.code,
            retryable: true,
          };
        }
        throw cause;
      }
    },
  );
}
