import { AuditAction, GameStatus, Prisma } from "@prisma/client";

export const ALLOWED_INITIAL_RATINGS = [1200, 1500] as const;
export class InitialRatingValidationError extends Error {}

export type ChangeInitialRatingInput = { playerId: string; adminId: string; newInitialRating: number; reason: string; confirmed: boolean };
type Recalculate = (tx: Prisma.TransactionClient, from: Date) => Promise<{
  participantUpdates: Array<{ gameId: string }>;
  finalRatings: Map<string, number>;
}>;

export function validateInitialRatingRequest(input: Omit<ChangeInitialRatingInput, "adminId">) {
  if (!input.playerId) throw new InitialRatingValidationError("Die Spieler-ID fehlt.");
  if (!ALLOWED_INITIAL_RATINGS.includes(input.newInitialRating as 1200 | 1500)) throw new InitialRatingValidationError("Das Start-Elo muss exakt 1200 oder 1500 betragen.");
  if (!input.reason.trim()) throw new InitialRatingValidationError("Bitte gib einen Änderungsgrund ein.");
  if (!input.confirmed) throw new InitialRatingValidationError("Bitte bestätige die vollständige Elo-Neuberechnung.");
}

export async function changeInitialRatingInTransaction(tx: Prisma.TransactionClient, input: ChangeInitialRatingInput, recalculate: Recalculate) {
  validateInitialRatingRequest(input);
  const player = await tx.player.findUnique({ where: { id: input.playerId }, select: { id: true, initialRating: true, currentRating: true, deletedAt: true, mergedIntoPlayerId: true } });
  if (!player) throw new InitialRatingValidationError("Der Spieler wurde nicht gefunden.");
  if (player.deletedAt) throw new InitialRatingValidationError("Das Start-Elo eines gelöschten Spielers kann nicht geändert werden.");
  if (player.mergedIntoPlayerId) throw new InitialRatingValidationError("Das Start-Elo eines zusammengeführten Spielers kann nicht geändert werden.");
  if (player.initialRating === input.newInitialRating) throw new InitialRatingValidationError("Der gewählte Wert entspricht bereits dem aktuellen Start-Elo.");

  const firstGame = await tx.game.findFirst({
    where: { status: GameStatus.CONFIRMED, deletedAt: null, participants: { some: { playerId: input.playerId } } },
    orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { playedAt: true },
  });
  await tx.player.update({ where: { id: input.playerId }, data: firstGame ? { initialRating: input.newInitialRating } : { initialRating: input.newInitialRating, currentRating: input.newInitialRating } });

  let recalculatedGames = 0;
  let updatedParticipants = 0;
  let newCurrentRating = input.newInitialRating;
  if (firstGame) {
    const result = await recalculate(tx, firstGame.playedAt);
    recalculatedGames = new Set(result.participantUpdates.map((participant) => participant.gameId)).size;
    updatedParticipants = result.participantUpdates.length;
    newCurrentRating = result.finalRatings.get(input.playerId) ?? input.newInitialRating;
  }
  await tx.auditLog.create({ data: {
    actorUserId: input.adminId, action: AuditAction.UPDATED, entityType: "PlayerInitialRating", entityId: input.playerId,
    oldData: { initialRating: player.initialRating, currentRating: player.currentRating },
    newData: { initialRating: input.newInitialRating, currentRating: newCurrentRating, recalculationFrom: firstGame?.playedAt.toISOString() ?? null, recalculatedGames, updatedParticipants },
    note: input.reason.trim(),
  } });
  return { recalculationFrom: firstGame?.playedAt ?? null, recalculatedGames, updatedParticipants, newCurrentRating };
}
