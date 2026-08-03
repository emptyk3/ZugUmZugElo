import { UserRole, UserStatus } from "@prisma/client";

export type AuthorizationUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  deletedAt: Date | null;
  canCreateGames: boolean;
  requiresGameApproval: boolean;
  gameEntryBlockedUntil: Date | null;
  emailVerifiedAt: Date | null;
  profileRestricted: boolean;
};

export function mayLogin(user: Pick<AuthorizationUser, "status" | "deletedAt">) {
  const blockedStatuses = new Set<UserStatus>([UserStatus.REJECTED, UserStatus.SUSPENDED, UserStatus.DELETED]);
  return !user.deletedAt && !blockedStatuses.has(user.status);
}

export function gameSubmissionPolicy(user: AuthorizationUser, now = new Date()) {
  if (!mayLogin(user)) return { allowed: false, reasons: [] as string[], message: "Dieses Benutzerkonto darf keine Partien eintragen." };
  if (!user.emailVerifiedAt || user.status === UserStatus.EMAIL_UNVERIFIED) return { allowed: false, reasons: [], message: "Bitte bestätige zuerst deine E-Mail-Adresse." };
  if (!user.canCreateGames) return { allowed: false, reasons: [], message: "Die Partieerfassung ist für dieses Konto gesperrt." };
  if (user.gameEntryBlockedUntil && user.gameEntryBlockedUntil > now) return { allowed: false, reasons: [], message: `Die Partieerfassung ist bis ${user.gameEntryBlockedUntil.toLocaleString("de-AT")} gesperrt.` };
  const reasons: string[] = [];
  if (user.status === UserStatus.PENDING_APPROVAL) reasons.push("CREATOR_NOT_APPROVED");
  if (user.requiresGameApproval || user.profileRestricted) reasons.push("USER_REQUIRES_APPROVAL");
  return { allowed: true, reasons, message: null };
}

export function isAdmin(user: Pick<AuthorizationUser, "role" | "status" | "deletedAt">) {
  return user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE && !user.deletedAt;
}
