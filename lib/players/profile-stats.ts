export type ProfileParticipation = {
  id: string;
  placement: number;
  points: number;
  ratingBefore: number;
  ratingChange: number;
  ratingAfter: number;
  game: { id: string; playedAt: Date; createdAt: Date };
};

export type LinkedExtreme = { value: number; playedAt: Date; gameId: string };

const ascending = (a: ProfileParticipation, b: ProfileParticipation) =>
  a.game.playedAt.getTime() - b.game.playedAt.getTime() ||
  a.game.createdAt.getTime() - b.game.createdAt.getTime() ||
  a.game.id.localeCompare(b.game.id);

export function calculateProfileStats(initialRating: number, rows: ProfileParticipation[]) {
  const participations = [...rows].sort(ascending);
  const games = participations.length;
  const wins = participations.filter((row) => row.placement === 1).length;
  const highestRating = participations.reduce(
    (best, row) => row.ratingAfter > best.value ? { value: row.ratingAfter, reachedAt: row.game.playedAt } : best,
    { value: initialRating, reachedAt: null as Date | null },
  );
  // Ties deliberately keep the earliest chronologically stable result.
  const highestScore = participations.reduce<LinkedExtreme | null>((best, row) =>
    !best || row.points > best.value ? { value: row.points, playedAt: row.game.playedAt, gameId: row.game.id } : best, null);
  const largestGain = participations.reduce<LinkedExtreme | null>((best, row) =>
    !best || row.ratingChange > best.value ? { value: row.ratingChange, playedAt: row.game.playedAt, gameId: row.game.id } : best, null);
  const largestLoss = participations.reduce<LinkedExtreme | null>((best, row) =>
    !best || row.ratingChange < best.value ? { value: row.ratingChange, playedAt: row.game.playedAt, gameId: row.game.id } : best, null);

  return {
    games, wins,
    winRate: games ? wins / games : null,
    averagePlacement: games ? participations.reduce((sum, row) => sum + row.placement, 0) / games : null,
    averagePoints: games ? participations.reduce((sum, row) => sum + row.points, 0) / games : null,
    highestRating,
    highestScore,
    largestGain,
    largestLoss,
    lastActivity: participations.at(-1)?.game.playedAt ?? null,
    timeline: [
      { id: "initial", gameId: null, playedAt: null, ratingBefore: initialRating, ratingChange: 0, ratingAfter: initialRating },
      ...participations.map((row) => ({ id: row.id, gameId: row.game.id, playedAt: row.game.playedAt, ratingBefore: row.ratingBefore, ratingChange: row.ratingChange, ratingAfter: row.ratingAfter })),
    ],
  };
}
