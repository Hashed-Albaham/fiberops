CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(32) NOT NULL,
	`managerName` varchar(160),
	`active` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `employeeAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`projectId` int NOT NULL,
	`roleOnProject` varchar(160) NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`documentType` enum('passport','visa','medical_insurance','contract','identity','other') NOT NULL,
	`title` varchar(180) NOT NULL,
	`referenceNumber` varchar(100),
	`expiryDate` date,
	`fileKey` varchar(512),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeQualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`issuer` varchar(180) NOT NULL,
	`certificateNumber` varchar(100),
	`issuedDate` date,
	`expiryDate` date,
	`status` enum('valid','expiring','expired','not_required') NOT NULL DEFAULT 'valid',
	`attachmentKey` varchar(512),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeQualifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeNo` varchar(40) NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`jobTitle` varchar(150) NOT NULL,
	`nationality` varchar(90) NOT NULL,
	`phone` varchar(32),
	`email` varchar(320),
	`passportNumber` varchar(64),
	`passportExpiryAt` date,
	`joiningDate` date NOT NULL,
	`employmentStatus` enum('active','on_leave','suspended','terminated') NOT NULL DEFAULT 'active',
	`departmentId` int,
	`primaryProjectId` int,
	`emergencyContactName` varchar(160),
	`emergencyContactPhone` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employee_no_unique` UNIQUE(`employeeNo`)
);
--> statement-breakpoint
CREATE TABLE `fiberDrums` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drumId` varchar(64) NOT NULL,
	`fiberSpec` varchar(180) NOT NULL,
	`coreCount` int NOT NULL,
	`supplier` varchar(160),
	`totalMeters` int NOT NULL,
	`remainingMeters` int NOT NULL,
	`minimumMeters` int NOT NULL DEFAULT 0,
	`assignedProjectId` int,
	`storageLocation` varchar(160) NOT NULL,
	`status` enum('available','allocated','low_stock','depleted') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fiberDrums_id` PRIMARY KEY(`id`),
	CONSTRAINT `fiber_drums_id_unique` UNIQUE(`drumId`)
);
--> statement-breakpoint
CREATE TABLE `fieldEquipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetTag` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` enum('splicer','otdr','power_meter','safety','other') NOT NULL,
	`serialNumber` varchar(100),
	`calibrationDueAt` date,
	`status` enum('ready','assigned','maintenance','calibration_due') NOT NULL DEFAULT 'ready',
	`assignedEmployeeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fieldEquipment_id` PRIMARY KEY(`id`),
	CONSTRAINT `equipment_tag_unique` UNIQUE(`assetTag`)
);
--> statement-breakpoint
CREATE TABLE `operationalAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`entityType` varchar(60) NOT NULL,
	`entityId` int NOT NULL,
	`action` enum('create','update','delete','renew','assign','unassign','issue') NOT NULL,
	`summary` varchar(500) NOT NULL,
	`beforeJson` text,
	`afterJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operationalAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`permitNo` varchar(80) NOT NULL,
	`issuer` enum('public_works','traffic','municipality','other') NOT NULL,
	`routeName` varchar(220) NOT NULL,
	`projectId` int,
	`startDate` date NOT NULL,
	`expiryDate` date NOT NULL,
	`status` enum('valid','expiring','expired','under_renewal') NOT NULL DEFAULT 'valid',
	`renewalReference` varchar(80),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permits_id` PRIMARY KEY(`id`),
	CONSTRAINT `permits_number_unique` UNIQUE(`permitNo`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(180) NOT NULL,
	`clientName` varchar(180),
	`status` enum('planning','active','paused','completed') NOT NULL DEFAULT 'planning',
	`startDate` date,
	`targetDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `residencyPermits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`iqamaNumber` varchar(64) NOT NULL,
	`sponsorName` varchar(180),
	`issueDate` date,
	`expiryDate` date NOT NULL,
	`status` enum('valid','expiring','expired','under_renewal') NOT NULL DEFAULT 'valid',
	`lastRenewedAt` timestamp,
	`renewalReference` varchar(80),
	`renewalNotes` text,
	`attachmentKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `residencyPermits_id` PRIMARY KEY(`id`),
	CONSTRAINT `residency_iqama_unique` UNIQUE(`iqamaNumber`),
	CONSTRAINT `residency_employee_unique` UNIQUE(`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workRoutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeCode` varchar(64) NOT NULL,
	`name` varchar(220) NOT NULL,
	`projectId` int,
	`contractorName` varchar(180),
	`stage` enum('civil','pulling','splicing','otdr','handover') NOT NULL DEFAULT 'civil',
	`progressPercent` int NOT NULL DEFAULT 0,
	`permitId` int,
	`status` enum('active','blocked','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workRoutes_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_routes_code_unique` UNIQUE(`routeCode`)
);
--> statement-breakpoint
ALTER TABLE `employeeAssignments` ADD CONSTRAINT `employeeAssignments_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeAssignments` ADD CONSTRAINT `employeeAssignments_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeDocuments` ADD CONSTRAINT `employeeDocuments_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employeeQualifications` ADD CONSTRAINT `employeeQualifications_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_primaryProjectId_projects_id_fk` FOREIGN KEY (`primaryProjectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fiberDrums` ADD CONSTRAINT `fiberDrums_assignedProjectId_projects_id_fk` FOREIGN KEY (`assignedProjectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fieldEquipment` ADD CONSTRAINT `fieldEquipment_assignedEmployeeId_employees_id_fk` FOREIGN KEY (`assignedEmployeeId`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalAuditLogs` ADD CONSTRAINT `operationalAuditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `permits` ADD CONSTRAINT `permits_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `residencyPermits` ADD CONSTRAINT `residencyPermits_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workRoutes` ADD CONSTRAINT `workRoutes_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workRoutes` ADD CONSTRAINT `workRoutes_permitId_permits_id_fk` FOREIGN KEY (`permitId`) REFERENCES `permits`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assignments_employee_idx` ON `employeeAssignments` (`employeeId`);--> statement-breakpoint
CREATE INDEX `assignments_project_idx` ON `employeeAssignments` (`projectId`);--> statement-breakpoint
CREATE INDEX `assignments_status_idx` ON `employeeAssignments` (`status`);--> statement-breakpoint
CREATE INDEX `documents_employee_idx` ON `employeeDocuments` (`employeeId`);--> statement-breakpoint
CREATE INDEX `documents_expiry_idx` ON `employeeDocuments` (`expiryDate`);--> statement-breakpoint
CREATE INDEX `qualifications_employee_idx` ON `employeeQualifications` (`employeeId`);--> statement-breakpoint
CREATE INDEX `qualifications_expiry_idx` ON `employeeQualifications` (`status`,`expiryDate`);--> statement-breakpoint
CREATE INDEX `employees_status_idx` ON `employees` (`employmentStatus`);--> statement-breakpoint
CREATE INDEX `employees_department_idx` ON `employees` (`departmentId`);--> statement-breakpoint
CREATE INDEX `employees_project_idx` ON `employees` (`primaryProjectId`);--> statement-breakpoint
CREATE INDEX `fiber_drums_status_idx` ON `fiberDrums` (`status`);--> statement-breakpoint
CREATE INDEX `equipment_status_idx` ON `fieldEquipment` (`status`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `operationalAuditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `operationalAuditLogs` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `permits_status_expiry_idx` ON `permits` (`status`,`expiryDate`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `residency_status_expiry_idx` ON `residencyPermits` (`status`,`expiryDate`);--> statement-breakpoint
CREATE INDEX `work_routes_status_idx` ON `workRoutes` (`status`);