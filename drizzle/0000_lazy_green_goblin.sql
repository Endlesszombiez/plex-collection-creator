CREATE TABLE `applied_collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`suggestion_id` integer,
	`plex_collection_key` text NOT NULL,
	`collection_name` text NOT NULL,
	`item_count` integer NOT NULL,
	`applied_at` integer,
	FOREIGN KEY (`suggestion_id`) REFERENCES `suggestions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`library_count` integer,
	`item_count` integer,
	`started_at` integer,
	`completed_at` integer,
	`error_message` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plex_token` text,
	`plex_server_url` text,
	`plex_server_id` text,
	`ai_provider` text,
	`ai_credentials` text,
	`selected_libraries` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer,
	`collection_name` text NOT NULL,
	`reasoning` text,
	`items` text NOT NULL,
	`item_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`custom_prompt` text,
	`created_at` integer,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
