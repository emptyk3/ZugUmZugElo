import { compareGames, equalNumber, type MissionCatalogItem, type StatisticsGame } from "./types.ts";

export type MissionMetric = "drawn" | "drawnRate" | "kept" | "keptRate" | "wins" | "winRate" | "averagePlacement" | "averagePoints" | "averageWinnerPoints" | "maxPoints";
export type MissionStatisticRow = {
  id: string; name: string; isWithoutMission: boolean;
  drawn: number | null; drawnRate: number | null; kept: number | null; keptRate: number | null;
  wins: number; winRate: number | null; averagePlacement: number | null; averagePoints: number | null;
  averageWinnerPoints: number | null; maxPoints: { value: number; gameId: string } | null;
};

const metrics: MissionMetric[] = ["drawn", "drawnRate", "kept", "keptRate", "wins", "winRate", "averagePlacement", "averagePoints", "averageWinnerPoints", "maxPoints"];

export function calculateMissionStatistics(games: StatisticsGame[], catalog: MissionCatalogItem[]) {
  const sortedGames = [...games].sort(compareGames);
  const entries = sortedGames.flatMap((game) => game.participants.map((row) => ({ game, row })));
  const totalDrawn = entries.filter((entry) => catalog.some((mission) => mission.id === entry.row.missionId)).length;
  const summarize = (id: string, name: string, relevant: typeof entries, drawn: number | null, kept: number | null, without = false): MissionStatisticRow => {
    const wins = relevant.filter((entry) => entry.row.placement === 1);
    const maximum = relevant.length ? Math.max(...relevant.map((entry) => entry.row.points)) : null;
    const maximumEntry = maximum === null ? null : relevant.find((entry) => entry.row.points === maximum)!;
    return {
      id, name, isWithoutMission: without, drawn,
      drawnRate: drawn === null || totalDrawn === 0 ? null : drawn / totalDrawn,
      kept, keptRate: without
        ? kept === null || totalDrawn === 0 ? null : kept / totalDrawn
        : drawn === null || kept === null || drawn === 0 ? null : kept / drawn,
      wins: wins.length, winRate: relevant.length ? wins.length / relevant.length : null,
      averagePlacement: relevant.length ? relevant.reduce((sum, entry) => sum + entry.row.placement, 0) / relevant.length : null,
      averagePoints: relevant.length ? relevant.reduce((sum, entry) => sum + entry.row.points, 0) / relevant.length : null,
      averageWinnerPoints: wins.length ? wins.reduce((sum, entry) => sum + entry.row.points, 0) / wins.length : null,
      maxPoints: maximumEntry ? { value: maximumEntry.row.points, gameId: maximumEntry.game.id } : null,
    };
  };
  const rows = catalog.map((mission) => {
    const drawnEntries = entries.filter((entry) => entry.row.missionId === mission.id);
    const relevant = drawnEntries.filter((entry) => entry.row.missionKept);
    return summarize(mission.id, mission.name, relevant, drawnEntries.length, relevant.length);
  });
  const without = entries.filter((entry) => !entry.row.missionKept);
  rows.push(summarize("without-mission", "Ohne Mission", without, null, without.length, true));

  const best = Object.fromEntries(metrics.map((metric) => {
    const candidates = rows.flatMap((row) => {
      if (metric === "wins" && row.winRate === null) return [];
      if (row.isWithoutMission && (metric === "kept" || metric === "keptRate")) return [];
      const raw = metric === "maxPoints" ? row.maxPoints?.value ?? null : row[metric];
      return raw === null ? [] : [{ id: row.id, value: raw as number }];
    });
    if (!candidates.length) return [metric, []];
    const target = metric === "averagePlacement" ? Math.min(...candidates.map((item) => item.value)) : Math.max(...candidates.map((item) => item.value));
    return [metric, candidates.filter((item) => equalNumber(item.value, target)).map((item) => item.id)];
  })) as Record<MissionMetric, string[]>;
  return { rows, best, totalDrawn };
}
