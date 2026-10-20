CREATE TABLE `seo_provider_result_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`upstream_vendor` text NOT NULL,
	`operation` text NOT NULL,
	`configuration_id` text,
	`revision` integer NOT NULL,
	`contract_version` integer NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configuration_id`) REFERENCES `seo_provider_configurations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seo_provider_result_source_org_idx` ON `seo_provider_result_sources` (`organization_id`);--> statement-breakpoint
ALTER TABLE `keyword_metrics` ADD `provider_result_source_id` text REFERENCES seo_provider_result_sources(id);--> statement-breakpoint
ALTER TABLE `rank_snapshots` ADD `provider_result_source_id` text REFERENCES seo_provider_result_sources(id);--> statement-breakpoint
ALTER TABLE `audit_lighthouse_results` ADD `provider_result_source_id` text REFERENCES seo_provider_result_sources(id);--> statement-breakpoint
ALTER TABLE `ai_observations` ADD `provider_result_source_id` text REFERENCES seo_provider_result_sources(id);