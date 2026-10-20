import { AsyncLocalStorage } from "node:async_hooks";
import type {
  ProviderExecution,
  ProviderExecutionReference,
} from "@/server/providers/types";

interface ProviderScope {
  organizationId: string;
  execution?: Promise<ProviderExecution>;
  reference?: ProviderExecutionReference;
}

export function withProviderExecution<T>(
  execution: ProviderExecution,
  work: () => T,
): T {
  return scope.run(
    {
      organizationId: execution.organizationId,
      execution: Promise.resolve(execution),
    },
    work,
  );
}

export function withProviderReference<T>(
  reference: ProviderExecutionReference,
  work: () => T,
): T {
  return scope.run(
    { organizationId: reference.organizationId, reference },
    work,
  );
}

// Workflow callbacks run in independent execution contexts. Capture the scope
// at registration, then re-enter it inside each replayed step callback.
export function bindProviderScope<T>(work: () => T): () => T {
  const current = scope.getStore();
  return current ? () => scope.run(current, work) : work;
}

const scope = new AsyncLocalStorage<ProviderScope>();

export function withProviderScope<T>(organizationId: string, work: () => T): T {
  if (scope.getStore()?.organizationId === organizationId) return work();
  return scope.run({ organizationId }, work);
}

export async function getScopedProviderExecution(): Promise<
  ProviderExecution | undefined
> {
  const current = scope.getStore();
  if (!current) return undefined; // Existing server-side CLI environment mode.
  current.execution ??= import("@/server/providers/resolver").then(
    ({ resolveProviderExecution }) =>
      resolveProviderExecution(
        current.organizationId,
        current.reference?.credentialVersion,
        current.reference?.revision,
        current.reference?.provider,
      ),
  );
  return current.execution;
}
