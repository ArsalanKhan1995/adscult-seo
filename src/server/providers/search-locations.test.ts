import { beforeEach, expect, it, vi } from "vitest";
import { fetchSearchLocations } from "./search-locations";
import { withProviderScope } from "./context";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, string>(),
  get: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    KV: {
      get: async (key: string): Promise<unknown> =>
        JSON.parse(mocks.cache.get(key) ?? "null"),
      put: async (key: string, value: string) => {
        mocks.cache.set(key, value);
      },
    },
  },
}));
vi.mock("@/server/lib/dataforseo/core", () => ({ dataforseoGet: mocks.get }));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: async (organizationId: string) => ({
    organizationId,
    provider: "dataforseo",
    revision: 1,
    credentialVersion: null,
    source: "environment",
    authorization: "private-secret",
  }),
}));
beforeEach(() => {
  mocks.cache.clear();
  mocks.get.mockResolvedValue({
    status_code: 20000,
    tasks: [
      {
        status_code: 20000,
        result: [
          {
            location_code: 1,
            location_name: "Austin,Texas,United States",
            location_type: "City",
          },
        ],
      },
    ],
  });
});

it("reuses a location catalog within its organization without sharing a cache fill across organizations", async () => {
  const first = await withProviderScope("org-a", () =>
    fetchSearchLocations("us"),
  );
  await withProviderScope("org-a", () => fetchSearchLocations("us"));
  await withProviderScope("org-b", () => fetchSearchLocations("us"));
  expect(mocks.get).toHaveBeenCalledTimes(2);
  expect(first).toMatchObject({
    ok: true,
    data: { locations: [{ locationName: "Austin,Texas,United States" }] },
  });
  expect(JSON.stringify(first)).not.toContain("private-secret");
});
