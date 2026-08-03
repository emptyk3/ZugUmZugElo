import { GameStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { prisma } from "@/lib/prisma";
import { calculateMissionStats } from "@/lib/players/mission-stats";
import { calculateOpponentStats, type OpponentStat } from "@/lib/players/opponent-stats";
import { calculateProfileStats } from "@/lib/players/profile-stats";
import EloChart from "./EloChart";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
const formatDate = (value: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(value);
const formatDateTime = (value: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vienna" }).format(value);
const number = (value: number, digits = 1) => new Intl.NumberFormat("de-AT", { maximumFractionDigits: digits }).format(value);
const percent = (value: number | null) => value === null ? "Keine Daten" : new Intl.NumberFormat("de-AT", { style: "percent", maximumFractionDigits: 1 }).format(value);
const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;

function OpponentFeature({ label, opponent }: { label: string; opponent: OpponentStat | null }) {
  return <article className={styles.opponentFeature}><span>{label}</span>{opponent ? <PlayerAliasLink playerId={opponent.id} alias={opponent.alias} className={styles.opponentLink}>
    <PlayerAvatar imageUrl={opponent.imageUrl} alias={opponent.alias} size={48} /><div><strong>{opponent.alias}</strong><small>{opponent.games} Partien · {percent(opponent.winRate)}</small></div>
  </PlayerAliasLink> : <p>Noch nicht genügend gemeinsame Partien.</p>}</article>;
}

export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await prisma.player.findFirst({
    where: { id, isActive: true, deletedAt: null, mergedIntoPlayerId: null },
    select: { id: true, alias: true, initialRating: true, currentRating: true,
      user: { select: { profileImageUrl: true } },
      aliases: { orderBy: [{ validFrom: "desc" }, { id: "asc" }], select: { id: true, alias: true } },
      participations: { where: { game: { status: GameStatus.CONFIRMED, deletedAt: null } },
        orderBy: [{ game: { playedAt: "asc" } }, { game: { createdAt: "asc" } }, { game: { id: "asc" } }],
        select: { id: true, placement: true, points: true, missionKept: true, ratingBefore: true, ratingChange: true, ratingAfter: true,
          mission: { select: { id: true, name: true, sortOrder: true } },
          game: { select: { id: true, playedAt: true, createdAt: true, participants: { orderBy: { placement: "asc" }, select: { placement: true, player: { select: { id: true, alias: true, user: { select: { profileImageUrl: true } } } } } } } } },
      },
    },
  });
  if (!player) notFound();
  const rank = await prisma.player.count({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null, currentRating: { gt: player.currentRating } } }) + 1;
  const profile = calculateProfileStats(player.initialRating, player.participations);
  const missions = calculateMissionStats(player.participations.map((row) => ({ points: row.points, placement: row.placement, missionKept: row.missionKept, gameId: row.game.id, playedAt: row.game.playedAt, mission: row.mission })));
  const opponents = calculateOpponentStats(player.participations.flatMap((row) => row.game.participants.filter((item) => item.player.id !== player.id).map((item) => ({ gameId: row.game.id, ownPlacement: row.placement, opponentPlacement: item.placement, opponent: { id: item.player.id, alias: item.player.alias, imageUrl: item.player.user?.profileImageUrl ?? null } }))));
  const previousAliases = player.aliases.filter((item) => item.alias.localeCompare(player.alias, "de", { sensitivity: "accent" }) !== 0);
  const recent = [...player.participations].reverse().slice(0, 5);
  const career = [
    ["Aktuelle Elo", number(player.currentRating)], ["Höchste Elo", `${number(profile.highestRating.value)}${profile.highestRating.reachedAt ? ` · ${formatDate(profile.highestRating.reachedAt)}` : " · Start"}`],
    ["Höchste Punktzahl", profile.highestScore ? <Link href={`/partien/${profile.highestScore.gameId}`}>{profile.highestScore.value} · {formatDate(profile.highestScore.playedAt)}</Link> : "Keine Daten"],
    ["Siege", String(profile.wins)], ["Winrate", percent(profile.winRate)], ["Ø Platzierung", profile.averagePlacement === null ? "Keine Daten" : number(profile.averagePlacement, 2)],
    ["Ø Punktzahl", profile.averagePoints === null ? "Keine Daten" : number(profile.averagePoints, 2)],
    ["Größtes Plus", profile.largestGain ? <Link className={styles.positive} href={`/partien/${profile.largestGain.gameId}`}>{signed(profile.largestGain.value)} · {formatDate(profile.largestGain.playedAt)}</Link> : "Keine Daten"],
    ["Größtes Minus", profile.largestLoss ? <Link className={styles.negative} href={`/partien/${profile.largestLoss.gameId}`}>{signed(profile.largestLoss.value)} · {formatDate(profile.largestLoss.playedAt)}</Link> : "Keine Daten"],
    ["Letzte Aktivität", profile.lastActivity ? formatDateTime(profile.lastActivity) : "Keine Daten"],
  ] as const;

  return <main className={styles.page}><Link className={styles.back} href="/">← Zur Rangliste</Link>
    <section className={styles.profileCard}>
      <header className={styles.hero}><PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={96} /><p>Öffentliches Spielerprofil</p><h1>{player.alias}</h1><strong>Rang {rank} · {number(player.currentRating)} Elo</strong><span>{profile.games} bestätigte Partien</span>
        {previousAliases.length > 0 && <div className={styles.aliases}><small>Frühere Aliasse</small><div>{previousAliases.slice(0, 3).map((item) => <span key={item.id}>{item.alias}</span>)}</div>{previousAliases.length > 3 && <details><summary>Alle anzeigen (+{previousAliases.length - 3})</summary><div>{previousAliases.slice(3).map((item) => <span key={item.id}>{item.alias}</span>)}</div></details>}</div>}
      </header>
      <section className={styles.eloPanel}><div className={styles.panelTitle}><span>Entwicklung</span><h2>Elo-Verlauf</h2></div><EloChart points={profile.timeline.map((point) => ({ ...point, playedAt: point.playedAt?.toISOString() ?? null }))} /></section>
      <section className={styles.career}><div className={styles.panelTitle}><span>Überblick</span><h2>Karriere</h2></div><dl>{career.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    </section>

    <section className={styles.card}><div className={styles.sectionHead}><div><span>Nach Aufgabe</span><h2>Missionsstatistik</h2></div></div>
      <div className={styles.highlights}>{[["Lieblingsmission", missions.favorite], ["Beste Mission", missions.best], ["Schlechteste Mission", missions.worst]].map(([label, item]) => <div key={label as string}><span>{label as string}</span><strong>{typeof item === "object" && item ? item.name : "Keine Daten"}</strong>{typeof item === "object" && item && <small>{item.games} Partien · {percent(item.winRate)}</small>}</div>)}</div>
      {missions.rows.length ? <div className={styles.tableWrap}><table><thead><tr><th>Mission</th><th>Partien</th><th>Siege</th><th>Winrate</th><th>Ø Platz.</th><th>Ø Punkte</th><th>Höchste Punkte</th><th>Behalten</th><th>Nicht behalten</th></tr></thead><tbody>{missions.rows.map((row) => <tr key={row.id}><th>{row.name}</th><td>{row.games}</td><td>{row.wins}</td><td>{percent(row.winRate)}</td><td>{number(row.averagePlacement, 2)}</td><td>{number(row.averagePoints, 2)}</td><td><Link href={`/partien/${row.highestScore.gameId}`}>{row.highestScore.value}</Link></td><td>{row.isWithoutMission ? "–" : `${row.kept} · ${percent(row.kept / row.games)}`}</td><td>{row.isWithoutMission ? "–" : `${row.notKept} · ${percent(row.notKept / row.games)}`}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Noch keine Missionsdaten.</p>}
    </section>

    <section className={styles.card}><div className={styles.sectionHead}><div><span>Direktvergleich</span><h2>Gegnerstatistik</h2></div></div><div className={styles.opponentHighlights}><OpponentFeature label="Lieblingsgegner" opponent={opponents.favorite} /><OpponentFeature label="Erzfeind" opponent={opponents.nemesis} /></div>
      {opponents.rows.length ? <div className={styles.tableWrap}><table><thead><tr><th>Spieler</th><th>Gemeinsame Partien</th><th>Siege</th><th>Niederlagen</th><th>Winrate</th><th>Ø Platzierungsdiff.</th></tr></thead><tbody>{opponents.rows.map((row) => <tr key={row.id}><th><PlayerAliasLink playerId={row.id} alias={row.alias} className={styles.playerCell}><PlayerAvatar imageUrl={row.imageUrl} alias={row.alias} size={30} />{row.alias}</PlayerAliasLink></th><td>{row.games}</td><td>{row.wins}</td><td>{row.losses}</td><td>{percent(row.winRate)}</td><td className={row.averagePlacementDifference >= 0 ? styles.positive : styles.negative}>{signed(row.averagePlacementDifference)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Noch keine gemeinsamen Partien.</p>}
    </section>

    <section className={`${styles.card} ${styles.games}`}><div className={styles.sectionHead}><div><span>Bestätigte Partien</span><h2>Partieverlauf</h2></div><strong>{profile.games}</strong></div>
      {recent.length === 0 ? <p className={styles.empty}>Noch keine bestätigten Partien.</p> : <ol>{recent.map((row) => <li key={row.id}><span className={styles.place}>{row.placement}</span><div><Link href={`/partien/${row.game.id}`}>{formatDateTime(row.game.playedAt)}</Link><small>{row.points} Punkte · {row.mission.name}{!row.missionKept ? " · Mission nicht behalten" : ""} · {row.game.participants.length} Teilnehmer</small><small>mit {row.game.participants.filter((item) => item.player.id !== player.id).map((item, index) => <span key={item.player.id}>{index ? ", " : ""}<PlayerAliasLink playerId={item.player.id} alias={item.player.alias} /></span>)}</small></div><div className={styles.gameElo}><small>{number(row.ratingBefore)} → {number(row.ratingAfter)}</small><strong className={row.ratingChange >= 0 ? styles.positive : styles.negative}>{signed(row.ratingChange)}</strong></div></li>)}</ol>}
      {profile.games > 5 && <footer className={styles.allGames}><Link href={`/partien?spieler=${player.id}`}>Alle Partien anzeigen →</Link></footer>}
    </section>
  </main>;
}
