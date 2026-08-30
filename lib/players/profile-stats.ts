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

const populationStandardDeviation = (values: number[], mean: number | null) => mean === null
  ? null
  : Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);

const ascending = (a: ProfileParticipation, b: ProfileParticipation) =>
  a.game.playedAt.getTime() - b.game.playedAt.getTime() ||
  a.game.createdAt.getTime() - b.game.createdAt.getTime() ||
  a.game.id.localeCompare(b.game.id);

export function calculateProfileStats(initialRating: number, rows: ProfileParticipation[]) {
  const participations = [...rows].sort(ascending);
  const games = participations.length;
  const wins = participations.filter((row) => row.placement === 1).length;
  const placements = participations.map((row) => row.placement);
  const points = participations.map((row) => row.points);
  const averagePlacement = games ? placements.reduce((sum, value) => sum + value, 0) / games : null;
  const averagePoints = games ? points.reduce((sum, value) => sum + value, 0) / games : null;
  const highestRating = participations.reduce(
    (best, row) => row.ratingAfter > best.value ? { value: row.ratingAfter, reachedAt: row.game.playedAt } : best,
    { value: initialRating, reachedAt: null as Date | null },
  );
  // Ties deliberately keep the earliest chronologically stable result.
  const largestGain = participations.reduce<LinkedExtreme | null>((best, row) =>
    !best || row.ratingChange > best.value ? { value: row.ratingChange, playedAt: row.game.playedAt, gameId: row.game.id } : best, null);
  const largestLoss = participations.reduce<LinkedExtreme | null>((best, row) =>
    !best || row.ratingChange < best.value ? { value: row.ratingChange, playedAt: row.game.playedAt, gameId: row.game.id } : best, null);

  return {
    games, wins,
    winRate: games ? wins / games : null,
    averagePlacement,
    placementStandardDeviation: populationStandardDeviation(placements, averagePlacement),
    averagePoints,
    pointsStandardDeviation: populationStandardDeviation(points, averagePoints),
    highestRating,
    largestGain,
    largestLoss,
    lastActivity: participations.at(-1)?.game.playedAt ?? null,
    timeline: [
      { id: "initial", gameId: null, playedAt: null, ratingBefore: initialRating, ratingChange: 0, ratingAfter: initialRating },
      ...participations.map((row) => ({ id: row.id, gameId: row.game.id, playedAt: row.game.playedAt, ratingBefore: row.ratingBefore, ratingChange: row.ratingChange, ratingAfter: row.ratingAfter })),
    ],
  };
}
