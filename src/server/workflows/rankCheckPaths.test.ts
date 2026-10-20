import { AppError } from "@/server/lib/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import type { RankCheckTaskInput } from "@/server/providers/contracts/rank-check";
import {
  withProviderScope,
  getScopedProviderExecution,
} from "@/server/providers/context";
import { runLiveCheck, runQueuedCheck } from "./rankCheckPaths";
import { resolveProviderExecution } from "@/server/providers/resolver";

const mocks = vi.hoisted(() => ({
  getSnapshotsForRun: vi.fn(),
  insertSnapshots: vi.fn(),
  updateRun: vi.fn(),
  setRunErrorIfEmpty: vi.fn(),
  fetchRankCheckTaskResult: vi.fn(),
  rankCheckBatch: vi.fn(),
  rankCheckTaskPost: vi.fn(),
}));

vi.mock(
  "@/server/features/rank-tracking/repositories/RankTrackingRepository",
  () => ({ RankTrackingRepository: mocks }),
);
vi.mock("@/server/lib/dataforseo", () => ({
  fetchRankCheckTaskResult: mocks.fetchRankCheckTaskResult,
  createDataforseoClient: () => ({
    serp: {
      rankCheckBatch: mocks.rankCheckBatch,
      rankCheckTaskPost: mocks.rankCheckTaskPost,
    },
  }),
}));
vi.mock("@/server/providers/resolver", () => ({
  resolveProviderExecution: vi.fn(),
}));
vi.mock("@/server/workflows/pgStep", () => ({
  pgStep: (
    _step: unknown,
    _name: string,
    _config: unknown,
    fn: () => unknown,
  ) => fn(),
}));

const keywords = Array.from({ length: 11 }, (_, index) => ({
  id: `kw_${index}`,
  keyword: `keyword ${index}`,
}));

function runManualCheck() {
  // The real workflow resolves and pins its provider before parallel steps.
  return withProviderScope("org", async () => {
    await getScopedProviderExecution();
    return runLiveCheck(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only sleep is reached; pgStep is mocked
      { sleep: vi.fn() } as unknown as WorkflowStep,
      makeCheckContext(),
    );
  });
}

function makeCheckContext() {
  return {
    billingCustomer: {
      organizationId: "org",
      userId: "user",
      userEmail: "user@example.com",
    },
    keywords,
    devices: "desktop" as const,
    serpDepth: 10,
    domain: "openseo.so",
    locationCode: 2840,
    languageCode: "en",
    runId: "run_1",
  };
}

describe("runLiveCheck", () => {
  beforeEach(() => {
    vi.mocked(resolveProviderExecution).mockImplementation(
      async (organizationId: string) => ({
        organizationId,
        provider: "dataforseo",
        revision: 0,
        credentialVersion: null,
        source: "environment",
        authorization: "test-credentials",
      }),
    );
    mocks.setRunErrorIfEmpty.mockResolvedValue(undefined);
    mocks.rankCheckBatch.mockImplementation(
      async (inputs: RankCheckTaskInput[]) =>
        inputs.map((input) => ({
          status: "fulfilled",
          value: { ...input, position: 3, url: null, serpFeatures: [] },
        })),
    );
    mocks.rankCheckTaskPost.mockImplementation(
      async ({ tasks }: { tasks: RankCheckTaskInput[] }) =>
        tasks.map((task) => ({ ...task, taskId: `task_${task.keywordId}` })),
    );
    mocks.fetchRankCheckTaskResult.mockImplementation(
      async (task: RankCheckTaskInput) => ({
        status: "completed",
        result: { ...task, position: 5, url: null, serpFeatures: [] },
      }),
    );
  });

  it.each([
    new AppError("SEO_PROVIDER_CONFIGURATION_UNAVAILABLE"),
    new AppError("SEO_PROVIDER_TIMEOUT"),
    new AppError("UPSTREAM_UNAVAILABLE"),
    new TypeError("fetch failed"),
    new SyntaxError("Unexpected end of JSON input"),
  ])(
    "does not buy another result after an uncertain queued submission: %s",
    async (error) => {
      mocks.rankCheckTaskPost.mockRejectedValueOnce(error);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only sleep is used; pgStep is mocked
      const step = { sleep: vi.fn() } as unknown as WorkflowStep;
      const result = await runQueuedCheck(step, makeCheckContext());
      expect(result).toMatchObject({ queueTasks: 0, fallbackTasks: 0 });
      expect(mocks.rankCheckBatch).not.toHaveBeenCalled();
      expect(mocks.fetchRankCheckTaskResult).not.toHaveBeenCalled();
    },
  );

  it("keeps going after a failed live batch and queues only the missing pairs", async () => {
    // The first batch step dies after its calls; the second batch saves kw_10.
    mocks.insertSnapshots.mockRejectedValueOnce(new Error("step timed out"));
    mocks.getSnapshotsForRun.mockResolvedValue([
      { trackingKeywordId: "kw_10", device: "desktop" },
    ]);

    const stats = await runManualCheck();

    expect(mocks.rankCheckBatch).toHaveBeenCalledTimes(2);
    expect(mocks.rankCheckTaskPost).toHaveBeenCalledOnce();
    expect(mocks.rankCheckTaskPost).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: keywords
          .slice(0, 10)
          .map((kw): unknown => expect.objectContaining({ keywordId: kw.id })),
      }),
    );
    expect(stats).toMatchObject({ queueTasks: 10, queueCollected: 10 });
  });

  it("makes no second live call when a queued retry fails", async () => {
    mocks.getSnapshotsForRun.mockResolvedValue([]);
    mocks.fetchRankCheckTaskResult.mockResolvedValue({
      status: "failed",
      message: "Internal SE Server Error.",
    });

    const stats = await runManualCheck();

    // Two live batches, then no live fallback for the failed queue tasks:
    // that call could exceed the credits the user approved.
    expect(mocks.rankCheckBatch).toHaveBeenCalledTimes(2);
    expect(stats).toMatchObject({ queueTasks: 11, fallbackTasks: 0 });
  });

  it("leaves a pair unchecked when its queued retry doesn't find the domain", async () => {
    mocks.getSnapshotsForRun.mockResolvedValue([]);
    mocks.fetchRankCheckTaskResult.mockImplementation(
      async (task: RankCheckTaskInput) => ({
        status: "completed",
        result: {
          ...task,
          position: task.keywordId === "kw_0" ? null : 5,
          url: null,
          serpFeatures: [],
        },
      }),
    );

    await runManualCheck();

    // The queue round saves every pair except kw_0's not-found.
    expect(mocks.insertSnapshots).toHaveBeenLastCalledWith(
      keywords
        .slice(1)
        .map((kw): unknown =>
          expect.objectContaining({ trackingKeywordId: kw.id, position: 5 }),
        ),
    );
  });

  it("skips the queue when the live endpoint checked every pair", async () => {
    mocks.getSnapshotsForRun.mockResolvedValue(
      keywords.map((kw) => ({ trackingKeywordId: kw.id, device: "desktop" })),
    );

    expect(await runManualCheck()).toBeNull();
    expect(mocks.rankCheckTaskPost).not.toHaveBeenCalled();
  });
});
