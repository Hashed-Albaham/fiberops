import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { operationsRouter } from "./routers/operations";
import { workforceRouter } from "./routers/workforce";

function matchesCredential(value: string, expected: string) {
  if (!expected) return false;
  const valueDigest = createHash("sha256").update(value).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(valueDigest, expectedDigest);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
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

        if (!usernameMatches || !passwordMatches) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "بيانات الدخول غير صحيحة.",
          });
        }

        const openId = "fiberops-local-admin";
        await db.upsertUser({
          openId,
          name: "مسؤول FiberOps",
          email: null,
          loginMethod: "local",
          role: "admin",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name: "مسؤول FiberOps",
          expiresInMs: ONE_YEAR_MS,
        });
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
});

export type AppRouter = typeof appRouter;
