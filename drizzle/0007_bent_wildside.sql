DROP TABLE `invitation`;--> statement-breakpoint
DROP TABLE `member`;--> statement-breakpoint
DROP TABLE `organizationRole`;--> statement-breakpoint
ALTER TABLE `user` ADD `orgId` text REFERENCES organization(id);--> statement-breakpoint
CREATE INDEX `user_orgId_idx` ON `user` (`orgId`);--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `role`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `banned`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `banReason`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `banExpires`;--> statement-breakpoint
ALTER TABLE `session` DROP COLUMN `activeOrganizationId`;--> statement-breakpoint
ALTER TABLE `session` DROP COLUMN `impersonatedBy`;