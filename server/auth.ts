import { parse as parseCookies } from "cookie";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { promisify } from "util";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../drizzle/schema";
import * as db from "./db";

type LocalSessionPayload = { openId: string };
const scrypt = promisify(scryptCallback);

function sessionSecret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function createLocalSessionToken(
  openId: string,
  expiresInMs = ONE_YEAR_MS,
) {
  const expiresAt = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({ openId } satisfies LocalSessionPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(sessionSecret());
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const token = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    const openId = payload.openId;
    if (typeof openId !== "string" || !openId) return null;
    const user = await db.getUserByOpenId(openId);
    return user?.active === "yes" ? user : null;
  } catch {
    return null;
  }
}
