PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
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
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "characters_position_zero_or_one" CHECK("__new_characters"."position" in (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "project_id", "name", "prompt", "image_path", "generation_status", "generation_error", "position", "created_at", "updated_at") SELECT "id", "project_id", "name", "prompt", "image_path", "generation_status", "generation_error", "position", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `characters_project_id_idx` ON `characters` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_project_position_unique` ON `characters` (`project_id`,`position`);