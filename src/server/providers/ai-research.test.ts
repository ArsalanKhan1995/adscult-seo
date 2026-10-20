import { expect, it, vi } from "vitest";
import { fetchAiMentions } from "./ai-research";

const mocks = vi.hoisted(() => ({ mentions: vi.fn() }));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: async (organizationId: string) => ({
    organizationId,
    provider: "dataforseo",
    revision: 4,
    credentialVersion: null,
    source: "environment",
    authorization: "private-secret",
  }),
}));
vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({
    aiSearch: { mentionsSearch: mocks.mentions },
  }),
}));
const customer = {
  organizationId: "org",
  userId: "user",
  userEmail: "user@example.com",
};
const request = {
  platform: "chat_gpt" as const,
  locationCode: 2840,
  languageCode: "en",
  target: {
    type: "keyword" as const,
    value: "coffee",
    searchScope: ["question", "answer"],
  },
};

it("preserves measured AI demand and unknown demand while stripping nested vendor fields", async () => {
  mocks.mentions.mockResolvedValueOnce([
    {
      question: "Coffee?",
      ai_search_volume: 0,
      sources: [{ url: "https://example.com", privatePayload: "raw" }],
      privatePayload: "raw",
    },
    { question: "Tea?", ai_search_volume: null },
  ]);
  const result = await fetchAiMentions(customer, request);
  expect(result).toMatchObject({
    ok: true,
    data: {
      rows: [{ ai_search_volume: 0 }, { ai_search_volume: null }],
      scope: {
        locationCode: 2840,
        languageCode: "en",
        volumeMeaning: "estimated_prompt_demand_from_google_search_data",
        period: "monthly",
      },
      pagination: { returnedCount: 2, totalCount: null },
    },
  });
  expect(JSON.stringify(result)).not.toMatch(/privatePayload|private-secret/);
});

it("rejects an unsupported ChatGPT research market before a paid request", async () => {
  const result = await fetchAiMentions(customer, {
    ...request,
    locationCode: 2826,
  });
  expect(result).toMatchObject({
    ok: false,
    error: { code: "INVALID_REQUEST" },
  });
  expect(mocks.mentions).not.toHaveBeenCalled();
});
