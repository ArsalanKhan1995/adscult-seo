CREATE TABLE "seo_provider_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor" text NOT NULL,
	"configuration_id" text,
	"previous_configuration_id" text,
	"revision" integer NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_provider_configurations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"selection_source" text DEFAULT 'explicit' NOT NULL,
	"credential_source" text NOT NULL,
	"encrypted_credentials" text,
	"key_version" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_provider_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"active_configuration_id" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"mutation_id" text,
	"updated_by" text,
	"updated_at" text,
	"last_action_at" text,
	"last_test_at" text
);
--> statement-breakpoint
CREATE TABLE "seo_provider_tasks" (
	"upstream_task_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"configuration_id" text,
	"revision" integer NOT NULL,
	"operation" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_provider_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"configuration_id" text NOT NULL,
	"credential_digest" text NOT NULL,
	"outcome" text NOT NULL,
	"tested_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo_provider_audit_events" ADD CONSTRAINT "seo_provider_audit_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_audit_events" ADD CONSTRAINT "seo_provider_audit_events_configuration_id_seo_provider_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."seo_provider_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_audit_events" ADD CONSTRAINT "seo_provider_audit_events_previous_configuration_id_seo_provider_configurations_id_fk" FOREIGN KEY ("previous_configuration_id") REFERENCES "public"."seo_provider_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_configurations" ADD CONSTRAINT "seo_provider_configurations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_settings" ADD CONSTRAINT "seo_provider_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_settings" ADD CONSTRAINT "seo_provider_settings_active_configuration_id_seo_provider_configurations_id_fk" FOREIGN KEY ("active_configuration_id") REFERENCES "public"."seo_provider_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_tasks" ADD CONSTRAINT "seo_provider_tasks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_tasks" ADD CONSTRAINT "seo_provider_tasks_configuration_id_seo_provider_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."seo_provider_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_tests" ADD CONSTRAINT "seo_provider_tests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_tests" ADD CONSTRAINT "seo_provider_tests_configuration_id_seo_provider_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."seo_provider_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seo_provider_audit_org_idx" ON "seo_provider_audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seo_provider_config_org_idx" ON "seo_provider_configurations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seo_provider_task_org_idx" ON "seo_provider_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seo_provider_test_config_idx" ON "seo_provider_tests" USING btree ("configuration_id");