import { expect, it, vi } from "vitest";
import { fetchRankChecks } from "./rank-check";
import { AppError } from "@/server/lib/errors";

const mocks = vi.hoisted(() => ({ batch: vi.fn() }));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: async (organizationId: string) => ({
    organizationId,
    provider: "dataforseo",
    revision: 5,
    credentialVersion: null,
    source: "environment",
    authorization: "private-secret",
  }),
}));
vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({ serp: { rankCheckBatch: mocks.batch } }),
  fetchRankCheckTaskResult: vi.fn(),
}));

it("keeps duplicate keyword/device inputs in order with partial results and sanitized failures through one billed batch", async () => {
  mocks.batch.mockResolvedValueOnce([
    {
      status: "fulfilled",
      value: {
        keywordId: "first",
        keyword: "coffee",
        position: 2,
        url: null,
        serpFeatures: ["organic"],
      },
    },
    {
      status: "rejected",
      reason: new AppError("UPSTREAM_UNAVAILABLE", "private vendor payload"),
    },
    { status: "rejected", reason: new AppError("INSUFFICIENT_CREDITS") },
  ]);
  const result = await fetchRankChecks(
    { organizationId: "org", userId: "user", userEmail: "user@example.com" },
    [
      {
        keywordId: "first",
        keyword: "coffee",
        device: "desktop",
        locationCode: 2840,
        languageCode: "en",
        targetDomain: "example.com",
        depth: 20,
      },
      {
        keywordId: "second",
        keyword: "coffee",
        device: "mobile",
        locationCode: 2840,
        languageCode: "en",
        targetDomain: "example.com",
        depth: 20,
      },
      {
        keywordId: "third",
        keyword: "coffee",
        device: "desktop",
        locationCode: 2840,
        languageCode: "en",
        targetDomain: "example.com",
        depth: 20,
      },
    ],
  );
  expect(result).toMatchObject({
    ok: true,
    data: {
      items: [
        {
          inputIndex: 0,
          keywordId: "first",
          device: "desktop",
          result: { ok: true, data: { position: 2 } },
        },
        {
          inputIndex: 1,
          keywordId: "second",
          device: "mobile",
          result: {
            ok: false,
            error: { code: "UPSTREAM_ERROR", message: "UPSTREAM_UNAVAILABLE" },
          },
        },
        {
          inputIndex: 2,
          keywordId: "third",
          result: {
            ok: false,
            error: {
              code: "INSUFFICIENT_CREDITS",
              message: "INSUFFICIENT_CREDITS",
            },
          },
        },
      ],
    },
  });
  // The grouped metered method, rather than a per-keyword reservation, is the billing contract.
  expect(mocks.batch).toHaveBeenCalledOnce();
  expect(result.meta.warnings).toHaveLength(1);
  expect(JSON.stringify(result)).not.toMatch(
    /private vendor payload|private-secret/,
  );
});
