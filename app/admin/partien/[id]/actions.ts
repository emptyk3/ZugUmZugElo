"use server";

import { AuditAction, GameStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { calculateMultiplayerElo } from "@/lib/elo";
import { recalculateEloFromTransaction } from "@/lib/elo/recalculation";
import { GAME_PHOTO_REQUIRED_MESSAGE, validateGameParticipants, type EditableParticipant } from "@/lib/games/validation";
import { prisma } from "@/lib/prisma";
import { deleteStoredImage, withStoredImageLifecycle, type StoredImage } from "@/lib/storage/images";
import { ELO_RECALCULATION_TRANSACTION_OPTIONS } from "@/lib/prisma/transaction-options";
import { resolveOpenGameReviews } from "@/lib/games/review-resolution";
import { hardDeleteGameInTransaction } from "@/lib/games/deletion";

type EditGameInput = { playedAt: string; participants: EditableParticipant[]; reason?: string; resolveOpenReports?: boolean };

function parseInput(formData: FormData): EditGameInput {
  const raw = String(formData.get("payload") ?? "");
  let input: EditGameInput;
  try { input = JSON.parse(raw) as EditGameInput; } catch { throw new Error("Die Bearbeitungsdaten sind ungültig."); }
  const playedAt = new Date(input.playedAt);
  if (Number.isNaN(playedAt.getTime())) throw new Error("Datum und Uhrzeit der Partie sind ungültig.");
  validateGameParticipants(input.participants);
  return { ...input, playedAt: playedAt.toISOString(), reason: input.reason?.trim() };
}

function auditParticipants(participants: Array<{ playerId: string; points: number; placement: number; tiebreakRank: number | null; missionId: string; missionKept: boolean }>) {
  return participants.map(({ playerId, points, placement, tiebreakRank, missionId, missionKept }) => ({ playerId, points, placement, tiebreakRank, missionId, missionKept }));
}

async function persistEdit(gameId: string, adminId: string, input: EditGameInput, replacement: StoredImage | null) {
  return prisma.$transaction(async (tx) => {
    const oldGame = await tx.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { participants: { orderBy: { placement: "asc" } } },
    });
    if (oldGame.status === GameStatus.DELETED || oldGame.deletedAt) throw new Error("Gelöschte Partien können nicht bearbeitet werden.");
    if (!replacement && (!oldGame.photoUrl || !oldGame.photoStorageId)) throw new Error(GAME_PHOTO_REQUIRED_MESSAGE);

    const playerIds = validateGameParticipants(input.participants);
    const missionIds = [...new Set(input.participants.map((participant) => participant.missionId.trim()))];
    const historicalMissionIds = new Set(oldGame.participants.map((participant) => participant.missionId));
    const [players, missions] = await Promise.all([
      tx.player.findMany({ where: { id: { in: playerIds }, isActive: true, deletedAt: null, mergedIntoPlayerId: null }, select: { id: true, currentRating: true } }),
      tx.mission.findMany({ where: { id: { in: missionIds } }, select: { id: true, isActive: true } }),
    ]);
    if (players.length !== playerIds.length) throw new Error("Mindestens ein Spieler ist nicht vorhanden oder nicht aktiv.");
    if (missions.length !== missionIds.length || missions.some((mission) => !mission.isActive && !historicalMissionIds.has(mission.id))) {
      throw new Error("Mindestens eine Mission ist ungültig oder nicht mehr für neue Zuordnungen verfügbar.");
    }

    const ratings = new Map(players.map((player) => [player.id, player.currentRating]));
    const results = calculateMultiplayerElo(input.participants.map((participant) => ({
      id: participant.playerId.trim(), rating: ratings.get(participant.playerId.trim())!, points: participant.points, tiebreakRank: participant.tiebreakRank,
    })));
    const resultByPlayer = new Map(results.map((result) => [result.id, result]));
    const newPlayedAt = new Date(input.playedAt);
    const recalculationFrom = new Date(Math.min(oldGame.playedAt.getTime(), newPlayedAt.getTime()));

    await tx.game.update({ where: { id: gameId }, data: {
      playedAt: newPlayedAt,
      ...(replacement ? { photoUrl: replacement.url, photoStorageId: replacement.storageId } : {}),
    } });
    await tx.gameParticipant.deleteMany({ where: { gameId } });
    await tx.gameParticipant.createMany({ data: input.participants.map((participant) => {
      const result = resultByPlayer.get(participant.playerId.trim())!;
      return {
        gameId, playerId: participant.playerId.trim(), points: participant.points, placement: result.placement,
        tiebreakRank: participant.tiebreakRank, missionId: participant.missionId.trim(), missionKept: participant.missionKept,
        ratingBefore: result.rating, ratingChange: oldGame.status === GameStatus.CONFIRMED ? result.ratingChange : 0,
        ratingAfter: oldGame.status === GameStatus.CONFIRMED ? result.ratingAfter : result.rating,
      };
    }) });

    if (oldGame.status === GameStatus.CONFIRMED) await recalculateEloFromTransaction(tx, recalculationFrom);
    if (input.resolveOpenReports) await resolveOpenGameReviews(tx, gameId, adminId);

    const updatedParticipants = input.participants.map((participant) => {
      const result = resultByPlayer.get(participant.playerId.trim())!;
      return { playerId: participant.playerId.trim(), points: participant.points, placement: result.placement, tiebreakRank: participant.tiebreakRank ?? null, missionId: participant.missionId.trim(), missionKept: participant.missionKept };
    });
    await tx.auditLog.create({ data: {
      actorUserId: adminId, action: AuditAction.UPDATED, entityType: "Game", entityId: gameId,
      oldData: { playedAt: oldGame.playedAt.toISOString(), participants: auditParticipants(oldGame.participants), photo: { storageId: oldGame.photoStorageId ?? null } },
      newData: { playedAt: newPlayedAt.toISOString(), participants: updatedParticipants, photo: { replaced: Boolean(replacement), storageId: replacement?.storageId ?? oldGame.photoStorageId ?? null }, recalculationFrom: oldGame.status === GameStatus.CONFIRMED ? recalculationFrom.toISOString() : null },
      note: input.reason || "Partie administrativ bearbeitet",
    } });
    return { oldPhoto: replacement ? { url: oldGame.photoUrl, storageId: oldGame.photoStorageId } : null };
  }, ELO_RECALCULATION_TRANSACTION_OPTIONS);
}

export async function updateGame(gameId: string, formData: FormData) {
  const admin = await requireAdmin();
  try {
    const input = parseInput(formData);
    const fileValue = formData.get("photo");
    const replacement = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const result = replacement
      ? await withStoredImageLifecycle(replacement, "games", (image) => persistEdit(gameId, admin.id, input, image))
      : await persistEdit(gameId, admin.id, input, null);
    if (result.oldPhoto) {
      await deleteStoredImage(result.oldPhoto).catch(() => console.error("Das ersetzte alte Partiefoto konnte nicht gelöscht werden."));
    }
    revalidatePath("/"); revalidatePath("/partien"); revalidatePath(`/partien/${gameId}`);
    revalidatePath("/admin/partien"); revalidatePath(`/admin/partien/${gameId}`);
    return { success: true as const };
  } catch (error) {
    console.error("Administrative Partiebearbeitung fehlgeschlagen:", error instanceof Error ? error.message : "Unbekannter Fehler");
    return { error: error instanceof Error ? error.message : "Die Partie konnte nicht bearbeitet werden." };
  }
}

export async function resolveGameReports(gameId: string) {
  const admin = await requireAdmin();
  if (!gameId) return { error: "Die Partie-ID fehlt." };
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.game.findUniqueOrThrow({ where: { id: gameId }, select: { id: true } });
      return resolveOpenGameReviews(tx, gameId, admin.id);
    });
    revalidatePath("/admin"); revalidatePath("/admin/partien"); revalidatePath(`/admin/partien/${gameId}`);
    return result.closedCount > 0 || result.closedReportCount > 0 ? { success: true as const } : { error: "Für diese Partie gibt es keine offene Meldung mehr." };
  } catch (error) {
    console.error("Partiemeldungen konnten nicht abgeschlossen werden:", error instanceof Error ? error.message : "Unbekannter Fehler");
    return { error: "Die Meldung konnte nicht als erledigt markiert werden. Bitte versuche es erneut." };
  }
}

export async function deleteGame(gameId: string) {
  const admin = await requireAdmin();
  if (!gameId) return { error: "Die Partie-ID fehlt." };
  try {
    await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId }, select: { id: true, playedAt: true, status: true, photoUrl: true, photoStorageId: true } });
      // Vercel Blob ist nicht Teil der PostgreSQL-Transaktion. Ein Fehler stoppt vor jeder Datenbanklöschung.
      if (game.photoUrl || game.photoStorageId) await deleteStoredImage({ url: game.photoUrl, storageId: game.photoStorageId });
      await hardDeleteGameInTransaction(tx, game, admin.id, { recalculate: recalculateEloFromTransaction });
    }, ELO_RECALCULATION_TRANSACTION_OPTIONS);
    revalidatePath("/"); revalidatePath("/partien"); revalidatePath(`/partien/${gameId}`);
    revalidatePath("/statistik"); revalidatePath("/admin"); revalidatePath("/admin/partien");
    return { success: true as const };
  } catch (error) {
    console.error("Partie konnte nicht endgültig gelöscht werden:", error instanceof Error ? error.message : "Unbekannter Fehler");
    return { error: "Die Partie konnte nicht gelöscht werden. Es wurden keine unvollständigen Datenbankänderungen gespeichert." };
  }
}
