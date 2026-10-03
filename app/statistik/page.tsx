import { GameStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import PlayerAvatar from "@/components/PlayerAvatar";
import { formatElo, formatEloChange } from "@/lib/format/elo";
import { prisma } from "@/lib/prisma";
import { calculateGameStatistics } from "@/lib/statistics/game-statistics";
import type { MissionStatisticRow } from "@/lib/statistics/mission-statistics";
import { buildMissionStatisticsView, resolveMissionPlayerCountFilter, type MissionPlayerCountFilter } from "@/lib/statistics/mission-view";
import { calculatePlayerStatistics, type SeriesRecord } from "@/lib/statistics/player-statistics";
import type { StatisticsGame } from "@/lib/statistics/types";
import GamePointsTimelineChart from "./GamePointsTimelineChart";
import MissionPlacementTimelineChart from "./MissionPlacementTimelineChart";
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

type RankedPlayerRecord = { id: string; alias: string; imageUrl: string | null; rank: number };
function RecordTopList<T extends RankedPlayerRecord>({ rows, value, details, empty = "Keine Daten" }: { rows: T[]; value: (row: T) => React.ReactNode; details?: (row: T) => React.ReactNode; empty?: string }) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  return <ol className={`${styles.recordList} ${styles.rankedRecordList}`}>{rows.map((row, index) => <li key={`${row.id}-${index}`}><b className={styles.recordRank}>#{row.rank}</b><Person row={row} /><div className={styles.recordValue}><strong>{value(row)}</strong>{details?.(row)}</div></li>)}</ol>;
}

function RecordCard<T extends RankedPlayerRecord>({ eyebrow, title, rows, value, details, footer }: { eyebrow: string; title: string; rows: T[]; value: (row: T) => React.ReactNode; details?: (row: T) => React.ReactNode; footer?: React.ReactNode }) {
  return <article className={styles.card}><span>{eyebrow}</span><h2>{title}</h2><RecordTopList rows={rows} value={value} details={details} />{footer}</article>;
}

function PlayersArea({ statistics }: { statistics: ReturnType<typeof calculatePlayerStatistics> }) {
  return <div className={styles.area}>
    <div className={styles.topGrid}><section className={styles.topCard}><div><span>Aktuelle Rangliste</span><h2>Höchste aktuelle Elo</h2><p>Geteilte Werte erhalten denselben dichten Rang; angezeigt werden alle Spieler der ersten drei Elo-Ränge.</p></div><RecordTopList rows={statistics.currentTop} value={(row) => `${formatElo(row.currentRating)} Elo`} empty="Noch keine aktiven Spieler." /></section>
    <section className={styles.topCard}><div><span>Partienrangliste</span><h2>Meiste gespielte Partien</h2><p>Bestätigte Partien; Gleichstände erhalten denselben dichten Rang.</p></div><RecordTopList rows={statistics.mostGames} value={(row) => `${row.games} Partien`} empty="Noch keine Spieler vorhanden." /></section></div>
    <div className={styles.cardGrid}>
      <RecordCard eyebrow="Karriererekord" title="Höchste Elo aller Zeiten" rows={statistics.highestAllTime} value={(row) => `${formatElo(row.value)} Elo`} details={(row) => row.gameId && <Link href={`/partien/${row.gameId}`}>{row.playedAt ? date(row.playedAt) : "Partie"}</Link>} footer={<small>Nur gespeicherte ratingAfter-Werte nach bestätigten Partien; Start-Elo zählt nicht als erspielter Rekord.</small>} />
      <RecordCard eyebrow="Mindestens 5 Partien" title="Höchste Winrate" rows={statistics.highestWinRate} value={(row) => percent(row.winRate)} details={(row) => <small>{row.wins} Siege · {row.games} Partien</small>} />
      <RecordCard eyebrow="Mindestens 5 Partien" title="Höchste Ø-Punkte" rows={statistics.highestAveragePoints} value={(row) => number(row.averagePoints, 1)} details={(row) => <small>{row.games} Partien</small>} />
      <RecordCard eyebrow="Mindestens 5 Partien" title="Höchste Median-Punkte" rows={statistics.highestMedianPoints} value={(row) => number(row.medianPoints, 1)} details={(row) => <small>{row.games} Partien</small>} />
      <RecordCard eyebrow="Mindestens 5 Partien" title="Beste Ø-Platzierung" rows={statistics.bestAveragePlacement} value={(row) => number(row.averagePlacement, 2)} details={(row) => <small>{row.games} Partien</small>} />
      <RecordCard eyebrow="Nur eigene Partien" title="Längste Winning Streak" rows={statistics.longestWinningStreak} value={(row) => `${row.games} Siege`} details={(row) => <><Link href={`/partien/${row.firstGameId}`}>{range(row)}</Link>{row.running && <span>Laufend</span>}</>} />
      <RecordCard eyebrow="ratingChange ≥ 0" title="Längste Serie ohne Elo-Verlust" rows={statistics.longestNonLossStreak} value={(row) => `${row.games} Partien · ${formatEloChange(row.totalGain)}`} details={(row) => <><Link href={`/partien/${row.firstGameId}`}>{range(row)}</Link>{row.running && <span>Laufend</span>}</>} />
      <RecordCard eyebrow="ratingChange ≥ 0" title="Größtes Plus ohne Verlust" rows={statistics.greatestNonLossGain} value={(row) => `${formatEloChange(row.totalGain)} Elo · ${row.games} Partien`} details={(row) => <><Link href={`/partien/${row.firstGameId}`}>{range(row)}</Link>{row.running && <span>Laufend</span>}</>} />
      <RecordCard eyebrow="Gleitendes Fenster" title="Bestes Plus über 5 Partien" rows={statistics.bestFiveGameGain} value={(row) => `${formatEloChange(row.value)} Elo`} details={(row) => <Link href={`/partien/${row.firstGameId}`}>{range(row)}</Link>} />
      <RecordCard eyebrow="Gleitendes Fenster" title="Bestes Plus über 10 Partien" rows={statistics.bestTenGameGain} value={(row) => `${formatEloChange(row.value)} Elo`} details={(row) => <Link href={`/partien/${row.firstGameId}`}>{range(row)}</Link>} />
    </div>
  </div>;
}

function GamesArea({ statistics }: { statistics: ReturnType<typeof calculateGameStatistics> }) {
  const columns = [statistics.total, statistics.fourPlayers, statistics.fivePlayers];
  const serializable = (entries: typeof statistics.timelines.total) => entries.map((entry) => ({ ...entry, playedAt: entry.playedAt.toISOString() }));
  return <div className={styles.gameStatistics}><section className={styles.tableCard}><h2>Spielstatistiken</h2><div className={styles.tableWrap}><table><thead><tr><th>Kennzahl</th><th>Gesamt</th><th>4 Spieler</th><th>5 Spieler</th></tr></thead><tbody><tr><th>Anzahl gespielter Partien</th>{columns.map((c, i) => <td key={i}>{c.games}</td>)}</tr><tr><th>Durchschnittliche Punkte</th>{columns.map((c, i) => <td key={i}>{c.averagePoints === null ? "Keine Daten" : number(c.averagePoints, 1)}</td>)}</tr><tr><th>Median Punkte</th>{columns.map((c, i) => <td key={i}>{c.medianPoints === null ? "—" : number(c.medianPoints, 1)}</td>)}</tr><tr><th>Durchschnittliche Punkte des Siegers</th>{columns.map((c, i) => <td key={i}>{c.averageWinnerPoints === null ? "Keine Daten" : number(c.averageWinnerPoints, 1)}</td>)}</tr><tr><th>Median Punkte des Siegers</th>{columns.map((c, i) => <td key={i}>{c.medianWinnerPoints === null ? "—" : number(c.medianWinnerPoints, 1)}</td>)}</tr></tbody></table></div>{statistics.unexpectedPlayerCountGames > 0 && <p className={styles.note}>{statistics.unexpectedPlayerCountGames} bestätigte {statistics.unexpectedPlayerCountGames === 1 ? "Partie hat" : "Partien haben"} weder vier noch fünf Teilnehmer und ist nur in „Gesamt“ enthalten.</p>}</section>
    <GamePointsTimelineChart title="Punkteentwicklung – Gesamt" entries={serializable(statistics.timelines.total)} emptyMessage="Noch keine bestätigten Partien vorhanden." />
    <GamePointsTimelineChart title="Punkteentwicklung – 4 Spieler" entries={serializable(statistics.timelines.fourPlayers)} emptyMessage="Noch keine Partien mit 4 Spielern vorhanden." />
    <GamePointsTimelineChart title="Punkteentwicklung – 5 Spieler" entries={serializable(statistics.timelines.fivePlayers)} emptyMessage="Noch keine Partien mit 5 Spielern vorhanden." />
  </div>;
}

const missionMedals = { 1: "🏆", 2: "🥈", 3: "🥉" } as const;
function MissionValue({ row, rank, showMedal = true, goldPairSide, children }: { row: MissionStatisticRow; rank?: 1 | 2 | 3; showMedal?: boolean; goldPairSide?: "start" | "end"; children: React.ReactNode }) {
  const classes = [rank ? styles[`rank${rank}` as "rank1" | "rank2" | "rank3"] : undefined, rank === 1 && goldPairSide ? styles[goldPairSide === "start" ? "goldPairStart" : "goldPairEnd"] : undefined].filter(Boolean).join(" ") || undefined;
  return <td className={classes}>{rank && showMedal && <span aria-label={`Platz ${rank}`} title={`Platz ${rank}`}>{missionMedals[rank]}</span>}{children}</td>;
}
function MissionsArea({ view, filter }: { view: ReturnType<typeof buildMissionStatisticsView>; filter: MissionPlayerCountFilter }) {
  const { statistics, timeline } = view;
  return <div className={styles.missionStatistics}><nav className={styles.missionSubtabs} aria-label="Teilnehmerzahl der Missionsstatistik">{[["gesamt", "Gesamt"], ["4", "4 Spieler"], ["5", "5 Spieler"]].map(([key, label]) => <Link key={key} href={`/statistik?bereich=missionen&spieleranzahl=${key}`} aria-current={filter === key ? "page" : undefined}>{label}</Link>)}</nav>{view.games.length === 0 ? <section className={`${styles.tableCard} ${styles.missionEmpty}`}><p>Noch keine Daten vorhanden.</p></section> : <><section className={`${styles.tableCard} ${styles.missionTableCard}`}><h2>Missionsstatistiken</h2><div className={`${styles.tableWrap} ${styles.missionTableWrap}`}><table><colgroup><col className={styles.missionRankColumn} /><col className={styles.missionNameColumn} /><col className={styles.missionDrawnColumn} /><col span={5} /><col className={styles.missionMetricMeanColumn} /><col className={styles.missionMetricSigmaColumn} /><col /><col className={styles.missionMetricMeanColumn} /><col className={styles.missionMetricSigmaColumn} /><col /></colgroup><thead><tr><th className={styles.missionRankHeader}>Rang</th><th>Mission</th><th>Gezogen</th><th>% Gezogen</th><th>Behalten</th><th>% Behalten</th><th>Siege</th><th>Sieg-%</th><th>Ø Platz</th><th className={styles.sigmaHeader}>σ</th><th>Median Punkte</th><th>Ø Punkte</th><th className={styles.sigmaHeader}>σ</th><th>Ø Elo ±</th></tr></thead><tbody>{statistics.rows.map((row, index) => <tr key={row.id}><td className={styles.missionRankCell}>{index < 3 ? missionMedals[(index + 1) as 1 | 2 | 3] : `${index + 1}.`}</td><th scope="row">{row.name}</th>
    <MissionValue row={row}>{row.drawn ?? "—"}</MissionValue><MissionValue row={row}>{row.drawnRate === null ? "—" : percent(row.drawnRate)}</MissionValue><MissionValue row={row} rank={statistics.rankings.kept[row.id]}>{row.kept ?? "—"}</MissionValue><MissionValue row={row} rank={statistics.rankings.keptRate[row.id]}>{row.keptRate === null ? "—" : percent(row.keptRate)}</MissionValue>
    <MissionValue row={row} rank={statistics.rankings.wins[row.id]}>{row.wins}</MissionValue><MissionValue row={row} rank={statistics.rankings.winRate[row.id]}>{percent(row.winRate)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averagePlacement[row.id]} goldPairSide="start">{row.averagePlacement === null ? "Keine Daten" : number(row.averagePlacement, 2)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averagePlacement[row.id]} showMedal={false} goldPairSide="end">{row.placementStandardDeviation === null ? "Keine Daten" : `± ${number(row.placementStandardDeviation, 2)}`}</MissionValue><MissionValue row={row} rank={statistics.rankings.medianPoints[row.id]}>{row.medianPoints === null ? "—" : number(row.medianPoints, 1)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averagePoints[row.id]} goldPairSide="start">{row.averagePoints === null ? "Keine Daten" : number(row.averagePoints, 1)}</MissionValue><MissionValue row={row} rank={statistics.rankings.averagePoints[row.id]} showMedal={false} goldPairSide="end">{row.pointsStandardDeviation === null ? "Keine Daten" : `± ${number(row.pointsStandardDeviation, 1)}`}</MissionValue><MissionValue row={row} rank={statistics.rankings.averageRatingChange[row.id]}>{row.averageRatingChange === null ? "Keine Daten" : signedNumber(row.averageRatingChange)}</MissionValue></tr>)}</tbody></table></div><p className={styles.missionExplanation}><span>Bei der Auswertung von Missionen werden nur Partien berücksichtigt, in denen die jeweilige Mission behalten wurde.</span><span>„Ohne Mission“ umfasst alle Partien, in denen die gezogene Mission nicht behalten wurde.</span><span>Die Reihenfolge richtet sich nach der durchschnittlichen Platzierung.</span></p></section><MissionPlacementTimelineChart series={timeline.series} entries={timeline.entries.map((entry) => ({ ...entry, playedAt: entry.playedAt.toISOString() }))} maximumPlacement={view.chartMaximumPlacement} /></>}</div>;
}

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ bereich?: string; spieleranzahl?: string }> }) {
  const parameters = await searchParams;
  const requested = parameters.bereich;
  const area = requested === "spiel" || requested === "missionen" ? requested : "spieler";
  const missionFilter = resolveMissionPlayerCountFilter(parameters.spieleranzahl);
  const [players, rawGames, missions] = await Promise.all([
    prisma.player.findMany({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null }, orderBy: [{ currentRating: "desc" }, { alias: "asc" }], select: { id: true, alias: true, currentRating: true, user: { select: { profileImageUrl: true } } } }),
    prisma.game.findMany({ where: { status: GameStatus.CONFIRMED, deletedAt: null }, orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, playedAt: true, createdAt: true, participants: { select: { id: true, playerId: true, points: true, placement: true, ratingBefore: true, ratingChange: true, ratingAfter: true, missionId: true, missionKept: true, player: { select: { alias: true, user: { select: { profileImageUrl: true } } } } } } } }),
    prisma.mission.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, sortOrder: true } }),
  ]);
  const games: StatisticsGame[] = rawGames.map((game) => ({ ...game, participants: game.participants.map((row) => ({ ...row, alias: row.player.alias, imageUrl: row.player.user?.profileImageUrl ?? null })) }));
  const publicPlayers = players.map((player) => ({ id: player.id, alias: player.alias, currentRating: player.currentRating, imageUrl: player.user?.profileImageUrl ?? null }));
  const missionView = area === "missionen" ? buildMissionStatisticsView(games, missions, missionFilter) : null;
  return <main className={styles.page}><header className={styles.hero}><span>Globale Auswertung</span><h1>Statistiken</h1><p>Rekorde, Serien und Kennzahlen aus allen bestätigten Partien der Spielgruppe.</p></header><nav className={styles.tabs} aria-label="Statistikbereiche">{[["spieler", "Spieler"], ["spiel", "Spiel"], ["missionen", "Missionen"]].map(([key, label]) => <Link key={key} href={`/statistik?bereich=${key}`} aria-current={area === key ? "page" : undefined}>{label}</Link>)}</nav>
    {area === "spieler" && <PlayersArea statistics={calculatePlayerStatistics(publicPlayers, games)} />}{area === "spiel" && <GamesArea statistics={calculateGameStatistics(games)} />}{missionView && <MissionsArea view={missionView} filter={missionFilter} />}
  </main>;
}
