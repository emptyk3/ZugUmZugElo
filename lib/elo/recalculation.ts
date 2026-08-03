import { GameStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateChronologicalRatings } from "./timeline";

/** Runs a replay inside an existing transaction (admin approval/edit/backdating). */
export async function recalculateEloFromTransaction(
  tx: Prisma.TransactionClient,
  from: Date,
) {
  if (Number.isNaN(from.getTime())) throw new TypeError("Der Startzeitpunkt der Elo-Neuberechnung ist ungültig.");

  const [players, earlierParticipants, games] = await Promise.all([
    tx.player.findMany({ select: { id: true, initialRating: true } }),
    tx.gameParticipant.findMany({
      where: { game: { status: GameStatus.CONFIRMED, deletedAt: null, playedAt: { lt: from } } },
      orderBy: [
        { game: { playedAt: "desc" } },
        { game: { createdAt: "desc" } },
        { gameId: "desc" },
      ],
      select: { playerId: true, ratingAfter: true },
    }),
    tx.game.findMany({
      where: { status: GameStatus.CONFIRMED, deletedAt: null, playedAt: { gte: from } },
      orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        playedAt: true,
        createdAt: true,
        participants: {
          select: { id: true, playerId: true, points: true, tiebreakRank: true },
        },
      },
    }),
  ]);

  const ratingsAtStart = new Map(players.map((player) => [player.id, player.initialRating]));
  const resolvedPlayers = new Set<string>();
  for (const participant of earlierParticipants) {
    if (!resolvedPlayers.has(participant.playerId)) {
      ratingsAtStart.set(participant.playerId, participant.ratingAfter);
      resolvedPlayers.add(participant.playerId);
    }
  }

  const recalculated = calculateChronologicalRatings(ratingsAtStart, games);
  for (const participant of recalculated.participantUpdates) {
    await tx.gameParticipant.update({
      where: { id: participant.id },
      data: {
        placement: participant.placement,
        ratingBefore: participant.ratingBefore,
        ratingChange: participant.ratingChange,
        ratingAfter: participant.ratingAfter,
      },
    });
  }
  for (const [playerId, currentRating] of recalculated.finalRatings) {
    await tx.player.update({ where: { id: playerId }, data: { currentRating } });
  }
  return recalculated;
}

/** Public transaction boundary for future game editing and backdating flows. */
export function recalculateEloFrom(from: Date) {
  return prisma.$transaction(
    (tx) => recalculateEloFromTransaction(tx, from),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
