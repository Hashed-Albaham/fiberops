import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";

const upsertUser = vi.fn();

vi.mock("./db", () => ({ upsertUser }));

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createContext() {
  const cookies: CookieCall[] = [];
  return {
    ctx: {
      user: null,
      req: { protocol: "https", headers: {} },
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
      },
    },
    cookies,
  };
}

describe("auth.login", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("LOCAL_ADMIN_USERNAME", "local-admin-test");
    vi.stubEnv("LOCAL_ADMIN_PASSWORD", "local-password-test");
    vi.stubEnv("JWT_SECRET", "local-jwt-secret-for-vitest-only");
  });

  it("creates an administrator session for valid local credentials", async () => {
    const { appRouter } = await import("./routers");
    const { ctx, cookies } = createContext();

    const result = await appRouter.createCaller(ctx as never).auth.login({
      username: "local-admin-test",
      password: "local-password-test",
    });

    expect(result).toEqual({ success: true });
    expect(upsertUser).toHaveBeenCalledWith(expect.objectContaining({
      openId: "fiberops-local-admin",
      role: "admin",
      loginMethod: "local",
    }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.value).toContain(".");
  });

  it("rejects an invalid local password without creating a session", async () => {
    const { appRouter } = await import("./routers");
    const { ctx, cookies } = createContext();

    await expect(
      appRouter.createCaller(ctx as never).auth.login({
        username: "local-admin-test",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(upsertUser).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(0);
  });
});
