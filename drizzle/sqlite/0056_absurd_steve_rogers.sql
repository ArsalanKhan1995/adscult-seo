CREATE TABLE `seo_provider_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor` text NOT NULL,
	`configuration_id` text,
	`previous_configuration_id` text,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configuration_id`) REFERENCES `seo_provider_configurations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`previous_configuration_id`) REFERENCES `seo_provider_configurations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seo_provider_audit_org_idx` ON `seo_provider_audit_events` (`organization_id`);--> statement-breakpoint
CREATE TABLE `seo_provider_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`selection_source` text DEFAULT 'explicit' NOT NULL,
	`credential_source` text NOT NULL,
	`encrypted_credentials` text,
	`key_version` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seo_provider_config_org_idx` ON `seo_provider_configurations` (`organization_id`);--> statement-breakpoint
CREATE TABLE `seo_provider_settings` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`active_configuration_id` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`mutation_id` text,
	`updated_by` text,
	`updated_at` text,
	`last_action_at` text,
	`last_test_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_configuration_id`) REFERENCES `seo_provider_configurations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seo_provider_tasks` (
	`upstream_task_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`configuration_id` text,
	`revision` integer NOT NULL,
	`operation` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configuration_id`) REFERENCES `seo_provider_configurations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seo_provider_task_org_idx` ON `seo_provider_tasks` (`organization_id`);--> statement-breakpoint
CREATE TABLE `seo_provider_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`configuration_id` text NOT NULL,
	`credential_digest` text NOT NULL,
	`outcome` text NOT NULL,
	`tested_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configuration_id`) REFERENCES `seo_provider_configurations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seo_provider_test_config_idx` ON `seo_provider_tests` (`configuration_id`);