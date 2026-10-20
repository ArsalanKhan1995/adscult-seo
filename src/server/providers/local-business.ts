import { withProviderScope } from "./context";
import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  fetchBusinessDataTaskResult,
  fetchBusinessListingsCategories,
  fetchLocalSerpTaskResult,
} from "@/server/lib/dataforseo";
import {
  executeProviderOperation,
  executeProviderReadOperation,
} from "./operation";
import { executeProviderTaskOperation } from "./task-operation";
import {
  localBusinessRowSchema,
  businessQuestionSchema,
  businessReviewSchema,
  businessUpdateSchema,
  businessTotalsSchema,
  type BusinessLocation,
  type BusinessTaskEndpoint,
  type MapsRequest,
} from "./contracts/local-business";

export function fetchBusinessProfile(
  customer: BillingCustomerContext,
  input: BusinessLocation & { keyword: string },
) {
  return executeProviderOperation(
    customer,
    "business.info",
    async (client) => ({
      profile: localBusinessRowSchema
        .nullable()
        .parse(await client.business.myBusinessInfo(input)),
      scope: { ...input, engine: "google", ratingScale: "per_row_rating_max" },
    }),
  );
}

export function fetchBusinessListings(
  customer: BillingCustomerContext,
  input: {
    categories?: string[];
    title?: string;
    locationCoordinate: string;
    isClaimed?: boolean;
    filters?: unknown[];
    orderBy?: string[];
    limit: number;
    offset?: number;
  },
) {
  return executeProviderOperation(
    customer,
    "business.listings",
    async (client) => {
      const rows = z
        .array(localBusinessRowSchema)
        .parse(await client.business.businessListings(input));
      return {
        rows,
        scope: {
          locationCoordinate: input.locationCoordinate,
          engine: "google",
          ratingScale: "per_row_rating_max",
        },
        pagination: {
          offset: input.offset ?? 0,
          limit: input.limit,
          returnedCount: rows.length,
          totalCount: null,
        },
      };
    },
  );
}

export function fetchMapsResults(
  customer: BillingCustomerContext,
  input: MapsRequest,
) {
  return executeProviderOperation(customer, "serp.local", async (client) => ({
    rows: z.array(localBusinessRowSchema).parse(await client.serp.local(input)),
    scope: {
      ...input,
      engine: "google",
      positionSemantics: "type_group_and_absolute_positions",
      ratingScale: "per_row_rating_max",
    },
  }));
}

export function fetchBusinessQuestions(
  customer: BillingCustomerContext,
  input: {
    keyword: string;
    locationCoordinate: string;
    languageCode: string;
    depth: number;
  },
) {
  return executeProviderOperation(
    customer,
    "business.questions",
    async (client) => ({
      rows: z
        .array(businessQuestionSchema)
        .parse(await client.business.questionsAnswers(input)),
      scope: { ...input, engine: "google" },
    }),
  );
}

export function postBusinessReviews(
  customer: BillingCustomerContext,
  input: BusinessLocation & {
    keyword?: string;
    cid?: string;
    placeId?: string;
    depth: number;
    sortBy?: string;
    includeOtherSources: boolean;
  },
) {
  return executeProviderOperation(
    customer,
    "business.reviewsPost",
    async (client) => ({
      taskId: z
        .string()
        .min(1)
        .parse(await client.business.reviewsTaskPost(input)),
      scope: { ...input, engine: "google" },
    }),
  );
}

export function postBusinessUpdates(
  customer: BillingCustomerContext,
  input: BusinessLocation & { keyword: string; depth: number },
) {
  return executeProviderOperation(
    customer,
    "business.updatesPost",
    async (client) => ({
      taskId: z
        .string()
        .min(1)
        .parse(await client.business.updatesTaskPost(input)),
      scope: { ...input, engine: "google" },
    }),
  );
}

export function collectBusinessTask(
  customer: BillingCustomerContext,
  input: { endpoint: BusinessTaskEndpoint; taskId: string },
) {
  return executeProviderTaskOperation(
    customer,
    "business.taskGet",
    `/v3/business_data/google/${input.endpoint}/task_get/${encodeURIComponent(input.taskId)}`,
    async () => {
      const outcome = await fetchBusinessDataTaskResult(input);
      if (outcome.status === "pending")
        return { status: "pending" as const, result: null };
      if (!outcome.result)
        return { status: "completed" as const, result: null };
      const schema =
        input.endpoint === "my_business_updates"
          ? businessUpdateSchema
          : businessReviewSchema;
      const result = businessTotalsSchema.parse(outcome.result);
      return {
        status: "completed" as const,
        result: {
          ...result,
          items: z.array(schema).parse(outcome.result.items ?? []),
        },
      };
    },
  );
}

export function fetchBusinessCategories(customer: BillingCustomerContext) {
  return withProviderScope(customer.organizationId, () =>
    executeProviderReadOperation("business.categories", async () => ({
      rows: z
        .array(
          z.object({
            category: z.string(),
            businessCount: z.number().nonnegative().nullable(),
          }),
        )
        .parse((await fetchBusinessListingsCategories()).data),
    })),
  );
}

export function postMapsTasks(
  customer: BillingCustomerContext,
  input: {
    keyword: string;
    locationCoordinates: string[];
    languageCode: string;
    device: "desktop" | "mobile";
    depth: number;
  },
) {
  return executeProviderOperation(
    customer,
    "serp.localTaskPost",
    async (client, warnings) => {
      const taskIds = z
        .array(z.string().nullable())
        .parse(await client.serp.localTaskPost(input));
      if (taskIds.length !== input.locationCoordinates.length)
        throw new SyntaxError("Missing Maps task outcomes");
      if (taskIds.some((id) => id === null))
        warnings.push("Some Maps searches were not accepted.");
      return { taskIds, scope: { ...input, engine: "google_maps" } };
    },
  );
}

export function collectMapsTask(
  customer: BillingCustomerContext,
  taskId: string,
) {
  return executeProviderTaskOperation(
    customer,
    "serp.localTaskGet",
    `/v3/serp/google/maps/task_get/advanced/${encodeURIComponent(taskId)}`,
    async () => {
      const outcome = await fetchLocalSerpTaskResult(taskId);
      if (outcome.status === "completed")
        return {
          ...outcome,
          items: z.array(localBusinessRowSchema).parse(outcome.items),
        };
      return outcome.status === "failed"
        ? { ...outcome, message: "UPSTREAM_UNAVAILABLE" }
        : outcome;
    },
  );
}
