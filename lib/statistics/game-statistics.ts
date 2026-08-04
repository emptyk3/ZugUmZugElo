import type { StatisticsGame } from "./types.ts";

export type GameStatisticColumn = {
  games: number;
  averagePoints: number | null;
  averageWinnerPoints: number | null;
};

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
  return {
    total: summarize(games),
    fourPlayers: summarize(fourPlayerGames),
    fivePlayers: summarize(fivePlayerGames),
    unexpectedPlayerCountGames: games.length - fourPlayerGames.length - fivePlayerGames.length,
  };
}

