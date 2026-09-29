PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`githubRepo` text NOT NULL,
	`projectPartnerId` text NOT NULL,
	FOREIGN KEY (`projectPartnerId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "name", "githubRepo", "projectPartnerId") SELECT "id", "projectName", "githubLink", "projectPartnerId" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `project_projectPartnerId_idx` ON `project` (`projectPartnerId`);