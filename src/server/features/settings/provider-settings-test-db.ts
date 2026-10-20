import { readFileSync } from "node:fs";
// Default: in-memory SQLite. Opt-in Postgres uses an already migrated disposable
// database; never point this suite at an application database.
export const { client, testDb, databaseProvider } = await (async () => {
  const url = process.env.PROVIDER_TEST_POSTGRES_URL;
  if (url) {
    const target = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.pathname !== "/openseo_provider_test"
    )
      throw new Error("Provider tests require a local disposable database");
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const connection = postgres(url, { max: 2 });
    return {
      databaseProvider: "postgres",
      testDb: drizzle(connection),
      client: {
        execute: async (query: string) => ({
          rows: [...(await connection.unsafe(query))],
        }),
        executeMultiple: async (query: string) => {
          await connection.unsafe(query);
        },
        close: () => connection.end(),
      },
    };
  }
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const sqliteClient = createClient({ url: "file::memory:" });
  return {
    client: sqliteClient,
    testDb: drizzle(sqliteClient),
    databaseProvider: "d1",
  };
})();

export async function prepareDatabase() {
  if (databaseProvider === "postgres") {
    await client.executeMultiple(
      "INSERT INTO organization (id, name, slug, created_at) VALUES ('org-a', 'Provider test A', 'provider-test-a', NOW()), ('org-b', 'Provider test B', 'provider-test-b', NOW()) ON CONFLICT (id) DO NOTHING",
    );
    return;
  }
  await client.executeMultiple(
    "PRAGMA foreign_keys = ON; CREATE TABLE organization (id TEXT PRIMARY KEY); INSERT INTO organization VALUES ('org-a'), ('org-b');",
  );
  await client.executeMultiple(
    readFileSync("drizzle/sqlite/0056_absurd_steve_rogers.sql", "utf8"),
  );
}
