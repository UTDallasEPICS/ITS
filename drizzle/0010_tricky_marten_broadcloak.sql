PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_thread_members` (
	`thread_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`thread_id`, `user_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_chat_thread_members`("thread_id", "user_id", "created_at") SELECT "thread_id", "user_id", "created_at" FROM `chat_thread_members`;--> statement-breakpoint
DROP TABLE `chat_thread_members`;--> statement-breakpoint
ALTER TABLE `__new_chat_thread_members` RENAME TO `chat_thread_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `chat_thread_members_user_idx` ON `chat_thread_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_chat_thread_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`thread_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`plain_text_body` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_chat_thread_messages`("id", "created_at", "thread_id", "user_id", "plain_text_body") SELECT "id", "created_at", "thread_id", "user_id", "plain_text_body" FROM `chat_thread_messages`;--> statement-breakpoint
DROP TABLE `chat_thread_messages`;--> statement-breakpoint
ALTER TABLE `__new_chat_thread_messages` RENAME TO `chat_thread_messages`;--> statement-breakpoint
CREATE INDEX `chat_thread_messages_pagination_idx` ON `chat_thread_messages` (`thread_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_chat_threads` (
	`id` integer PRIMARY KEY NOT NULL,
	`projectId` integer NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chat_threads`("id", "projectId", "created_at", "closed_at") SELECT "id", "projectId", "created_at", "closed_at" FROM `chat_threads`;--> statement-breakpoint
DROP TABLE `chat_threads`;--> statement-breakpoint
ALTER TABLE `__new_chat_threads` RENAME TO `chat_threads`;--> statement-breakpoint
CREATE INDEX `chat_threads_projectId_idx` ON `chat_threads` (`projectId`);