import { beforeEach, expect, it, vi } from "vitest";
import { fetchBacklinksOverview, fetchBacklinksPage } from "./backlinks";

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  history: vi.fn(),
  rows: vi.fn(),
  execution: vi.fn(),
}));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: mocks.execution,
}));
vi.mock("@/server/lib/dataforseo", async () => ({
  ...(await import("@/server/lib/dataforseoBacklinksTarget")),
  createDataforseoClient: () => ({
    backlinks: {
      summary: mocks.summary,
      history: mocks.history,
      rows: mocks.rows,
    },
  }),
}));
const customer = {
  organizationId: "organization",
  userId: "user",
  userEmail: "user@example.com",
};
beforeEach(() => {
  mocks.execution.mockResolvedValue({
    organizationId: customer.organizationId,
    provider: "dataforseo",
    revision: 3,
    credentialVersion: null,
    source: "environment",
    authorization: "server-only",
  });
  mocks.summary.mockResolvedValue({ backlinks: 0, private_payload: "raw" });
  mocks.history.mockResolvedValue([]);
});

it("declares backlink metric identity and keeps unavailable page history and scores distinct from measured zero", async () => {
  const result = await fetchBacklinksOverview(customer, {
    target: "https://example.com/post",
    scope: "exact_url",
  });
  expect(result).toMatchObject({
    ok: true,
    data: {
      overview: {
        scope: "exact_url",
        summary: { backlinks: 0, rank: null },
        trends: [],
      },
    },
    meta: {
      scope: { researchScope: "exact_url" },
      metricDefinitions: { rank: "dataforseo_backlinks_rank_0_100" },
    },
  });
  expect(result.meta.warnings).toHaveLength(1);
  expect(mocks.history).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/private_payload|server-only/);
});

it("reports unverified backlinks as unavailable without returning a fabricated empty page or calling the vendor", async () => {
  mocks.execution.mockResolvedValueOnce({ provider: "treg", revision: 4 });
  const result = await fetchBacklinksPage(customer, {
    target: "example.com",
    page: 1,
    pageSize: 10,
    sortField: "rank",
    sortOrder: "desc",
    filters: {},
    mode: "as_is",
  });
  expect(result).toMatchObject({ ok: false, error: { code: "UNSUPPORTED" } });
  expect(result).not.toHaveProperty("data");
  expect(mocks.rows).not.toHaveBeenCalled();
});
