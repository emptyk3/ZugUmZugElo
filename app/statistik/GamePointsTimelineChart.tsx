"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GamePointsTimelineEntry } from "@/lib/statistics/game-statistics";
import styles from "./page.module.css";

export type GamePointsTimelinePoint = Omit<GamePointsTimelineEntry, "playedAt"> & { playedAt: string };

const shortDate = (timestamp: number) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(timestamp));
const fullDate = (timestamp: number) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(new Date(timestamp));
const points = (value: number, digits: number) => new Intl.NumberFormat("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

const seriesLabels = {
  winnerPoints: "Siegerpunkte der Partie",
  gameAveragePoints: "Ø Punkte der Partie",
  cumulativeWinnerAverage: "Laufender Ø Siegerpunkte",
  cumulativePlayerAverage: "Laufender Ø aller Punkte",
} as const;

export default function GamePointsTimelineChart({ title, entries, emptyMessage }: { title: string; entries: GamePointsTimelinePoint[]; emptyMessage: string }) {
  if (!entries.length) return <article className={styles.timelineCard}><h3>{title}</h3><p className={styles.timelineDescription}>Einzelpartien und laufende Durchschnittswerte im Zeitverlauf.</p><div className={styles.timelineEmpty}>{emptyMessage}</div></article>;

  const data = entries.map((entry) => ({ ...entry, timestamp: new Date(entry.playedAt).getTime() }));
  return <article className={styles.timelineCard}>
    <h3>{title}</h3><p className={styles.timelineDescription}>Einzelpartien und laufende Durchschnittswerte im Zeitverlauf.</p>
    <div className={styles.timelineChart} role="img" aria-label={`${title}: Siegerpunkte, Partiedurchschnitt und laufende Durchschnittswerte`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="#dcdad1" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={shortDate} minTickGap={42} tick={{ fontSize: 11 }} />
          <YAxis domain={["auto", "auto"]} width={48} tick={{ fontSize: 11 }} label={{ value: "Punkte", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#69746e" } }} />
          <Tooltip content={({ active, payload }) => { const point = payload?.[0]?.payload as typeof data[number] | undefined; return active && point ? <div className={styles.timelineTooltip}>
            <strong>{fullDate(point.timestamp)}</strong>
            <span>Siegerpunkte: {points(point.winnerPoints, 0)}</span>
            <span>Ø Punkte dieser Partie: {points(point.gameAveragePoints, 1)}</span>
            <span>Laufender Ø Siegerpunkte: {points(point.cumulativeWinnerAverage, 1)}</span>
            <span>Laufender Ø aller Punkte: {points(point.cumulativePlayerAverage, 1)}</span>
          </div> : null; }} />
          <Legend formatter={(value) => seriesLabels[value as keyof typeof seriesLabels] ?? value} wrapperStyle={{ fontSize: 11 }} />
          <Line type="linear" dataKey="winnerPoints" name="winnerPoints" stroke="#9a5721" strokeWidth={1.5} strokeOpacity={0.72} dot={{ r: 2, fill: "#fffdf8", strokeWidth: 1.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="linear" dataKey="gameAveragePoints" name="gameAveragePoints" stroke="#7b8982" strokeWidth={1.5} strokeOpacity={0.72} dot={{ r: 2, fill: "#fffdf8", strokeWidth: 1.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="cumulativeWinnerAverage" name="cumulativeWinnerAverage" stroke="#1d5c45" strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="cumulativePlayerAverage" name="cumulativePlayerAverage" stroke="#c08a22" strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </article>;
}
