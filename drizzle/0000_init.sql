CREATE TABLE `raw_json` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`date` text(10) NOT NULL,
	`payload` text NOT NULL,
	`fetchedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raw_json_source_kind_date_uq` ON `raw_json` (`source`,`kind`,`date`);--> statement-breakpoint
CREATE INDEX `raw_json_kind_date_idx` ON `raw_json` (`kind`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_run` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`startedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finishedAt` integer,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `sync_run_started_idx` ON `sync_run` (`startedAt`);