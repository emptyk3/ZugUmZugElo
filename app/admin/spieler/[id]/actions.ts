"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ELO_RECALCULATION_TRANSACTION_OPTIONS } from "@/lib/prisma/transaction-options";
import { logServerDatabaseError } from "@/lib/prisma/log-error";
import { changeInitialRatingInTransaction, InitialRatingValidationError } from "@/lib/players/initial-rating";
import { recalculateEloFromTransaction } from "@/lib/elo/recalculation";

export type ChangeInitialRatingState = { error?: string; success?: string };

export async function changePlayerInitialRating(playerId: string, formData: FormData): Promise<ChangeInitialRatingState> {
  const admin = await requireAdmin();
  const newInitialRating = Number(formData.get("initialRating"));
  const reason = String(formData.get("reason") ?? "").trim();
  const confirmed = formData.get("confirmed") === "on";
  try {
    const result = await prisma.$transaction(
      (tx) => changeInitialRatingInTransaction(tx, { playerId, adminId: admin.id, newInitialRating, reason, confirmed }, recalculateEloFromTransaction),
      ELO_RECALCULATION_TRANSACTION_OPTIONS,
    );
    revalidatePath("/"); revalidatePath("/partien"); revalidatePath(`/spieler/${playerId}`); revalidatePath("/admin/spieler"); revalidatePath(`/admin/spieler/${playerId}`);
    return result.recalculationFrom
      ? { success: "Das Start-Elo wurde geändert und die Elo-Historie erfolgreich neu berechnet." }
      : { success: "Das Start-Elo wurde geändert. Es waren noch keine Partien neu zu berechnen." };
  } catch (error) {
    if (error instanceof InitialRatingValidationError) return { error: error.message };
    logServerDatabaseError("Änderung des Spieler-Start-Elo fehlgeschlagen", error);
    return { error: "Das Start-Elo konnte nicht geändert werden. Alle Änderungen wurden zurückgerollt." };
  }
}
