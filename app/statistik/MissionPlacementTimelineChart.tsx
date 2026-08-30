"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { buildMissionPlacementBranches, buildMissionPlacementTooltipRows, type MissionPlacementTimeline } from "@/lib/statistics/mission-placement-timeline";
import { hideAllMissionLines, missionLineKey, onlyMissionAverages, toggleMissionLine, type MissionLineKind } from "@/lib/statistics/mission-placement-timeline-visibility";
import { selectTimelineTicks } from "@/lib/statistics/game-points-timeline-visuals";
import styles from "./page.module.css";

type MissionPlacementChartGame = Omit<MissionPlacementTimeline["entries"][number], "playedAt"> & { playedAt: string };
type Props = { series: MissionPlacementTimeline["series"]; entries: MissionPlacementChartGame[]; maximumPlacement: number };
const palette = [
  { light: "#ef9a9a", dark: "#c62828" }, { light: "#ffb74d", dark: "#ef6c00" },
  { light: "#f4d35e", dark: "#c99700" }, { light: "#81c784", dark: "#2e7d32" },
  { light: "#90caf9", dark: "#1565c0" }, { light: "#ce93d8", dark: "#7b1fa2" },
  { light: "#9e9e9e", dark: "#212121" },
] as const;
const shortDate = (timestamp: number) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(timestamp));
const fullDate = (timestamp: number) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(new Date(timestamp));
const average = (value: number) => new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function MissionPlacementTimelineChart({ series, entries, maximumPlacement }: Props) {
  const [visible, setVisible] = useState<Set<string>>(() => onlyMissionAverages(series));
  const data = useMemo(() => entries.map((entry) => ({ ...entry, timestamp: new Date(entry.playedAt).getTime() })), [entries]);
  const gamesById = useMemo(() => new Map(data.map((game) => [game.gameId, game])), [data]);
  const ticks = useMemo(() => selectTimelineTicks(data), [data]);
  const timestampsByPosition = useMemo(() => new Map(data.map((game) => [game.visualPosition, game.timestamp])), [data]);
  const colorsByMissionId = useMemo(() => new Map(series.map((mission, index) => [mission.id, palette[index % palette.length].dark])), [series]);
  const placementBranchesByMission = useMemo(() => new Map(series.map((mission) => [mission.id, buildMissionPlacementBranches(data.map((game) => ({ ...game, playedAt: new Date(game.playedAt) })), mission.id)])), [data, series]);
  const toggle = (missionId: string, kind: MissionLineKind) => setVisible((current) => toggleMissionLine(current, missionId, kind));
  const yTicks = Array.from({ length: maximumPlacement }, (_, index) => index + 1);

  return <article className={`${styles.timelineCard} ${styles.missionTimelineCard}`}>
    <h3>Platzierungsentwicklung nach Mission</h3>
    <p className={styles.timelineDescription}>Einzelplatzierungen und laufende durchschnittliche Platzierung im Zeitverlauf.</p>
    <div className={styles.missionTimelineActions}><button type="button" onClick={() => setVisible(hideAllMissionLines())}>Alle ausblenden</button><button type="button" onClick={() => setVisible(onlyMissionAverages(series))}>Nur Durchschnitte</button></div>
    <div className={styles.missionTimelineControls}>{series.map((mission, index) => <fieldset key={mission.id} style={{ "--mission-color": palette[index % palette.length].dark } as React.CSSProperties}><legend>{mission.name}</legend>{(["result", "average"] as const).map((kind) => <label key={kind}><input type="checkbox" checked={visible.has(missionLineKey(mission.id, kind))} onChange={() => toggle(mission.id, kind)} />{kind === "result" ? "Platzierung" : "Laufender Ø Platz"}</label>)}</fieldset>)}</div>
    {!data.length ? <div className={styles.timelineEmpty}>Noch keine Missionsdaten vorhanden.</div> : <div className={styles.missionTimelineChartScroll}><div className={styles.missionTimelineChart} role="img" aria-label="Platzierungsentwicklung der ausgewählten Missionen">
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
        <CartesianGrid stroke="#dcdad1" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="visualPosition" type="number" scale="linear" domain={["dataMin", "dataMax"]} ticks={ticks.map((game) => game.visualPosition)} tickFormatter={(position) => shortDate(timestampsByPosition.get(position) ?? data[0].timestamp)} minTickGap={42} tick={{ fontSize: 11 }} />
        <YAxis domain={[1, maximumPlacement]} reversed ticks={yTicks} allowDecimals={false} width={48} tick={{ fontSize: 11 }} label={{ value: "Platz", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#69746e" } }} />
        <Tooltip shared content={({ active, payload }) => { const payloadPoint = payload?.[0]?.payload as { gameId?: string } | undefined; const game = payloadPoint?.gameId ? gamesById.get(payloadPoint.gameId) : undefined; const visibleMissionIds = new Set(series.filter((mission) => visible.has(missionLineKey(mission.id, "result")) || visible.has(missionLineKey(mission.id, "average"))).map((mission) => mission.id)); const rows = game ? buildMissionPlacementTooltipRows({ ...game, playedAt: new Date(game.playedAt) }, series, visibleMissionIds) : []; return active && game && rows.length ? <div className={`${styles.timelineTooltip} ${styles.missionTimelineTooltip}`}><strong>{fullDate(game.timestamp)}</strong>{rows.map((row) => <div key={`${row.missionId}-${row.participantId}`}><b style={{ color: colorsByMissionId.get(row.missionId) }}>{row.missionName}{row.missionId === "without-mission" ? ` – ${row.playerAlias}` : ""}</b><span>Platz {row.placement}</span><span>Laufender Ø Platz: {average(row.cumulativeAveragePlacement)}</span></div>)}<Link href={`/partien/${game.gameId}`}>Partie öffnen</Link></div> : null; }} />
        {series.flatMap((mission, index) => { const color = palette[index % palette.length]; return [
          visible.has(missionLineKey(mission.id, "result")) && placementBranchesByMission.get(mission.id)?.map((branch, branchIndex) => <Scatter key={`${mission.id}-result-${branchIndex}`} data={branch} dataKey="placement" name={`${mission.id}:result:${branchIndex}`} fill={color.light} line={{ stroke: color.light, strokeWidth: 1.5, strokeOpacity: .76 }} shape="circle" isAnimationActive={false} />),
          visible.has(missionLineKey(mission.id, "average")) && <Line key={`${mission.id}-average`} type="monotone" dataKey={(game: typeof data[number]) => game.missionValues?.[mission.id]?.cumulativeAveragePlacement ?? null} name={`${mission.id}:average`} stroke={color.dark} strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />,
        ]; })}
      </ComposedChart></ResponsiveContainer>
    </div></div>}
  </article>;
}
