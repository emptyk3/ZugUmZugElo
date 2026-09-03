import { compareGames, equalNumber, type MissionCatalogItem, type StatisticsGame } from "./types.ts";
import { median } from "./distribution.ts";

export type MissionMetric = "drawn" | "drawnRate" | "kept" | "keptRate" | "wins" | "winRate" | "averagePlacement" | "medianPoints" | "averagePoints" | "averageRatingChange";
export type MissionStatisticRow = {
  id: string; name: string; isWithoutMission: boolean;
  drawn: number | null; drawnRate: number | null; kept: number | null; keptRate: number | null;
  wins: number; winRate: number | null; averagePlacement: number | null; placementStandardDeviation: number | null;
  medianPoints: number | null; averagePoints: number | null; pointsStandardDeviation: number | null; averageRatingChange: number | null;
};

export type MissionRank = 1 | 2 | 3;
const metrics: MissionMetric[] = ["drawn", "drawnRate", "kept", "keptRate", "wins", "winRate", "averagePlacement", "medianPoints", "averagePoints", "averageRatingChange"];
const performanceMetrics = new Set<MissionMetric>(["kept", "keptRate", "wins", "winRate", "averagePlacement", "medianPoints", "averagePoints", "averageRatingChange"]);

const populationStandardDeviation = (values: number[], mean: number | null) => mean === null
  ? null
  : Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);

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
      const raw = row[metric];
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
    const placements = relevant.map((entry) => entry.row.placement);
    const points = relevant.map((entry) => entry.row.points);
    const averagePlacement = placements.length ? placements.reduce((sum, value) => sum + value, 0) / placements.length : null;
    const averagePoints = points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : null;
    return {
      id, name, isWithoutMission: without, drawn,
      drawnRate: drawn === null || totalDrawn === 0 ? null : drawn / totalDrawn,
      kept, keptRate: without
        ? kept === null || totalDrawn === 0 ? null : kept / totalDrawn
        : drawn === null || kept === null || drawn === 0 ? null : kept / drawn,
      wins: wins.length, winRate: relevant.length ? wins.length / relevant.length : null,
      averagePlacement,
      placementStandardDeviation: populationStandardDeviation(placements, averagePlacement),
      medianPoints: median(points),
      averagePoints,
      pointsStandardDeviation: populationStandardDeviation(points, averagePoints),
      averageRatingChange: relevant.length ? relevant.reduce((sum, entry) => sum + entry.row.ratingChange, 0) / relevant.length : null,
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
