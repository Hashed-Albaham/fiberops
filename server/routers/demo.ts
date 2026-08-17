import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  departments,
  employeeAssignments,
  employeeDocuments,
  employeeQualifications,
  employees,
  fieldEquipment,
  fiberDrums,
  operationalAuditLogs,
  permits,
  projects,
  residencyPermits,
  workRoutes,
} from "../../drizzle/schema";
import { requireDb } from "../db";
import { router, systemAdminProcedure } from "../_core/trpc";

function insertedId(result: unknown) {
  const value = Array.isArray(result) ? result[0] : result;
  return Number((value as { insertId?: number }).insertId ?? 0);
}

export const demoRouter = router({
  status: systemAdminProcedure.query(async () => {
    const db = await requireDb();
    const rows = await db.select({ id: employees.id }).from(employees).limit(1);
    return { populated: rows.length > 0 };
  }),
  seed: systemAdminProcedure
    .input(z.object({ confirmation: z.literal("تهيئة بيانات تجريبية") }))
    .mutation(async ({ ctx }) => {
      const db = await requireDb();
      const existing = await db.select({ id: employees.id }).from(employees).limit(1);
      if (existing.length > 0) {
        return { inserted: false, message: "لم تُضف بيانات تجريبية لأن قاعدة التشغيل تحتوي بالفعل على ملفات عمالة." };
      }

      const fieldDepartmentId = insertedId(await db.insert(departments).values({ name: "التشغيل الميداني التجريبي", code: "DEMO-FIELD", managerName: "مسؤول تشغيل تجريبي", active: "yes" }));
      const nocDepartmentId = insertedId(await db.insert(departments).values({ name: "ضمان الجودة التجريبي", code: "DEMO-QA", managerName: "مسؤول جودة تجريبي", active: "yes" }));
      const riyadhProjectId = insertedId(await db.insert(projects).values({ code: "DEMO-FTTH-RYD-01", name: "توسعة FTTH التجريبية — نطاق الرياض", clientName: "جهة اختبار", status: "active", startDate: new Date("2026-01-15"), targetDate: new Date("2026-11-30") }));
      const jeddahProjectId = insertedId(await db.insert(projects).values({ code: "DEMO-FTTH-JED-02", name: "ربط مناطق FTTH التجريبية — نطاق جدة", clientName: "جهة اختبار", status: "planning", startDate: new Date("2026-08-01"), targetDate: new Date("2027-02-28") }));

      const employeeSeeds = [
        ["DEMO-001", "سامي", "تجريبي", "مشرف تمديد", "سعودي", fieldDepartmentId, riyadhProjectId],
        ["DEMO-002", "نادر", "تجريبي", "فني لحام ألياف", "مصري", fieldDepartmentId, riyadhProjectId],
        ["DEMO-003", "عمر", "تجريبي", "فني OTDR", "أردني", nocDepartmentId, riyadhProjectId],
        ["DEMO-004", "خالد", "تجريبي", "فني سحب كابلات", "هندي", fieldDepartmentId, riyadhProjectId],
        ["DEMO-005", "ماهر", "تجريبي", "مراقب سلامة", "باكستاني", nocDepartmentId, jeddahProjectId],
        ["DEMO-006", "فهد", "تجريبي", "منسق تصاريح", "سعودي", nocDepartmentId, jeddahProjectId],
      ] as const;
      const employeeIds: number[] = [];
      for (const [employeeNo, firstName, lastName, jobTitle, nationality, departmentId, primaryProjectId] of employeeSeeds) {
        employeeIds.push(insertedId(await db.insert(employees).values({ employeeNo, firstName, lastName, jobTitle, nationality, phone: "+966500000000", email: `${employeeNo.toLowerCase()}@example.test`, passportNumber: `P-${employeeNo}`, passportExpiryAt: new Date("2028-12-31"), joiningDate: new Date("2025-01-01"), employmentStatus: "active", departmentId, primaryProjectId, emergencyContactName: "اتصال تجريبي", emergencyContactPhone: "+966511111111", notes: "سجل تجريبي قابل للتعديل أو الحذف." })));
      }

      const residencyDates = ["2027-03-15", "2026-09-18", "2026-05-30", "2027-01-12", "2026-10-02", "2027-06-01"];
      for (let index = 0; index < employeeIds.length; index += 1) {
        const employeeId = employeeIds[index]!;
        const expiry = residencyDates[index]!;
        await db.insert(residencyPermits).values({ employeeId, iqamaNumber: `DEMO-IQ-${String(index + 1).padStart(3, "0")}`, sponsorName: "راعي تجريبي", issueDate: new Date("2025-01-01"), expiryDate: new Date(expiry), status: index === 2 ? "expired" : index === 1 || index === 4 ? "expiring" : "valid", renewalReference: null, renewalNotes: "بيانات تجريبية" });
        await db.insert(employeeQualifications).values({ employeeId, name: index === 1 ? "Fiber Optic Splicing" : "سلامة مواقع الألياف", issuer: "معهد تدريبي تجريبي", certificateNumber: `DEMO-CERT-${index + 1}`, issuedDate: new Date("2025-02-01"), expiryDate: new Date(index === 3 ? "2026-06-20" : index === 0 ? "2026-09-25" : "2027-02-01"), status: index === 3 ? "expired" : index === 0 ? "expiring" : "valid", notes: "مؤهل تجريبي" });
      }
      for (const employeeId of employeeIds.slice(0, 4)) {
        await db.insert(employeeDocuments).values({ employeeId, documentType: "contract", title: "عقد عمل تجريبي", referenceNumber: `DEMO-CON-${employeeId}`, expiryDate: new Date("2027-12-31"), notes: "وثيقة تجريبية" });
      }
      for (let index = 0; index < employeeIds.slice(0, 5).length; index += 1) {
        const employeeId = employeeIds[index]!;
        await db.insert(employeeAssignments).values({ employeeId, projectId: index === 4 ? jeddahProjectId : riyadhProjectId, roleOnProject: index === 0 ? "مشرف فريق" : "فني تنفيذ", startDate: new Date("2026-02-01"), endDate: null, status: "active", notes: "تكليف تجريبي" });
      }

      await db.insert(fiberDrums).values([
        { drumId: "DEMO-DRUM-001", fiberSpec: "G.652D Single Mode", coreCount: 144, supplier: "مورد تجريبي", totalMeters: 4000, remainingMeters: 650, minimumMeters: 800, assignedProjectId: riyadhProjectId, storageLocation: "مستودع الرياض التجريبي", status: "low_stock" },
        { drumId: "DEMO-DRUM-002", fiberSpec: "G.657A2 Drop Cable", coreCount: 24, supplier: "مورد تجريبي", totalMeters: 2500, remainingMeters: 2500, minimumMeters: 500, assignedProjectId: null, storageLocation: "مستودع الرياض التجريبي", status: "available" },
        { drumId: "DEMO-DRUM-003", fiberSpec: "G.652D Single Mode", coreCount: 96, supplier: "مورد تجريبي", totalMeters: 3000, remainingMeters: 0, minimumMeters: 600, assignedProjectId: riyadhProjectId, storageLocation: "مستودع الموقع التجريبي", status: "depleted" },
      ]);
      await db.insert(fieldEquipment).values([
        { assetTag: "DEMO-OTDR-001", name: "جهاز OTDR تجريبي", category: "otdr", serialNumber: "OTDR-DEMO-01", calibrationDueAt: new Date("2026-09-10"), status: "calibration_due", assignedEmployeeId: employeeIds[2]! },
        { assetTag: "DEMO-SP-001", name: "آلة لحام ألياف تجريبية", category: "splicer", serialNumber: "SP-DEMO-01", calibrationDueAt: new Date("2027-03-01"), status: "assigned", assignedEmployeeId: employeeIds[1]! },
        { assetTag: "DEMO-PM-001", name: "مقياس قدرة تجريبي", category: "power_meter", serialNumber: "PM-DEMO-01", calibrationDueAt: new Date("2027-01-15"), status: "ready", assignedEmployeeId: null },
      ]);
      const permit1 = insertedId(await db.insert(permits).values({ permitNo: "DEMO-PERMIT-001", issuer: "municipality", routeName: "مسار حي تجريبي — القطاع أ", projectId: riyadhProjectId, startDate: new Date("2026-05-01"), expiryDate: new Date("2026-09-12"), status: "expiring", renewalReference: "DEMO-RNW-01", notes: "تصريح تجريبي" }));
      const permit2 = insertedId(await db.insert(permits).values({ permitNo: "DEMO-PERMIT-002", issuer: "traffic", routeName: "عبور تجريبي — القطاع ب", projectId: riyadhProjectId, startDate: new Date("2026-02-01"), expiryDate: new Date("2026-06-15"), status: "expired", renewalReference: null, notes: "تصريح تجريبي" }));
      await db.insert(workRoutes).values([
        { routeCode: "DEMO-RT-001", name: "مسار تمديد تجريبي — القطاع أ", projectId: riyadhProjectId, contractorName: "فريق اختبار", stage: "splicing", progressPercent: 72, permitId: permit1, status: "active" },
        { routeCode: "DEMO-RT-002", name: "مسار عبور تجريبي — القطاع ب", projectId: riyadhProjectId, contractorName: "فريق اختبار", stage: "civil", progressPercent: 38, permitId: permit2, status: "blocked" },
        { routeCode: "DEMO-RT-003", name: "مسار توسعة تجريبي — القطاع ج", projectId: jeddahProjectId, contractorName: "فريق اختبار", stage: "pulling", progressPercent: 14, permitId: null, status: "active" },
      ]);
      await db.insert(operationalAuditLogs).values({ actorUserId: ctx.user.id, entityType: "demo_seed", entityId: 0, action: "create", summary: "تعبئة بيانات FiberOps التجريبية الأولى" });
      return { inserted: true, message: "تمت تعبئة البيانات التجريبية بنجاح. يمكنك تعديل أي سجل أو حذفه من الواجهة." };
    }),
  repairArabic: systemAdminProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    const existing = await db.select({ id: employees.id }).from(employees).where(eq(employees.employeeNo, "DEMO-001")).limit(1);
    if (existing.length === 0) {
      return { repaired: false, message: "لا توجد بيانات تجريبية تحتاج إلى إصلاح." };
    }

    await db.execute(sql.raw("ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
    for (const table of ["users", "departments", "projects", "employees", "residencyPermits", "employeeQualifications", "employeeDocuments", "employeeAssignments", "fiberDrums", "fieldEquipment", "permits", "workRoutes", "operationalAuditLogs"]) {
      await db.execute(sql.raw(`ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`));
    }

    await db.update(departments).set({ name: "التشغيل الميداني التجريبي", managerName: "مسؤول تشغيل تجريبي" }).where(eq(departments.code, "DEMO-FIELD"));
    await db.update(departments).set({ name: "ضمان الجودة التجريبي", managerName: "مسؤول جودة تجريبي" }).where(eq(departments.code, "DEMO-QA"));
    await db.update(projects).set({ name: "توسعة FTTH التجريبية — نطاق الرياض", clientName: "جهة اختبار" }).where(eq(projects.code, "DEMO-FTTH-RYD-01"));
    await db.update(projects).set({ name: "ربط مناطق FTTH التجريبية — نطاق جدة", clientName: "جهة اختبار" }).where(eq(projects.code, "DEMO-FTTH-JED-02"));

    const employeeRepairs = [
      ["DEMO-001", "سامي", "تجريبي", "مشرف تمديد", "سعودي"],
      ["DEMO-002", "نادر", "تجريبي", "فني لحام ألياف", "مصري"],
      ["DEMO-003", "عمر", "تجريبي", "فني OTDR", "أردني"],
      ["DEMO-004", "خالد", "تجريبي", "فني سحب كابلات", "هندي"],
      ["DEMO-005", "ماهر", "تجريبي", "مراقب سلامة", "باكستاني"],
      ["DEMO-006", "فهد", "تجريبي", "منسق تصاريح", "سعودي"],
    ] as const;
    for (const [employeeNo, firstName, lastName, jobTitle, nationality] of employeeRepairs) {
      await db.update(employees).set({ firstName, lastName, jobTitle, nationality, emergencyContactName: "اتصال تجريبي", notes: "سجل تجريبي قابل للتعديل أو الحذف." }).where(eq(employees.employeeNo, employeeNo));
    }

    for (let index = 1; index <= 6; index += 1) {
      await db.update(residencyPermits).set({ sponsorName: "راعي تجريبي", renewalNotes: "بيانات تجريبية" }).where(eq(residencyPermits.iqamaNumber, `DEMO-IQ-${String(index).padStart(3, "0")}`));
      await db.update(employeeQualifications).set({ issuer: "معهد تدريبي تجريبي", notes: "مؤهل تجريبي" }).where(eq(employeeQualifications.certificateNumber, `DEMO-CERT-${index}`));
    }
    await db.update(employeeQualifications).set({ name: "سلامة مواقع الألياف" }).where(eq(employeeQualifications.certificateNumber, "DEMO-CERT-1"));
    await db.update(employeeQualifications).set({ name: "Fiber Optic Splicing" }).where(eq(employeeQualifications.certificateNumber, "DEMO-CERT-2"));
    await db.update(employeeQualifications).set({ name: "قياسات OTDR" }).where(eq(employeeQualifications.certificateNumber, "DEMO-CERT-3"));
    await db.update(employeeQualifications).set({ name: "سلامة مواقع الألياف" }).where(eq(employeeQualifications.certificateNumber, "DEMO-CERT-4"));
    await db.update(employeeQualifications).set({ name: "السلامة المهنية" }).where(eq(employeeQualifications.certificateNumber, "DEMO-CERT-5"));
    await db.update(employeeQualifications).set({ name: "إدارة تصاريح الحفر" }).where(eq(employeeQualifications.certificateNumber, "DEMO-CERT-6"));
    await db.update(employeeDocuments).set({ title: "عقد عمل تجريبي", notes: "وثيقة تجريبية" }).where(eq(employeeDocuments.referenceNumber, "DEMO-CON-001"));
    await db.update(employeeDocuments).set({ title: "عقد عمل تجريبي", notes: "وثيقة تجريبية" }).where(eq(employeeDocuments.referenceNumber, "DEMO-CON-002"));
    await db.update(employeeDocuments).set({ title: "تأمين طبي تجريبي", notes: "وثيقة تجريبية" }).where(eq(employeeDocuments.referenceNumber, "DEMO-INS-003"));
    await db.update(employeeDocuments).set({ title: "هوية تجريبية", notes: "وثيقة تجريبية" }).where(eq(employeeDocuments.referenceNumber, "DEMO-ID-004"));
    await db.update(employeeAssignments).set({ roleOnProject: "فني تنفيذ", notes: "تكليف تجريبي" }).where(eq(employeeAssignments.notes, "????"));
    await db.update(fiberDrums).set({ supplier: "مورد تجريبي", storageLocation: "مستودع الرياض التجريبي" }).where(eq(fiberDrums.drumId, "DEMO-DRUM-001"));
    await db.update(fiberDrums).set({ supplier: "مورد تجريبي", storageLocation: "مستودع الرياض التجريبي" }).where(eq(fiberDrums.drumId, "DEMO-DRUM-002"));
    await db.update(fiberDrums).set({ supplier: "مورد تجريبي", storageLocation: "مستودع الموقع التجريبي" }).where(eq(fiberDrums.drumId, "DEMO-DRUM-003"));
    await db.update(fieldEquipment).set({ name: "جهاز OTDR تجريبي" }).where(eq(fieldEquipment.assetTag, "DEMO-OTDR-001"));
    await db.update(fieldEquipment).set({ name: "آلة لحام ألياف تجريبية" }).where(eq(fieldEquipment.assetTag, "DEMO-SP-001"));
    await db.update(fieldEquipment).set({ name: "مقياس قدرة تجريبي" }).where(eq(fieldEquipment.assetTag, "DEMO-PM-001"));
    await db.update(permits).set({ routeName: "مسار حي تجريبي — القطاع أ", notes: "تصريح تجريبي" }).where(eq(permits.permitNo, "DEMO-PERMIT-001"));
    await db.update(permits).set({ routeName: "عبور تجريبي — القطاع ب", notes: "تصريح تجريبي" }).where(eq(permits.permitNo, "DEMO-PERMIT-002"));
    await db.update(permits).set({ routeName: "امتداد تجريبي — القطاع ج", notes: "تصريح تجريبي" }).where(eq(permits.permitNo, "DEMO-PERMIT-003"));
    await db.update(workRoutes).set({ name: "مسار تمديد تجريبي — القطاع أ", contractorName: "فريق اختبار" }).where(eq(workRoutes.routeCode, "DEMO-RT-001"));
    await db.update(workRoutes).set({ name: "مسار عبور تجريبي — القطاع ب", contractorName: "فريق اختبار" }).where(eq(workRoutes.routeCode, "DEMO-RT-002"));
    await db.update(workRoutes).set({ name: "مسار توسعة تجريبي — القطاع ج", contractorName: "فريق اختبار" }).where(eq(workRoutes.routeCode, "DEMO-RT-003"));
    await db.insert(operationalAuditLogs).values({ actorUserId: ctx.user.id, entityType: "arabic_encoding", entityId: 0, action: "update", summary: "إصلاح ترميز البيانات العربية التجريبية" });
    return { repaired: true, message: "تم إصلاح النص العربي في جميع البيانات التجريبية." };
  }),
});
