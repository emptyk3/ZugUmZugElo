import { AuditAction, GameStatus, Prisma } from "@prisma/client";
import { DEFAULT_INITIAL_RATING } from "./constants.ts";
import { writeRecalculatedRatings } from "./persistence.ts";
import { calculateChronologicalRatings } from "./timeline.ts";

export const UNIFORM_START_RATING_REBUILD_ID = "uniform-start-rating-1500-v1";

type PersistRebuild = typeof writeRecalculatedRatings;

export async function rebuildAllEloAt1500InTransaction(tx: Prisma.TransactionClient, persist: PersistRebuild = writeRecalculatedRatings) {
  const previousRun = await tx.auditLog.findFirst({ where: { entityType: "EloSystem", entityId: UNIFORM_START_RATING_REBUILD_ID }, select: { id: true } });
  if (previousRun) throw new Error("Der einmalige Elo-Rebuild auf Start-Elo 1500 wurde bereits ausgeführt.");
  const players = await tx.player.findMany({ select: { id: true, initialRating: true } });
  const affectedPlayers = players.filter((player) => player.initialRating !== DEFAULT_INITIAL_RATING).length;
  const oldStartRatings = [...new Set(players.map((player) => player.initialRating))].sort((left, right) => left - right);
  await tx.player.updateMany({ data: { initialRating: DEFAULT_INITIAL_RATING } });
  const games = await tx.game.findMany({
    where: { status: GameStatus.CONFIRMED, deletedAt: null },
    orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, playedAt: true, createdAt: true, participants: { select: { id: true, playerId: true, points: true, tiebreakRank: true } } },
  });
  const initialRatings = new Map(players.map((player) => [player.id, DEFAULT_INITIAL_RATING]));
  const recalculated = calculateChronologicalRatings(initialRatings, games);
  await persist(tx, recalculated);
  const summary = { totalPlayers: players.length, affectedPlayers, recalculatedGames: games.length, updatedParticipants: recalculated.participantUpdates.length };
  await tx.auditLog.create({ data: {
    actorUserId: null, action: AuditAction.UPDATED, entityType: "EloSystem", entityId: UNIFORM_START_RATING_REBUILD_ID,
    oldData: { startRatings: oldStartRatings },
    newData: { startRating: DEFAULT_INITIAL_RATING, ...summary, completedAt: new Date().toISOString() },
    note: "Einmaliger vollständiger Elo-Rebuild mit einheitlichem Start-Elo 1500.",
  } });
  return summary;
}
