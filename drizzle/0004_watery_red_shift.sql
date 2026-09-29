PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tickets` (
	`id` integer PRIMARY KEY NOT NULL,
	`projectId` integer NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`userId` text NOT NULL,
	`description` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tickets`("id", "projectId", "title", "status", "userId", "description", "timestamp") SELECT "id", "projectId", "title", "status", "userId", "description", "timestamp" FROM `tickets`;--> statement-breakpoint
DROP TABLE `tickets`;--> statement-breakpoint
ALTER TABLE `__new_tickets` RENAME TO `tickets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tickets_projectId_idx` ON `tickets` (`projectId`);