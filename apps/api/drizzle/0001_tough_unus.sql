CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`character_ids_json` text,
	`image_path` text,
	`generation_status` text DEFAULT 'PENDING' NOT NULL,
	`generation_error` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapters_project_id_idx` ON `chapters` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_project_position_unique` ON `chapters` (`project_id`,`position`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`image_path` text,
	`generation_status` text DEFAULT 'PENDING' NOT NULL,
	`generation_error` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `characters_project_id_idx` ON `characters` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_project_position_unique` ON `characters` (`project_id`,`position`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`book_file_path` text NOT NULL,
	`completed_step` text,
	`running_step` text,
	`step_state` text DEFAULT 'IDLE' NOT NULL,
	`step_started_at` integer,
	`step_error` text,
	`style` text,
	`gemini_book_file_uri` text,
	`gemini_book_interaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "user_id", "title", "book_file_path", "completed_step", "running_step", "step_state", "step_started_at", "step_error", "style", "gemini_book_file_uri", "gemini_book_interaction_id", "created_at", "updated_at") SELECT "id", "user_id", "title", "book_file_path", "completed_step", "running_step", "step_state", "step_started_at", "step_error", "style", "gemini_book_file_uri", "gemini_book_interaction_id", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `projects_user_id_idx` ON `projects` (`user_id`);--> statement-breakpoint
CREATE INDEX `projects_created_at_idx` ON `projects` (`created_at`);