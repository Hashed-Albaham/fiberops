import { asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { operationalAuditLogs, userRoles, users } from "../../drizzle/schema";
import { hashPassword } from "../auth";
import { requireDb } from "../db";
import { router, systemAdminProcedure } from "../_core/trpc";

const userInput = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, "اسم المستخدم يقبل الحروف والأرقام والنقطة والشرطة فقط."),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320).nullable().optional(),
  password: z.string().min(10).max(128),
  role: z.enum(userRoles),
});

const updateUserInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  password: z.string().min(10).max(128).optional(),
  role: z.enum(userRoles).optional(),
  active: z.enum(["yes", "no"]).optional(),
});

async function audit(actorUserId: number, entityId: number, action: "create" | "update", summary: string) {
  const db = await requireDb();
  await db.insert(operationalAuditLogs).values({ actorUserId, entityType: "user", entityId, action, summary });
}

export const usersRouter = router({
  list: systemAdminProcedure.query(async () => {
    const db = await requireDb();
    return db.select({ id: users.id, openId: users.openId, username: users.username, name: users.name, email: users.email, role: users.role, active: users.active, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt }).from(users).orderBy(asc(users.createdAt));
  }),
  create: systemAdminProcedure.input(userInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const passwordHash = await hashPassword(input.password);
    const result = await db.insert(users).values({ openId: `local-${randomUUID()}`, username: input.username, passwordHash, name: input.name, email: input.email ?? null, loginMethod: "local", role: input.role, active: "yes", lastSignedIn: new Date() });
    const value = Array.isArray(result) ? result[0] : result;
    const id = Number((value as { insertId?: number }).insertId ?? 0);
    await audit(ctx.user.id, id, "create", `إضافة المستخدم ${input.username} بالدور ${input.role}`);
    return { id };
  }),
  update: systemAdminProcedure.input(updateUserInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const user = (await db.select().from(users).where(eq(users.id, input.id)).limit(1))[0];
    if (!user) throw new Error("المستخدم غير موجود.");
    if (user.openId === "fiberops-local-admin" && (input.active === "no" || (input.role && input.role !== "admin"))) {
      throw new Error("لا يمكن تعطيل أو تخفيض صلاحية حساب المسؤول الأولي من الواجهة.");
    }
    const { id, password, ...values } = input;
    const patch: Partial<typeof users.$inferInsert> = { ...values };
    if (password) patch.passwordHash = await hashPassword(password);
    await db.update(users).set(patch).where(eq(users.id, id));
    await audit(ctx.user.id, id, "update", `تحديث المستخدم ${user.username ?? user.name ?? id}`);
    return { success: true };
  }),
});
