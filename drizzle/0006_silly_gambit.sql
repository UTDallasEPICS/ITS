ALTER TABLE `tickets` ADD `githubIssueId` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_githubIssueId_unique` ON `tickets` (`githubIssueId`);