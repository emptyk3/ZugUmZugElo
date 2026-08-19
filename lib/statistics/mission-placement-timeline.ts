import { compressTimelineGap } from "./game-points-timeline-visuals.ts";
import { compareGames, type MissionCatalogItem, type StatisticsGame, type StatisticsParticipation } from "./types.ts";

export type MissionPlacementSeries = { id: string; name: string };
export type MissionPlacementResult = { participantId: string; playerAlias: string; placement: number };
export type MissionPlacementValue = { placements: MissionPlacementResult[]; cumulativeAveragePlacement: number | null };
export type MissionPlacementGame = {
  gameId: string;
  playedAt: Date;
  visualPosition: number;
  missionValues: Record<string, MissionPlacementValue>;
};
export type MissionPlacementTimeline = {
  series: MissionPlacementSeries[];
  entries: MissionPlacementGame[];
  maximumPlacement: number;
};

export type MissionPlacementBranchPoint = MissionPlacementResult & {
  gameId: string;
  playedAt: Date;
  visualPosition: number;
};

export type MissionPlacementTooltipRow = MissionPlacementResult & {
  missionId: string;
  missionName: string;
  cumulativeAveragePlacement: number;
};

export function buildMissionPlacementBranches(entries: MissionPlacementGame[], missionId: string): MissionPlacementBranchPoint[][] {
  const maximumResultsPerGame = Math.max(0, ...entries.map((entry) => entry.missionValues[missionId].placements.length));
  return Array.from({ length: maximumResultsPerGame }, (_, branchIndex) => entries.flatMap((entry) => {
    const placements = entry.missionValues[missionId].placements;
    if (!placements.length) return [];
    const result = placements[Math.min(branchIndex, placements.length - 1)];
    return [{ ...result, gameId: entry.gameId, playedAt: entry.playedAt, visualPosition: entry.visualPosition }];
  }));
}

export function buildMissionPlacementTooltipRows(
  game: MissionPlacementGame,
  series: MissionPlacementSeries[],
  visibleMissionIds: ReadonlySet<string>,
): MissionPlacementTooltipRow[] {
  return series.flatMap((mission) => {
    if (!visibleMissionIds.has(mission.id)) return [];
    const value = game.missionValues[mission.id];
    if (!value.placements.length || value.cumulativeAveragePlacement === null) return [];
    const cumulativeAveragePlacement = value.cumulativeAveragePlacement;
    return value.placements.map((result) => ({
      ...result,
      missionId: mission.id,
      missionName: mission.name,
      cumulativeAveragePlacement,
    }));
  }).sort((left, right) => left.placement - right.placement || left.participantId.localeCompare(right.participantId));
}

const categoryFor = (participant: StatisticsParticipation, missionIds: ReadonlySet<string>) => participant.missionKept
  ? missionIds.has(participant.missionId) ? participant.missionId : null
  : "without-mission";

export function buildMissionPlacementTimeline(games: StatisticsGame[], catalog: MissionCatalogItem[]): MissionPlacementTimeline {
  const series = [...catalog.map(({ id, name }) => ({ id, name })), { id: "without-mission", name: "Ohne Mission" }];
  const missionIds = new Set(catalog.map((mission) => mission.id));
  const counters = new Map(series.map((mission) => [mission.id, { count: 0, sumPlacement: 0 }]));
  const relevantGames = [...games].sort(compareGames).map((game) => ({
    game,
    participants: [...game.participants].sort((left, right) => left.id.localeCompare(right.id)).flatMap((participant) => {
      const missionId = categoryFor(participant, missionIds);
      return missionId === null ? [] : [{ participant, missionId }];
    }),
  })).filter(({ participants }) => participants.length > 0);

  let visualPosition = 0;
  let maximumPlacement = 5;
  const entries = relevantGames.map(({ game, participants }, gameIndex) => {
    if (gameIndex > 0) visualPosition += compressTimelineGap(game.playedAt.getTime() - relevantGames[gameIndex - 1].game.playedAt.getTime());
    const missionValues: Record<string, MissionPlacementValue> = Object.fromEntries(series.map((mission) => [mission.id, { placements: [], cumulativeAveragePlacement: null }]));
    for (const mission of series) {
      const relevant = participants.filter((entry) => entry.missionId === mission.id).map((entry) => entry.participant);
      if (!relevant.length) continue;
      const counter = counters.get(mission.id)!;
      counter.count += relevant.length;
      counter.sumPlacement += relevant.reduce((sum, participant) => sum + participant.placement, 0);
      maximumPlacement = Math.max(maximumPlacement, ...relevant.map((participant) => participant.placement));
      missionValues[mission.id] = {
        placements: relevant.map((participant) => ({ participantId: participant.playerId, playerAlias: participant.alias, placement: participant.placement })),
        cumulativeAveragePlacement: counter.sumPlacement / counter.count,
      };
    }
    return { gameId: game.id, playedAt: game.playedAt, visualPosition, missionValues };
  });

  return { series, entries, maximumPlacement };
}
