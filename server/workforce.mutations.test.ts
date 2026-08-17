import { beforeEach, describe, expect, it, vi } from "vitest";
import { employees, employeeDocuments, residencyPermits } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const { requireDb } = vi.hoisted(() => ({ requireDb: vi.fn() }));
vi.mock("./db", () => ({ requireDb }));

import { workforceRouter } from "./routers/workforce";

function createMockDb(rows: unknown[] = []) {
  const values = vi.fn().mockResolvedValue({ insertId: 41 });
  const insert = vi.fn().mockReturnValue({ values });
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where, orderBy: vi.fn().mockResolvedValue(rows) });
  const select = vi.fn().mockReturnValue({ from });
  const updateWhere = vi.fn().mockResolvedValue({ affectedRows: 1 });
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });
  const deleteWhere = vi.fn().mockResolvedValue({ affectedRows: 1 });
  const remove = vi.fn().mockReturnValue({ where: deleteWhere });
  return { insert, values, select, from, where, limit, update, set, updateWhere, delete: remove, deleteWhere };
}

function adminContext(): TrpcContext {
  return {
    user: { id: 9, openId: "admin-test", name: "Admin", email: "admin@example.test", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workforce mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an employee and a linked residency without a persistent database", async () => {
    const db = createMockDb();
    requireDb.mockResolvedValue(db);
    const caller = workforceRouter.createCaller(adminContext());

    const result = await caller.createEmployee({
      employeeNo: "EMP-100", firstName: "Ahmad", lastName: "Ali", jobTitle: "Fiber Technician", nationality: "Saudi", joiningDate: "2026-01-01",
      residency: { iqamaNumber: "1234567890", expiryDate: "2027-01-01" },
    });

    expect(result).toEqual({ id: 41 });
    expect(db.insert).toHaveBeenCalledWith(employees);
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ employeeNo: "EMP-100" }));
    expect(db.insert).toHaveBeenCalledWith(residencyPermits);
  });

  it("renews a residency and writes an audit event without persisting data", async () => {
    const db = createMockDb([{ id: 5, employeeId: 12, iqamaNumber: "123", expiryDate: new Date("2026-02-01"), status: "expiring" }]);
    requireDb.mockResolvedValue(db);
    const caller = workforceRouter.createCaller(adminContext());

    const result = await caller.renewResidency({ employeeId: 12, expiryDate: "2027-02-01", renewalReference: "R-01" });

    expect(result).toMatchObject({ success: true, status: "valid" });
    expect(db.update).toHaveBeenCalledWith(residencyPermits);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ renewalReference: "R-01", status: "valid" }));
  });

  it("updates a workforce document through the guarded mutation contract", async () => {
    const db = createMockDb([{ id: 7, employeeId: 12, title: "Passport", documentType: "passport", expiryDate: new Date("2026-01-01") }]);
    requireDb.mockResolvedValue(db);
    const caller = workforceRouter.createCaller(adminContext());

    const result = await caller.updateDocument({ id: 7, title: "Renewed passport", expiryDate: "2028-01-01" });

    expect(result).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledWith(employeeDocuments);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ title: "Renewed passport" }));
  });

  it("deletes an employee through the protected mutation without persistent data", async () => {
    const db = createMockDb([{ id: 15, employeeNo: "EMP-015", firstName: "Sara", lastName: "A", jobTitle: "Supervisor", nationality: "Saudi", joiningDate: new Date(), employmentStatus: "active" }]);
    requireDb.mockResolvedValue(db);
    const caller = workforceRouter.createCaller(adminContext());

    const result = await caller.deleteEmployee({ id: 15 });

    expect(result).toEqual({ success: true });
    expect(db.delete).toHaveBeenCalledWith(employees);
    expect(db.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("rejects mutations for a non-administrator before any database operation", async () => {
    const db = createMockDb();
    requireDb.mockResolvedValue(db);
    const context = adminContext();
    context.user = { ...context.user!, role: "user" };
    const caller = workforceRouter.createCaller(context);

    await expect(caller.deleteEmployee({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.delete).not.toHaveBeenCalled();
  });
});
