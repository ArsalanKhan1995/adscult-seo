CREATE TABLE "seo_provider_result_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"upstream_vendor" text NOT NULL,
	"operation" text NOT NULL,
	"configuration_id" text,
	"revision" integer NOT NULL,
	"contract_version" integer NOT NULL,
	"fetched_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keyword_metrics" ADD COLUMN "provider_result_source_id" text;--> statement-breakpoint
ALTER TABLE "rank_snapshots" ADD COLUMN "provider_result_source_id" text;--> statement-breakpoint
ALTER TABLE "audit_lighthouse_results" ADD COLUMN "provider_result_source_id" text;--> statement-breakpoint
ALTER TABLE "ai_observations" ADD COLUMN "provider_result_source_id" text;--> statement-breakpoint
ALTER TABLE "seo_provider_result_sources" ADD CONSTRAINT "seo_provider_result_sources_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_provider_result_sources" ADD CONSTRAINT "seo_provider_result_sources_configuration_id_seo_provider_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."seo_provider_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seo_provider_result_source_org_idx" ON "seo_provider_result_sources" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "keyword_metrics" ADD CONSTRAINT "keyword_metrics_provider_result_source_id_seo_provider_result_sources_id_fk" FOREIGN KEY ("provider_result_source_id") REFERENCES "public"."seo_provider_result_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_provider_result_source_id_seo_provider_result_sources_id_fk" FOREIGN KEY ("provider_result_source_id") REFERENCES "public"."seo_provider_result_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_lighthouse_results" ADD CONSTRAINT "audit_lighthouse_results_provider_result_source_id_seo_provider_result_sources_id_fk" FOREIGN KEY ("provider_result_source_id") REFERENCES "public"."seo_provider_result_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_observations" ADD CONSTRAINT "ai_observations_provider_result_source_id_seo_provider_result_sources_id_fk" FOREIGN KEY ("provider_result_source_id") REFERENCES "public"."seo_provider_result_sources"("id") ON DELETE no action ON UPDATE no action;