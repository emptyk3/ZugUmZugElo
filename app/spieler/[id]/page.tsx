import { GameStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { formatElo, formatEloChange } from "@/lib/format/elo";
import { prisma } from "@/lib/prisma";
import { calculateMissionStats, type MissionStat } from "@/lib/players/mission-stats";
import { calculateOpponentStats, type OpponentStat } from "@/lib/players/opponent-stats";
import { calculateProfileStats } from "@/lib/players/profile-stats";
import EloChart from "./EloChart";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
const formatDate = (value: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(value);
const formatDateTime = (value: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vienna" }).format(value);
const number = (value: number, digits = 1) => new Intl.NumberFormat("de-AT", { maximumFractionDigits: digits }).format(value);
const percent = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("de-AT", { style: "percent", maximumFractionDigits: 1 }).format(value);
const signedNumber = (value: number, digits = 2) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value), digits)}`;

function OpponentFeature({ label, opponent }: { label: string; opponent: OpponentStat | null }) {
  return <article className={styles.opponentFeature}><span>{label}</span>{opponent ? <>
    <PlayerAliasLink playerId={opponent.id} alias={opponent.alias} className={styles.opponentLink}><PlayerAvatar imageUrl={opponent.imageUrl} alias={opponent.alias} size={48} /><strong>{opponent.alias}</strong></PlayerAliasLink>
    <dl><div><dt>Gemeinsame Partien</dt><dd>{opponent.games}</dd></div><div><dt>Direkte Winrate</dt><dd>{percent(opponent.winRate)}</dd></div><div><dt>Ø Platzierungsdifferenz</dt><dd>{signedNumber(opponent.averagePlacementDifference)}</dd></div></dl>
  </> : <p>Noch nicht genügend Gegnerdaten</p>}</article>;
}

function MissionFeature({ label, mission }: { label: string; mission: MissionStat | null }) {
  return <article className={styles.missionFeature}><span>{label}</span>{mission ? <><strong>{mission.name}</strong><dl><div><dt>Winrate</dt><dd>{percent(mission.winRate)}</dd></div><div><dt>Ø Platzierung</dt><dd>{number(mission.averagePlacement!, 2)}</dd></div><div><dt>Ø Punkte</dt><dd>{number(mission.averagePoints!, 1)}</dd></div></dl></> : <p>Noch nicht genügend Daten</p>}</article>;
}

export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await prisma.player.findFirst({
    where: { id, isActive: true, deletedAt: null, mergedIntoPlayerId: null },
    select: {
      id: true, alias: true, initialRating: true, currentRating: true,
      user: { select: { profileImageUrl: true } },
      aliases: { orderBy: [{ validFrom: "desc" }, { id: "asc" }], select: { id: true, alias: true } },
      participations: {
        where: { game: { status: GameStatus.CONFIRMED, deletedAt: null } },
        orderBy: [{ game: { playedAt: "asc" } }, { game: { createdAt: "asc" } }, { game: { id: "asc" } }],
        select: {
          id: true, placement: true, points: true, missionKept: true, ratingBefore: true, ratingChange: true, ratingAfter: true,
          mission: { select: { id: true, name: true, sortOrder: true } },
          game: { select: {
            id: true, playedAt: true, createdAt: true,
            participants: {
              orderBy: [{ placement: "asc" }, { id: "asc" }],
              select: {
                id: true, placement: true, points: true, missionKept: true,
                mission: { select: { name: true } },
                player: { select: { id: true, alias: true, user: { select: { profileImageUrl: true } } } },
              },
            },
          } },
        },
      },
    },
  });
  if (!player) notFound();
  const [higherRatedPlayers, missionCatalog] = await Promise.all([
    prisma.player.count({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null, currentRating: { gt: player.currentRating } } }),
    prisma.mission.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, sortOrder: true } }),
  ]);
  const rank = higherRatedPlayers + 1;
  const profile = calculateProfileStats(player.initialRating, player.participations);
  const missions = calculateMissionStats(player.participations.map((row) => ({ points: row.points, placement: row.placement, missionKept: row.missionKept, gameId: row.game.id, playedAt: row.game.playedAt, mission: row.mission })), missionCatalog);
  const opponents = calculateOpponentStats(player.participations.flatMap((row) => row.game.participants.filter((item) => item.player.id !== player.id).map((item) => ({
    gameId: row.game.id, ownPlacement: row.placement, opponentPlacement: item.placement, ownPoints: row.points, opponentPoints: item.points,
    opponent: { id: item.player.id, alias: item.player.alias, imageUrl: item.player.user?.profileImageUrl ?? null },
  }))));
  const previousAliases = player.aliases.filter((item) => item.alias.localeCompare(player.alias, "de", { sensitivity: "accent" }) !== 0);
  const recent = [...player.participations].reverse().slice(0, 5);
  const career = [
    { label: "Aktuelle Elo", value: formatElo(player.currentRating) },
    { label: "Höchste Elo", value: formatElo(profile.highestRating.value), date: profile.highestRating.reachedAt ? formatDate(profile.highestRating.reachedAt) : "Startwert" },
    { label: "Höchste Punktzahl", value: profile.highestScore ? String(profile.highestScore.value) : "—", date: profile.highestScore ? formatDate(profile.highestScore.playedAt) : undefined, href: profile.highestScore ? `/partien/${profile.highestScore.gameId}` : undefined },
    { label: "Siege", value: String(profile.wins) },
    { label: "Winrate", value: percent(profile.winRate) },
    { label: "Ø Platzierung", value: profile.averagePlacement === null ? "—" : number(profile.averagePlacement, 2) },
    { label: "Ø Punktzahl", value: profile.averagePoints === null ? "—" : number(profile.averagePoints, 2) },
    { label: "Größtes Plus", value: profile.largestGain ? formatEloChange(profile.largestGain.value) : "—", date: profile.largestGain ? formatDate(profile.largestGain.playedAt) : undefined, href: profile.largestGain ? `/partien/${profile.largestGain.gameId}` : undefined, tone: "positive" },
    { label: "Größtes Minus", value: profile.largestLoss ? formatEloChange(profile.largestLoss.value) : "—", date: profile.largestLoss ? formatDate(profile.largestLoss.playedAt) : undefined, href: profile.largestLoss ? `/partien/${profile.largestLoss.gameId}` : undefined, tone: "negative" },
    { label: "Letzte Aktivität", value: profile.lastActivity ? formatDateTime(profile.lastActivity) : "—" },
  ];

  return <main className={styles.page}><Link className={styles.back} href="/">← Zur Rangliste</Link>
    <section className={styles.profileCard}>
      <header className={styles.hero}><PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={104} /><h1>{player.alias}</h1><div className={styles.profileFacts}><span>Rang <strong>{rank}</strong></span><span className={styles.primaryElo}><strong>{formatElo(player.currentRating)}</strong> Elo</span><span><strong>{profile.games}</strong> bestätigte Partien</span></div>
        {previousAliases.length > 0 && <div className={styles.aliases}><small>Frühere Aliasse</small><div>{previousAliases.slice(0, 3).map((item) => <span key={item.id}>{item.alias}</span>)}</div>{previousAliases.length > 3 && <details><summary>Alle anzeigen (+{previousAliases.length - 3})</summary><div>{previousAliases.slice(3).map((item) => <span key={item.id}>{item.alias}</span>)}</div></details>}</div>}
      </header>
      <section className={styles.eloPanel}><div className={styles.panelTitle}><span>Entwicklung</span><h2>Elo-Verlauf</h2></div><EloChart points={profile.timeline.map((point) => ({ ...point, playedAt: point.playedAt?.toISOString() ?? null }))} /></section>
      <section className={styles.career}><div className={styles.panelTitle}><span>Überblick</span><h2>Karriere</h2></div><dl>{career.map((item) => <div key={item.label}><dt>{item.label}</dt><dd className={item.tone ? styles[item.tone as "positive" | "negative"] : undefined}>{item.href ? <Link href={item.href}>{item.value}</Link> : item.value}</dd>{item.date && <small>{item.date}</small>}</div>)}</dl></section>
    </section>

    <section className={styles.card}><div className={styles.sectionHead}><div><span>Nach Aufgabe</span><h2>Missionsstatistik</h2></div></div>
      <div className={styles.highlights}><MissionFeature label="Beste Mission" mission={missions.best} /><MissionFeature label="Schlechteste Mission" mission={missions.worst} /></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Mission</th><th>Spiele</th><th>Siege</th><th>Winrate</th><th>Ø Platz</th><th>Ø Punkte</th><th>Max. Punkte</th><th>% behalten</th></tr></thead><tbody>{missions.rows.map((row) => <tr key={row.id}><th>{row.name}</th><td>{row.games}</td><td>{row.wins}</td><td>{percent(row.winRate)}</td><td>{row.averagePlacement === null ? "—" : number(row.averagePlacement, 2)}</td><td>{row.averagePoints === null ? "—" : number(row.averagePoints, 1)}</td><td>{row.highestScore ? <Link href={`/partien/${row.highestScore.gameId}`}>{row.highestScore.value}</Link> : "—"}</td><td>{row.isWithoutMission ? "—" : percent(row.keptRate)}</td></tr>)}</tbody></table></div>
    </section>

    <section className={styles.card}><div className={styles.sectionHead}><div><span>Direktvergleich</span><h2>Gegnerstatistik</h2></div></div><div className={styles.opponentHighlights}><OpponentFeature label="Lieblingsgegner" opponent={opponents.favorite} /><OpponentFeature label="Erzfeind" opponent={opponents.nemesis} /></div>
      {opponents.rows.length ? <div className={styles.tableWrap}><table><thead><tr><th>Alias</th><th>Spiele</th><th>Siege</th><th>Niederlagen</th><th>Winrate</th><th>Ø Platzierungsdifferenz</th><th>Ø Punktedifferenz</th></tr></thead><tbody>{opponents.rows.map((row) => <tr key={row.id}><th><PlayerAliasLink playerId={row.id} alias={row.alias} className={styles.playerCell}><PlayerAvatar imageUrl={row.imageUrl} alias={row.alias} size={30} />{row.alias}</PlayerAliasLink></th><td>{row.games}</td><td>{row.wins}</td><td>{row.losses}</td><td>{percent(row.winRate)}</td><td>{signedNumber(row.averagePlacementDifference)}</td><td>{signedNumber(row.averagePointDifference, 1)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Noch nicht genügend Gegnerdaten</p>}
    </section>

    <section className={`${styles.card} ${styles.games}`}><div className={styles.sectionHead}><div><span>Bestätigte Partien</span><h2>Partieverlauf</h2></div><strong>{profile.games}</strong></div>
      {recent.length === 0 ? <p className={styles.empty}>Noch keine bestätigten Partien.</p> : <ol>{recent.map((row) => <li className={styles.gameEntry} key={row.id}><div className={styles.gameHead}><Link href={`/partien/${row.game.id}`}>{formatDateTime(row.game.playedAt)}</Link><div className={styles.gameElo}><span>{formatElo(row.ratingBefore)} → {formatElo(row.ratingAfter)}</span><strong className={row.ratingChange >= 0 ? styles.positive : styles.negative}>{formatEloChange(row.ratingChange)}</strong></div></div><ol className={styles.participantList}>{row.game.participants.map((participant) => <li className={participant.player.id === player.id ? styles.profileParticipant : undefined} key={participant.id}><span className={styles.place}>{participant.placement}</span><PlayerAvatar imageUrl={participant.player.user?.profileImageUrl} alias={participant.player.alias} size={36} /><div><PlayerAliasLink playerId={participant.player.id} alias={participant.player.alias}>{participant.player.id === player.id ? <strong>{participant.player.alias}</strong> : participant.player.alias}</PlayerAliasLink><small>{participant.mission.name}{!participant.missionKept && <em>Mission nicht behalten</em>}</small></div><strong>{participant.points} Punkte</strong></li>)}</ol></li>)}</ol>}
      {profile.games > 5 && <footer className={styles.allGames}><Link href={`/partien?spieler=${player.id}`}>Alle Partien anzeigen →</Link></footer>}
    </section>
  </main>;
}
