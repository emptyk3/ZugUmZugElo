export type OpponentGame = {
  gameId: string; ownPlacement: number; opponentPlacement: number; ownPoints: number; opponentPoints: number;
  opponent: { id: string; alias: string; imageUrl: string | null };
};
export type OpponentStat = {
  id: string; alias: string; imageUrl: string | null; games: number; wins: number; losses: number; winRate: number;
  averagePlacementDifference: number; averagePointDifference: number;
};

const favoriteOrder = (a: OpponentStat, b: OpponentStat) =>
  b.winRate - a.winRate || b.averagePlacementDifference - a.averagePlacementDifference || a.alias.localeCompare(b.alias, "de");
const nemesisOrder = (a: OpponentStat, b: OpponentStat) =>
  a.winRate - b.winRate || a.averagePlacementDifference - b.averagePlacementDifference || a.alias.localeCompare(b.alias, "de");

export function calculateOpponentStats(input: OpponentGame[]) {
  const unique = new Map<string, OpponentGame>();
  for (const row of input) unique.set(`${row.gameId}:${row.opponent.id}`, row);
  const groups = new Map<string, OpponentGame[]>();
  for (const row of unique.values()) groups.set(row.opponent.id, [...(groups.get(row.opponent.id) ?? []), row]);
  const allRows: OpponentStat[] = [...groups.values()].map((games) => {
    const wins = games.filter((row) => row.ownPlacement < row.opponentPlacement).length;
    return {
      ...games[0].opponent, games: games.length, wins, losses: games.length - wins, winRate: wins / games.length,
      averagePlacementDifference: games.reduce((sum, row) => sum + row.opponentPlacement - row.ownPlacement, 0) / games.length,
      averagePointDifference: games.reduce((sum, row) => sum + row.ownPoints - row.opponentPoints, 0) / games.length,
    };
  });
  const rows = allRows.filter((row) => row.games >= 5).sort(favoriteOrder);
  const hasEnoughHighlights = rows.length >= 2;
  return {
    rows,
    favorite: hasEnoughHighlights ? [...rows].sort(favoriteOrder)[0] : null,
    nemesis: hasEnoughHighlights ? [...rows].sort(nemesisOrder)[0] : null,
  };
}
