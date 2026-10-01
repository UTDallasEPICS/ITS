DROP INDEX `organization_slug_unique`;--> statement-breakpoint
ALTER TABLE `organization` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `organization` DROP COLUMN `logo`;