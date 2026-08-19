import { compareGames, type MissionCatalogItem, type StatisticsGame } from "./types.ts";

export type MissionTimelineSeries = { id: string; name: string };
export type MissionTimelineValue = { points: number | null; cumulativeAverage: number | null };
export type MissionPointsTimelineEntry = {
  gameId: string;
  playedAt: Date;
  missionValues: Record<string, MissionTimelineValue>;
};

export type MissionPointsTimeline = {
  series: MissionTimelineSeries[];
  entries: MissionPointsTimelineEntry[];
};

export function buildMissionPointsTimeline(games: StatisticsGame[], catalog: MissionCatalogItem[]): MissionPointsTimeline {
  const series = [...catalog.map(({ id, name }) => ({ id, name })), { id: "without-mission", name: "Ohne Mission" }];
  const missionIds = new Set(catalog.map((mission) => mission.id));
  const counters = new Map(series.map((mission) => [mission.id, { games: 0, sumPoints: 0 }]));
  const emptyValues = (): Record<string, MissionTimelineValue> => Object.fromEntries(series.map((mission) => [mission.id, { points: null, cumulativeAverage: null }]));

  const entries = [...games].sort(compareGames).flatMap((game) => [...game.participants]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((participant) => {
      const missionId = participant.missionKept
        ? missionIds.has(participant.missionId) ? participant.missionId : null
        : "without-mission";
      if (missionId === null) return [];

      const counter = counters.get(missionId)!;
      counter.games += 1;
      counter.sumPoints += participant.points;
      const missionValues = emptyValues();
      missionValues[missionId] = { points: participant.points, cumulativeAverage: counter.sumPoints / counter.games };
      return [{ gameId: game.id, playedAt: game.playedAt, missionValues }];
    }));

  return { series, entries };
}
