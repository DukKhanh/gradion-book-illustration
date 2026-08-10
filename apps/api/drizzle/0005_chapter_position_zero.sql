PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chapters` (
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
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chapters_position_zero" CHECK("__new_chapters"."position" = 0)
);
--> statement-breakpoint
INSERT INTO `__new_chapters`("id", "project_id", "name", "prompt", "character_ids_json", "image_path", "generation_status", "generation_error", "position", "created_at", "updated_at") SELECT "id", "project_id", "name", "prompt", "character_ids_json", "image_path", "generation_status", "generation_error", "position", "created_at", "updated_at" FROM `chapters`;--> statement-breakpoint
DROP TABLE `chapters`;--> statement-breakpoint
ALTER TABLE `__new_chapters` RENAME TO `chapters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `chapters_project_id_idx` ON `chapters` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_project_position_unique` ON `chapters` (`project_id`,`position`);
