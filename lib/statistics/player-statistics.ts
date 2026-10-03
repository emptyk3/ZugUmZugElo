import { compareGames, equalNumber, type StatisticsGame, type StatisticsPlayer } from "./types.ts";
import { median } from "./distribution.ts";

type PlayerRef = Pick<StatisticsPlayer, "id" | "alias" | "imageUrl">;
type OwnGame = { game: StatisticsGame; row: StatisticsGame["participants"][number] };
export type LinkedRecord = PlayerRef & { value: number; games?: number; wins?: number; gameId?: string; playedAt?: Date };
export type SeriesRecord = PlayerRef & {
  value: number;
  games: number;
  totalGain: number;
  averagePoints: number;
  startedAt: Date;
  endedAt: Date;
  firstGameId: string;
  running: boolean;
};

const playerRef = (row: OwnGame): PlayerRef => ({ id: row.row.playerId, alias: row.row.alias, imageUrl: row.row.imageUrl });
const selectTopRanks = <T>(rows: T[], compare: (a: T, b: T) => number, sameRank: (a: T, b: T) => boolean = (a, b) => compare(a, b) === 0) => {
  const sorted = [...rows].sort(compare);
  let previous: T | undefined;
  let rank = 0;
  return sorted.map((row) => {
    if (previous === undefined || !sameRank(row, previous)) rank += 1;
    previous = row;
    return { ...row, rank };
  }).filter((row) => row.rank <= 3);
};

const bestPerPlayer = <T extends PlayerRef>(rows: T[], compare: (a: T, b: T) => number) => {
  const seen = new Set<string>();
  return [...rows].sort(compare).filter((row) => seen.has(row.id) ? false : (seen.add(row.id), true));
};

function buildSeries(rows: OwnGame[], accepts: (row: OwnGame) => boolean): SeriesRecord[] {
  const result: SeriesRecord[] = [];
  let current: OwnGame[] = [];
  const flush = (running: boolean) => {
    if (!current.length) return;
    result.push({
      ...playerRef(current[0]),
      value: current.length,
      games: current.length,
      totalGain: current.reduce((sum, item) => sum + item.row.ratingChange, 0),
      averagePoints: current.reduce((sum, item) => sum + item.row.points, 0) / current.length,
      startedAt: current[0].game.playedAt,
      endedAt: current.at(-1)!.game.playedAt,
      firstGameId: current[0].game.id,
      running,
    });
    current = [];
  };
  rows.forEach((row) => accepts(row) ? current.push(row) : flush(false));
  flush(true);
  return result;
}

function windows(rows: OwnGame[], size: number): SeriesRecord[] {
  return rows.slice(0, Math.max(0, rows.length - size + 1)).map((_, index) => {
    const window = rows.slice(index, index + size);
    return {
      ...playerRef(window[0]), value: window.at(-1)!.row.ratingAfter - window[0].row.ratingBefore,
      games: size, totalGain: window.reduce((sum, item) => sum + item.row.ratingChange, 0),
      averagePoints: window.reduce((sum, item) => sum + item.row.points, 0) / size,
      startedAt: window[0].game.playedAt, endedAt: window.at(-1)!.game.playedAt,
      firstGameId: window[0].game.id, running: index + size === rows.length,
    };
  });
}

export function calculatePlayerStatistics(players: StatisticsPlayer[], games: StatisticsGame[]) {
  const sortedGames = [...games].sort(compareGames);
  const byPlayer = new Map<string, OwnGame[]>();
  sortedGames.forEach((game) => game.participants.forEach((row) => {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push({ game, row });
    byPlayer.set(row.playerId, list);
  }));

  const ranked = [...players].sort((a, b) => b.currentRating - a.currentRating || a.alias.localeCompare(b.alias, "de"));
  let previous: number | undefined;
  let rank = 0;
  const currentTop = ranked.map((player) => {
    if (previous === undefined || !equalNumber(previous, player.currentRating)) rank += 1;
    previous = player.currentRating;
    return { ...player, rank };
  }).filter((player) => player.rank <= 3);

  const mostGamesSorted = players.map((player) => ({
    ...player,
    games: new Set((byPlayer.get(player.id) ?? []).map((item) => item.game.id)).size,
  })).sort((a, b) => b.games - a.games || a.alias.localeCompare(b.alias, "de") || a.id.localeCompare(b.id));
  previous = undefined;
  rank = 0;
  const mostGames = mostGamesSorted.map((player) => {
    if (previous === undefined || previous !== player.games) rank += 1;
    previous = player.games;
    return { ...player, rank };
  }).filter((player) => player.rank <= 3);

  const allTimeByPlayer = [...byPlayer.values()].map((rows) => rows.reduce((best, row) => row.row.ratingAfter > best.row.ratingAfter ? row : best))
    .map((row) => ({ ...playerRef(row), value: row.row.ratingAfter, gameId: row.game.id, playedAt: row.game.playedAt }));
  const highestAllTime = selectTopRanks(allTimeByPlayer, (a, b) => b.value - a.value || a.alias.localeCompare(b.alias, "de"), (a, b) => equalNumber(a.value, b.value));

  const summaries = [...byPlayer.values()].map((rows) => {
    const wins = rows.filter((item) => item.row.placement === 1).length;
    return {
      ...playerRef(rows[0]), games: rows.length, wins, winRate: wins / rows.length,
      averagePoints: rows.reduce((sum, item) => sum + item.row.points, 0) / rows.length,
      medianPoints: median(rows.map((item) => item.row.points))!,
      averagePlacement: rows.reduce((sum, item) => sum + item.row.placement, 0) / rows.length,
    };
  });
  const highestWinRate = selectTopRanks(summaries.filter((row) => row.games >= 5), (a, b) => b.winRate - a.winRate || b.games - a.games || b.wins - a.wins);
  const highestAveragePoints = selectTopRanks(summaries.filter((row) => row.games >= 5), (a, b) => b.averagePoints - a.averagePoints || b.games - a.games);
  const highestMedianPoints = selectTopRanks(summaries.filter((row) => row.games >= 5), (a, b) => b.medianPoints - a.medianPoints || b.averagePoints - a.averagePoints || b.games - a.games || a.alias.localeCompare(b.alias, "de"));
  const bestAveragePlacement = selectTopRanks(summaries.filter((row) => row.games >= 5), (a, b) => a.averagePlacement - b.averagePlacement || b.winRate - a.winRate || b.games - a.games || a.alias.localeCompare(b.alias, "de"));

  const winningSeries = [...byPlayer.values()].flatMap((rows) => buildSeries(rows, (item) => item.row.placement === 1));
  const nonLossSeries = [...byPlayer.values()].flatMap((rows) => buildSeries(rows, (item) => item.row.ratingChange >= 0));
  const winningOrder = (a: SeriesRecord, b: SeriesRecord) => b.games - a.games || b.averagePoints - a.averagePoints;
  const nonLossOrder = (a: SeriesRecord, b: SeriesRecord) => b.games - a.games || b.totalGain - a.totalGain || b.averagePoints - a.averagePoints;
  const nonLossGainOrder = (a: SeriesRecord, b: SeriesRecord) => b.totalGain - a.totalGain || a.games - b.games || b.averagePoints - a.averagePoints;
  const windowOrder = (a: SeriesRecord, b: SeriesRecord) => b.value - a.value;
  const longestWinningStreak = selectTopRanks(bestPerPlayer(winningSeries, winningOrder), winningOrder);
  const longestNonLossStreak = selectTopRanks(bestPerPlayer(nonLossSeries, nonLossOrder), nonLossOrder);
  const greatestNonLossGain = selectTopRanks(bestPerPlayer(nonLossSeries, nonLossGainOrder), nonLossGainOrder);
  const bestFiveGameGain = selectTopRanks(bestPerPlayer([...byPlayer.values()].flatMap((rows) => windows(rows, 5)), windowOrder), windowOrder);
  const bestTenGameGain = selectTopRanks(bestPerPlayer([...byPlayer.values()].flatMap((rows) => windows(rows, 10)), windowOrder), windowOrder);

  return { currentTop, mostGames, highestAllTime, highestWinRate, highestAveragePoints, highestMedianPoints, bestAveragePlacement, longestWinningStreak, longestNonLossStreak, greatestNonLossGain, bestFiveGameGain, bestTenGameGain };
}
