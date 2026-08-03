export type OpponentGame = { gameId: string; opponent: { id: string; alias: string; imageUrl: string | null }; ownPlacement: number; opponentPlacement: number };
export type OpponentStat = { id: string; alias: string; imageUrl: string | null; games: number; wins: number; losses: number; winRate: number; averagePlacementDifference: number };

export function calculateOpponentStats(input: OpponentGame[]) {
  const unique = new Map<string, OpponentGame>();
  for (const row of input) unique.set(`${row.gameId}:${row.opponent.id}`, row);
  const groups = new Map<string, OpponentGame[]>();
  for (const row of unique.values()) groups.set(row.opponent.id, [...(groups.get(row.opponent.id) ?? []), row]);
  const rows: OpponentStat[] = [...groups.values()].map((games) => {
    const wins = games.filter((row) => row.ownPlacement < row.opponentPlacement).length;
    return { ...games[0].opponent, games: games.length, wins, losses: games.length - wins, winRate: wins / games.length,
      averagePlacementDifference: games.reduce((sum, row) => sum + row.opponentPlacement - row.ownPlacement, 0) / games.length };
  }).sort((a, b) => b.games - a.games || a.alias.localeCompare(b.alias, "de"));
  const eligible = rows.filter((row) => row.games >= 5);
  const favorite = [...eligible].sort((a, b) => b.winRate - a.winRate || b.games - a.games || b.averagePlacementDifference - a.averagePlacementDifference || a.alias.localeCompare(b.alias, "de"))[0] ?? null;
  const nemesis = [...eligible].sort((a, b) => a.winRate - b.winRate || b.games - a.games || a.averagePlacementDifference - b.averagePlacementDifference || a.alias.localeCompare(b.alias, "de"))[0] ?? null;
  return { rows, favorite, nemesis };
}
