import { GameStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import PlayerAvatar from "@/components/PlayerAvatar";
import { formatElo, formatEloChange } from "@/lib/format/elo";
import { prisma } from "@/lib/prisma";
import { calculateGameStatistics } from "@/lib/statistics/game-statistics";
import { calculateMissionStatistics, type MissionStatisticRow } from "@/lib/statistics/mission-statistics";
import { buildMissionPointsTimeline } from "@/lib/statistics/mission-points-timeline";
import { calculatePlayerStatistics, type SeriesRecord } from "@/lib/statistics/player-statistics";
import type { StatisticsGame } from "@/lib/statistics/types";
import GamePointsTimelineChart from "./GamePointsTimelineChart";
import MissionPointsTimelineChart from "./MissionPointsTimelineChart";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Statistiken | ZugUmZugElo", description: "Globale Spieler-, Spiel- und Missionsstatistiken der Spielgruppe." };

const date = (value: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(value);
const number = (value: number, digits: number) => new Intl.NumberFormat("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const percent = (value: number | null) => value === null ? "Keine Daten" : new Intl.NumberFormat("de-AT", { style: "percent", maximumFractionDigits: 1 }).format(value);
const signedNumber = (value: number) => value > 0 ? `+${number(value, 1)}` : value < 0 ? `−${number(Math.abs(value), 1)}` : number(0, 1);
const range = (row: SeriesRecord) => `${date(row.startedAt)} – ${date(row.endedAt)}`;

function Person({ row }: { row: { id: string; alias: string; imageUrl: string | null } }) {
  return <PlayerAliasLink playerId={row.id} alias={row.alias} className={styles.person}><PlayerAvatar alias={row.alias} imageUrl={row.imageUrl} size={42} /><strong>{row.alias}</strong></PlayerAliasLink>;
}

function SeriesList({ rows, value }: { rows: SeriesRecord[]; value: (row: SeriesRecord) => string }) {
  if (!rows.length) return <p className={styles.empty}>Keine Daten</p>;
  return <ul className={styles.recordList}>{rows.map((row, index) => <li key={`${row.id}-${row.firstGameId}-${index}`}><Person row={row} /><div className={styles.recordValue}><strong>{value(row)}</strong><Link href={`/partien/${row.firstGameId}`}>{range(row)}</Link>{row.running && <span>Laufend</span>}</div></li>)}</ul>;
}

function PlayersArea({ statistics }: { statistics: ReturnType<typeof calculatePlayerStatistics> }) {
  const linked = (rows: typeof statistics.highestAllTime, formatter: (value: number) => string) => rows.length ? <ul className={styles.recordList}>{rows.map((row) => <li key={row.id}><Person row={row} /><div className={styles.recordValue}><strong>{formatter(row.value)}</strong>{row.gameId && <Link href={`/partien/${row.gameId}`}>{row.playedAt ? date(row.playedAt) : "Partie"}</Link>}</div></li>)}</ul> : <p className={styles.empty}>Keine Daten</p>;
  return <div className={styles.area}>
    <section className={styles.topCard}><div><span>Aktuelle Rangliste</span><h2>Höchste aktuelle Elo</h2><p>Geteilte Werte erhalten denselben dichten Rang; angezeigt werden alle Spieler der ersten drei Elo-Ränge.</p></div>{statistics.currentTop.length ? <ol>{statistics.currentTop.map((row) => <li key={row.id}><b>#{row.rank}</b><Person row={row} /><strong>{formatElo(row.currentRating)} Elo</strong></li>)}</ol> : <p className={styles.empty}>Noch keine aktiven Spieler.</p>}</section>
    <div className={styles.cardGrid}>
      <article className={styles.card}><span>Karriererekord</span><h2>Höchste Elo aller Zeiten</h2>{linked(statistics.highestAllTime, (v) => `${formatElo(v)} Elo`)}<small>Nur gespeicherte ratingAfter-Werte nach bestätigten Partien; Start-Elo zählt nicht als erspielter Rekord.</small></article>
      <article className={styles.card}><span>Mindestens 5 Partien</span><h2>Höchste Winrate</h2>{statistics.highestWinRate.length ? <ul className={styles.recordList}>{statistics.highestWinRate.map((row) => <li key={row.id}><Person row={row} /><div className={styles.recordValue}><strong>{percent(row.winRate)}</strong><small>{row.wins} Siege · {row.games} Partien</small></div></li>)}</ul> : <p className={styles.empty}>Keine Daten</p>}</article>
      <article className={styles.card}><span>Mindestens 5 Partien</span><h2>Höchste Ø-Punkte</h2>{statistics.highestAveragePoints.length ? <ul className={styles.recordList}>{statistics.highestAveragePoints.map((row) => <li key={row.id}><Person row={row} /><div className={styles.recordValue}><strong>{number(row.averagePoints, 1)}</strong><small>{row.games} Partien</small></div></li>)}</ul> : <p className={styles.empty}>Keine Daten</p>}</article>
      <article className={styles.card}><span>Einzelpartie</span><h2>Höchste Punktzahl</h2>{linked(statistics.highestScore, String)}</article>
    </div>
    <h2 className={styles.groupTitle}>Serienrekorde</h2><div className={styles.cardGrid}>
      <article className={styles.card}><span>Nur eigene Partien</span><h2>Längste Winning Streak</h2><SeriesList rows={statistics.longestWinningStreak} value={(r) => `${r.games} Siege`} /></article>
      <article className={styles.card}><span>ratingChange ≥ 0</span><h2>Längste Serie ohne Elo-Verlust</h2><SeriesList rows={statistics.longestNonLossStreak} value={(r) => `${r.games} Partien · ${formatEloChange(r.totalGain)}`} /></article>
      <article className={styles.card}><span>ratingChange ≥ 0</span><h2>Größtes Plus ohne Verlust</h2><SeriesList rows={statistics.greatestNonLossGain} value={(r) => `${formatEloChange(r.totalGain)} Elo · ${r.games} Partien`} /></article>
      <article className={styles.card}><span>Gleitendes Fenster</span><h2>Bestes Plus über 5 Partien</h2><SeriesList rows={statistics.bestFiveGameGain} value={(r) => `${formatEloChange(r.value)} Elo`} /></article>
      <article className={styles.card}><span>Gleitendes Fenster</span><h2>Bestes Plus über 10 Partien</h2><SeriesList rows={statistics.bestTenGameGain} value={(r) => `${formatEloChange(r.value)} Elo`} /></article>
    </div>
  </div>;
}

function GamesArea({ statistics }: { statistics: ReturnType<typeof calculateGameStatistics> }) {
  const columns = [statistics.total, statistics.fourPlayers, statistics.fivePlayers];
  const serializable = (entries: typeof statistics.timelines.total) => entries.map((entry) => ({ ...entry, playedAt: entry.playedAt.toISOString() }));
  return <div className={styles.gameStatistics}><section className={styles.tableCard}><h2>Spielstatistiken</h2><div className={styles.tableWrap}><table><thead><tr><th>Kennzahl</th><th>Gesamt</th><th>4 Spieler</th><th>5 Spieler</th></tr></thead><tbody><tr><th>Anzahl gespielter Partien</th>{columns.map((c, i) => <td key={i}>{c.games}</td>)}</tr><tr><th>Durchschnittliche Punkte</th>{columns.map((c, i) => <td key={i}>{c.averagePoints === null ? "Keine Daten" : number(c.averagePoints, 1)}</td>)}</tr><tr><th>Durchschnittliche Punkte des Siegers</th>{columns.map((c, i) => <td key={i}>{c.averageWinnerPoints === null ? "Keine Daten" : number(c.averageWinnerPoints, 1)}</td>)}</tr></tbody></table></div>{statistics.unexpectedPlayerCountGames > 0 && <p className={styles.note}>{statistics.unexpectedPlayerCountGames} bestätigte {statistics.unexpectedPlayerCountGames === 1 ? "Partie hat" : "Partien haben"} weder vier noch fünf Teilnehmer und ist nur in „Gesamt“ enthalten.</p>}</section>
    <GamePointsTimelineChart title="Punkteentwicklung – Gesamt" entries={serializable(statistics.timelines.total)} emptyMessage="Noch keine bestätigten Partien vorhanden." />
    <GamePointsTimelineChart title="Punkteentwicklung – 4 Spieler" entries={serializable(statistics.timelines.fourPlayers)} emptyMessage="Noch keine Partien mit 4 Spielern vorhanden." />
    <GamePointsTimelineChart title="Punkteentwicklung – 5 Spieler" entries={serializable(statistics.timelines.fivePlayers)} emptyMessage="Noch keine Partien mit 5 Spielern vorhanden." />
  </div>;
}

const missionMedals = { 1: "🏆", 2: "🥈", 3: "🥉" } as const;
function MissionValue({ row, rank, children }: { row: MissionStatisticRow; rank?: 1 | 2 | 3; children: React.ReactNode }) {
  return <td className={rank ? styles[`rank${rank}` as "rank1" | "rank2" | "rank3"] : undefined}>{rank && <span aria-label={`Platz ${rank}`} title={`Platz ${rank}`}>{missionMedals[rank]}</span>}{children}</td>;
}
function MissionsArea({ statistics, timeline }: { statistics: ReturnType<typeof calculateMissionStatistics>; timeline: ReturnType<typeof buildMissionPointsTimeline> }) {
  return <div className={styles.missionStatistics}><section className={`${styles.tableCard} ${styles.missionTableCard}`}><h2>Missionsstatistiken</h2><div className={`${styles.tableWrap} ${styles.missionTableWrap}`}><table><colgroup><col className={styles.missionRankColumn} /><col className={styles.missionNameColumn} /><col className={styles.missionDrawnColumn} /><col span={10} /></colgroup><thead><tr><th className={styles.missionRankHeader}>Rang</th><th>Mission</th><th>Gezogen</th><th>% Gezogen</th><th>Behalten</th><th>% Behalten</th><th>Siege</th><th>Sieg-%</th><th>Ø Platz</th><th>Ø Punkte</th><th>Ø Punkte (Sieg)</th><th>Ø Elo ±</th><th>Max. Punkte</th></tr></thead><tbody>{statistics.rows.map((row, index) => <tr key={row.id}><td className={styles.missionRankCell}>{index < 3 ? missionMedals[(index + 1) as 1 | 2 | 3] : `${index + 1}.`}</td><th scope="row">{row.name}</th>
    <MissionValue row={row}>{row.drawn ?? "—"}</MissionValue><MissionValue row={row}>{row.drawnRate === null ? "—" : percent(row.drawnRate)}</MissionValue><MissionValue row={row} rank={statistics.rankings.kept[row.id]}>{row.kept ?? "—"}</MissionValue><MissionValue row={row} rank={statistics.rankings.keptRate[row.id]}>{row.keptRate === null ? "—" : percent(row.keptRate)}</MissionValue>
    <MissionValue row={row} rank={statistics.rankings.wins[row.id]}>{row.wins}</MissionValue><MissionValue row={row} rank={statistics.rankings.winRate[row.id]}>{percent(row.winRate)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averagePlacement[row.id]}>{row.averagePlacement === null ? "Keine Daten" : number(row.averagePlacement, 2)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averagePoints[row.id]}>{row.averagePoints === null ? "Keine Daten" : number(row.averagePoints, 1)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averageWinnerPoints[row.id]}>{row.averageWinnerPoints === null ? "Keine Daten" : number(row.averageWinnerPoints, 1)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averageRatingChange[row.id]}>{row.averageRatingChange === null ? "Keine Daten" : signedNumber(row.averageRatingChange)}</MissionValue><MissionValue row={row} rank={statistics.rankings.maxPoints[row.id]}>{row.maxPoints ? <Link href={`/partien/${row.maxPoints.gameId}`}>{row.maxPoints.value}</Link> : "Keine Daten"}</MissionValue></tr>)}</tbody></table></div><p className={styles.missionExplanation}><span>Bei der Auswertung von Missionen werden nur Partien berücksichtigt, in denen die jeweilige Mission behalten wurde.</span><span>„Ohne Mission“ umfasst alle Partien, in denen die gezogene Mission nicht behalten wurde.</span><span>Die Reihenfolge richtet sich nach der durchschnittlichen Platzierung.</span></p></section><MissionPointsTimelineChart series={timeline.series} entries={timeline.entries.map((entry) => ({ ...entry, playedAt: entry.playedAt.toISOString() }))} /></div>;
}

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  const requested = (await searchParams).bereich;
  const area = requested === "spiel" || requested === "missionen" ? requested : "spieler";
  const [players, rawGames, missions] = await Promise.all([
    prisma.player.findMany({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null }, orderBy: [{ currentRating: "desc" }, { alias: "asc" }], select: { id: true, alias: true, currentRating: true, user: { select: { profileImageUrl: true } } } }),
    prisma.game.findMany({ where: { status: GameStatus.CONFIRMED, deletedAt: null }, orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, playedAt: true, createdAt: true, participants: { select: { id: true, playerId: true, points: true, placement: true, ratingBefore: true, ratingChange: true, ratingAfter: true, missionId: true, missionKept: true, player: { select: { alias: true, user: { select: { profileImageUrl: true } } } } } } } }),
    prisma.mission.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, sortOrder: true } }),
  ]);
  const games: StatisticsGame[] = rawGames.map((game) => ({ ...game, participants: game.participants.map((row) => ({ ...row, alias: row.player.alias, imageUrl: row.player.user?.profileImageUrl ?? null })) }));
  const publicPlayers = players.map((player) => ({ id: player.id, alias: player.alias, currentRating: player.currentRating, imageUrl: player.user?.profileImageUrl ?? null }));
  return <main className={styles.page}><header className={styles.hero}><span>Globale Auswertung</span><h1>Statistiken</h1><p>Rekorde, Serien und Kennzahlen aus allen bestätigten Partien der Spielgruppe.</p></header><nav className={styles.tabs} aria-label="Statistikbereiche">{[["spieler", "Spieler"], ["spiel", "Spiel"], ["missionen", "Missionen"]].map(([key, label]) => <Link key={key} href={`/statistik?bereich=${key}`} aria-current={area === key ? "page" : undefined}>{label}</Link>)}</nav>
    {area === "spieler" && <PlayersArea statistics={calculatePlayerStatistics(publicPlayers, games)} />}{area === "spiel" && <GamesArea statistics={calculateGameStatistics(games)} />}{area === "missionen" && <MissionsArea statistics={calculateMissionStatistics(games, missions)} timeline={buildMissionPointsTimeline(games, missions)} />}
  </main>;
}
