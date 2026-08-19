import type { MissionPlacementSeries } from "./mission-placement-timeline.ts";

export type MissionLineKind = "result" | "average";
export const missionLineKey = (missionId: string, kind: MissionLineKind) => `${missionId}:${kind}`;
export const onlyMissionAverages = (series: MissionPlacementSeries[]) => new Set(series.map((mission) => missionLineKey(mission.id, "average")));
export const hideAllMissionLines = () => new Set<string>();
export const toggleMissionLine = (visible: ReadonlySet<string>, missionId: string, kind: MissionLineKind) => {
  const next = new Set(visible);
  const key = missionLineKey(missionId, kind);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
};
