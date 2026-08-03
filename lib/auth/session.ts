import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "./policy";

const COOKIE_NAME = "zugumzugelo_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET muss mindestens 32 Zeichen lang sein.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + SESSION_SECONDS * 1000 })).toString("base64url");
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

async function sessionUserId() {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId?: string; expiresAt?: number };
    return parsed.userId && parsed.expiresAt && parsed.expiresAt > Date.now() ? parsed.userId : null;
  } catch { return null; }
}

export async function getCurrentUser() {
  const id = await sessionUserId();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, emailVerifiedAt: true, deletedAt: true, canCreateGames: true, requiresGameApproval: true, gameEntryBlockedUntil: true, profileRestricted: true, profileImageUrl: true, profileImageStorageId: true, player: { select: { id: true, alias: true } } },
  });
}

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user || user.deletedAt) redirect(`/anmelden?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireActiveUser(next = "/") {
  const user = await requireUser(next);
  if (user.status !== "ACTIVE") redirect("/mein-profil?hinweis=nicht-aktiv");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!isAdmin(user)) redirect("/");
  return user;
}
