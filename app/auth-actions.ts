"use server";

import { Prisma, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { createSecureToken, hashToken } from "@/lib/auth/tokens";
import { sendAccountLink } from "@/lib/auth/mail";
import { mayLogin } from "@/lib/auth/policy";

export type FormState = { error?: string; success?: string };
const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase("en-US");
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const alias = String(formData.get("alias") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("passwordRepeat") ?? "");
  const level = String(formData.get("level") ?? "beginner");
  if (!firstName || !lastName || !alias) return { error: "Vorname, Nachname und Alias sind Pflichtfelder." };
  if (!validEmail(email)) return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  if (password !== repeat) return { error: "Die Passwörter stimmen nicht überein." };
  const passwordError = validatePassword(password); if (passwordError) return { error: passwordError };
  if (!['beginner', 'advanced'].includes(level)) return { error: "Ungültiges Startniveau." };
  const passwordHash = await hashPassword(password);
  const { token, tokenHash } = createSecureToken();
  let existingPlayerClaimCreated = false;
  try {
    await prisma.$transaction(async (tx) => {
      const aliasCollision = await tx.player.findFirst({ where: { alias: { equals: alias, mode: "insensitive" }, isActive: true, deletedAt: null, mergedIntoPlayerId: null }, select: { id: true, userId: true, _count: { select: { claimTargets: { where: { status: "PENDING" } } } } } });
      if (aliasCollision?.userId || (aliasCollision?._count.claimTargets ?? 0) > 0) throw new Error("Dieser Spieler ist bereits einem Benutzer zugeordnet oder wird bereits beansprucht.");
      const user = await tx.user.create({ data: { email, passwordHash, firstName, lastName, status: UserStatus.EMAIL_UNVERIFIED } });
      if (aliasCollision) {
        await tx.playerClaim.create({ data: { playerId: aliasCollision.id, submittedByUserId: user.id, status: "PENDING" } });
        existingPlayerClaimCreated = true;
      } else {
        const rating = level === "advanced" ? 1500 : 1200;
        await tx.player.create({ data: { alias, initialRating: rating, currentRating: rating, userId: user.id, aliases: { create: { alias } } } });
      }
      await tx.emailVerificationToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await sendAccountLink("email-verification", email, "/email-bestaetigen", token);
    return { success: existingPlayerClaimCreated ? "Dieser Spieler existiert bereits. Möchtest du diesen Spieler beanspruchen? Der Claim wurde zur Adminprüfung angelegt. Bitte bestätige deine E-Mail-Adresse." : "Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "E-Mail-Adresse oder Alias wird bereits verwendet." };
    return { error: error instanceof Error && (error.message.includes("Alias") || error.message.includes("Spieler")) ? error.message : "Die Registrierung konnte nicht abgeschlossen werden." };
  }
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const generic = { error: "Anmeldedaten ungültig oder Konto nicht verfügbar." };
  const user = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: normalizeEmail(identifier) }, include: { player: true } })
    : await prisma.user.findFirst({ where: { player: { is: { alias: { equals: identifier, mode: "insensitive" }, isActive: true, deletedAt: null } } }, include: { player: true } });
  if (!user || !mayLogin(user) || !(await verifyPassword(password, user.passwordHash))) return generic;
  await createSession(user.id);
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() { await destroySession(); redirect("/"); }

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, deletedAt: true } });
  if (user && !user.deletedAt) {
    const { token, tokenHash } = createSecureToken();
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    await sendAccountLink("password-reset", user.email, "/passwort-zuruecksetzen", token);
  }
  return { success: "Falls ein Konto existiert, wurde ein Link zum Zurücksetzen bereitgestellt." };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? ""); const password = String(formData.get("password") ?? ""); const repeat = String(formData.get("passwordRepeat") ?? "");
  if (password !== repeat) return { error: "Die Passwörter stimmen nicht überein." };
  const passwordError = validatePassword(password); if (passwordError) return { error: passwordError };
  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const stored = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!stored || stored.usedAt || stored.expiresAt <= new Date()) throw new Error("invalid");
      await tx.user.update({ where: { id: stored.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } });
    });
    return { success: "Das Passwort wurde geändert. Du kannst dich jetzt anmelden." };
  } catch { return { error: "Der Link ist ungültig, abgelaufen oder wurde bereits verwendet." }; }
}

export async function verifyEmailToken(token: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const stored = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!stored || stored.usedAt || stored.expiresAt <= new Date()) throw new Error("invalid");
      const now = new Date();
      await tx.emailVerificationToken.update({ where: { id: stored.id }, data: { usedAt: now } });
      await tx.user.update({ where: { id: stored.userId }, data: { emailVerifiedAt: now, status: UserStatus.PENDING_APPROVAL } });
    });
    return true;
  } catch { return false; }
}
