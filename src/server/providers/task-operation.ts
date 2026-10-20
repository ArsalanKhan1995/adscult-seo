import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import {
  getScopedProviderExecution,
  withProviderScope,
  withProviderExecution,
} from "./context";
import { resolveTaskExecution } from "./task-context";
import { executeProviderReadOperation } from "./operation";

// Resolve ownership and the original credential version before capability
// checks. A newly selected provider must not block collection of old paid tasks.
export function executeProviderTaskOperation<T>(
  customer: BillingCustomerContext,
  operation: "business.taskGet" | "serp.localTaskGet" | "ai.trackingGet",
  path: string,
  collect: () => Promise<T>,
) {
  return withProviderScope(customer.organizationId, async () => {
    const execution = await resolveTaskExecution(
      path,
      await getScopedProviderExecution(),
    );
    if (!execution) throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
    return withProviderExecution(execution, () =>
      executeProviderReadOperation(operation, collect),
    );
  });
}
