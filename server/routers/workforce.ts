import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  departments,
  employeeAssignments,
  employeeDocuments,
  employeeQualifications,
  employees,
  operationalAuditLogs,
  projects,
  residencyPermits,
} from "../../drizzle/schema";
import { requireDb } from "../db";
import { adminProcedure, readProcedure, router } from "../_core/trpc";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ يجب أن يكون بصيغة YYYY-MM-DD");
const optionalDateField = dateField.nullable().optional();
const optionalText = z.string().trim().max(500).nullable().optional();
const optionalId = z.number().int().positive().nullable().optional();
const idField = z.object({ id: z.number().int().positive() });

const employeeInput = z.object({
  employeeNo: z.string().trim().min(2).max(40),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  jobTitle: z.string().trim().min(2).max(150),
  nationality: z.string().trim().min(2).max(90),
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  passportNumber: z.string().trim().max(64).nullable().optional(),
  passportExpiryAt: optionalDateField,
  joiningDate: dateField,
  employmentStatus: z.enum(["active", "on_leave", "suspended", "terminated"]).default("active"),
  departmentId: optionalId,
  primaryProjectId: optionalId,
  emergencyContactName: z.string().trim().max(160).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(32).nullable().optional(),
  notes: optionalText,
});

const residencyInput = z.object({
  iqamaNumber: z.string().trim().min(4).max(64),
  sponsorName: z.string().trim().max(180).nullable().optional(),
  issueDate: optionalDateField,
  expiryDate: dateField,
  status: z.enum(["valid", "expiring", "expired", "under_renewal"]).default("valid"),
  renewalReference: z.string().trim().max(80).nullable().optional(),
  renewalNotes: optionalText,
});

const qualificationInput = z.object({
  employeeId: z.number().int().positive(),
  name: z.string().trim().min(2).max(180),
  issuer: z.string().trim().min(2).max(180),
  certificateNumber: z.string().trim().max(100).nullable().optional(),
  issuedDate: optionalDateField,
  expiryDate: optionalDateField,
  status: z.enum(["valid", "expiring", "expired", "not_required"]).default("valid"),
  notes: optionalText,
});

const documentInput = z.object({
  employeeId: z.number().int().positive(),
  documentType: z.enum(["passport", "visa", "medical_insurance", "contract", "identity", "other"]),
  title: z.string().trim().min(2).max(180),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  expiryDate: optionalDateField,
  notes: optionalText,
});

const assignmentInput = z.object({
  employeeId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  roleOnProject: z.string().trim().min(2).max(160),
  startDate: dateField,
  endDate: optionalDateField,
  notes: optionalText,
});

function insertId(result: unknown) {
  const value = Array.isArray(result) ? result[0] : result;
  return Number((value as { insertId?: number }).insertId ?? 0);
}

function toDbDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00`);
}

function daysUntil(dateValue: string | Date) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = dateValue instanceof Date ? dateValue : new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
}

function residencyComplianceStatus(dateValue: string | Date) {
  const remaining = daysUntil(dateValue);
  if (remaining <= 0) return "expired" as const;
  if (remaining <= 60) return "expiring" as const;
  return "valid" as const;
}

function qualificationComplianceStatus(dateValue: string | Date | null | undefined) {
  if (!dateValue) return "not_required" as const;
  return residencyComplianceStatus(dateValue);
}

async function audit(input: {
  actorUserId: number;
  entityType: string;
  entityId: number;
  action: "create" | "update" | "delete" | "renew" | "assign" | "unassign" | "issue";
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  const db = await requireDb();
  await db.insert(operationalAuditLogs).values({
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    summary: input.summary,
    beforeJson: input.before ? JSON.stringify(input.before) : null,
    afterJson: input.after ? JSON.stringify(input.after) : null,
  });
}

export const workforceRouter = router({
  list: readProcedure.query(async () => {
    const db = await requireDb();
    const [employeeRows, departmentRows, projectRows, residencyRows, qualificationRows, documentRows, assignmentRows] = await Promise.all([
      db.select().from(employees).orderBy(asc(employees.employeeNo)),
      db.select().from(departments).orderBy(asc(departments.name)),
      db.select().from(projects).orderBy(asc(projects.name)),
      db.select().from(residencyPermits),
      db.select().from(employeeQualifications),
      db.select().from(employeeDocuments),
      db.select().from(employeeAssignments),
    ]);
    const departmentMap = new Map(departmentRows.map(row => [row.id, row]));
    const projectMap = new Map(projectRows.map(row => [row.id, row]));
    return {
      employees: employeeRows.map(employee => ({
        ...employee,
        department: employee.departmentId ? departmentMap.get(employee.departmentId) ?? null : null,
        project: employee.primaryProjectId ? projectMap.get(employee.primaryProjectId) ?? null : null,
        residency: residencyRows.find(row => row.employeeId === employee.id) ?? null,
        qualifications: qualificationRows.filter(row => row.employeeId === employee.id),
        documents: documentRows.filter(row => row.employeeId === employee.id),
        assignments: assignmentRows.filter(row => row.employeeId === employee.id),
      })),
      departments: departmentRows,
      projects: projectRows,
    };
  }),

  summary: readProcedure.query(async () => {
    const db = await requireDb();
    const [employeeRows, residencyRows, qualificationRows] = await Promise.all([
      db.select().from(employees),
      db.select().from(residencyPermits),
      db.select().from(employeeQualifications),
    ]);
    const criticalResidencies = residencyRows.filter(row => row.status === "expired" || row.status === "expiring");
    const criticalQualifications = qualificationRows.filter(row => row.status === "expired" || row.status === "expiring");
    return {
      activeEmployees: employeeRows.filter(row => row.employmentStatus === "active").length,
      expiringResidencies: criticalResidencies.length,
      expiringQualifications: criticalQualifications.length,
      expiredCompliance: [...residencyRows, ...qualificationRows].filter(row => row.status === "expired").length,
    };
  }),

  createEmployee: adminProcedure.input(employeeInput.extend({ residency: residencyInput.optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const { residency, ...employeeValues } = input;
    const result = await db.insert(employees).values({
      ...employeeValues,
      joiningDate: toDbDate(employeeValues.joiningDate)!,
      passportExpiryAt: toDbDate(employeeValues.passportExpiryAt),
    });
    const employeeId = insertId(result);
    if (residency) {
      await db.insert(residencyPermits).values({
        ...residency,
        employeeId,
        issueDate: toDbDate(residency.issueDate),
        expiryDate: toDbDate(residency.expiryDate)!,
        status: residencyComplianceStatus(residency.expiryDate),
      });
    }
    await audit({ actorUserId: ctx.user.id, entityType: "employee", entityId: employeeId, action: "create", summary: `إضافة ملف العامل ${input.employeeNo}`, after: input });
    return { id: employeeId };
  }),

  updateEmployee: adminProcedure.input(idField.merge(employeeInput.partial())).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employees).where(eq(employees.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على العامل المطلوب.");
    const { id, joiningDate, passportExpiryAt, ...values } = input;
    const updateValues: Partial<typeof employees.$inferInsert> = { ...values };
    if (joiningDate !== undefined) updateValues.joiningDate = toDbDate(joiningDate)!;
    if (passportExpiryAt !== undefined) updateValues.passportExpiryAt = toDbDate(passportExpiryAt);
    await db.update(employees).set(updateValues).where(eq(employees.id, id));
    await audit({ actorUserId: ctx.user.id, entityType: "employee", entityId: id, action: "update", summary: `تعديل ملف العامل ${before.employeeNo}`, before, after: values });
    return { success: true };
  }),

  deleteEmployee: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employees).where(eq(employees.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على العامل المطلوب.");
    await db.delete(employees).where(eq(employees.id, input.id));
    await audit({ actorUserId: ctx.user.id, entityType: "employee", entityId: input.id, action: "delete", summary: `حذف ملف العامل ${before.employeeNo}`, before });
    return { success: true };
  }),

  renewResidency: adminProcedure.input(z.object({ employeeId: z.number().int().positive(), expiryDate: dateField, renewalReference: z.string().trim().max(80).nullable().optional(), renewalNotes: optionalText })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(residencyPermits).where(eq(residencyPermits.employeeId, input.employeeId)).limit(1))[0];
    if (!before) throw new Error("لا يوجد سجل إقامة مرتبط بهذا العامل.");
    const status = residencyComplianceStatus(input.expiryDate);
    await db.update(residencyPermits).set({ expiryDate: toDbDate(input.expiryDate)!, renewalReference: input.renewalReference, renewalNotes: input.renewalNotes, lastRenewedAt: new Date(), status }).where(eq(residencyPermits.employeeId, input.employeeId));
    await audit({ actorUserId: ctx.user.id, entityType: "residency", entityId: before.id, action: "renew", summary: `تجديد إقامة العامل رقم ${before.employeeId}`, before, after: input });
    return { success: true, status };
  }),

  createQualification: adminProcedure.input(qualificationInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const status = input.status === "not_required" ? "not_required" : qualificationComplianceStatus(input.expiryDate);
    const result = await db.insert(employeeQualifications).values({ ...input, issuedDate: toDbDate(input.issuedDate), expiryDate: toDbDate(input.expiryDate), status });
    const id = insertId(result);
    await audit({ actorUserId: ctx.user.id, entityType: "qualification", entityId: id, action: "create", summary: `إضافة مؤهل ${input.name}`, after: input });
    return { id };
  }),

  updateQualification: adminProcedure.input(idField.merge(qualificationInput.omit({ employeeId: true }).partial())).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeQualifications).where(eq(employeeQualifications.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على المؤهل.");
    const { id, issuedDate, expiryDate, ...values } = input;
    const updateValues: Partial<typeof employeeQualifications.$inferInsert> = { ...values };
    if (issuedDate !== undefined) updateValues.issuedDate = toDbDate(issuedDate);
    if (expiryDate !== undefined) updateValues.expiryDate = toDbDate(expiryDate);
    await db.update(employeeQualifications).set(updateValues).where(eq(employeeQualifications.id, id));
    await audit({ actorUserId: ctx.user.id, entityType: "qualification", entityId: id, action: "update", summary: `تعديل مؤهل ${before.name}`, before, after: values });
    return { success: true };
  }),

  deleteQualification: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeQualifications).where(eq(employeeQualifications.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على المؤهل.");
    await db.delete(employeeQualifications).where(eq(employeeQualifications.id, input.id));
    await audit({ actorUserId: ctx.user.id, entityType: "qualification", entityId: input.id, action: "delete", summary: `حذف مؤهل ${before.name}`, before });
    return { success: true };
  }),

  createDocument: adminProcedure.input(documentInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(employeeDocuments).values({ ...input, expiryDate: toDbDate(input.expiryDate) });
    const id = insertId(result);
    await audit({ actorUserId: ctx.user.id, entityType: "document", entityId: id, action: "create", summary: `إضافة وثيقة ${input.title}`, after: input });
    return { id };
  }),

  updateDocument: adminProcedure.input(idField.merge(documentInput.omit({ employeeId: true }).partial())).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على الوثيقة.");
    const { id, expiryDate, ...values } = input;
    const updateValues: Partial<typeof employeeDocuments.$inferInsert> = { ...values };
    if (expiryDate !== undefined) updateValues.expiryDate = toDbDate(expiryDate);
    await db.update(employeeDocuments).set(updateValues).where(eq(employeeDocuments.id, id));
    await audit({ actorUserId: ctx.user.id, entityType: "document", entityId: id, action: "update", summary: `تعديل وثيقة ${before.title}`, before, after: values });
    return { success: true };
  }),

  deleteDocument: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على الوثيقة.");
    await db.delete(employeeDocuments).where(eq(employeeDocuments.id, input.id));
    await audit({ actorUserId: ctx.user.id, entityType: "document", entityId: input.id, action: "delete", summary: `حذف وثيقة ${before.title}`, before });
    return { success: true };
  }),

  assignEmployee: adminProcedure.input(assignmentInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const result = await db.insert(employeeAssignments).values({ ...input, startDate: toDbDate(input.startDate)!, endDate: toDbDate(input.endDate), status: "active" });
    const assignmentId = insertId(result);
    await db.update(employees).set({ primaryProjectId: input.projectId }).where(eq(employees.id, input.employeeId));
    await audit({ actorUserId: ctx.user.id, entityType: "assignment", entityId: assignmentId, action: "assign", summary: `تعيين عامل على مشروع رقم ${input.projectId}`, after: input });
    return { id: assignmentId };
  }),

  updateAssignment: adminProcedure.input(idField.merge(z.object({
    projectId: z.number().int().positive().optional(),
    roleOnProject: z.string().trim().min(2).max(160).optional(),
    startDate: dateField.optional(),
    endDate: optionalDateField,
    status: z.enum(["active", "completed", "cancelled"]).optional(),
    notes: optionalText,
  }))).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeAssignments).where(eq(employeeAssignments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على التكليف.");
    const { id, startDate, endDate, ...values } = input;
    const updateValues: Partial<typeof employeeAssignments.$inferInsert> = { ...values };
    if (startDate !== undefined) updateValues.startDate = toDbDate(startDate)!;
    if (endDate !== undefined) updateValues.endDate = toDbDate(endDate);
    await db.update(employeeAssignments).set(updateValues).where(eq(employeeAssignments.id, id));
    await audit({ actorUserId: ctx.user.id, entityType: "assignment", entityId: id, action: "update", summary: `تعديل تكليف العامل رقم ${before.employeeId}`, before, after: values });
    return { success: true };
  }),

  unassignEmployee: adminProcedure.input(idField).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const before = (await db.select().from(employeeAssignments).where(eq(employeeAssignments.id, input.id)).limit(1))[0];
    if (!before) throw new Error("لم يتم العثور على التكليف.");
    await db.update(employeeAssignments).set({ status: "cancelled", endDate: new Date() }).where(eq(employeeAssignments.id, input.id));
    await audit({ actorUserId: ctx.user.id, entityType: "assignment", entityId: input.id, action: "unassign", summary: `إلغاء تكليف العامل رقم ${before.employeeId}`, before });
    return { success: true };
  }),

  refreshCompliance: adminProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const [residencies, qualifications] = await Promise.all([db.select().from(residencyPermits), db.select().from(employeeQualifications)]);
    let changed = 0;
    for (const residency of residencies) {
      const nextStatus = residencyComplianceStatus(residency.expiryDate);
      if (residency.status !== nextStatus) {
        await db.update(residencyPermits).set({ status: nextStatus }).where(eq(residencyPermits.id, residency.id));
        changed += 1;
      }
    }
    for (const qualification of qualifications) {
      const nextStatus = qualification.status === "not_required" ? "not_required" : qualificationComplianceStatus(qualification.expiryDate);
      if (qualification.status !== nextStatus) {
        await db.update(employeeQualifications).set({ status: nextStatus }).where(eq(employeeQualifications.id, qualification.id));
        changed += 1;
      }
    }
    await audit({ actorUserId: ctx.user.id, entityType: "compliance", entityId: 0, action: "update", summary: `تحديث حالات الامتثال: ${changed} سجلاً` });
    return { changed };
  }),

  listAudit: adminProcedure.input(z.object({ entityType: z.string().trim().max(60).optional(), entityId: z.number().int().positive().optional() }).optional()).query(async ({ input }) => {
    const db = await requireDb();
    if (input?.entityType && input.entityId) {
      return db.select().from(operationalAuditLogs).where(and(eq(operationalAuditLogs.entityType, input.entityType), eq(operationalAuditLogs.entityId, input.entityId))).orderBy(asc(operationalAuditLogs.createdAt));
    }
    return db.select().from(operationalAuditLogs).orderBy(asc(operationalAuditLogs.createdAt));
  }),
});
