import { median } from "../statistics/distribution.ts";
import { equalNumber } from "../statistics/types.ts";

export type MissionDefinition = { id: string; name: string; sortOrder: number };
export type MissionParticipation = {
  points: number; placement: number; missionKept: boolean; gameId: string; playedAt: Date;
  mission: MissionDefinition;
};

export type MissionStat = {
  id: string; name: string; sortOrder: number; games: number; wins: number; winRate: number | null;
  averagePlacement: number | null; placementStandardDeviation: number | null;
  medianPoints: number | null; averagePoints: number | null; pointsStandardDeviation: number | null;
  highestScore: { value: number; gameId: string; playedAt: Date } | null;
  kept: number; drawn: number; keptRate: number | null; isWithoutMission: boolean; isTotal: boolean;
  missionRank: number | null;
};

export type MissionHighlightMetric = "wins" | "winRate" | "averagePlacement" | "medianPoints" | "averagePoints" | "highestScore";
export type MissionHighlightRank = 1 | 2 | 3;
export type MissionHighlightRankings = Record<MissionHighlightMetric, Record<string, MissionHighlightRank>>;

const highlightMetrics: MissionHighlightMetric[] = ["wins", "winRate", "averagePlacement", "medianPoints", "averagePoints", "highestScore"];

const populationStandardDeviation = (values: number[], mean: number | null) => mean === null
  ? null
  : Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);

function summarize(id: string, name: string, sortOrder: number, items: MissionParticipation[], drawn: number, flags: { isWithoutMission?: boolean; isTotal?: boolean } = {}): MissionStat {
  const ordered = [...items].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.gameId.localeCompare(b.gameId));
  const highest = ordered.reduce<MissionParticipation | null>((best, row) => !best || row.points > best.points ? row : best, null);
  const wins = items.filter((row) => row.placement === 1).length;
  const placements = items.map((row) => row.placement);
  const points = items.map((row) => row.points);
  const averagePlacement = items.length ? placements.reduce((sum, value) => sum + value, 0) / items.length : null;
  const averagePoints = items.length ? points.reduce((sum, value) => sum + value, 0) / items.length : null;
  return {
    id, name, sortOrder, games: items.length, wins, winRate: items.length ? wins / items.length : null,
    averagePlacement,
    placementStandardDeviation: populationStandardDeviation(placements, averagePlacement),
    medianPoints: median(points),
    averagePoints,
    pointsStandardDeviation: populationStandardDeviation(points, averagePoints),
    highestScore: highest ? { value: highest.points, gameId: highest.gameId, playedAt: highest.playedAt } : null,
    kept: flags.isTotal ? items.filter((row) => row.missionKept).length : items.length,
    drawn, keptRate: drawn === 0 ? null : (flags.isTotal ? items.filter((row) => row.missionKept).length : items.length) / drawn,
    isWithoutMission: Boolean(flags.isWithoutMission), isTotal: Boolean(flags.isTotal), missionRank: null,
  };
}

const bestOrder = (a: MissionStat, b: MissionStat) =>
  (a.averagePlacement ?? Infinity) - (b.averagePlacement ?? Infinity) || (b.winRate ?? -1) - (a.winRate ?? -1) ||
  (b.averagePoints ?? -Infinity) - (a.averagePoints ?? -Infinity) || a.name.localeCompare(b.name, "de");
const worstOrder = (a: MissionStat, b: MissionStat) =>
  (b.averagePlacement ?? -Infinity) - (a.averagePlacement ?? -Infinity) || (a.winRate ?? Infinity) - (b.winRate ?? Infinity) ||
  (a.averagePoints ?? Infinity) - (b.averagePoints ?? Infinity) || a.name.localeCompare(b.name, "de");

const samePerformance = (a: MissionStat, b: MissionStat) =>
  equalNumber(a.averagePlacement!, b.averagePlacement!) && equalNumber(a.winRate!, b.winRate!) && equalNumber(a.averagePoints!, b.averagePoints!);

function createHighlightRankings(rows: MissionStat[]): MissionHighlightRankings {
  return Object.fromEntries(highlightMetrics.map((metric) => {
    const candidates = rows.flatMap((row) => {
      const value = metric === "highestScore" ? row.highestScore?.value : row[metric];
      return typeof value === "number" && Number.isFinite(value) ? [{ id: row.id, value }] : [];
    });
    candidates.sort((left, right) => (metric === "averagePlacement" ? left.value - right.value : right.value - left.value) || left.id.localeCompare(right.id));
    const ranks: Record<string, MissionHighlightRank> = {};
    let previousValue: number | null = null;
    let rank = 0;
    candidates.forEach((candidate, index) => {
      if (previousValue === null || !equalNumber(candidate.value, previousValue)) rank = index + 1;
      previousValue = candidate.value;
      if (rank <= 3) ranks[candidate.id] = rank as MissionHighlightRank;
    });
    return [metric, ranks];
  })) as MissionHighlightRankings;
}

export function calculateMissionStats(rows: MissionParticipation[], catalog: MissionDefinition[] = []) {
  const definitions = catalog.length ? [...catalog] : [...new Map(rows.map((row) => [row.mission.id, row.mission])).values()];
  definitions.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
  const missionRows = definitions.map((mission) => {
    const drawn = rows.filter((row) => row.mission.id === mission.id).length;
    const kept = rows.filter((row) => row.mission.id === mission.id && row.missionKept);
    return summarize(mission.id, mission.name, mission.sortOrder, kept, drawn);
  });
  const withoutMission = summarize("without-mission", "Ohne Mission", Number.MAX_SAFE_INTEGER, rows.filter((row) => !row.missionKept), rows.length, { isWithoutMission: true });
  const total = summarize("total", "Gesamt", -1, rows, rows.length, { isTotal: true });
  const categories = [...missionRows, withoutMission];
  const qualified = categories.filter((row) => row.games >= 3).sort(bestOrder);
  const unqualified = categories.filter((row) => row.games < 3).sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  let previous: MissionStat | null = null;
  let missionRank = 0;
  const rankedCategories = qualified.map((row, index) => {
    if (!previous || !samePerformance(row, previous)) missionRank = index + 1;
    previous = row;
    return { ...row, missionRank };
  });
  const hasEnoughHighlights = qualified.length >= 2;
  return {
    rows: [total, ...rankedCategories, ...unqualified],
    rankings: createHighlightRankings(qualified),
    best: hasEnoughHighlights ? [...qualified].sort(bestOrder)[0] : null,
    worst: hasEnoughHighlights ? [...qualified].sort(worstOrder)[0] : null,
  };
}
