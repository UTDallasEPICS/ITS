ALTER TABLE `project` ADD `siteTag` text;--> statement-breakpoint
CREATE UNIQUE INDEX `project_siteTag_unique` ON `project` (`siteTag`);