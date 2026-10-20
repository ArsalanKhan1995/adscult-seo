import { beforeEach, expect, it, vi } from "vitest";
import {
  fetchDomainOverview,
  fetchDomainKeywords,
  fetchDomainPages,
} from "./domain";

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  keywords: vi.fn(),
  pages: vi.fn(),
  execution: vi.fn(),
}));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: mocks.execution,
}));
vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({
    domain: {
      rankOverview: mocks.overview,
      rankedKeywords: mocks.keywords,
      relevantPages: mocks.pages,
    },
  }),
}));
const customer = {
  organizationId: "organization",
  userId: "user",
  userEmail: "user@example.com",
};
const market = {
  domain: "example.com/blog",
  scope: "subfolder",
  locationCode: 2840,
  languageCode: "en",
} as const;
const page = {
  ...market,
  offset: 0,
  limit: 2,
  sortMode: "traffic",
  sortOrder: "desc",
  filters: {},
} as const;
beforeEach(() => {
  mocks.execution.mockResolvedValue({
    organizationId: customer.organizationId,
    provider: "dataforseo",
    revision: 3,
    credentialVersion: null,
    source: "environment",
    authorization: "server-only",
  });
  mocks.overview.mockResolvedValue([]);
  mocks.keywords.mockResolvedValue({ items: [], totalCount: null });
  mocks.pages.mockResolvedValue({ items: [], totalCount: null });
});

it("keeps measured zero traffic distinct from unknown keywords and declares overview scope", async () => {
  mocks.overview.mockResolvedValue([{ metrics: { organic: { etv: 0 } } }]);
  const result = await fetchDomainOverview(customer, market);
  expect(result).toMatchObject({
    ok: true,
    data: {
      organicTraffic: 0,
      organicKeywords: null,
      scope: {
        metricScope: "subdomains",
        researchScope: "subfolder",
        trafficUnit: "estimated_monthly_visits",
      },
    },
    meta: { provider: "dataforseo", settingsRevision: 3 },
  });
  expect(result.meta.warnings).toHaveLength(1);
});

it.each([
  ["organic", 2],
  ["paid", null],
] as const)(
  "keeps %s group position separate from absolute rank and pages by received rows",
  async (type, organicPosition) => {
    mocks.keywords.mockResolvedValue({
      items: [
        {
          keyword_data: {
            keyword: "coffee",
            keyword_info: { search_volume: 0 },
          },
          ranked_serp_element: {
            serp_item: { rank_absolute: 4, rank_group: 2, type },
          },
        },
      ],
      totalCount: null,
      receivedCount: 2, // One upstream row was rejected by the section parser.
    });
    const result = await fetchDomainKeywords(customer, page);
    expect(result).toMatchObject({
      ok: true,
      data: {
        items: [
          {
            keyword: "coffee",
            position: 4,
            absolutePosition: 4,
            organicPosition,
            resultType: type,
            searchVolume: 0,
          },
        ],
        receivedCount: 2,
        totalCount: null,
        hasMore: true,
      },
    });
    expect(result.meta.warnings).toHaveLength(1);
  },
);

it("returns malformed page measurements as a typed failure rather than exposing raw fields", async () => {
  mocks.pages.mockResolvedValue({
    items: [
      {
        page_address: "https://example.com/blog/a",
        metrics: { organic: { etv: "invalid" } },
        private_payload: "raw",
      },
    ],
    totalCount: 1,
  });
  const result = await fetchDomainPages(customer, page);
  expect(result).toMatchObject({
    ok: false,
    error: { code: "INVALID_RESPONSE", retryable: false },
  });
  expect(JSON.stringify(result)).not.toMatch(/private_payload|server-only/);
});
