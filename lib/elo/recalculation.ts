import { GameStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateChronologicalRatings } from "./timeline";
import { ELO_RECALCULATION_TRANSACTION_OPTIONS } from "@/lib/prisma/transaction-options";
import { writeRecalculatedRatings } from "./persistence";

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
  await writeRecalculatedRatings(tx, recalculated);
  return recalculated;
}

/** Public transaction boundary for future game editing and backdating flows. */
export function recalculateEloFrom(from: Date) {
  return prisma.$transaction(
    (tx) => recalculateEloFromTransaction(tx, from),
    ELO_RECALCULATION_TRANSACTION_OPTIONS,
  );
}
