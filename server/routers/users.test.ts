import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseState = {
  storedUser: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
  patches: [] as Record<string, unknown>[],
};

vi.mock("../db", () => ({
  requireDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (databaseState.storedUser ? [databaseState.storedUser] : []),
        }),
        orderBy: async () => (databaseState.storedUser ? [databaseState.storedUser] : []),
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        databaseState.inserts.push(values);
        return [{ insertId: databaseState.inserts.length === 1 ? 77 : 0 }];
      },
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          databaseState.patches.push(patch);
          databaseState.storedUser = { ...databaseState.storedUser, ...patch };
        },
      }),
    }),
  })),
}));

import { usersRouter } from "./users";

const adminContext = {
  user: { id: 1, role: "admin", active: "yes" },
} as never;

describe("usersRouter", () => {
  beforeEach(() => {
    databaseState.storedUser = null;
    databaseState.inserts = [];
    databaseState.patches = [];
  });

  it("creates a local user and persists its role", async () => {
    const caller = usersRouter.createCaller(adminContext);
    const result = await caller.create({
      username: "field.supervisor",
      name: "مشرف ميداني تجريبي",
      email: "field.supervisor@example.test",
      password: "temporary-pass-2026",
      role: "field_supervisor",
    });

    expect(result).toEqual({ id: 77 });
    expect(databaseState.inserts[0]).toMatchObject({
      username: "field.supervisor",
      name: "مشرف ميداني تجريبي",
      email: "field.supervisor@example.test",
      role: "field_supervisor",
      active: "yes",
      loginMethod: "local",
    });
    expect(databaseState.inserts[0]?.passwordHash).not.toBe("temporary-pass-2026");
  });

  it("updates user profile, role, state, and password hash", async () => {
    databaseState.storedUser = {
      id: 77,
      openId: "local-user-77",
      username: "field.supervisor",
      name: "مشرف ميداني تجريبي",
    };
    const caller = usersRouter.createCaller(adminContext);
    await caller.update({
      id: 77,
      name: "مشرف عمليات ميدانية",
      email: "ops.supervisor@example.test",
      password: "updated-pass-2026",
      role: "operations_manager",
      active: "no",
    });

    expect(databaseState.patches[0]).toMatchObject({
      name: "مشرف عمليات ميدانية",
      email: "ops.supervisor@example.test",
      role: "operations_manager",
      active: "no",
    });
    expect(databaseState.patches[0]?.passwordHash).not.toBe("updated-pass-2026");
  });
});
