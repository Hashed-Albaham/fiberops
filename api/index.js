// server/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/routers.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
import { createHash, timingSafeEqual as timingSafeEqual2 } from "crypto";
import { z as z5 } from "zod";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

// drizzle/schema.ts
import {
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var userRoles = ["admin", "operations_manager", "field_supervisor", "viewer"];
var users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var departments = mysqlTable(
  "departments",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    managerName: varchar("managerName", { length: 160 }),
    active: mysqlEnum("active", ["yes", "no"]).default("yes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("departments_code_unique").on(table.code)]
);
var projects = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("projects_code_unique").on(table.code), index("projects_status_idx").on(table.status)]
);
var employees = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    uniqueIndex("employees_employee_no_unique").on(table.employeeNo),
    index("employees_status_idx").on(table.employmentStatus),
    index("employees_department_idx").on(table.departmentId),
    index("employees_project_idx").on(table.primaryProjectId)
  ]
);
var residencyPermits = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    uniqueIndex("residency_iqama_unique").on(table.iqamaNumber),
    uniqueIndex("residency_employee_unique").on(table.employeeId),
    index("residency_status_expiry_idx").on(table.status, table.expiryDate)
  ]
);
var employeeQualifications = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [index("qualifications_employee_idx").on(table.employeeId), index("qualifications_expiry_idx").on(table.status, table.expiryDate)]
);
var employeeDocuments = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [index("documents_employee_idx").on(table.employeeId), index("documents_expiry_idx").on(table.expiryDate)]
);
var employeeAssignments = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [index("assignments_employee_idx").on(table.employeeId), index("assignments_project_idx").on(table.projectId), index("assignments_status_idx").on(table.status)]
);
var fiberDrums = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("fiber_drums_id_unique").on(table.drumId), index("fiber_drums_status_idx").on(table.status)]
);
var fieldEquipment = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("equipment_tag_unique").on(table.assetTag), index("equipment_status_idx").on(table.status)]
);
var permits = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("permits_number_unique").on(table.permitNo), index("permits_status_expiry_idx").on(table.status, table.expiryDate)]
);
var workRoutes = mysqlTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("work_routes_code_unique").on(table.routeCode), index("work_routes_status_idx").on(table.status)]
);
var operationalAuditLogs = mysqlTable(
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
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_actor_idx").on(table.actorUserId)]
);

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = createPool({ uri: process.env.DATABASE_URL, charset: "utf8mb4", connectionLimit: 5 });
      _db = drizzle({ client: pool });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A FiberOps \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.");
  }
  return db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.username !== void 0) {
      values.username = user.username;
      updateSet.username = user.username;
    }
    if (user.passwordHash !== void 0) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }
    if (user.active !== void 0) {
      values.active = user.active;
      updateSet.active = user.active;
    }
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByUsername(username) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

// server/auth.ts
import { parse as parseCookies } from "cookie";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { promisify } from "util";
var scrypt = promisify(scryptCallback);
function sessionSecret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}
async function createLocalSessionToken(openId, expiresInMs = ONE_YEAR_MS) {
  const expiresAt = Math.floor((Date.now() + expiresInMs) / 1e3);
  return new SignJWT({ openId }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(expiresAt).sign(sessionSecret());
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = await scrypt(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}
async function getAuthenticatedUser(req) {
  const token = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    const openId = payload.openId;
    if (typeof openId !== "string" || !openId) return null;
    const user = await getUserByOpenId(openId);
    return user?.active === "yes" ? user : null;
  } catch {
    return null;
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/env.ts
var ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  localAdminUsername: process.env.LOCAL_ADMIN_USERNAME ?? "",
  localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production"
};

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var hasRole = (role, allowedRoles) => allowedRoles.includes(role);
var readProcedure = protectedProcedure;
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !hasRole(ctx.user.role, ["admin", "operations_manager", "field_supervisor"])) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var systemAdminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    if (!opts.ctx.user || opts.ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
  })
);

// server/routers/operations.ts
import { asc, eq as eq2 } from "drizzle-orm";
import { z } from "zod";
var dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var optionalDate = dateField.nullable().optional();
var optionalText = z.string().trim().max(500).nullable().optional();
var optionalId = z.number().int().positive().nullable().optional();
var idInput = z.object({ id: z.number().int().positive() });
var departmentInput = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(32), managerName: z.string().trim().max(160).nullable().optional(), active: z.enum(["yes", "no"]).default("yes") });
var projectInput = z.object({ code: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(180), clientName: z.string().trim().max(180).nullable().optional(), status: z.enum(["planning", "active", "paused", "completed"]).default("planning"), startDate: optionalDate, targetDate: optionalDate });
var drumInput = z.object({ drumId: z.string().trim().min(2).max(64), fiberSpec: z.string().trim().min(2).max(180), coreCount: z.number().int().min(1).max(288), supplier: z.string().trim().max(160).nullable().optional(), totalMeters: z.number().int().positive(), remainingMeters: z.number().int().min(0), minimumMeters: z.number().int().min(0).default(0), assignedProjectId: optionalId, storageLocation: z.string().trim().min(2).max(160) });
var equipmentInput = z.object({ assetTag: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(180), category: z.enum(["splicer", "otdr", "power_meter", "safety", "other"]), serialNumber: z.string().trim().max(100).nullable().optional(), calibrationDueAt: optionalDate, status: z.enum(["ready", "assigned", "maintenance", "calibration_due"]).default("ready"), assignedEmployeeId: optionalId });
var permitInput = z.object({ permitNo: z.string().trim().min(2).max(80), issuer: z.enum(["public_works", "traffic", "municipality", "other"]), routeName: z.string().trim().min(2).max(220), projectId: optionalId, startDate: dateField, expiryDate: dateField, renewalReference: z.string().trim().max(80).nullable().optional(), notes: optionalText });
var routeInput = z.object({ routeCode: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(220), projectId: optionalId, contractorName: z.string().trim().max(180).nullable().optional(), stage: z.enum(["civil", "pulling", "splicing", "otdr", "handover"]).default("civil"), progressPercent: z.number().int().min(0).max(100), permitId: optionalId, status: z.enum(["active", "blocked", "completed"]).default("active") });
function toDbDate(value) {
  if (value === void 0) return void 0;
  if (value === null) return null;
  return /* @__PURE__ */ new Date(`${value}T00:00:00`);
}
function insertId(result) {
  const value = Array.isArray(result) ? result[0] : result;
  return Number(value.insertId ?? 0);
}
function permitStatus(expiryDate) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const remaining = Math.ceil(((/* @__PURE__ */ new Date(`${expiryDate}T00:00:00`)).getTime() - today.getTime()) / 864e5);
  if (remaining <= 0) return "expired";
  if (remaining <= 60) return "expiring";
  return "valid";
}
function drumStatus(input) {
  if (input.remainingMeters <= 0) return "depleted";
  if (input.remainingMeters <= input.minimumMeters) return "low_stock";
  if (input.remainingMeters < input.totalMeters) return "allocated";
  return "available";
}
async function audit(actorUserId, entityType, entityId, action, summary, before, after) {
  const db = await requireDb();
  await db.insert(operationalAuditLogs).values({ actorUserId, entityType, entityId, action, summary, beforeJson: before ? JSON.stringify(before) : null, afterJson: after ? JSON.stringify(after) : null });
}
var operationsRouter = router({
  list: readProcedure.query(async () => {
    const db = await requireDb();
    const [departmentRows, projectRows, drumRows, equipmentRows, permitRows, routeRows, employeeRows] = await Promise.all([
      db.select().from(departments).orderBy(asc(departments.name)),
      db.select().from(projects).orderBy(asc(projects.name)),
      db.select().from(fiberDrums).orderBy(asc(fiberDrums.drumId)),
      db.select().from(fieldEquipment).orderBy(asc(fieldEquipment.assetTag)),
      db.select().from(permits).orderBy(asc(permits.expiryDate)),
      db.select().from(workRoutes).orderBy(asc(workRoutes.routeCode)),
      db.select({ id: employees.id, employeeNo: employees.employeeNo, firstName: employees.firstName, lastName: employees.lastName, jobTitle: employees.jobTitle }).from(employees).orderBy(asc(employees.employeeNo))
    ]);
    return { departments: departmentRows, projects: projectRows, drums: drumRows, equipment: equipmentRows, permits: permitRows, routes: routeRows, employees: employeeRows };
  }),
  overview: readProcedure.query(async () => {
    const db = await requireDb();
    const [employeeRows, drumRows, equipmentRows, permitRows, routeRows] = await Promise.all([db.select().from(employees), db.select().from(fiberDrums), db.select().from(fieldEquipment), db.select().from(permits), db.select().from(workRoutes)]);
    return {
      employees: employeeRows.filter((row) => row.employmentStatus === "active").length,
      lowStockDrums: drumRows.filter((row) => row.status === "low_stock" || row.status === "depleted").length,
      calibrationDue: equipmentRows.filter((row) => row.status === "calibration_due").length,
      criticalPermits: permitRows.filter((row) => row.status === "expired" || row.status === "expiring").length,
      blockedRoutes: routeRows.filter((row) => row.status === "blocked").length
    };
  }),
  createDepartment: adminProcedure.input(departmentInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(departments).values(input);
    const id = insertId(result);
    await audit(ctx.user.id, "department", id, "create", `\u0625\u0636\u0627\u0641\u0629 \u0642\u0633\u0645 ${input.name}`, void 0, input);
    return { id };
  }),
  updateDepartment: adminProcedure.input(idInput.merge(departmentInput)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(departments).where(eq2(departments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    const { id, ...values } = input;
    await db.update(departments).set(values).where(eq2(departments.id, id));
    await audit(ctx.user.id, "department", id, "update", `\u062A\u0639\u062F\u064A\u0644 \u0642\u0633\u0645 ${before.name}`, before, values);
    return { success: true };
  }),
  deleteDepartment: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(departments).where(eq2(departments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    await db.delete(departments).where(eq2(departments.id, input.id));
    await audit(ctx.user.id, "department", input.id, "delete", `\u062D\u0630\u0641 \u0642\u0633\u0645 ${before.name}`, before);
    return { success: true };
  }),
  createProject: adminProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(projects).values({ ...input, startDate: toDbDate(input.startDate), targetDate: toDbDate(input.targetDate) });
    const id = insertId(result);
    await audit(ctx.user.id, "project", id, "create", `\u0625\u0636\u0627\u0641\u0629 \u0645\u0634\u0631\u0648\u0639 ${input.code}`, void 0, input);
    return { id };
  }),
  updateProject: adminProcedure.input(idInput.merge(projectInput)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(projects).where(eq2(projects.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    const { id, startDate, targetDate, ...values } = input;
    await db.update(projects).set({ ...values, startDate: toDbDate(startDate), targetDate: toDbDate(targetDate) }).where(eq2(projects.id, id));
    await audit(ctx.user.id, "project", id, "update", `\u062A\u0639\u062F\u064A\u0644 \u0645\u0634\u0631\u0648\u0639 ${before.code}`, before, values);
    return { success: true };
  }),
  deleteProject: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(projects).where(eq2(projects.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    await db.delete(projects).where(eq2(projects.id, input.id));
    await audit(ctx.user.id, "project", input.id, "delete", `\u062D\u0630\u0641 \u0645\u0634\u0631\u0648\u0639 ${before.code}`, before);
    return { success: true };
  }),
  createDrum: adminProcedure.input(drumInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const status = drumStatus(input);
    const result = await db.insert(fiberDrums).values({ ...input, status });
    const id = insertId(result);
    await audit(ctx.user.id, "drum", id, "create", `\u0625\u0636\u0627\u0641\u0629 \u0628\u0643\u0631\u0629 ${input.drumId}`, void 0, input);
    return { id };
  }),
  updateDrum: adminProcedure.input(idInput.merge(drumInput)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(fiberDrums).where(eq2(fiberDrums.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0628\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    const { id, ...values } = input;
    await db.update(fiberDrums).set({ ...values, status: drumStatus(values) }).where(eq2(fiberDrums.id, id));
    await audit(ctx.user.id, "drum", id, "update", `\u062A\u0639\u062F\u064A\u0644 \u0628\u0643\u0631\u0629 ${before.drumId}`, before, values);
    return { success: true };
  }),
  deleteDrum: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(fiberDrums).where(eq2(fiberDrums.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0628\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    await db.delete(fiberDrums).where(eq2(fiberDrums.id, input.id));
    await audit(ctx.user.id, "drum", input.id, "delete", `\u062D\u0630\u0641 \u0628\u0643\u0631\u0629 ${before.drumId}`, before);
    return { success: true };
  }),
  createEquipment: adminProcedure.input(equipmentInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(fieldEquipment).values({ ...input, calibrationDueAt: toDbDate(input.calibrationDueAt) });
    const id = insertId(result);
    await audit(ctx.user.id, "equipment", id, "create", `\u0625\u0636\u0627\u0641\u0629 \u0623\u0635\u0644 ${input.assetTag}`, void 0, input);
    return { id };
  }),
  updateEquipment: adminProcedure.input(idInput.merge(equipmentInput)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(fieldEquipment).where(eq2(fieldEquipment.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0639\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    const { id, calibrationDueAt, ...values } = input;
    await db.update(fieldEquipment).set({ ...values, calibrationDueAt: toDbDate(calibrationDueAt) }).where(eq2(fieldEquipment.id, id));
    await audit(ctx.user.id, "equipment", id, "update", `\u062A\u0639\u062F\u064A\u0644 \u0623\u0635\u0644 ${before.assetTag}`, before, values);
    return { success: true };
  }),
  assignEquipment: adminProcedure.input(z.object({ id: z.number().int().positive(), employeeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(fieldEquipment).where(eq2(fieldEquipment.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0639\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    await db.update(fieldEquipment).set({ assignedEmployeeId: input.employeeId, status: "assigned" }).where(eq2(fieldEquipment.id, input.id));
    await audit(ctx.user.id, "equipment", input.id, "assign", `\u062A\u0639\u064A\u064A\u0646 \u0623\u0635\u0644 ${before.assetTag} \u0644\u0644\u0639\u0627\u0645\u0644 ${input.employeeId}`, before, input);
    return { success: true };
  }),
  releaseEquipment: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(fieldEquipment).where(eq2(fieldEquipment.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0639\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    await db.update(fieldEquipment).set({ assignedEmployeeId: null, status: "ready" }).where(eq2(fieldEquipment.id, input.id));
    await audit(ctx.user.id, "equipment", input.id, "unassign", `\u0625\u0644\u063A\u0627\u0621 \u062A\u0639\u064A\u064A\u0646 \u0623\u0635\u0644 ${before.assetTag}`, before);
    return { success: true };
  }),
  deleteEquipment: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(fieldEquipment).where(eq2(fieldEquipment.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0639\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    await db.delete(fieldEquipment).where(eq2(fieldEquipment.id, input.id));
    await audit(ctx.user.id, "equipment", input.id, "delete", `\u062D\u0630\u0641 \u0623\u0635\u0644 ${before.assetTag}`, before);
    return { success: true };
  }),
  createPermit: adminProcedure.input(permitInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(permits).values({ ...input, startDate: toDbDate(input.startDate), expiryDate: toDbDate(input.expiryDate), status: permitStatus(input.expiryDate) });
    const id = insertId(result);
    await audit(ctx.user.id, "permit", id, "create", `\u0625\u0635\u062F\u0627\u0631 \u062A\u0635\u0631\u064A\u062D ${input.permitNo}`, void 0, input);
    return { id };
  }),
  updatePermit: adminProcedure.input(idInput.merge(permitInput)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(permits).where(eq2(permits.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u062A\u0635\u0631\u064A\u062D \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    const { id, startDate, expiryDate, ...values } = input;
    await db.update(permits).set({ ...values, startDate: toDbDate(startDate), expiryDate: toDbDate(expiryDate), status: permitStatus(expiryDate) }).where(eq2(permits.id, id));
    await audit(ctx.user.id, "permit", id, "update", `\u062A\u0639\u062F\u064A\u0644 \u062A\u0635\u0631\u064A\u062D ${before.permitNo}`, before, values);
    return { success: true };
  }),
  renewPermit: adminProcedure.input(z.object({ id: z.number().int().positive(), expiryDate: dateField, renewalReference: z.string().trim().max(80).nullable().optional(), notes: optionalText })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(permits).where(eq2(permits.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u062A\u0635\u0631\u064A\u062D \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    await db.update(permits).set({ expiryDate: toDbDate(input.expiryDate), renewalReference: input.renewalReference, notes: input.notes, status: permitStatus(input.expiryDate) }).where(eq2(permits.id, input.id));
    await audit(ctx.user.id, "permit", input.id, "renew", `\u062A\u062C\u062F\u064A\u062F \u062A\u0635\u0631\u064A\u062D ${before.permitNo}`, before, input);
    return { success: true };
  }),
  deletePermit: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(permits).where(eq2(permits.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u062A\u0635\u0631\u064A\u062D \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    await db.delete(permits).where(eq2(permits.id, input.id));
    await audit(ctx.user.id, "permit", input.id, "delete", `\u062D\u0630\u0641 \u062A\u0635\u0631\u064A\u062D ${before.permitNo}`, before);
    return { success: true };
  }),
  createRoute: adminProcedure.input(routeInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(workRoutes).values(input);
    const id = insertId(result);
    await audit(ctx.user.id, "route", id, "create", `\u0625\u0636\u0627\u0641\u0629 \u0645\u0633\u0627\u0631 ${input.routeCode}`, void 0, input);
    return { id };
  }),
  updateRoute: adminProcedure.input(idInput.merge(routeInput)).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(workRoutes).where(eq2(workRoutes.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    const { id, ...values } = input;
    await db.update(workRoutes).set(values).where(eq2(workRoutes.id, id));
    await audit(ctx.user.id, "route", id, "update", `\u062A\u0639\u062F\u064A\u0644 \u0645\u0633\u0627\u0631 ${before.routeCode}`, before, values);
    return { success: true };
  }),
  deleteRoute: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(workRoutes).where(eq2(workRoutes.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    await db.delete(workRoutes).where(eq2(workRoutes.id, input.id));
    await audit(ctx.user.id, "route", input.id, "delete", `\u062D\u0630\u0641 \u0645\u0633\u0627\u0631 ${before.routeCode}`, before);
    return { success: true };
  }),
  refreshPermitStatuses: adminProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db.select().from(permits);
    let changed = 0;
    for (const permit of rows) {
      const nextStatus = permitStatus(permit.expiryDate instanceof Date ? permit.expiryDate.toISOString().slice(0, 10) : String(permit.expiryDate));
      if (permit.status !== nextStatus) {
        await db.update(permits).set({ status: nextStatus }).where(eq2(permits.id, permit.id));
        changed += 1;
      }
    }
    await audit(ctx.user.id, "permit", 0, "update", `\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u062A\u0635\u0627\u0631\u064A\u062D: ${changed} \u0633\u062C\u0644\u0627\u064B`);
    return { changed };
  })
});

// server/routers/workforce.ts
import { and, asc as asc2, eq as eq3 } from "drizzle-orm";
import { z as z2 } from "zod";
var dateField2 = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0635\u064A\u063A\u0629 YYYY-MM-DD");
var optionalDateField = dateField2.nullable().optional();
var optionalText2 = z2.string().trim().max(500).nullable().optional();
var optionalId2 = z2.number().int().positive().nullable().optional();
var idField = z2.object({ id: z2.number().int().positive() });
var employeeInput = z2.object({
  employeeNo: z2.string().trim().min(2).max(40),
  firstName: z2.string().trim().min(2).max(100),
  lastName: z2.string().trim().min(2).max(100),
  jobTitle: z2.string().trim().min(2).max(150),
  nationality: z2.string().trim().min(2).max(90),
  phone: z2.string().trim().max(32).nullable().optional(),
  email: z2.string().trim().email().max(320).nullable().optional(),
  passportNumber: z2.string().trim().max(64).nullable().optional(),
  passportExpiryAt: optionalDateField,
  joiningDate: dateField2,
  employmentStatus: z2.enum(["active", "on_leave", "suspended", "terminated"]).default("active"),
  departmentId: optionalId2,
  primaryProjectId: optionalId2,
  emergencyContactName: z2.string().trim().max(160).nullable().optional(),
  emergencyContactPhone: z2.string().trim().max(32).nullable().optional(),
  notes: optionalText2
});
var residencyInput = z2.object({
  iqamaNumber: z2.string().trim().min(4).max(64),
  sponsorName: z2.string().trim().max(180).nullable().optional(),
  issueDate: optionalDateField,
  expiryDate: dateField2,
  status: z2.enum(["valid", "expiring", "expired", "under_renewal"]).default("valid"),
  renewalReference: z2.string().trim().max(80).nullable().optional(),
  renewalNotes: optionalText2
});
var qualificationInput = z2.object({
  employeeId: z2.number().int().positive(),
  name: z2.string().trim().min(2).max(180),
  issuer: z2.string().trim().min(2).max(180),
  certificateNumber: z2.string().trim().max(100).nullable().optional(),
  issuedDate: optionalDateField,
  expiryDate: optionalDateField,
  status: z2.enum(["valid", "expiring", "expired", "not_required"]).default("valid"),
  notes: optionalText2
});
var documentInput = z2.object({
  employeeId: z2.number().int().positive(),
  documentType: z2.enum(["passport", "visa", "medical_insurance", "contract", "identity", "other"]),
  title: z2.string().trim().min(2).max(180),
  referenceNumber: z2.string().trim().max(100).nullable().optional(),
  expiryDate: optionalDateField,
  notes: optionalText2
});
var assignmentInput = z2.object({
  employeeId: z2.number().int().positive(),
  projectId: z2.number().int().positive(),
  roleOnProject: z2.string().trim().min(2).max(160),
  startDate: dateField2,
  endDate: optionalDateField,
  notes: optionalText2
});
function insertId2(result) {
  const value = Array.isArray(result) ? result[0] : result;
  return Number(value.insertId ?? 0);
}
function toDbDate2(value) {
  if (value === void 0) return void 0;
  if (value === null) return null;
  return /* @__PURE__ */ new Date(`${value}T00:00:00`);
}
function daysUntil(dateValue) {
  const start = /* @__PURE__ */ new Date();
  start.setHours(0, 0, 0, 0);
  const target = dateValue instanceof Date ? dateValue : /* @__PURE__ */ new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target.getTime() - start.getTime()) / 864e5);
}
function residencyComplianceStatus(dateValue) {
  const remaining = daysUntil(dateValue);
  if (remaining <= 0) return "expired";
  if (remaining <= 60) return "expiring";
  return "valid";
}
function qualificationComplianceStatus(dateValue) {
  if (!dateValue) return "not_required";
  return residencyComplianceStatus(dateValue);
}
async function audit2(input) {
  const db = await requireDb();
  await db.insert(operationalAuditLogs).values({
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    summary: input.summary,
    beforeJson: input.before ? JSON.stringify(input.before) : null,
    afterJson: input.after ? JSON.stringify(input.after) : null
  });
}
var workforceRouter = router({
  list: readProcedure.query(async () => {
    const db = await requireDb();
    const [employeeRows, departmentRows, projectRows, residencyRows, qualificationRows, documentRows, assignmentRows] = await Promise.all([
      db.select().from(employees).orderBy(asc2(employees.employeeNo)),
      db.select().from(departments).orderBy(asc2(departments.name)),
      db.select().from(projects).orderBy(asc2(projects.name)),
      db.select().from(residencyPermits),
      db.select().from(employeeQualifications),
      db.select().from(employeeDocuments),
      db.select().from(employeeAssignments)
    ]);
    const departmentMap = new Map(departmentRows.map((row) => [row.id, row]));
    const projectMap = new Map(projectRows.map((row) => [row.id, row]));
    return {
      employees: employeeRows.map((employee) => ({
        ...employee,
        department: employee.departmentId ? departmentMap.get(employee.departmentId) ?? null : null,
        project: employee.primaryProjectId ? projectMap.get(employee.primaryProjectId) ?? null : null,
        residency: residencyRows.find((row) => row.employeeId === employee.id) ?? null,
        qualifications: qualificationRows.filter((row) => row.employeeId === employee.id),
        documents: documentRows.filter((row) => row.employeeId === employee.id),
        assignments: assignmentRows.filter((row) => row.employeeId === employee.id)
      })),
      departments: departmentRows,
      projects: projectRows
    };
  }),
  summary: readProcedure.query(async () => {
    const db = await requireDb();
    const [employeeRows, residencyRows, qualificationRows] = await Promise.all([
      db.select().from(employees),
      db.select().from(residencyPermits),
      db.select().from(employeeQualifications)
    ]);
    const criticalResidencies = residencyRows.filter((row) => row.status === "expired" || row.status === "expiring");
    const criticalQualifications = qualificationRows.filter((row) => row.status === "expired" || row.status === "expiring");
    return {
      activeEmployees: employeeRows.filter((row) => row.employmentStatus === "active").length,
      expiringResidencies: criticalResidencies.length,
      expiringQualifications: criticalQualifications.length,
      expiredCompliance: [...residencyRows, ...qualificationRows].filter((row) => row.status === "expired").length
    };
  }),
  createEmployee: adminProcedure.input(employeeInput.extend({ residency: residencyInput.optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const { residency, ...employeeValues } = input;
    const result = await db.insert(employees).values({
      ...employeeValues,
      joiningDate: toDbDate2(employeeValues.joiningDate),
      passportExpiryAt: toDbDate2(employeeValues.passportExpiryAt)
    });
    const employeeId = insertId2(result);
    if (residency) {
      await db.insert(residencyPermits).values({
        ...residency,
        employeeId,
        issueDate: toDbDate2(residency.issueDate),
        expiryDate: toDbDate2(residency.expiryDate),
        status: residencyComplianceStatus(residency.expiryDate)
      });
    }
    await audit2({ actorUserId: ctx.user.id, entityType: "employee", entityId: employeeId, action: "create", summary: `\u0625\u0636\u0627\u0641\u0629 \u0645\u0644\u0641 \u0627\u0644\u0639\u0627\u0645\u0644 ${input.employeeNo}`, after: input });
    return { id: employeeId };
  }),
  updateEmployee: adminProcedure.input(idField.merge(employeeInput.partial())).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employees).where(eq3(employees.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.");
    const { id, joiningDate, passportExpiryAt, ...values } = input;
    const updateValues = { ...values };
    if (joiningDate !== void 0) updateValues.joiningDate = toDbDate2(joiningDate);
    if (passportExpiryAt !== void 0) updateValues.passportExpiryAt = toDbDate2(passportExpiryAt);
    await db.update(employees).set(updateValues).where(eq3(employees.id, id));
    await audit2({ actorUserId: ctx.user.id, entityType: "employee", entityId: id, action: "update", summary: `\u062A\u0639\u062F\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u0639\u0627\u0645\u0644 ${before.employeeNo}`, before, after: values });
    return { success: true };
  }),
  deleteEmployee: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employees).where(eq3(employees.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.");
    await db.delete(employees).where(eq3(employees.id, input.id));
    await audit2({ actorUserId: ctx.user.id, entityType: "employee", entityId: input.id, action: "delete", summary: `\u062D\u0630\u0641 \u0645\u0644\u0641 \u0627\u0644\u0639\u0627\u0645\u0644 ${before.employeeNo}`, before });
    return { success: true };
  }),
  renewResidency: adminProcedure.input(z2.object({ employeeId: z2.number().int().positive(), expiryDate: dateField2, renewalReference: z2.string().trim().max(80).nullable().optional(), renewalNotes: optionalText2 })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(residencyPermits).where(eq3(residencyPermits.employeeId, input.employeeId)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0627 \u064A\u0648\u062C\u062F \u0633\u062C\u0644 \u0625\u0642\u0627\u0645\u0629 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0630\u0627 \u0627\u0644\u0639\u0627\u0645\u0644.");
    const status = residencyComplianceStatus(input.expiryDate);
    await db.update(residencyPermits).set({ expiryDate: toDbDate2(input.expiryDate), renewalReference: input.renewalReference, renewalNotes: input.renewalNotes, lastRenewedAt: /* @__PURE__ */ new Date(), status }).where(eq3(residencyPermits.employeeId, input.employeeId));
    await audit2({ actorUserId: ctx.user.id, entityType: "residency", entityId: before.id, action: "renew", summary: `\u062A\u062C\u062F\u064A\u062F \u0625\u0642\u0627\u0645\u0629 \u0627\u0644\u0639\u0627\u0645\u0644 \u0631\u0642\u0645 ${before.employeeId}`, before, after: input });
    return { success: true, status };
  }),
  createQualification: adminProcedure.input(qualificationInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const status = input.status === "not_required" ? "not_required" : qualificationComplianceStatus(input.expiryDate);
    const result = await db.insert(employeeQualifications).values({ ...input, issuedDate: toDbDate2(input.issuedDate), expiryDate: toDbDate2(input.expiryDate), status });
    const id = insertId2(result);
    await audit2({ actorUserId: ctx.user.id, entityType: "qualification", entityId: id, action: "create", summary: `\u0625\u0636\u0627\u0641\u0629 \u0645\u0624\u0647\u0644 ${input.name}`, after: input });
    return { id };
  }),
  updateQualification: adminProcedure.input(idField.merge(qualificationInput.omit({ employeeId: true }).partial())).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeQualifications).where(eq3(employeeQualifications.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0624\u0647\u0644.");
    const { id, issuedDate, expiryDate, ...values } = input;
    const updateValues = { ...values };
    if (issuedDate !== void 0) updateValues.issuedDate = toDbDate2(issuedDate);
    if (expiryDate !== void 0) updateValues.expiryDate = toDbDate2(expiryDate);
    await db.update(employeeQualifications).set(updateValues).where(eq3(employeeQualifications.id, id));
    await audit2({ actorUserId: ctx.user.id, entityType: "qualification", entityId: id, action: "update", summary: `\u062A\u0639\u062F\u064A\u0644 \u0645\u0624\u0647\u0644 ${before.name}`, before, after: values });
    return { success: true };
  }),
  deleteQualification: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeQualifications).where(eq3(employeeQualifications.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0624\u0647\u0644.");
    await db.delete(employeeQualifications).where(eq3(employeeQualifications.id, input.id));
    await audit2({ actorUserId: ctx.user.id, entityType: "qualification", entityId: input.id, action: "delete", summary: `\u062D\u0630\u0641 \u0645\u0624\u0647\u0644 ${before.name}`, before });
    return { success: true };
  }),
  createDocument: adminProcedure.input(documentInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(employeeDocuments).values({ ...input, expiryDate: toDbDate2(input.expiryDate) });
    const id = insertId2(result);
    await audit2({ actorUserId: ctx.user.id, entityType: "document", entityId: id, action: "create", summary: `\u0625\u0636\u0627\u0641\u0629 \u0648\u062B\u064A\u0642\u0629 ${input.title}`, after: input });
    return { id };
  }),
  updateDocument: adminProcedure.input(idField.merge(documentInput.omit({ employeeId: true }).partial())).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeDocuments).where(eq3(employeeDocuments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0648\u062B\u064A\u0642\u0629.");
    const { id, expiryDate, ...values } = input;
    const updateValues = { ...values };
    if (expiryDate !== void 0) updateValues.expiryDate = toDbDate2(expiryDate);
    await db.update(employeeDocuments).set(updateValues).where(eq3(employeeDocuments.id, id));
    await audit2({ actorUserId: ctx.user.id, entityType: "document", entityId: id, action: "update", summary: `\u062A\u0639\u062F\u064A\u0644 \u0648\u062B\u064A\u0642\u0629 ${before.title}`, before, after: values });
    return { success: true };
  }),
  deleteDocument: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeDocuments).where(eq3(employeeDocuments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0648\u062B\u064A\u0642\u0629.");
    await db.delete(employeeDocuments).where(eq3(employeeDocuments.id, input.id));
    await audit2({ actorUserId: ctx.user.id, entityType: "document", entityId: input.id, action: "delete", summary: `\u062D\u0630\u0641 \u0648\u062B\u064A\u0642\u0629 ${before.title}`, before });
    return { success: true };
  }),
  assignEmployee: adminProcedure.input(assignmentInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(employeeAssignments).values({ ...input, startDate: toDbDate2(input.startDate), endDate: toDbDate2(input.endDate), status: "active" });
    const assignmentId = insertId2(result);
    await db.update(employees).set({ primaryProjectId: input.projectId }).where(eq3(employees.id, input.employeeId));
    await audit2({ actorUserId: ctx.user.id, entityType: "assignment", entityId: assignmentId, action: "assign", summary: `\u062A\u0639\u064A\u064A\u0646 \u0639\u0627\u0645\u0644 \u0639\u0644\u0649 \u0645\u0634\u0631\u0648\u0639 \u0631\u0642\u0645 ${input.projectId}`, after: input });
    return { id: assignmentId };
  }),
  updateAssignment: adminProcedure.input(idField.merge(z2.object({
    projectId: z2.number().int().positive().optional(),
    roleOnProject: z2.string().trim().min(2).max(160).optional(),
    startDate: dateField2.optional(),
    endDate: optionalDateField,
    status: z2.enum(["active", "completed", "cancelled"]).optional(),
    notes: optionalText2
  }))).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeAssignments).where(eq3(employeeAssignments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u062A\u0643\u0644\u064A\u0641.");
    const { id, startDate, endDate, ...values } = input;
    const updateValues = { ...values };
    if (startDate !== void 0) updateValues.startDate = toDbDate2(startDate);
    if (endDate !== void 0) updateValues.endDate = toDbDate2(endDate);
    await db.update(employeeAssignments).set(updateValues).where(eq3(employeeAssignments.id, id));
    await audit2({ actorUserId: ctx.user.id, entityType: "assignment", entityId: id, action: "update", summary: `\u062A\u0639\u062F\u064A\u0644 \u062A\u0643\u0644\u064A\u0641 \u0627\u0644\u0639\u0627\u0645\u0644 \u0631\u0642\u0645 ${before.employeeId}`, before, after: values });
    return { success: true };
  }),
  unassignEmployee: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeAssignments).where(eq3(employeeAssignments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u062A\u0643\u0644\u064A\u0641.");
    await db.update(employeeAssignments).set({ status: "cancelled", endDate: /* @__PURE__ */ new Date() }).where(eq3(employeeAssignments.id, input.id));
    await audit2({ actorUserId: ctx.user.id, entityType: "assignment", entityId: input.id, action: "unassign", summary: `\u0625\u0644\u063A\u0627\u0621 \u062A\u0643\u0644\u064A\u0641 \u0627\u0644\u0639\u0627\u0645\u0644 \u0631\u0642\u0645 ${before.employeeId}`, before });
    return { success: true };
  }),
  refreshCompliance: adminProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const [residencies, qualifications] = await Promise.all([db.select().from(residencyPermits), db.select().from(employeeQualifications)]);
    let changed = 0;
    for (const residency of residencies) {
      const nextStatus = residencyComplianceStatus(residency.expiryDate);
      if (residency.status !== nextStatus) {
        await db.update(residencyPermits).set({ status: nextStatus }).where(eq3(residencyPermits.id, residency.id));
        changed += 1;
      }
    }
    for (const qualification of qualifications) {
      const nextStatus = qualification.status === "not_required" ? "not_required" : qualificationComplianceStatus(qualification.expiryDate);
      if (qualification.status !== nextStatus) {
        await db.update(employeeQualifications).set({ status: nextStatus }).where(eq3(employeeQualifications.id, qualification.id));
        changed += 1;
      }
    }
    await audit2({ actorUserId: ctx.user.id, entityType: "compliance", entityId: 0, action: "update", summary: `\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644: ${changed} \u0633\u062C\u0644\u0627\u064B` });
    return { changed };
  }),
  listAudit: adminProcedure.input(z2.object({ entityType: z2.string().trim().max(60).optional(), entityId: z2.number().int().positive().optional() }).optional()).query(async ({ input }) => {
    const db = await requireDb();
    if (input?.entityType && input.entityId) {
      return db.select().from(operationalAuditLogs).where(and(eq3(operationalAuditLogs.entityType, input.entityType), eq3(operationalAuditLogs.entityId, input.entityId))).orderBy(asc2(operationalAuditLogs.createdAt));
    }
    return db.select().from(operationalAuditLogs).orderBy(asc2(operationalAuditLogs.createdAt));
  })
});

// server/routers/users.ts
import { asc as asc3, eq as eq4 } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z as z3 } from "zod";
var userInput = z3.object({
  username: z3.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u064A\u0642\u0628\u0644 \u0627\u0644\u062D\u0631\u0648\u0641 \u0648\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0648\u0627\u0644\u0646\u0642\u0637\u0629 \u0648\u0627\u0644\u0634\u0631\u0637\u0629 \u0641\u0642\u0637."),
  name: z3.string().trim().min(2).max(160),
  email: z3.string().trim().email().max(320).nullable().optional(),
  password: z3.string().min(10).max(128),
  role: z3.enum(userRoles)
});
var updateUserInput = z3.object({
  id: z3.number().int().positive(),
  name: z3.string().trim().min(2).max(160).optional(),
  email: z3.string().trim().email().max(320).nullable().optional(),
  password: z3.string().min(10).max(128).optional(),
  role: z3.enum(userRoles).optional(),
  active: z3.enum(["yes", "no"]).optional()
});
async function audit3(actorUserId, entityId, action, summary) {
  const db = await requireDb();
  await db.insert(operationalAuditLogs).values({ actorUserId, entityType: "user", entityId, action, summary });
}
var usersRouter = router({
  list: systemAdminProcedure.query(async () => {
    const db = await requireDb();
    return db.select({ id: users.id, openId: users.openId, username: users.username, name: users.name, email: users.email, role: users.role, active: users.active, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt }).from(users).orderBy(asc3(users.createdAt));
  }),
  create: systemAdminProcedure.input(userInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const passwordHash = await hashPassword(input.password);
    const result = await db.insert(users).values({ openId: `local-${randomUUID()}`, username: input.username, passwordHash, name: input.name, email: input.email ?? null, loginMethod: "local", role: input.role, active: "yes", lastSignedIn: /* @__PURE__ */ new Date() });
    const value = Array.isArray(result) ? result[0] : result;
    const id = Number(value.insertId ?? 0);
    await audit3(ctx.user.id, id, "create", `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${input.username} \u0628\u0627\u0644\u062F\u0648\u0631 ${input.role}`);
    return { id };
  }),
  update: systemAdminProcedure.input(updateUserInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const user = (await db.select().from(users).where(eq4(users.id, input.id)).limit(1))[0];
    if (!user) throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    if (user.openId === "fiberops-local-admin" && (input.active === "no" || input.role && input.role !== "admin")) {
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u0637\u064A\u0644 \u0623\u0648 \u062A\u062E\u0641\u064A\u0636 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0623\u0648\u0644\u064A \u0645\u0646 \u0627\u0644\u0648\u0627\u062C\u0647\u0629.");
    }
    const { id, password, ...values } = input;
    const patch = { ...values };
    if (password) patch.passwordHash = await hashPassword(password);
    await db.update(users).set(patch).where(eq4(users.id, id));
    await audit3(ctx.user.id, id, "update", `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.username ?? user.name ?? id}`);
    return { success: true };
  })
});

// server/routers/demo.ts
import { eq as eq5, sql } from "drizzle-orm";
import { z as z4 } from "zod";
function insertedId(result) {
  const value = Array.isArray(result) ? result[0] : result;
  return Number(value.insertId ?? 0);
}
var demoRouter = router({
  status: systemAdminProcedure.query(async () => {
    const db = await requireDb();
    const rows = await db.select({ id: employees.id }).from(employees).limit(1);
    return { populated: rows.length > 0 };
  }),
  seed: systemAdminProcedure.input(z4.object({ confirmation: z4.literal("\u062A\u0647\u064A\u0626\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629") })).mutation(async ({ ctx }) => {
    const db = await requireDb();
    const existing = await db.select({ id: employees.id }).from(employees).limit(1);
    if (existing.length > 0) {
      return { inserted: false, message: "\u0644\u0645 \u062A\u064F\u0636\u0641 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0644\u0623\u0646 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u062A\u062D\u062A\u0648\u064A \u0628\u0627\u0644\u0641\u0639\u0644 \u0639\u0644\u0649 \u0645\u0644\u0641\u0627\u062A \u0639\u0645\u0627\u0644\u0629." };
    }
    const fieldDepartmentId = insertedId(await db.insert(departments).values({ name: "\u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", code: "DEMO-FIELD", managerName: "\u0645\u0633\u0624\u0648\u0644 \u062A\u0634\u063A\u064A\u0644 \u062A\u062C\u0631\u064A\u0628\u064A", active: "yes" }));
    const nocDepartmentId = insertedId(await db.insert(departments).values({ name: "\u0636\u0645\u0627\u0646 \u0627\u0644\u062C\u0648\u062F\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", code: "DEMO-QA", managerName: "\u0645\u0633\u0624\u0648\u0644 \u062C\u0648\u062F\u0629 \u062A\u062C\u0631\u064A\u0628\u064A", active: "yes" }));
    const riyadhProjectId = insertedId(await db.insert(projects).values({ code: "DEMO-FTTH-RYD-01", name: "\u062A\u0648\u0633\u0639\u0629 FTTH \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u2014 \u0646\u0637\u0627\u0642 \u0627\u0644\u0631\u064A\u0627\u0636", clientName: "\u062C\u0647\u0629 \u0627\u062E\u062A\u0628\u0627\u0631", status: "active", startDate: /* @__PURE__ */ new Date("2026-01-15"), targetDate: /* @__PURE__ */ new Date("2026-11-30") }));
    const jeddahProjectId = insertedId(await db.insert(projects).values({ code: "DEMO-FTTH-JED-02", name: "\u0631\u0628\u0637 \u0645\u0646\u0627\u0637\u0642 FTTH \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u2014 \u0646\u0637\u0627\u0642 \u062C\u062F\u0629", clientName: "\u062C\u0647\u0629 \u0627\u062E\u062A\u0628\u0627\u0631", status: "planning", startDate: /* @__PURE__ */ new Date("2026-08-01"), targetDate: /* @__PURE__ */ new Date("2027-02-28") }));
    const employeeSeeds = [
      ["DEMO-001", "\u0633\u0627\u0645\u064A", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0645\u0634\u0631\u0641 \u062A\u0645\u062F\u064A\u062F", "\u0633\u0639\u0648\u062F\u064A", fieldDepartmentId, riyadhProjectId],
      ["DEMO-002", "\u0646\u0627\u062F\u0631", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0641\u0646\u064A \u0644\u062D\u0627\u0645 \u0623\u0644\u064A\u0627\u0641", "\u0645\u0635\u0631\u064A", fieldDepartmentId, riyadhProjectId],
      ["DEMO-003", "\u0639\u0645\u0631", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0641\u0646\u064A OTDR", "\u0623\u0631\u062F\u0646\u064A", nocDepartmentId, riyadhProjectId],
      ["DEMO-004", "\u062E\u0627\u0644\u062F", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0641\u0646\u064A \u0633\u062D\u0628 \u0643\u0627\u0628\u0644\u0627\u062A", "\u0647\u0646\u062F\u064A", fieldDepartmentId, riyadhProjectId],
      ["DEMO-005", "\u0645\u0627\u0647\u0631", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0645\u0631\u0627\u0642\u0628 \u0633\u0644\u0627\u0645\u0629", "\u0628\u0627\u0643\u0633\u062A\u0627\u0646\u064A", nocDepartmentId, jeddahProjectId],
      ["DEMO-006", "\u0641\u0647\u062F", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0645\u0646\u0633\u0642 \u062A\u0635\u0627\u0631\u064A\u062D", "\u0633\u0639\u0648\u062F\u064A", nocDepartmentId, jeddahProjectId]
    ];
    const employeeIds = [];
    for (const [employeeNo, firstName, lastName, jobTitle, nationality, departmentId, primaryProjectId] of employeeSeeds) {
      employeeIds.push(insertedId(await db.insert(employees).values({ employeeNo, firstName, lastName, jobTitle, nationality, phone: "+966500000000", email: `${employeeNo.toLowerCase()}@example.test`, passportNumber: `P-${employeeNo}`, passportExpiryAt: /* @__PURE__ */ new Date("2028-12-31"), joiningDate: /* @__PURE__ */ new Date("2025-01-01"), employmentStatus: "active", departmentId, primaryProjectId, emergencyContactName: "\u0627\u062A\u0635\u0627\u0644 \u062A\u062C\u0631\u064A\u0628\u064A", emergencyContactPhone: "+966511111111", notes: "\u0633\u062C\u0644 \u062A\u062C\u0631\u064A\u0628\u064A \u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0639\u062F\u064A\u0644 \u0623\u0648 \u0627\u0644\u062D\u0630\u0641." })));
    }
    const residencyDates = ["2027-03-15", "2026-09-18", "2026-05-30", "2027-01-12", "2026-10-02", "2027-06-01"];
    for (let index2 = 0; index2 < employeeIds.length; index2 += 1) {
      const employeeId = employeeIds[index2];
      const expiry = residencyDates[index2];
      await db.insert(residencyPermits).values({ employeeId, iqamaNumber: `DEMO-IQ-${String(index2 + 1).padStart(3, "0")}`, sponsorName: "\u0631\u0627\u0639\u064A \u062A\u062C\u0631\u064A\u0628\u064A", issueDate: /* @__PURE__ */ new Date("2025-01-01"), expiryDate: new Date(expiry), status: index2 === 2 ? "expired" : index2 === 1 || index2 === 4 ? "expiring" : "valid", renewalReference: null, renewalNotes: "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629" });
      await db.insert(employeeQualifications).values({ employeeId, name: index2 === 1 ? "Fiber Optic Splicing" : "\u0633\u0644\u0627\u0645\u0629 \u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0623\u0644\u064A\u0627\u0641", issuer: "\u0645\u0639\u0647\u062F \u062A\u062F\u0631\u064A\u0628\u064A \u062A\u062C\u0631\u064A\u0628\u064A", certificateNumber: `DEMO-CERT-${index2 + 1}`, issuedDate: /* @__PURE__ */ new Date("2025-02-01"), expiryDate: /* @__PURE__ */ new Date(index2 === 3 ? "2026-06-20" : index2 === 0 ? "2026-09-25" : "2027-02-01"), status: index2 === 3 ? "expired" : index2 === 0 ? "expiring" : "valid", notes: "\u0645\u0624\u0647\u0644 \u062A\u062C\u0631\u064A\u0628\u064A" });
    }
    for (const employeeId of employeeIds.slice(0, 4)) {
      await db.insert(employeeDocuments).values({ employeeId, documentType: "contract", title: "\u0639\u0642\u062F \u0639\u0645\u0644 \u062A\u062C\u0631\u064A\u0628\u064A", referenceNumber: `DEMO-CON-${employeeId}`, expiryDate: /* @__PURE__ */ new Date("2027-12-31"), notes: "\u0648\u062B\u064A\u0642\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629" });
    }
    for (let index2 = 0; index2 < employeeIds.slice(0, 5).length; index2 += 1) {
      const employeeId = employeeIds[index2];
      await db.insert(employeeAssignments).values({ employeeId, projectId: index2 === 4 ? jeddahProjectId : riyadhProjectId, roleOnProject: index2 === 0 ? "\u0645\u0634\u0631\u0641 \u0641\u0631\u064A\u0642" : "\u0641\u0646\u064A \u062A\u0646\u0641\u064A\u0630", startDate: /* @__PURE__ */ new Date("2026-02-01"), endDate: null, status: "active", notes: "\u062A\u0643\u0644\u064A\u0641 \u062A\u062C\u0631\u064A\u0628\u064A" });
    }
    await db.insert(fiberDrums).values([
      { drumId: "DEMO-DRUM-001", fiberSpec: "G.652D Single Mode", coreCount: 144, supplier: "\u0645\u0648\u0631\u062F \u062A\u062C\u0631\u064A\u0628\u064A", totalMeters: 4e3, remainingMeters: 650, minimumMeters: 800, assignedProjectId: riyadhProjectId, storageLocation: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0631\u064A\u0627\u0636 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", status: "low_stock" },
      { drumId: "DEMO-DRUM-002", fiberSpec: "G.657A2 Drop Cable", coreCount: 24, supplier: "\u0645\u0648\u0631\u062F \u062A\u062C\u0631\u064A\u0628\u064A", totalMeters: 2500, remainingMeters: 2500, minimumMeters: 500, assignedProjectId: null, storageLocation: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0631\u064A\u0627\u0636 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", status: "available" },
      { drumId: "DEMO-DRUM-003", fiberSpec: "G.652D Single Mode", coreCount: 96, supplier: "\u0645\u0648\u0631\u062F \u062A\u062C\u0631\u064A\u0628\u064A", totalMeters: 3e3, remainingMeters: 0, minimumMeters: 600, assignedProjectId: riyadhProjectId, storageLocation: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", status: "depleted" }
    ]);
    await db.insert(fieldEquipment).values([
      { assetTag: "DEMO-OTDR-001", name: "\u062C\u0647\u0627\u0632 OTDR \u062A\u062C\u0631\u064A\u0628\u064A", category: "otdr", serialNumber: "OTDR-DEMO-01", calibrationDueAt: /* @__PURE__ */ new Date("2026-09-10"), status: "calibration_due", assignedEmployeeId: employeeIds[2] },
      { assetTag: "DEMO-SP-001", name: "\u0622\u0644\u0629 \u0644\u062D\u0627\u0645 \u0623\u0644\u064A\u0627\u0641 \u062A\u062C\u0631\u064A\u0628\u064A\u0629", category: "splicer", serialNumber: "SP-DEMO-01", calibrationDueAt: /* @__PURE__ */ new Date("2027-03-01"), status: "assigned", assignedEmployeeId: employeeIds[1] },
      { assetTag: "DEMO-PM-001", name: "\u0645\u0642\u064A\u0627\u0633 \u0642\u062F\u0631\u0629 \u062A\u062C\u0631\u064A\u0628\u064A", category: "power_meter", serialNumber: "PM-DEMO-01", calibrationDueAt: /* @__PURE__ */ new Date("2027-01-15"), status: "ready", assignedEmployeeId: null }
    ]);
    const permit1 = insertedId(await db.insert(permits).values({ permitNo: "DEMO-PERMIT-001", issuer: "municipality", routeName: "\u0645\u0633\u0627\u0631 \u062D\u064A \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0623", projectId: riyadhProjectId, startDate: /* @__PURE__ */ new Date("2026-05-01"), expiryDate: /* @__PURE__ */ new Date("2026-09-12"), status: "expiring", renewalReference: "DEMO-RNW-01", notes: "\u062A\u0635\u0631\u064A\u062D \u062A\u062C\u0631\u064A\u0628\u064A" }));
    const permit2 = insertedId(await db.insert(permits).values({ permitNo: "DEMO-PERMIT-002", issuer: "traffic", routeName: "\u0639\u0628\u0648\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0628", projectId: riyadhProjectId, startDate: /* @__PURE__ */ new Date("2026-02-01"), expiryDate: /* @__PURE__ */ new Date("2026-06-15"), status: "expired", renewalReference: null, notes: "\u062A\u0635\u0631\u064A\u062D \u062A\u062C\u0631\u064A\u0628\u064A" }));
    await db.insert(workRoutes).values([
      { routeCode: "DEMO-RT-001", name: "\u0645\u0633\u0627\u0631 \u062A\u0645\u062F\u064A\u062F \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0623", projectId: riyadhProjectId, contractorName: "\u0641\u0631\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631", stage: "splicing", progressPercent: 72, permitId: permit1, status: "active" },
      { routeCode: "DEMO-RT-002", name: "\u0645\u0633\u0627\u0631 \u0639\u0628\u0648\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0628", projectId: riyadhProjectId, contractorName: "\u0641\u0631\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631", stage: "civil", progressPercent: 38, permitId: permit2, status: "blocked" },
      { routeCode: "DEMO-RT-003", name: "\u0645\u0633\u0627\u0631 \u062A\u0648\u0633\u0639\u0629 \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u062C", projectId: jeddahProjectId, contractorName: "\u0641\u0631\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631", stage: "pulling", progressPercent: 14, permitId: null, status: "active" }
    ]);
    await db.insert(operationalAuditLogs).values({ actorUserId: ctx.user.id, entityType: "demo_seed", entityId: 0, action: "create", summary: "\u062A\u0639\u0628\u0626\u0629 \u0628\u064A\u0627\u0646\u0627\u062A FiberOps \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0627\u0644\u0623\u0648\u0644\u0649" });
    return { inserted: true, message: "\u062A\u0645\u062A \u062A\u0639\u0628\u0626\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0628\u0646\u062C\u0627\u062D. \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 \u0623\u064A \u0633\u062C\u0644 \u0623\u0648 \u062D\u0630\u0641\u0647 \u0645\u0646 \u0627\u0644\u0648\u0627\u062C\u0647\u0629." };
  }),
  repairArabic: systemAdminProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const existing = await db.select({ id: employees.id }).from(employees).where(eq5(employees.employeeNo, "DEMO-001")).limit(1);
    if (existing.length === 0) {
      return { repaired: false, message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u062A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u0625\u0635\u0644\u0627\u062D." };
    }
    await db.execute(sql.raw("ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
    for (const table of ["users", "departments", "projects", "employees", "residencyPermits", "employeeQualifications", "employeeDocuments", "employeeAssignments", "fiberDrums", "fieldEquipment", "permits", "workRoutes", "operationalAuditLogs"]) {
      await db.execute(sql.raw(`ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`));
    }
    await db.update(departments).set({ name: "\u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", managerName: "\u0645\u0633\u0624\u0648\u0644 \u062A\u0634\u063A\u064A\u0644 \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(departments.code, "DEMO-FIELD"));
    await db.update(departments).set({ name: "\u0636\u0645\u0627\u0646 \u0627\u0644\u062C\u0648\u062F\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", managerName: "\u0645\u0633\u0624\u0648\u0644 \u062C\u0648\u062F\u0629 \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(departments.code, "DEMO-QA"));
    await db.update(projects).set({ name: "\u062A\u0648\u0633\u0639\u0629 FTTH \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u2014 \u0646\u0637\u0627\u0642 \u0627\u0644\u0631\u064A\u0627\u0636", clientName: "\u062C\u0647\u0629 \u0627\u062E\u062A\u0628\u0627\u0631" }).where(eq5(projects.code, "DEMO-FTTH-RYD-01"));
    await db.update(projects).set({ name: "\u0631\u0628\u0637 \u0645\u0646\u0627\u0637\u0642 FTTH \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u2014 \u0646\u0637\u0627\u0642 \u062C\u062F\u0629", clientName: "\u062C\u0647\u0629 \u0627\u062E\u062A\u0628\u0627\u0631" }).where(eq5(projects.code, "DEMO-FTTH-JED-02"));
    const employeeRepairs = [
      ["DEMO-001", "\u0633\u0627\u0645\u064A", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0645\u0634\u0631\u0641 \u062A\u0645\u062F\u064A\u062F", "\u0633\u0639\u0648\u062F\u064A"],
      ["DEMO-002", "\u0646\u0627\u062F\u0631", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0641\u0646\u064A \u0644\u062D\u0627\u0645 \u0623\u0644\u064A\u0627\u0641", "\u0645\u0635\u0631\u064A"],
      ["DEMO-003", "\u0639\u0645\u0631", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0641\u0646\u064A OTDR", "\u0623\u0631\u062F\u0646\u064A"],
      ["DEMO-004", "\u062E\u0627\u0644\u062F", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0641\u0646\u064A \u0633\u062D\u0628 \u0643\u0627\u0628\u0644\u0627\u062A", "\u0647\u0646\u062F\u064A"],
      ["DEMO-005", "\u0645\u0627\u0647\u0631", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0645\u0631\u0627\u0642\u0628 \u0633\u0644\u0627\u0645\u0629", "\u0628\u0627\u0643\u0633\u062A\u0627\u0646\u064A"],
      ["DEMO-006", "\u0641\u0647\u062F", "\u062A\u062C\u0631\u064A\u0628\u064A", "\u0645\u0646\u0633\u0642 \u062A\u0635\u0627\u0631\u064A\u062D", "\u0633\u0639\u0648\u062F\u064A"]
    ];
    for (const [employeeNo, firstName, lastName, jobTitle, nationality] of employeeRepairs) {
      await db.update(employees).set({ firstName, lastName, jobTitle, nationality, emergencyContactName: "\u0627\u062A\u0635\u0627\u0644 \u062A\u062C\u0631\u064A\u0628\u064A", notes: "\u0633\u062C\u0644 \u062A\u062C\u0631\u064A\u0628\u064A \u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0639\u062F\u064A\u0644 \u0623\u0648 \u0627\u0644\u062D\u0630\u0641." }).where(eq5(employees.employeeNo, employeeNo));
    }
    for (let index2 = 1; index2 <= 6; index2 += 1) {
      await db.update(residencyPermits).set({ sponsorName: "\u0631\u0627\u0639\u064A \u062A\u062C\u0631\u064A\u0628\u064A", renewalNotes: "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629" }).where(eq5(residencyPermits.iqamaNumber, `DEMO-IQ-${String(index2).padStart(3, "0")}`));
      await db.update(employeeQualifications).set({ issuer: "\u0645\u0639\u0647\u062F \u062A\u062F\u0631\u064A\u0628\u064A \u062A\u062C\u0631\u064A\u0628\u064A", notes: "\u0645\u0624\u0647\u0644 \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(employeeQualifications.certificateNumber, `DEMO-CERT-${index2}`));
    }
    await db.update(employeeQualifications).set({ name: "\u0633\u0644\u0627\u0645\u0629 \u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0623\u0644\u064A\u0627\u0641" }).where(eq5(employeeQualifications.certificateNumber, "DEMO-CERT-1"));
    await db.update(employeeQualifications).set({ name: "Fiber Optic Splicing" }).where(eq5(employeeQualifications.certificateNumber, "DEMO-CERT-2"));
    await db.update(employeeQualifications).set({ name: "\u0642\u064A\u0627\u0633\u0627\u062A OTDR" }).where(eq5(employeeQualifications.certificateNumber, "DEMO-CERT-3"));
    await db.update(employeeQualifications).set({ name: "\u0633\u0644\u0627\u0645\u0629 \u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0623\u0644\u064A\u0627\u0641" }).where(eq5(employeeQualifications.certificateNumber, "DEMO-CERT-4"));
    await db.update(employeeQualifications).set({ name: "\u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0647\u0646\u064A\u0629" }).where(eq5(employeeQualifications.certificateNumber, "DEMO-CERT-5"));
    await db.update(employeeQualifications).set({ name: "\u0625\u062F\u0627\u0631\u0629 \u062A\u0635\u0627\u0631\u064A\u062D \u0627\u0644\u062D\u0641\u0631" }).where(eq5(employeeQualifications.certificateNumber, "DEMO-CERT-6"));
    await db.update(employeeDocuments).set({ title: "\u0639\u0642\u062F \u0639\u0645\u0644 \u062A\u062C\u0631\u064A\u0628\u064A", notes: "\u0648\u062B\u064A\u0642\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629" }).where(eq5(employeeDocuments.referenceNumber, "DEMO-CON-001"));
    await db.update(employeeDocuments).set({ title: "\u0639\u0642\u062F \u0639\u0645\u0644 \u062A\u062C\u0631\u064A\u0628\u064A", notes: "\u0648\u062B\u064A\u0642\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629" }).where(eq5(employeeDocuments.referenceNumber, "DEMO-CON-002"));
    await db.update(employeeDocuments).set({ title: "\u062A\u0623\u0645\u064A\u0646 \u0637\u0628\u064A \u062A\u062C\u0631\u064A\u0628\u064A", notes: "\u0648\u062B\u064A\u0642\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629" }).where(eq5(employeeDocuments.referenceNumber, "DEMO-INS-003"));
    await db.update(employeeDocuments).set({ title: "\u0647\u0648\u064A\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629", notes: "\u0648\u062B\u064A\u0642\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629" }).where(eq5(employeeDocuments.referenceNumber, "DEMO-ID-004"));
    await db.update(employeeAssignments).set({ roleOnProject: "\u0641\u0646\u064A \u062A\u0646\u0641\u064A\u0630", notes: "\u062A\u0643\u0644\u064A\u0641 \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(employeeAssignments.notes, "????"));
    await db.update(fiberDrums).set({ supplier: "\u0645\u0648\u0631\u062F \u062A\u062C\u0631\u064A\u0628\u064A", storageLocation: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0631\u064A\u0627\u0636 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(fiberDrums.drumId, "DEMO-DRUM-001"));
    await db.update(fiberDrums).set({ supplier: "\u0645\u0648\u0631\u062F \u062A\u062C\u0631\u064A\u0628\u064A", storageLocation: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0631\u064A\u0627\u0636 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(fiberDrums.drumId, "DEMO-DRUM-002"));
    await db.update(fiberDrums).set({ supplier: "\u0645\u0648\u0631\u062F \u062A\u062C\u0631\u064A\u0628\u064A", storageLocation: "\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(fiberDrums.drumId, "DEMO-DRUM-003"));
    await db.update(fieldEquipment).set({ name: "\u062C\u0647\u0627\u0632 OTDR \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(fieldEquipment.assetTag, "DEMO-OTDR-001"));
    await db.update(fieldEquipment).set({ name: "\u0622\u0644\u0629 \u0644\u062D\u0627\u0645 \u0623\u0644\u064A\u0627\u0641 \u062A\u062C\u0631\u064A\u0628\u064A\u0629" }).where(eq5(fieldEquipment.assetTag, "DEMO-SP-001"));
    await db.update(fieldEquipment).set({ name: "\u0645\u0642\u064A\u0627\u0633 \u0642\u062F\u0631\u0629 \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(fieldEquipment.assetTag, "DEMO-PM-001"));
    await db.update(permits).set({ routeName: "\u0645\u0633\u0627\u0631 \u062D\u064A \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0623", notes: "\u062A\u0635\u0631\u064A\u062D \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(permits.permitNo, "DEMO-PERMIT-001"));
    await db.update(permits).set({ routeName: "\u0639\u0628\u0648\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0628", notes: "\u062A\u0635\u0631\u064A\u062D \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(permits.permitNo, "DEMO-PERMIT-002"));
    await db.update(permits).set({ routeName: "\u0627\u0645\u062A\u062F\u0627\u062F \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u062C", notes: "\u062A\u0635\u0631\u064A\u062D \u062A\u062C\u0631\u064A\u0628\u064A" }).where(eq5(permits.permitNo, "DEMO-PERMIT-003"));
    await db.update(workRoutes).set({ name: "\u0645\u0633\u0627\u0631 \u062A\u0645\u062F\u064A\u062F \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0623", contractorName: "\u0641\u0631\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631" }).where(eq5(workRoutes.routeCode, "DEMO-RT-001"));
    await db.update(workRoutes).set({ name: "\u0645\u0633\u0627\u0631 \u0639\u0628\u0648\u0631 \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u0628", contractorName: "\u0641\u0631\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631" }).where(eq5(workRoutes.routeCode, "DEMO-RT-002"));
    await db.update(workRoutes).set({ name: "\u0645\u0633\u0627\u0631 \u062A\u0648\u0633\u0639\u0629 \u062A\u062C\u0631\u064A\u0628\u064A \u2014 \u0627\u0644\u0642\u0637\u0627\u0639 \u062C", contractorName: "\u0641\u0631\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631" }).where(eq5(workRoutes.routeCode, "DEMO-RT-003"));
    await db.insert(operationalAuditLogs).values({ actorUserId: ctx.user.id, entityType: "arabic_encoding", entityId: 0, action: "update", summary: "\u0625\u0635\u0644\u0627\u062D \u062A\u0631\u0645\u064A\u0632 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629" });
    return { repaired: true, message: "\u062A\u0645 \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0646\u0635 \u0627\u0644\u0639\u0631\u0628\u064A \u0641\u064A \u062C\u0645\u064A\u0639 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629." };
  })
});

// server/routers.ts
function matchesCredential(value, expected) {
  if (!expected) return false;
  const valueDigest = createHash("sha256").update(value).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual2(valueDigest, expectedDigest);
}
var appRouter = router({
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(
      z5.object({
        username: z5.string().trim().min(1).max(80),
        password: z5.string().min(1).max(256)
      })
    ).mutation(async ({ ctx, input }) => {
      const usernameMatches = matchesCredential(input.username, ENV.localAdminUsername);
      const passwordMatches = matchesCredential(input.password, ENV.localAdminPassword);
      if (usernameMatches && passwordMatches) {
        const openId = "fiberops-local-admin";
        await upsertUser({ openId, name: "\u0645\u0633\u0624\u0648\u0644 FiberOps", email: null, loginMethod: "local", role: "admin", active: "yes", lastSignedIn: /* @__PURE__ */ new Date() });
        const sessionToken2 = await createLocalSessionToken(openId, ONE_YEAR_MS);
        const cookieOptions2 = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken2, { ...cookieOptions2, maxAge: ONE_YEAR_MS });
        return { success: true };
      }
      const user = await getUserByUsername(input.username);
      if (!user || user.active !== "yes" || !await verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629."
        });
      }
      await upsertUser({ openId: user.openId, lastSignedIn: /* @__PURE__ */ new Date() });
      const sessionToken = await createLocalSessionToken(user.openId, ONE_YEAR_MS);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS
      });
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  workforce: workforceRouter,
  operations: operationsRouter,
  users: usersRouter,
  demo: demoRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  user = await getAuthenticatedUser(opts.req);
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/app.ts
async function createFiberOpsApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  return app;
}

// server/vercel-handler.ts
var appPromise;
async function handler(req, res) {
  appPromise ??= createFiberOpsApp();
  const app = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
