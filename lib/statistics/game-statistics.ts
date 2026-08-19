import { compareGames, type StatisticsGame } from "./types.ts";

export type GameStatisticColumn = {
  games: number;
  averagePoints: number | null;
  averageWinnerPoints: number | null;
};

export type GamePointsTimelineEntry = {
  gameId: string;
  playedAt: Date;
  winnerPoints: number;
  gameAveragePoints: number;
  cumulativeWinnerAverage: number;
  cumulativePlayerAverage: number;
};

export function buildGamePointsTimeline(games: StatisticsGame[]): GamePointsTimelineEntry[] {
  let winnerPointsTotal = 0;
  let playerPointsTotal = 0;
  let playerResultsTotal = 0;

  return [...games].sort(compareGames).map((game, index) => {
    const winner = game.participants.find((participant) => participant.placement === 1);
    if (!winner || game.participants.length === 0) throw new Error(`Partie ${game.id} besitzt keine vollständigen Ergebnisdaten.`);

    const gamePointsTotal = game.participants.reduce((sum, participant) => sum + participant.points, 0);
    winnerPointsTotal += winner.points;
    playerPointsTotal += gamePointsTotal;
    playerResultsTotal += game.participants.length;

    return {
      gameId: game.id,
      playedAt: game.playedAt,
      winnerPoints: winner.points,
      gameAveragePoints: gamePointsTotal / game.participants.length,
      cumulativeWinnerAverage: winnerPointsTotal / (index + 1),
      cumulativePlayerAverage: playerPointsTotal / playerResultsTotal,
    };
  });
}

function summarize(games: StatisticsGame[]): GameStatisticColumn {
  const results = games.flatMap((game) => game.participants);
  const winners = games.flatMap((game) => game.participants.filter((participant) => participant.placement === 1).slice(0, 1));
  return {
    games: games.length,
    averagePoints: results.length ? results.reduce((sum, row) => sum + row.points, 0) / results.length : null,
    averageWinnerPoints: winners.length ? winners.reduce((sum, row) => sum + row.points, 0) / winners.length : null,
  };
}

export function calculateGameStatistics(games: StatisticsGame[]) {
  const fourPlayerGames = games.filter((game) => game.participants.length === 4);
  const fivePlayerGames = games.filter((game) => game.participants.length === 5);
  // Build every timeline from its own game set. Category timelines must never
  // be filtered from an already accumulated total timeline.
  const totalTimeline = buildGamePointsTimeline(games);
  const fourPlayerTimeline = buildGamePointsTimeline(fourPlayerGames);
  const fivePlayerTimeline = buildGamePointsTimeline(fivePlayerGames);

  return {
    total: summarize(games),
    fourPlayers: summarize(fourPlayerGames),
    fivePlayers: summarize(fivePlayerGames),
    unexpectedPlayerCountGames: games.length - fourPlayerGames.length - fivePlayerGames.length,
    timelines: {
      total: totalTimeline,
      fourPlayers: fourPlayerTimeline,
      fivePlayers: fivePlayerTimeline,
    },
  };
}
