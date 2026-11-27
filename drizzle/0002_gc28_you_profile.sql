CREATE TABLE `daily_checkin` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`date` text(10) NOT NULL,
	`feeling` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_checkin_date_uq` ON `daily_checkin` (`date`);--> statement-breakpoint
CREATE TABLE `goal` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`date` text(10) NOT NULL,
	`target` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `niggle` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`bodyArea` text,
	`severity` integer DEFAULT 1 NOT NULL,
	`startedOn` text(10) NOT NULL,
	`resolvedOn` text(10),
	`note` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `niggle_active_idx` ON `niggle` (`resolvedOn`);--> statement-breakpoint
CREATE TABLE `training_slot` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`weekday` integer NOT NULL,
	`start` text(5) NOT NULL,
	`end` text(5) NOT NULL,
	`kind` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_slot_weekday_idx` ON `training_slot` (`weekday`);