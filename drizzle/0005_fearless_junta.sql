PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tickets` (
	`id` integer PRIMARY KEY NOT NULL,
	`projectId` integer NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`userId` text,
	`description` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tickets`("id", "projectId", "title", "status", "userId", "description", "timestamp") SELECT "id", "projectId", "title", "status", "userId", "description", "timestamp" FROM `tickets`;--> statement-breakpoint
DROP TABLE `tickets`;--> statement-breakpoint
ALTER TABLE `__new_tickets` RENAME TO `tickets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tickets_projectId_idx` ON `tickets` (`projectId`);--> statement-breakpoint
CREATE INDEX `tickets_userId_idx` ON `tickets` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_organizationId_userId_unique` ON `member` (`organizationId`,`userId`);