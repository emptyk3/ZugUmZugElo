"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "./page.module.css";
import { formatElo, formatEloChange } from "@/lib/format/elo";

export type EloPoint = { id: string; gameId: string | null; playedAt: string | null; ratingBefore: number; ratingChange: number; ratingAfter: number };
const date = (value: string) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vienna" }).format(new Date(value));

export default function EloChart({ points }: { points: EloPoint[] }) {
  if (points.length <= 1) return <div className={styles.chartEmpty}>Noch keine bestätigte Partie für einen Elo-Verlauf.</div>;
  const data = points.map((point, index) => ({ ...point, index, label: point.playedAt ? date(point.playedAt) : "Start" }));
  return <div className={styles.chart} aria-label="Elo-Verlauf">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 14, right: 10, bottom: 8, left: 2 }}>
        <XAxis dataKey="index" tickFormatter={(index) => data[index]?.label ?? ""} interval="preserveStartEnd" tick={{ fontSize: 11 }} />
        <YAxis domain={["dataMin - 20", "dataMax + 20"]} tickFormatter={formatElo} allowDecimals={false} width={54} tick={{ fontSize: 11 }} />
        <Tooltip content={({ active, payload }) => { const point = payload?.[0]?.payload as typeof data[number] | undefined; return active && point ? <div className={styles.tooltip}>
          <strong>{point.playedAt ? dateTime(point.playedAt) : "Startwert"}</strong>
          <span>Elo vorher: {formatElo(point.ratingBefore)}</span><span>Änderung: {formatEloChange(point.ratingChange)}</span><span>Elo danach: {formatElo(point.ratingAfter)}</span>
          {point.gameId && <Link href={`/partien/${point.gameId}`}>Partie öffnen →</Link>}
        </div> : null; }} />
        <Line type="monotone" dataKey="ratingAfter" stroke="#1d5c45" strokeWidth={3} dot={{ r: 3, fill: "#fffdf8", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
