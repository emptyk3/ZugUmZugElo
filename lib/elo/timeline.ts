import { calculateMultiplayerElo } from "./index.ts";

export type ChronologicalParticipant = { id: string; playerId: string; points: number; tiebreakRank: number | null };
export type ChronologicalGame = { id: string; playedAt: Date; createdAt: Date; participants: ChronologicalParticipant[] };
export type RecalculatedParticipant = { id: string; gameId: string; playerId: string; placement: number; ratingBefore: number; ratingChange: number; ratingAfter: number };

/** Pure chronological replay without React, UI, API or database dependencies. */
export function calculateChronologicalRatings(ratingsAtStart: ReadonlyMap<string, number>, games: readonly ChronologicalGame[]) {
  const ratings = new Map(ratingsAtStart);
  const participantUpdates: RecalculatedParticipant[] = [];
  const orderedGames = [...games].sort((left, right) => left.playedAt.getTime() - right.playedAt.getTime() || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
  for (const game of orderedGames) {
    const result = calculateMultiplayerElo(game.participants.map((participant) => {
      const rating = ratings.get(participant.playerId);
      if (rating === undefined) throw new Error(`Für Spieler ${participant.playerId} fehlt der Elo-Ausgangswert.`);
      return { id: participant.playerId, rating, points: participant.points, tiebreakRank: participant.tiebreakRank ?? undefined };
    }));
    const byPlayer = new Map(game.participants.map((participant) => [participant.playerId, participant]));
    for (const elo of result) {
      const participant = byPlayer.get(elo.id);
      if (!participant) throw new Error(`Teilnehmerdaten für Spieler ${elo.id} fehlen.`);
      participantUpdates.push({ id: participant.id, gameId: game.id, playerId: elo.id, placement: elo.placement, ratingBefore: elo.rating, ratingChange: elo.ratingChange, ratingAfter: elo.ratingAfter });
      ratings.set(elo.id, elo.ratingAfter);
    }
  }
  return { participantUpdates, finalRatings: ratings };
}
