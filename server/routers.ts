import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import * as db from "./db";
import { createLocalSessionToken, verifyPassword } from "./auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { publicProcedure, router } from "./_core/trpc";
import { operationsRouter } from "./routers/operations";
import { workforceRouter } from "./routers/workforce";
import { usersRouter } from "./routers/users";
import { demoRouter } from "./routers/demo";

function matchesCredential(value: string, expected: string) {
  if (!expected) return false;
  const valueDigest = createHash("sha256").update(value).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(valueDigest, expectedDigest);
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          username: z.string().trim().min(1).max(80),
          password: z.string().min(1).max(256),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const usernameMatches = matchesCredential(input.username, ENV.localAdminUsername);
        const passwordMatches = matchesCredential(input.password, ENV.localAdminPassword);

        if (usernameMatches && passwordMatches) {
          const openId = "fiberops-local-admin";
          await db.upsertUser({ openId, name: "مسؤول FiberOps", email: null, loginMethod: "local", role: "admin", active: "yes", lastSignedIn: new Date() });
          const sessionToken = await createLocalSessionToken(openId, ONE_YEAR_MS);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true } as const;
        }

        const user = await db.getUserByUsername(input.username);
        if (!user || user.active !== "yes" || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "بيانات الدخول غير صحيحة.",
          });
        }

        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const sessionToken = await createLocalSessionToken(user.openId, ONE_YEAR_MS);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  workforce: workforceRouter,
  operations: operationsRouter,
  users: usersRouter,
  demo: demoRouter,
});

export type AppRouter = typeof appRouter;
