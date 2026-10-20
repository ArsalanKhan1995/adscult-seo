import { expect, it, vi } from "vitest";
import { fetchSerp } from "./serp";

const mocks = vi.hoisted(() => ({ live: vi.fn() }));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: async (organizationId: string) => ({
    organizationId,
    provider: "dataforseo",
    revision: 7,
    credentialVersion: null,
    source: "environment",
    authorization: "private-secret",
  }),
}));
vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({ serp: { live: mocks.live } }),
}));

it("separates organic and absolute positions, preserves unknown metrics and declares the exact SERP scope", async () => {
  mocks.live.mockResolvedValueOnce([
    { type: "paid", rank_absolute: 1, rank_group: 1, privatePayload: "raw" },
    { type: "organic", rank_absolute: 3, rank_group: 1, etv: 0 },
    { type: "organic", rank_absolute: 4 },
  ]);
  const result = await fetchSerp(
    {
      organizationId: "org",
      userId: "user",
      userEmail: "user@example.com",
    },
    {
      keyword: "coffee",
      locationCode: 2840,
      languageCode: "en",
      locationName: "Austin,Texas,United States",
      device: "mobile",
      depth: 30,
    },
  );
  expect(result).toMatchObject({
    ok: true,
    data: {
      rows: [
        {
          resultType: "paid",
          absolutePosition: 1,
          organicPosition: null,
          estimatedMonthlyVisits: null,
        },
        {
          resultType: "organic",
          absolutePosition: 3,
          organicPosition: 1,
          estimatedMonthlyVisits: 0,
        },
        { resultType: "organic", absolutePosition: 4, organicPosition: null },
      ],
      scope: {
        engine: "google",
        locationCode: 2840,
        languageCode: "en",
        locationName: "Austin,Texas,United States",
        device: "mobile",
        depth: 30,
        trafficCostCurrency: "USD",
        trafficUnit: "estimated_monthly_visits",
      },
      pagination: { returnedCount: 3, totalCount: null, cursor: null },
    },
    meta: { provider: "dataforseo", settingsRevision: 7 },
  });
  expect(result.meta.warnings).toHaveLength(1);
  expect(JSON.stringify(result)).not.toMatch(/privatePayload|private-secret/);
});
