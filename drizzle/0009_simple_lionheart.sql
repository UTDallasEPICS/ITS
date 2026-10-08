CREATE TABLE `chat_thread_members` (
	`thread_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer,
	PRIMARY KEY(`thread_id`, `user_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_thread_members_user_idx` ON `chat_thread_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_thread_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer,
	`thread_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`plain_text_body` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_thread_messages_pagination_idx` ON `chat_thread_messages` (`thread_id`,`id`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` integer PRIMARY KEY NOT NULL,
	`projectId` integer NOT NULL,
	`created_at` integer,
	`closed_at` integer,
	FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_threads_projectId_idx` ON `chat_threads` (`projectId`);