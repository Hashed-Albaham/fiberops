import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  departments,
  employees,
  fieldEquipment,
  fiberDrums,
  operationalAuditLogs,
  permits,
  projects,
  workRoutes,
} from "../../drizzle/schema";
import { requireDb } from "../db";
import { adminProcedure, readProcedure, router } from "../_core/trpc";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = dateField.nullable().optional();
const optionalText = z.string().trim().max(500).nullable().optional();
const optionalId = z.number().int().positive().nullable().optional();
const idInput = z.object({ id: z.number().int().positive() });

const departmentInput = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(32), managerName: z.string().trim().max(160).nullable().optional(), active: z.enum(["yes", "no"]).default("yes") });
const projectInput = z.object({ code: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(180), clientName: z.string().trim().max(180).nullable().optional(), status: z.enum(["planning", "active", "paused", "completed"]).default("planning"), startDate: optionalDate, targetDate: optionalDate });
const drumInput = z.object({ drumId: z.string().trim().min(2).max(64), fiberSpec: z.string().trim().min(2).max(180), coreCount: z.number().int().min(1).max(288), supplier: z.string().trim().max(160).nullable().optional(), totalMeters: z.number().int().positive(), remainingMeters: z.number().int().min(0), minimumMeters: z.number().int().min(0).default(0), assignedProjectId: optionalId, storageLocation: z.string().trim().min(2).max(160) });
const equipmentInput = z.object({ assetTag: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(180), category: z.enum(["splicer", "otdr", "power_meter", "safety", "other"]), serialNumber: z.string().trim().max(100).nullable().optional(), calibrationDueAt: optionalDate, status: z.enum(["ready", "assigned", "maintenance", "calibration_due"]).default("ready"), assignedEmployeeId: optionalId });
const permitInput = z.object({ permitNo: z.string().trim().min(2).max(80), issuer: z.enum(["public_works", "traffic", "municipality", "other"]), routeName: z.string().trim().min(2).max(220), projectId: optionalId, startDate: dateField, expiryDate: dateField, renewalReference: z.string().trim().max(80).nullable().optional(), notes: optionalText });
const routeInput = z.object({ routeCode: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(220), projectId: optionalId, contractorName: z.string().trim().max(180).nullable().optional(), stage: z.enum(["civil", "pulling", "splicing", "otdr", "handover"]).default("civil"), progressPercent: z.number().int().min(0).max(100), permitId: optionalId, status: z.enum(["active", "blocked", "completed"]).default("active") });

function toDbDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00`);
}

function insertId(result: unknown) {
  const value = Array.isArray(result) ? result[0] : result;
  return Number((value as { insertId?: number }).insertId ?? 0);
}

function permitStatus(expiryDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remaining = Math.ceil((new Date(`${expiryDate}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
  if (remaining <= 0) return "expired" as const;
  if (remaining <= 60) return "expiring" as const;
  return "valid" as const;
}

function drumStatus(input: { remainingMeters: number; minimumMeters: number; totalMeters: number }) {
  if (input.remainingMeters <= 0) return "depleted" as const;
  if (input.remainingMeters <= input.minimumMeters) return "low_stock" as const;
  if (input.remainingMeters < input.totalMeters) return "allocated" as const;
  return "available" as const;
}

async function audit(actorUserId: number, entityType: string, entityId: number, action: "create" | "update" | "delete" | "renew" | "assign" | "unassign" | "issue", summary: string, before?: unknown, after?: unknown) {
  const db = await requireDb();
  await db.insert(operationalAuditLogs).values({ actorUserId, entityType, entityId, action, summary, beforeJson: before ? JSON.stringify(before) : null, afterJson: after ? JSON.stringify(after) : null });
}

export const operationsRouter = router({
  list: readProcedure.query(async () => {
    const db = await requireDb();
    const [departmentRows, projectRows, drumRows, equipmentRows, permitRows, routeRows, employeeRows] = await Promise.all([
      db.select().from(departments).orderBy(asc(departments.name)),
      db.select().from(projects).orderBy(asc(projects.name)),
      db.select().from(fiberDrums).orderBy(asc(fiberDrums.drumId)),
      db.select().from(fieldEquipment).orderBy(asc(fieldEquipment.assetTag)),
      db.select().from(permits).orderBy(asc(permits.expiryDate)),
      db.select().from(workRoutes).orderBy(asc(workRoutes.routeCode)),
      db.select({ id: employees.id, employeeNo: employees.employeeNo, firstName: employees.firstName, lastName: employees.lastName, jobTitle: employees.jobTitle }).from(employees).orderBy(asc(employees.employeeNo)),
    ]);
    return { departments: departmentRows, projects: projectRows, drums: drumRows, equipment: equipmentRows, permits: permitRows, routes: routeRows, employees: employeeRows };
  }),

  overview: readProcedure.query(async () => {
    const db = await requireDb();
    const [employeeRows, drumRows, equipmentRows, permitRows, routeRows] = await Promise.all([db.select().from(employees), db.select().from(fiberDrums), db.select().from(fieldEquipment), db.select().from(permits), db.select().from(workRoutes)]);
    return {
      employees: employeeRows.filter(row => row.employmentStatus === "active").length,
      lowStockDrums: drumRows.filter(row => row.status === "low_stock" || row.status === "depleted").length,
      calibrationDue: equipmentRows.filter(row => row.status === "calibration_due").length,
      criticalPermits: permitRows.filter(row => row.status === "expired" || row.status === "expiring").length,
      blockedRoutes: routeRows.filter(row => row.status === "blocked").length,
    };
  }),

  createDepartment: adminProcedure.input(departmentInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const result = await db.insert(departments).values(input); const id = insertId(result); await audit(ctx.user.id, "department", id, "create", `إضافة قسم ${input.name}`, undefined, input); return { id }; }),
  updateDepartment: adminProcedure.input(idInput.merge(departmentInput)).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(departments).where(eq(departments.id, input.id)).limit(1))[0]; if (!before) throw new Error("القسم غير موجود."); const { id, ...values } = input; await db.update(departments).set(values).where(eq(departments.id, id)); await audit(ctx.user.id, "department", id, "update", `تعديل قسم ${before.name}`, before, values); return { success: true }; }),
  deleteDepartment: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(departments).where(eq(departments.id, input.id)).limit(1))[0]; if (!before) throw new Error("القسم غير موجود."); await db.delete(departments).where(eq(departments.id, input.id)); await audit(ctx.user.id, "department", input.id, "delete", `حذف قسم ${before.name}`, before); return { success: true }; }),

  createProject: adminProcedure.input(projectInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const result = await db.insert(projects).values({ ...input, startDate: toDbDate(input.startDate), targetDate: toDbDate(input.targetDate) }); const id = insertId(result); await audit(ctx.user.id, "project", id, "create", `إضافة مشروع ${input.code}`, undefined, input); return { id }; }),
  updateProject: adminProcedure.input(idInput.merge(projectInput)).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(projects).where(eq(projects.id, input.id)).limit(1))[0]; if (!before) throw new Error("المشروع غير موجود."); const { id, startDate, targetDate, ...values } = input; await db.update(projects).set({ ...values, startDate: toDbDate(startDate), targetDate: toDbDate(targetDate) }).where(eq(projects.id, id)); await audit(ctx.user.id, "project", id, "update", `تعديل مشروع ${before.code}`, before, values); return { success: true }; }),
  deleteProject: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(projects).where(eq(projects.id, input.id)).limit(1))[0]; if (!before) throw new Error("المشروع غير موجود."); await db.delete(projects).where(eq(projects.id, input.id)); await audit(ctx.user.id, "project", input.id, "delete", `حذف مشروع ${before.code}`, before); return { success: true }; }),

  createDrum: adminProcedure.input(drumInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const status = drumStatus(input); const result = await db.insert(fiberDrums).values({ ...input, status }); const id = insertId(result); await audit(ctx.user.id, "drum", id, "create", `إضافة بكرة ${input.drumId}`, undefined, input); return { id }; }),
  updateDrum: adminProcedure.input(idInput.merge(drumInput)).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(fiberDrums).where(eq(fiberDrums.id, input.id)).limit(1))[0]; if (!before) throw new Error("البكرة غير موجودة."); const { id, ...values } = input; await db.update(fiberDrums).set({ ...values, status: drumStatus(values) }).where(eq(fiberDrums.id, id)); await audit(ctx.user.id, "drum", id, "update", `تعديل بكرة ${before.drumId}`, before, values); return { success: true }; }),
  deleteDrum: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(fiberDrums).where(eq(fiberDrums.id, input.id)).limit(1))[0]; if (!before) throw new Error("البكرة غير موجودة."); await db.delete(fiberDrums).where(eq(fiberDrums.id, input.id)); await audit(ctx.user.id, "drum", input.id, "delete", `حذف بكرة ${before.drumId}`, before); return { success: true }; }),

  createEquipment: adminProcedure.input(equipmentInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const result = await db.insert(fieldEquipment).values({ ...input, calibrationDueAt: toDbDate(input.calibrationDueAt) }); const id = insertId(result); await audit(ctx.user.id, "equipment", id, "create", `إضافة أصل ${input.assetTag}`, undefined, input); return { id }; }),
  updateEquipment: adminProcedure.input(idInput.merge(equipmentInput)).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(fieldEquipment).where(eq(fieldEquipment.id, input.id)).limit(1))[0]; if (!before) throw new Error("المعدة غير موجودة."); const { id, calibrationDueAt, ...values } = input; await db.update(fieldEquipment).set({ ...values, calibrationDueAt: toDbDate(calibrationDueAt) }).where(eq(fieldEquipment.id, id)); await audit(ctx.user.id, "equipment", id, "update", `تعديل أصل ${before.assetTag}`, before, values); return { success: true }; }),
  assignEquipment: adminProcedure.input(z.object({ id: z.number().int().positive(), employeeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(fieldEquipment).where(eq(fieldEquipment.id, input.id)).limit(1))[0]; if (!before) throw new Error("المعدة غير موجودة."); await db.update(fieldEquipment).set({ assignedEmployeeId: input.employeeId, status: "assigned" }).where(eq(fieldEquipment.id, input.id)); await audit(ctx.user.id, "equipment", input.id, "assign", `تعيين أصل ${before.assetTag} للعامل ${input.employeeId}`, before, input); return { success: true }; }),
  releaseEquipment: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(fieldEquipment).where(eq(fieldEquipment.id, input.id)).limit(1))[0]; if (!before) throw new Error("المعدة غير موجودة."); await db.update(fieldEquipment).set({ assignedEmployeeId: null, status: "ready" }).where(eq(fieldEquipment.id, input.id)); await audit(ctx.user.id, "equipment", input.id, "unassign", `إلغاء تعيين أصل ${before.assetTag}`, before); return { success: true }; }),
  deleteEquipment: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(fieldEquipment).where(eq(fieldEquipment.id, input.id)).limit(1))[0]; if (!before) throw new Error("المعدة غير موجودة."); await db.delete(fieldEquipment).where(eq(fieldEquipment.id, input.id)); await audit(ctx.user.id, "equipment", input.id, "delete", `حذف أصل ${before.assetTag}`, before); return { success: true }; }),

  createPermit: adminProcedure.input(permitInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const result = await db.insert(permits).values({ ...input, startDate: toDbDate(input.startDate)!, expiryDate: toDbDate(input.expiryDate)!, status: permitStatus(input.expiryDate) }); const id = insertId(result); await audit(ctx.user.id, "permit", id, "create", `إصدار تصريح ${input.permitNo}`, undefined, input); return { id }; }),
  updatePermit: adminProcedure.input(idInput.merge(permitInput)).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(permits).where(eq(permits.id, input.id)).limit(1))[0]; if (!before) throw new Error("التصريح غير موجود."); const { id, startDate, expiryDate, ...values } = input; await db.update(permits).set({ ...values, startDate: toDbDate(startDate)!, expiryDate: toDbDate(expiryDate)!, status: permitStatus(expiryDate) }).where(eq(permits.id, id)); await audit(ctx.user.id, "permit", id, "update", `تعديل تصريح ${before.permitNo}`, before, values); return { success: true }; }),
  renewPermit: adminProcedure.input(z.object({ id: z.number().int().positive(), expiryDate: dateField, renewalReference: z.string().trim().max(80).nullable().optional(), notes: optionalText })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(permits).where(eq(permits.id, input.id)).limit(1))[0]; if (!before) throw new Error("التصريح غير موجود."); await db.update(permits).set({ expiryDate: toDbDate(input.expiryDate)!, renewalReference: input.renewalReference, notes: input.notes, status: permitStatus(input.expiryDate) }).where(eq(permits.id, input.id)); await audit(ctx.user.id, "permit", input.id, "renew", `تجديد تصريح ${before.permitNo}`, before, input); return { success: true }; }),
  deletePermit: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(permits).where(eq(permits.id, input.id)).limit(1))[0]; if (!before) throw new Error("التصريح غير موجود."); await db.delete(permits).where(eq(permits.id, input.id)); await audit(ctx.user.id, "permit", input.id, "delete", `حذف تصريح ${before.permitNo}`, before); return { success: true }; }),

  createRoute: adminProcedure.input(routeInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const result = await db.insert(workRoutes).values(input); const id = insertId(result); await audit(ctx.user.id, "route", id, "create", `إضافة مسار ${input.routeCode}`, undefined, input); return { id }; }),
  updateRoute: adminProcedure.input(idInput.merge(routeInput)).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(workRoutes).where(eq(workRoutes.id, input.id)).limit(1))[0]; if (!before) throw new Error("المسار غير موجود."); const { id, ...values } = input; await db.update(workRoutes).set(values).where(eq(workRoutes.id, id)); await audit(ctx.user.id, "route", id, "update", `تعديل مسار ${before.routeCode}`, before, values); return { success: true }; }),
  deleteRoute: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); const before = (await db.select().from(workRoutes).where(eq(workRoutes.id, input.id)).limit(1))[0]; if (!before) throw new Error("المسار غير موجود."); await db.delete(workRoutes).where(eq(workRoutes.id, input.id)); await audit(ctx.user.id, "route", input.id, "delete", `حذف مسار ${before.routeCode}`, before); return { success: true }; }),

  refreshPermitStatuses: adminProcedure.mutation(async ({ ctx }) => { const db = await requireDb(); const rows = await db.select().from(permits); let changed = 0; for (const permit of rows) { const nextStatus = permitStatus(permit.expiryDate instanceof Date ? permit.expiryDate.toISOString().slice(0, 10) : String(permit.expiryDate)); if (permit.status !== nextStatus) { await db.update(permits).set({ status: nextStatus }).where(eq(permits.id, permit.id)); changed += 1; } } await audit(ctx.user.id, "permit", 0, "update", `تحديث حالات التصاريح: ${changed} سجلاً`); return { changed }; }),
});
