ALTER TABLE `projects` ADD `gemini_book_state` text DEFAULT 'IDLE' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `gemini_book_started_at` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `gemini_book_error` text;