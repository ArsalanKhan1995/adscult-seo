import { z } from "zod";
import type {
  ProviderExecution,
  ProviderResult,
  ProviderTransportAdapter,
} from "@/server/providers/types";
import { providerOperations } from "@/server/providers/types";
import { AppError } from "@/server/lib/errors";

// Account authentication is free. SEO operations remain gated on their own
// contracts, live normalization and billing verification; never guess routes.
export const tregAdapter: ProviderTransportAdapter = {
  id: "treg",
  capabilities: () =>
    providerOperations.map(({ operation, label }) => ({
      operation,
      label,
      state: "unverified",
    })),
  testConnection,
  request() {
    return Promise.reject(new AppError("SEO_PROVIDER_UNSUPPORTED"));
  },
};

const accountSchema = z.object({
  org_id: z.number().int().positive(),
  org: z.string().min(1),
});

async function testConnection(
  execution: ProviderExecution,
): Promise<ProviderResult<{ authenticated: boolean }>> {
  const meta = {
    provider: execution.provider,
    upstreamVendor: "treg",
    operation: "connection.test",
    settingsRevision: execution.revision,
    fetchedAt: new Date().toISOString(),
    warnings: [
      "Account authentication does not verify SEO operations. Live operation and billing checks are still required before activation.",
    ],
  };
  type FailureCode = Extract<
    ProviderResult<never>,
    { ok: false }
  >["error"]["code"];
  const failure = (
    code: FailureCode,
  ): ProviderResult<{ authenticated: boolean }> => ({
    ok: false,
    error: {
      code,
      message: code,
      retryable: ["RATE_LIMITED", "TIMEOUT", "UPSTREAM_ERROR"].includes(code),
    },
    meta,
  });
  if (execution.provider !== "treg") return failure("UNSUPPORTED");
  try {
    // Same free account read as the official CLI's whoami; no /call request,
    // redirects, automatic retries, account details or balances in the result.
    const response = await fetch("https://treg.to/auth/me", {
      method: "GET",
      headers: { "X-Treg-Token": execution.authorization },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if ([401, 403].includes(response.status)) return failure("AUTH_FAILED");
    if (response.status === 429) return failure("RATE_LIMITED");
    if (!response.ok) return failure("UPSTREAM_ERROR");
    if (!accountSchema.safeParse(await response.json()).success)
      return failure("INVALID_RESPONSE");
    return { ok: true, data: { authenticated: true }, meta };
  } catch (error) {
    if (error instanceof SyntaxError) return failure("INVALID_RESPONSE");
    if (
      error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name)
    )
      return failure("TIMEOUT");
    return failure("UPSTREAM_ERROR");
  }
}
