import {
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = ["admin", "operations_manager", "field_supervisor", "viewer"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 80 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("viewer").notNull(),
  active: mysqlEnum("active", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const departments = mysqlTable(
  "departments",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    managerName: varchar("managerName", { length: 160 }),
    active: mysqlEnum("active", ["yes", "no"]).default("yes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("departments_code_unique").on(table.code)],
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    clientName: varchar("clientName", { length: 180 }),
    status: mysqlEnum("status", ["planning", "active", "paused", "completed"]).default("planning").notNull(),
    startDate: date("startDate"),
    targetDate: date("targetDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("projects_code_unique").on(table.code), index("projects_status_idx").on(table.status)],
);

export const employees = mysqlTable(
  "employees",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeNo: varchar("employeeNo", { length: 40 }).notNull(),
    firstName: varchar("firstName", { length: 100 }).notNull(),
    lastName: varchar("lastName", { length: 100 }).notNull(),
    jobTitle: varchar("jobTitle", { length: 150 }).notNull(),
    nationality: varchar("nationality", { length: 90 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    passportNumber: varchar("passportNumber", { length: 64 }),
    passportExpiryAt: date("passportExpiryAt"),
    joiningDate: date("joiningDate").notNull(),
    employmentStatus: mysqlEnum("employmentStatus", ["active", "on_leave", "suspended", "terminated"]).default("active").notNull(),
    departmentId: int("departmentId").references(() => departments.id, { onDelete: "set null" }),
    primaryProjectId: int("primaryProjectId").references(() => projects.id, { onDelete: "set null" }),
    emergencyContactName: varchar("emergencyContactName", { length: 160 }),
    emergencyContactPhone: varchar("emergencyContactPhone", { length: 32 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("employees_employee_no_unique").on(table.employeeNo),
    index("employees_status_idx").on(table.employmentStatus),
    index("employees_department_idx").on(table.departmentId),
    index("employees_project_idx").on(table.primaryProjectId),
  ],
);

export const residencyPermits = mysqlTable(
  "residencyPermits",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
    iqamaNumber: varchar("iqamaNumber", { length: 64 }).notNull(),
    sponsorName: varchar("sponsorName", { length: 180 }),
    issueDate: date("issueDate"),
    expiryDate: date("expiryDate").notNull(),
    status: mysqlEnum("status", ["valid", "expiring", "expired", "under_renewal"]).default("valid").notNull(),
    lastRenewedAt: timestamp("lastRenewedAt"),
    renewalReference: varchar("renewalReference", { length: 80 }),
    renewalNotes: text("renewalNotes"),
    attachmentKey: varchar("attachmentKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("residency_iqama_unique").on(table.iqamaNumber),
    uniqueIndex("residency_employee_unique").on(table.employeeId),
    index("residency_status_expiry_idx").on(table.status, table.expiryDate),
  ],
);

export const employeeQualifications = mysqlTable(
  "employeeQualifications",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    issuer: varchar("issuer", { length: 180 }).notNull(),
    certificateNumber: varchar("certificateNumber", { length: 100 }),
    issuedDate: date("issuedDate"),
    expiryDate: date("expiryDate"),
    status: mysqlEnum("status", ["valid", "expiring", "expired", "not_required"]).default("valid").notNull(),
    attachmentKey: varchar("attachmentKey", { length: 512 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("qualifications_employee_idx").on(table.employeeId), index("qualifications_expiry_idx").on(table.status, table.expiryDate)],
);

export const employeeDocuments = mysqlTable(
  "employeeDocuments",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
    documentType: mysqlEnum("documentType", ["passport", "visa", "medical_insurance", "contract", "identity", "other"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    referenceNumber: varchar("referenceNumber", { length: 100 }),
    expiryDate: date("expiryDate"),
    fileKey: varchar("fileKey", { length: 512 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("documents_employee_idx").on(table.employeeId), index("documents_expiry_idx").on(table.expiryDate)],
);

export const employeeAssignments = mysqlTable(
  "employeeAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    roleOnProject: varchar("roleOnProject", { length: 160 }).notNull(),
    startDate: date("startDate").notNull(),
    endDate: date("endDate"),
    status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("assignments_employee_idx").on(table.employeeId), index("assignments_project_idx").on(table.projectId), index("assignments_status_idx").on(table.status)],
);

export const fiberDrums = mysqlTable(
  "fiberDrums",
  {
    id: int("id").autoincrement().primaryKey(),
    drumId: varchar("drumId", { length: 64 }).notNull(),
    fiberSpec: varchar("fiberSpec", { length: 180 }).notNull(),
    coreCount: int("coreCount").notNull(),
    supplier: varchar("supplier", { length: 160 }),
    totalMeters: int("totalMeters").notNull(),
    remainingMeters: int("remainingMeters").notNull(),
    minimumMeters: int("minimumMeters").notNull().default(0),
    assignedProjectId: int("assignedProjectId").references(() => projects.id, { onDelete: "set null" }),
    storageLocation: varchar("storageLocation", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["available", "allocated", "low_stock", "depleted"]).default("available").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("fiber_drums_id_unique").on(table.drumId), index("fiber_drums_status_idx").on(table.status)],
);

export const fieldEquipment = mysqlTable(
  "fieldEquipment",
  {
    id: int("id").autoincrement().primaryKey(),
    assetTag: varchar("assetTag", { length: 64 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    category: mysqlEnum("category", ["splicer", "otdr", "power_meter", "safety", "other"]).notNull(),
    serialNumber: varchar("serialNumber", { length: 100 }),
    calibrationDueAt: date("calibrationDueAt"),
    status: mysqlEnum("status", ["ready", "assigned", "maintenance", "calibration_due"]).default("ready").notNull(),
    assignedEmployeeId: int("assignedEmployeeId").references(() => employees.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("equipment_tag_unique").on(table.assetTag), index("equipment_status_idx").on(table.status)],
);

export const permits = mysqlTable(
  "permits",
  {
    id: int("id").autoincrement().primaryKey(),
    permitNo: varchar("permitNo", { length: 80 }).notNull(),
    issuer: mysqlEnum("issuer", ["public_works", "traffic", "municipality", "other"]).notNull(),
    routeName: varchar("routeName", { length: 220 }).notNull(),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    startDate: date("startDate").notNull(),
    expiryDate: date("expiryDate").notNull(),
    status: mysqlEnum("status", ["valid", "expiring", "expired", "under_renewal"]).default("valid").notNull(),
    renewalReference: varchar("renewalReference", { length: 80 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("permits_number_unique").on(table.permitNo), index("permits_status_expiry_idx").on(table.status, table.expiryDate)],
);

export const workRoutes = mysqlTable(
  "workRoutes",
  {
    id: int("id").autoincrement().primaryKey(),
    routeCode: varchar("routeCode", { length: 64 }).notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    contractorName: varchar("contractorName", { length: 180 }),
    stage: mysqlEnum("stage", ["civil", "pulling", "splicing", "otdr", "handover"]).default("civil").notNull(),
    progressPercent: int("progressPercent").notNull().default(0),
    permitId: int("permitId").references(() => permits.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["active", "blocked", "completed"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("work_routes_code_unique").on(table.routeCode), index("work_routes_status_idx").on(table.status)],
);

export const operationalAuditLogs = mysqlTable(
  "operationalAuditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entityType", { length: 60 }).notNull(),
    entityId: int("entityId").notNull(),
    action: mysqlEnum("action", ["create", "update", "delete", "renew", "assign", "unassign", "issue"]).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    beforeJson: text("beforeJson"),
    afterJson: text("afterJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_actor_idx").on(table.actorUserId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
