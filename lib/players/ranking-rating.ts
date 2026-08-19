const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const INACTIVITY_GRACE_DAYS = 30;

export type RankingRating = {
  currentRating: number;
  rankingRating: number;
  inactiveDays: number | null;
  inactivityPenalty: number;
};

/** Uses complete UTC-based 24-hour periods; a player without a game is not inactive. */
export function calculateRankingRating(currentRating: number, lastPlayedAt: Date | null, now: Date): RankingRating {
  if (!lastPlayedAt) return { currentRating, rankingRating: currentRating, inactiveDays: null, inactivityPenalty: 0 };
  const inactiveDays = Math.max(0, Math.floor((now.getTime() - lastPlayedAt.getTime()) / MILLISECONDS_PER_DAY));
  const inactivityPenalty = inactiveDays > INACTIVITY_GRACE_DAYS ? inactiveDays : 0;
  return { currentRating, rankingRating: currentRating - inactivityPenalty, inactiveDays, inactivityPenalty };
}

export type RankingPlayer = RankingRating & {
  id: string;
  alias: string;
  confirmedGames: number;
};

export function compareRankingPlayers(left: RankingPlayer, right: RankingPlayer) {
  return right.rankingRating - left.rankingRating
    || right.currentRating - left.currentRating
    || right.confirmedGames - left.confirmedGames
    || left.alias.localeCompare(right.alias, "de")
    || left.id.localeCompare(right.id);
}
