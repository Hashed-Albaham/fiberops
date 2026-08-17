import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "operations_manager" | "field_supervisor" | "viewer"): TrpcContext {
  const now = new Date();
  return {
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: 44,
      openId: `test-${role}`,
      username: `test-${role}`,
      passwordHash: null,
      name: "مستخدم اختبار",
      email: null,
      loginMethod: "local",
      role,
      active: "yes",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
  };
}

describe("FiberOps permissions", () => {
  it("blocks non-administrators from listing user accounts", async () => {
    const caller = appRouter.createCaller(contextFor("operations_manager"));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks viewers from creating workforce records", async () => {
    const caller = appRouter.createCaller(contextFor("viewer"));
    await expect(caller.workforce.createEmployee({
      employeeNo: "TEST-001",
      firstName: "عامل",
      lastName: "اختبار",
      jobTitle: "فني",
      nationality: "اختبار",
      joiningDate: "2026-01-01",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires the explicit confirmation phrase before demo seeding", async () => {
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.demo.seed({ confirmation: "إجراء مختلف" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
