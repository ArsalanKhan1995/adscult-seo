import { AppError } from "@/server/lib/errors";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  executeProviderOperation,
  executeProviderReadOperation,
} from "./operation";
import { withProviderScope } from "./context";
import {
  resolveLatestLlmModelName,
  type LlmResponseModelSlug,
} from "@/server/lib/dataforseo/llm-models";
import { buildLlmTarget } from "@/server/lib/dataforseo";
import {
  llmMentionItemSchema,
  llmAggregatedTotalSchema,
  llmTopPagesItemSchema,
  llmCrossAggregatedItemSchema,
  llmResponseResultSchema,
  type AiResearchTarget,
} from "./contracts/ai-research";
import { z } from "zod";
import type { LlmTarget } from "@/server/lib/dataforseo/shared";

function vendorTarget(input: AiResearchTarget): LlmTarget {
  if (input.type === "keyword" && input.searchScope)
    return {
      keyword: input.value,
      search_scope: input.searchScope,
      match_type: input.matchType ?? "word_match",
    };
  return buildLlmTarget(input);
}

export function fetchAiModelName(
  customer: BillingCustomerContext,
  model: LlmResponseModelSlug,
) {
  return withProviderScope(customer.organizationId, () =>
    executeProviderReadOperation("ai.response", async () => ({
      modelName: await resolveLatestLlmModelName(model),
    })),
  );
}

interface ResearchMarket {
  platform: "chat_gpt" | "google";
  locationCode: number;
  languageCode: string;
}
function assertMarket(input: ResearchMarket) {
  if (
    input.platform === "chat_gpt" &&
    (input.locationCode !== 2840 || input.languageCode !== "en")
  ) {
    throw new AppError("VALIDATION_ERROR");
  }
}
function scope(input: ResearchMarket) {
  return {
    platform: input.platform,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    volumeMeaning: "estimated_prompt_demand_from_google_search_data",
    period: "monthly",
    metricSource: "dataforseo_llm_mentions",
  };
}

export function fetchAiMentions(
  customer: BillingCustomerContext,
  input: ResearchMarket & {
    target: AiResearchTarget;
    limit?: number;
    orderBy?: string[];
  },
) {
  return executeProviderOperation(customer, "ai.mentions", async (client) => {
    assertMarket(input);
    const rows = z.array(llmMentionItemSchema).parse(
      await client.aiSearch.mentionsSearch({
        ...input,
        target: vendorTarget(input.target),
      }),
    );
    return {
      rows,
      scope: scope(input),
      pagination: {
        limit: input.limit ?? 100,
        returnedCount: rows.length,
        totalCount: null,
      },
    };
  });
}
export function fetchAiMetrics(
  customer: BillingCustomerContext,
  input: ResearchMarket & {
    target: AiResearchTarget;
    internalListLimit?: number;
  },
) {
  return executeProviderOperation(customer, "ai.metrics", async (client) => {
    assertMarket(input);
    return {
      metrics: llmAggregatedTotalSchema.parse(
        await client.aiSearch.aggregatedMetrics({
          ...input,
          target: vendorTarget(input.target),
        }),
      ),
      scope: scope(input),
    };
  });
}
export function fetchAiPages(
  customer: BillingCustomerContext,
  input: ResearchMarket & {
    target: AiResearchTarget;
    itemsListLimit?: number;
  },
) {
  return executeProviderOperation(customer, "ai.pages", async (client) => {
    assertMarket(input);
    return {
      rows: z.array(llmTopPagesItemSchema).parse(
        await client.aiSearch.topPages({
          ...input,
          target: vendorTarget(input.target),
        }),
      ),
      scope: scope(input),
    };
  });
}
export function fetchAiCrossMetrics(
  customer: BillingCustomerContext,
  input: ResearchMarket & {
    groups: Array<{ key: string; target: AiResearchTarget }>;
    internalListLimit?: number;
  },
) {
  return executeProviderOperation(
    customer,
    "ai.crossMetrics",
    async (client) => {
      assertMarket(input);
      return {
        rows: z.array(llmCrossAggregatedItemSchema).parse(
          await client.aiSearch.crossAggregatedMetrics({
            ...input,
            groups: input.groups.map((group) => ({
              ...group,
              target: vendorTarget(group.target),
            })),
          }),
        ),
        scope: scope(input),
      };
    },
  );
}
export function fetchAiResponse(
  customer: BillingCustomerContext,
  input: {
    modelSlug: "chat_gpt" | "claude" | "gemini" | "perplexity";
    modelName: string;
    userPrompt: string;
    webSearch?: boolean;
    webSearchCountryCode?: string;
    maxOutputTokens?: number;
  },
) {
  return executeProviderOperation(customer, "ai.response", async (client) => ({
    response: llmResponseResultSchema.parse(
      await client.aiSearch.llmResponse(input),
    ),
    scope: {
      model: input.modelSlug,
      modelName: input.modelName,
      countryCode: input.webSearchCountryCode ?? null,
      language: "prompt_defined",
    },
  }));
}
