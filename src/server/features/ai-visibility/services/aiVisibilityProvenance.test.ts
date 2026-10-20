import { afterAll, expect, it, vi } from "vitest";
import {
  seoProviderConfigurations,
  seoProviderSettings,
  seoProviderResultSources,
} from "@/db/schema";
import { withProviderReference } from "@/server/providers/context";
import { AiVisibilityRepository as repo } from "../repositories/AiVisibilityRepository";
import { collectAiLiveBatch } from "./aiVisibilityCollection";
import { configuration, customer } from "./aiVisibilityTestFixtures";

const { testDb, trackingLiveBatch } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } = await import("../aiVisibilityTestDb");
  return {
    testDb: await createAiVisibilityTestDb(),
    trackingLiveBatch: vi.fn(),
  };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => false,
  getOptionalEnvValue: async (key: string) =>
    key === "DATAFORSEO_API_KEY" ? btoa("test:password") : undefined,
}));
vi.mock("@/server/lib/dataforseo", () => ({
  MAX_TASKS_PER_POST: 100,
  createDataforseoClient: () => ({ aiSearch: { trackingLiveBatch } }),
}));
afterAll(() => testDb.client.close());

const runId = "run";
const market = { locationCode: 2840, languageCode: "en" };
const pendingTask = {
  tag: "answer-0",
  taskId: "task",
  engine: "chatgpt",
  prompt: "Which SEO tools?",
  attempts: 1,
} as const;
const liveAnswer = {
  status: "fulfilled",
  value: { status: "completed", result: { markdown: "OpenSEO", sources: [] } },
} as const;

it("keeps an answer's original configuration after a workflow resumes across a switch", async () => {
  await testDb.seedProject();
  const rows = configuration({
    engines: ["chatgpt"],
    prompts: [{ text: "Which SEO tools?" }],
  });
  await repo.saveConfiguration(rows);
  await repo.createRun(
    {
      id: runId,
      trackerId: rows.tracker.id,
      projectId: "project",
      trigger: "manual",
      status: "running",
      ...market,
      createdAt: "2026-10-20T00:00:00.000Z",
    },
    [
      {
        id: "answer-0",
        runId,
        promptId: rows.prompts[0].id,
        engine: "chatgpt",
        branded: false,
      },
    ],
  );
  await testDb.db.insert(seoProviderConfigurations).values(
    ["original", "replacement"].map((id) => ({
      id,
      organizationId: "organization",
      provider: "dataforseo",
      credentialSource: "environment",
      createdBy: "user",
      createdAt: "2026-10-20T00:00:00.000Z",
    })),
  );
  await testDb.db.insert(seoProviderSettings).values({
    organizationId: "organization",
    activeConfigurationId: "replacement",
    revision: 5,
  });
  trackingLiveBatch.mockResolvedValue([liveAnswer]);
  await withProviderReference(
    {
      organizationId: "organization",
      provider: "dataforseo",
      revision: 4,
      credentialVersion: "original",
    },
    () => collectAiLiveBatch(runId, customer, market, [pendingTask]),
  );
  const answer = await repo.getObservation("answer-0");
  const [source] = await testDb.db.select().from(seoProviderResultSources);
  expect(source).toMatchObject({
    provider: "dataforseo",
    upstreamVendor: "dataforseo",
    organizationId: "organization",
    configurationId: "original",
    revision: 4,
  });
  expect(answer).toMatchObject({
    status: "completed",
    providerResultSourceId: source.id,
  });
});
