export type MissionParticipation = {
  points: number; placement: number; missionKept: boolean; gameId: string; playedAt: Date;
  mission: { id: string; name: string; sortOrder: number } | null;
};

export type MissionStat = {
  id: string; name: string; sortOrder: number; games: number; wins: number; winRate: number;
  averagePlacement: number; averagePoints: number; highestScore: { value: number; gameId: string; playedAt: Date };
  kept: number; notKept: number; isWithoutMission: boolean;
};

export function calculateMissionStats(rows: MissionParticipation[]) {
  const groups = new Map<string, MissionParticipation[]>();
  for (const row of rows) {
    const key = row.mission?.id ?? "without-mission";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const stats: MissionStat[] = [...groups.entries()].map(([id, items]) => {
    const mission = items[0].mission;
    const ordered = [...items].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.gameId.localeCompare(b.gameId));
    const wins = items.filter((row) => row.placement === 1).length;
    const highest = ordered.reduce((best, row) => row.points > best.points ? row : best);
    return { id, name: mission?.name ?? "Ohne Mission", sortOrder: mission?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      games: items.length, wins, winRate: wins / items.length,
      averagePlacement: items.reduce((sum, row) => sum + row.placement, 0) / items.length,
      averagePoints: items.reduce((sum, row) => sum + row.points, 0) / items.length,
      highestScore: { value: highest.points, gameId: highest.gameId, playedAt: highest.playedAt },
      kept: items.filter((row) => row.missionKept).length, notKept: items.filter((row) => !row.missionKept).length,
      isWithoutMission: !mission };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));

  const favorite = [...stats].sort((a, b) => b.games - a.games || b.winRate - a.winRate || a.sortOrder - b.sortOrder)[0] ?? null;
  const qualified = stats.filter((item) => item.games >= 2);
  const best = [...qualified].sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.averagePlacement - b.averagePlacement || a.sortOrder - b.sortOrder)[0] ?? null;
  const worst = [...qualified].sort((a, b) => a.winRate - b.winRate || b.games - a.games || b.averagePlacement - a.averagePlacement || a.sortOrder - b.sortOrder)[0] ?? null;
  return { rows: stats, favorite, best, worst };
}
