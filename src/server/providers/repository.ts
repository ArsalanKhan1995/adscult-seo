import { and, desc, eq, lt, or, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  seoProviderSettings as settings,
  seoProviderConfigurations as configurations,
  seoProviderTests as tests,
  seoProviderAuditEvents as audit,
  seoProviderTasks as tasks,
} from "@/db/schema";
import { AppError } from "@/server/lib/errors";

type Configuration = typeof configurations.$inferInsert;

export const ProviderRepository = {
  async settings(organizationId: string) {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.organizationId, organizationId));
    return row;
  },
  async ensureSettings(organizationId: string) {
    await db.insert(settings).values({ organizationId }).onConflictDoNothing();
  },
  async configuration(organizationId: string, id: string) {
    const [row] = await db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.organizationId, organizationId),
          eq(configurations.id, id),
        ),
      );
    return row;
  },
  async history(organizationId: string) {
    return db
      .select({
        id: configurations.id,
        provider: configurations.provider,
        credentialSource: configurations.credentialSource,
        createdAt: configurations.createdAt,
      })
      .from(configurations)
      .where(eq(configurations.organizationId, organizationId))
      .orderBy(desc(configurations.createdAt))
      .limit(20);
  },
  async saveCandidate(input: Configuration) {
    await runBatch((tx) => [
      tx.insert(configurations).values(input),
      tx.insert(audit).values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        actor: input.createdBy,
        configurationId: input.id,
        revision: 0,
        action: "save_candidate",
        outcome: "saved",
        createdAt: input.createdAt,
      }),
    ]);
  },
  async latestTest(organizationId: string, configurationId: string) {
    const [row] = await db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.organizationId, organizationId),
          eq(tests.configurationId, configurationId),
        ),
      )
      .orderBy(desc(tests.testedAt))
      .limit(1);
    return row;
  },
  async recordTest(input: typeof tests.$inferInsert, actor: string) {
    await runBatch((tx) => [
      tx.insert(tests).values(input),
      tx.insert(audit).values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        actor,
        configurationId: input.configurationId,
        revision: 0,
        action: "test_candidate",
        outcome: input.outcome,
        createdAt: input.testedAt,
      }),
    ]);
  },
  async rateLimit(
    organizationId: string,
    milliseconds: number,
    kind: "write" | "test" = "write",
  ) {
    await this.ensureSettings(organizationId);
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - milliseconds).toISOString();
    const column =
      kind === "test" ? settings.lastTestAt : settings.lastActionAt;
    const rows = await db
      .update(settings)
      .set(kind === "test" ? { lastTestAt: now } : { lastActionAt: now })
      .where(
        and(
          eq(settings.organizationId, organizationId),
          or(isNull(column), lt(column, cutoff)),
        ),
      )
      .returning({ id: settings.organizationId });
    if (rows.length === 0) throw new AppError("RATE_LIMITED");
  },
  async activate(input: {
    organizationId: string;
    actor: string;
    configurationId: string | null;
    previousConfigurationId: string | null;
    expectedRevision: number;
  }) {
    const mutationId = crypto.randomUUID();
    const now = new Date().toISOString();
    // The audit INSERT is conditional on this exact CAS winning. runBatch is
    // atomic on D1 and Postgres; no separate unguarded audit or lost updates.
    await runBatch((tx) => [
      tx
        .update(settings)
        .set({
          activeConfigurationId: input.configurationId,
          revision: input.expectedRevision + 1,
          mutationId,
          updatedAt: now,
          updatedBy: input.actor,
        })
        .where(
          and(
            eq(settings.organizationId, input.organizationId),
            eq(settings.revision, input.expectedRevision),
          ),
        ),
      tx.insert(audit).select(
        tx
          .select({
            id: sql<string>`${mutationId}`.as("id"),
            organizationId: settings.organizationId,
            actor: sql<string>`${input.actor}`.as("actor"),
            configurationId: sql<string | null>`${input.configurationId}`.as(
              "configuration_id",
            ),
            previousConfigurationId: sql<
              string | null
            >`${input.previousConfigurationId}`.as("previous_configuration_id"),
            revision: settings.revision,
            action:
              sql<string>`${input.configurationId ? "activate" : "use_environment"}`.as(
                "action",
              ),
            outcome: sql<string>`'activated'`.as("outcome"),
            createdAt: sql<string>`${now}`.as("created_at"),
          })
          .from(settings)
          .where(
            and(
              eq(settings.organizationId, input.organizationId),
              eq(settings.mutationId, mutationId),
            ),
          ),
      ),
    ]);
    const [event] = await db
      .select({ id: audit.id })
      .from(audit)
      .where(
        and(
          eq(audit.id, mutationId),
          eq(audit.organizationId, input.organizationId),
        ),
      );
    if (!event) throw new AppError("CONFLICT");
  },
  async task(organizationId: string, upstreamTaskId: string) {
    const [row] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          eq(tasks.upstreamTaskId, upstreamTaskId),
        ),
      );
    return row;
  },
  async internalTask(upstreamTaskId: string) {
    const [row] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.upstreamTaskId, upstreamTaskId));
    return row;
  },
  async saveTasks(rows: Array<typeof tasks.$inferInsert>) {
    // Keep comfortably below D1's parameter ceiling.
    for (const row of rows)
      await db.insert(tasks).values(row).onConflictDoNothing();
  },
};
