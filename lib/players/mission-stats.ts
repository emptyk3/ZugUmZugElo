export type MissionDefinition = { id: string; name: string; sortOrder: number };
export type MissionParticipation = {
  points: number; placement: number; missionKept: boolean; gameId: string; playedAt: Date;
  mission: MissionDefinition;
};

export type MissionStat = {
  id: string; name: string; sortOrder: number; games: number; wins: number; winRate: number | null;
  averagePlacement: number | null; placementStandardDeviation: number | null;
  averagePoints: number | null; pointsStandardDeviation: number | null;
  highestScore: { value: number; gameId: string; playedAt: Date } | null;
  kept: number; drawn: number; keptRate: number | null; isWithoutMission: boolean; isTotal: boolean;
};

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
    averagePoints,
    pointsStandardDeviation: populationStandardDeviation(points, averagePoints),
    highestScore: highest ? { value: highest.points, gameId: highest.gameId, playedAt: highest.playedAt } : null,
    kept: flags.isTotal ? items.filter((row) => row.missionKept).length : items.length,
    drawn, keptRate: flags.isWithoutMission || drawn === 0 ? null : (flags.isTotal ? items.filter((row) => row.missionKept).length : items.length) / drawn,
    isWithoutMission: Boolean(flags.isWithoutMission), isTotal: Boolean(flags.isTotal),
  };
}

const bestOrder = (a: MissionStat, b: MissionStat) =>
  (b.winRate ?? -1) - (a.winRate ?? -1) || (a.averagePlacement ?? Infinity) - (b.averagePlacement ?? Infinity) ||
  (b.averagePoints ?? -Infinity) - (a.averagePoints ?? -Infinity) || a.name.localeCompare(b.name, "de");
const worstOrder = (a: MissionStat, b: MissionStat) =>
  (a.winRate ?? Infinity) - (b.winRate ?? Infinity) || (b.averagePlacement ?? -Infinity) - (a.averagePlacement ?? -Infinity) ||
  (a.averagePoints ?? Infinity) - (b.averagePoints ?? Infinity) || a.name.localeCompare(b.name, "de");

export function calculateMissionStats(rows: MissionParticipation[], catalog: MissionDefinition[] = []) {
  const definitions = catalog.length ? [...catalog] : [...new Map(rows.map((row) => [row.mission.id, row.mission])).values()];
  definitions.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
  const missionRows = definitions.map((mission) => {
    const drawn = rows.filter((row) => row.mission.id === mission.id).length;
    const kept = rows.filter((row) => row.mission.id === mission.id && row.missionKept);
    return summarize(mission.id, mission.name, mission.sortOrder, kept, drawn);
  });
  const withoutMission = summarize("without-mission", "Ohne Mission", Number.MAX_SAFE_INTEGER, rows.filter((row) => !row.missionKept), 0, { isWithoutMission: true });
  const total = summarize("total", "Gesamt", -1, rows, rows.length, { isTotal: true });
  const categories = [...missionRows, withoutMission];
  const qualified = categories.filter((row) => row.games >= 3);
  const hasEnoughHighlights = qualified.length >= 2;
  return {
    rows: [total, ...missionRows, withoutMission],
    best: hasEnoughHighlights ? [...qualified].sort(bestOrder)[0] : null,
    worst: hasEnoughHighlights ? [...qualified].sort(worstOrder)[0] : null,
  };
}
