"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MissionPointsTimeline, MissionTimelineValue } from "@/lib/statistics/mission-points-timeline";
import { hideAllMissionLines, missionLineKey, onlyMissionAverages, toggleMissionLine, type MissionLineKind } from "@/lib/statistics/mission-points-timeline-visibility";
import { addCompressedTimelinePositions, selectTimelineTicks } from "@/lib/statistics/game-points-timeline-visuals";
import styles from "./page.module.css";

type MissionTimelineChartPoint = Omit<MissionPointsTimeline["entries"][number], "playedAt"> & { playedAt: string };
type Props = { series: MissionPointsTimeline["series"]; entries: MissionTimelineChartPoint[] };

const palette = [
  { light: "#c47b52", dark: "#7a4329" }, { light: "#5f9691", dark: "#2f6661" },
  { light: "#927fb5", dark: "#5b477f" }, { light: "#c19a3f", dark: "#80601b" },
  { light: "#77a16a", dark: "#416e3a" }, { light: "#ad7487", dark: "#784657" },
  { light: "#7893b1", dark: "#435f7f" },
] as const;
const shortDate = (timestamp: number) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(timestamp));
const fullDate = (timestamp: number) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(new Date(timestamp));
const points = (value: number, digits: number) => new Intl.NumberFormat("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export default function MissionPointsTimelineChart({ series, entries }: Props) {
  const [visible, setVisible] = useState<Set<string>>(() => onlyMissionAverages(series));
  const data = useMemo(() => addCompressedTimelinePositions(entries), [entries]);
  const ticks = useMemo(() => selectTimelineTicks(data), [data]);
  const timestampsByPosition = useMemo(() => new Map(data.map((point) => [point.visualPosition, point.timestamp])), [data]);
  const toggle = (missionId: string, kind: MissionLineKind) => setVisible((current) => toggleMissionLine(current, missionId, kind));

  return <article className={`${styles.timelineCard} ${styles.missionTimelineCard}`}>
    <h3>Punkteentwicklung nach Mission</h3>
    <p className={styles.timelineDescription}>Einzelne Missionsergebnisse und laufende Durchschnittswerte im Zeitverlauf.</p>
    <div className={styles.missionTimelineActions}><button type="button" onClick={() => setVisible(hideAllMissionLines())}>Alle ausblenden</button><button type="button" onClick={() => setVisible(onlyMissionAverages(series))}>Nur Durchschnitte</button></div>
    <div className={styles.missionTimelineControls}>{series.map((mission, index) => <fieldset key={mission.id} style={{ "--mission-color": palette[index % palette.length].dark } as React.CSSProperties}><legend>{mission.name}</legend>{(["result", "average"] as const).map((kind) => <label key={kind}><input type="checkbox" checked={visible.has(missionLineKey(mission.id, kind))} onChange={() => toggle(mission.id, kind)} />{kind === "result" ? "Partieergebnisse" : "Laufender Durchschnitt"}</label>)}</fieldset>)}</div>
    {!data.length ? <div className={styles.timelineEmpty}>Noch keine Missionsdaten vorhanden.</div> : <div className={styles.missionTimelineChartScroll}><div className={styles.missionTimelineChart} role="img" aria-label="Punkteentwicklung der ausgewählten Missionen">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
        <CartesianGrid stroke="#dcdad1" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="visualPosition" type="number" scale="linear" domain={["dataMin", "dataMax"]} ticks={ticks.map((point) => point.visualPosition)} tickFormatter={(position) => shortDate(timestampsByPosition.get(position) ?? data[0].timestamp)} minTickGap={42} tick={{ fontSize: 11 }} />
        <YAxis domain={["auto", "auto"]} width={48} tick={{ fontSize: 11 }} label={{ value: "Punkte", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#69746e" } }} />
        <Tooltip content={({ active, payload }) => { const point = payload?.[0]?.payload as typeof data[number] | undefined; const missionIds = [...new Set((payload ?? []).map((item) => String(item.name).split(":")[0]))]; return active && point && missionIds.length ? <div className={`${styles.timelineTooltip} ${styles.missionTimelineTooltip}`}><strong>{fullDate(point.timestamp)}</strong>{missionIds.map((missionId) => { const mission = series.find((candidate) => candidate.id === missionId); const value = point.missionValues[missionId] as MissionTimelineValue | undefined; return mission && value && value.points !== null ? <div key={missionId}><b>{mission.name}</b><span>Partiepunkte: {points(value.points, 0)}</span><span>Laufender Durchschnitt: {points(value.cumulativeAverage!, 1)}</span><Link href={`/partien/${point.gameId}`}>Partie öffnen</Link></div> : null; })}</div> : null; }} />
        {series.flatMap((mission, index) => { const color = palette[index % palette.length]; return [
          visible.has(missionLineKey(mission.id, "result")) && <Line key={`${mission.id}-result`} type="linear" dataKey={(point: typeof data[number]) => point.missionValues[mission.id]?.points ?? null} name={`${mission.id}:result`} stroke={color.light} strokeWidth={1.5} strokeOpacity={.76} dot={{ r: 2, fill: "#fffdf8", strokeWidth: 1.25 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />,
          visible.has(missionLineKey(mission.id, "average")) && <Line key={`${mission.id}-average`} type="monotone" dataKey={(point: typeof data[number]) => point.missionValues[mission.id]?.cumulativeAverage ?? null} name={`${mission.id}:average`} stroke={color.dark} strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />,
        ]; })}
      </LineChart></ResponsiveContainer>
    </div></div>}
  </article>;
}
