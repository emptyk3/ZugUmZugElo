import { buildMissionPlacementTimeline } from "./mission-placement-timeline.ts";
import { calculateMissionStatistics } from "./mission-statistics.ts";
import type { MissionCatalogItem, StatisticsGame } from "./types.ts";

export type MissionPlayerCountFilter = "gesamt" | "4" | "5";

export function resolveMissionPlayerCountFilter(value: string | undefined): MissionPlayerCountFilter {
  return value === "4" || value === "5" ? value : "gesamt";
}

export function filterMissionGames(games: StatisticsGame[], filter: MissionPlayerCountFilter): StatisticsGame[] {
  if (filter === "gesamt") return games;
  const playerCount = Number(filter);
  return games.filter((game) => game.participants.length === playerCount);
}

export function missionChartMaximumPlacement(filter: MissionPlayerCountFilter): 4 | 5 {
  return filter === "4" ? 4 : 5;
}

export function buildMissionStatisticsView(games: StatisticsGame[], catalog: MissionCatalogItem[], filter: MissionPlayerCountFilter) {
  const filteredGames = filterMissionGames(games, filter);
  return {
    games: filteredGames,
    statistics: calculateMissionStatistics(filteredGames, catalog),
    timeline: buildMissionPlacementTimeline(filteredGames, catalog),
    chartMaximumPlacement: missionChartMaximumPlacement(filter),
  };
}
