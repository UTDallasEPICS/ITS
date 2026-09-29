CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expiresAt` integer,
	`createdAt` integer NOT NULL,
	`inviterId` text NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviterId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organizationId`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organizationId`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`userId`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` integer PRIMARY KEY NOT NULL,
	`githubLink` text NOT NULL,
	`orgName` text NOT NULL,
	`projectPartnerId` text NOT NULL,
	`projectName` text NOT NULL,
	`organizationId` text NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_organizationId_idx` ON `project` (`organizationId`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`userId` text NOT NULL,
	`description` text NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `session` ADD `activeOrganizationId` text;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonatedBy` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `banReason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banExpires` integer;