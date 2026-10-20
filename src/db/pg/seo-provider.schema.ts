import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { organization } from "./better-auth-schema";

// Immutable versions retain encrypted credentials for rollback and queued work.
export const seoProviderConfigurations = pgTable(
  "seo_provider_configurations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    selectionSource: text("selection_source").notNull().default("explicit"),
    credentialSource: text("credential_source").notNull(),
    encryptedCredentials: text("encrypted_credentials"),
    keyVersion: text("key_version"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("seo_provider_config_org_idx").on(t.organizationId)],
);

export const seoProviderSettings = pgTable("seo_provider_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  activeConfigurationId: text("active_configuration_id").references(
    () => seoProviderConfigurations.id,
    { onDelete: "no action" },
  ),
  revision: integer("revision").notNull().default(0),
  mutationId: text("mutation_id"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at"),
  lastActionAt: text("last_action_at"),
  lastTestAt: text("last_test_at"),
});

export const seoProviderTests = pgTable(
  "seo_provider_tests",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    configurationId: text("configuration_id")
      .notNull()
      .references(() => seoProviderConfigurations.id, {
        onDelete: "no action",
      }),
    credentialDigest: text("credential_digest").notNull(),
    outcome: text("outcome").notNull(),
    testedAt: text("tested_at").notNull(),
  },
  (t) => [index("seo_provider_test_config_idx").on(t.configurationId)],
);

export const seoProviderAuditEvents = pgTable(
  "seo_provider_audit_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    configurationId: text("configuration_id").references(
      () => seoProviderConfigurations.id,
      { onDelete: "no action" },
    ),
    previousConfigurationId: text("previous_configuration_id").references(
      () => seoProviderConfigurations.id,
      { onDelete: "no action" },
    ),
    revision: integer("revision").notNull(),
    action: text("action").notNull(),
    outcome: text("outcome").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("seo_provider_audit_org_idx").on(t.organizationId)],
);

export const seoProviderTasks = pgTable(
  "seo_provider_tasks",
  {
    upstreamTaskId: text("upstream_task_id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    configurationId: text("configuration_id").references(
      () => seoProviderConfigurations.id,
      { onDelete: "no action" },
    ),
    revision: integer("revision").notNull(),
    operation: text("operation").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("seo_provider_task_org_idx").on(t.organizationId)],
);

// Immutable provenance shared by results produced in the same execution.
// Historical and client-supplied metrics have no source reference.
export const seoProviderResultSources = pgTable(
  "seo_provider_result_sources",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    upstreamVendor: text("upstream_vendor").notNull(),
    operation: text("operation").notNull(),
    configurationId: text("configuration_id").references(
      () => seoProviderConfigurations.id,
      { onDelete: "no action" },
    ),
    revision: integer("revision").notNull(),
    contractVersion: integer("contract_version").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [index("seo_provider_result_source_org_idx").on(t.organizationId)],
);
