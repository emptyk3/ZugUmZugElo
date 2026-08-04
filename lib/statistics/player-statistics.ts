import { compareGames, equalNumber, type StatisticsGame, type StatisticsPlayer } from "./types.ts";

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
const selectBest = <T>(rows: T[], compare: (a: T, b: T) => number) => {
  if (!rows.length) return [];
  const sorted = [...rows].sort(compare);
  const best = sorted[0];
  return sorted.filter((row) => compare(row, best) === 0);
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

  const allRows = [...byPlayer.values()].flat();
  const allTime = selectBest(allRows, (a, b) => b.row.ratingAfter - a.row.ratingAfter)
    .filter((row, index, list) => list.findIndex((item) => item.row.playerId === row.row.playerId) === index)
    .map((row) => ({ ...playerRef(row), value: row.row.ratingAfter, gameId: row.game.id, playedAt: row.game.playedAt }));

  const summaries = [...byPlayer.values()].map((rows) => {
    const wins = rows.filter((item) => item.row.placement === 1).length;
    return { ...playerRef(rows[0]), games: rows.length, wins, winRate: wins / rows.length, averagePoints: rows.reduce((sum, item) => sum + item.row.points, 0) / rows.length };
  });
  const highestWinRate = selectBest(summaries.filter((row) => row.games >= 5), (a, b) => b.winRate - a.winRate || b.games - a.games || b.wins - a.wins);
  const highestAveragePoints = selectBest(summaries.filter((row) => row.games >= 5), (a, b) => b.averagePoints - a.averagePoints || b.games - a.games);

  const maxScore = allRows.length ? Math.max(...allRows.map((item) => item.row.points)) : null;
  const highestScore = maxScore === null ? [] : allRows.filter((item) => item.row.points === maxScore)
    .filter((row, index, list) => list.findIndex((item) => item.row.playerId === row.row.playerId) === index)
    .map((row) => ({ ...playerRef(row), value: row.row.points, gameId: row.game.id, playedAt: row.game.playedAt }));

  const winningSeries = [...byPlayer.values()].flatMap((rows) => buildSeries(rows, (item) => item.row.placement === 1));
  const nonLossSeries = [...byPlayer.values()].flatMap((rows) => buildSeries(rows, (item) => item.row.ratingChange >= 0));
  const longestWinningStreak = selectBest(winningSeries, (a, b) => b.games - a.games || b.averagePoints - a.averagePoints);
  const longestNonLossStreak = selectBest(nonLossSeries, (a, b) => b.games - a.games || b.totalGain - a.totalGain || b.averagePoints - a.averagePoints);
  const greatestNonLossGain = selectBest(nonLossSeries, (a, b) => b.totalGain - a.totalGain || a.games - b.games || b.averagePoints - a.averagePoints);
  const bestFiveGameGain = selectBest([...byPlayer.values()].flatMap((rows) => windows(rows, 5)), (a, b) => b.value - a.value);
  const bestTenGameGain = selectBest([...byPlayer.values()].flatMap((rows) => windows(rows, 10)), (a, b) => b.value - a.value);

  return { currentTop, highestAllTime: allTime, highestWinRate, highestAveragePoints, highestScore, longestWinningStreak, longestNonLossStreak, greatestNonLossGain, bestFiveGameGain, bestTenGameGain };
}

