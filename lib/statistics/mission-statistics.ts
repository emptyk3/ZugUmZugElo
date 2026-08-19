import { compareGames, equalNumber, type MissionCatalogItem, type StatisticsGame } from "./types.ts";

export type MissionMetric = "drawn" | "drawnRate" | "kept" | "keptRate" | "wins" | "winRate" | "averagePlacement" | "averagePoints" | "averageWinnerPoints" | "averageRatingChange" | "maxPoints";
export type MissionStatisticRow = {
  id: string; name: string; isWithoutMission: boolean;
  drawn: number | null; drawnRate: number | null; kept: number | null; keptRate: number | null;
  wins: number; winRate: number | null; averagePlacement: number | null; averagePoints: number | null;
  averageWinnerPoints: number | null; averageRatingChange: number | null; maxPoints: { value: number; gameId: string } | null;
};

export type MissionRank = 1 | 2 | 3;
const metrics: MissionMetric[] = ["drawn", "drawnRate", "kept", "keptRate", "wins", "winRate", "averagePlacement", "averagePoints", "averageWinnerPoints", "averageRatingChange", "maxPoints"];
const performanceMetrics = new Set<MissionMetric>(["kept", "keptRate", "wins", "winRate", "averagePlacement", "averagePoints", "averageWinnerPoints", "averageRatingChange", "maxPoints"]);

const descendingNullable = (left: number | null, right: number | null) => {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right - left;
};

const ascendingNullable = (left: number | null, right: number | null) => {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left - right;
};

export function compareMissionRows(left: MissionStatisticRow, right: MissionStatisticRow) {
  return ascendingNullable(left.averagePlacement, right.averagePlacement)
    || descendingNullable(left.winRate, right.winRate)
    || descendingNullable(left.averagePoints, right.averagePoints)
    || left.name.localeCompare(right.name, "de")
    || left.id.localeCompare(right.id);
}

export function createMissionRankings(rows: MissionStatisticRow[]) {
  return Object.fromEntries(metrics.map((metric) => {
    if (!performanceMetrics.has(metric)) return [metric, {}];
    const candidates = rows.flatMap((row) => {
      if (metric === "wins" && row.winRate === null) return [];
      const raw = metric === "maxPoints" ? row.maxPoints?.value ?? null : row[metric];
      return typeof raw === "number" && Number.isFinite(raw) ? [{ id: row.id, value: raw }] : [];
    });
    candidates.sort((left, right) => (metric === "averagePlacement" ? left.value - right.value : right.value - left.value) || left.id.localeCompare(right.id));
    const ranks: Record<string, MissionRank> = {};
    let previousValue: number | null = null;
    let rank = 0;
    candidates.forEach((candidate, index) => {
      if (previousValue === null || !equalNumber(candidate.value, previousValue)) rank = index + 1;
      previousValue = candidate.value;
      if (rank <= 3) ranks[candidate.id] = rank as MissionRank;
    });
    return [metric, ranks];
  })) as Record<MissionMetric, Record<string, MissionRank>>;
}

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
      averageRatingChange: relevant.length ? relevant.reduce((sum, entry) => sum + entry.row.ratingChange, 0) / relevant.length : null,
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

  const rankings = createMissionRankings(rows);
  return { rows: [...rows].sort(compareMissionRows), rankings, totalDrawn };
}
