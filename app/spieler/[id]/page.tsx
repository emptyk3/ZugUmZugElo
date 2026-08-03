import { GameStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function date(value: Date) { return new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "Europe/Vienna" }).format(value); }

export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await prisma.player.findFirst({
    where: { id, isActive: true, deletedAt: null, mergedIntoPlayerId: null },
    select: {
      id: true, alias: true, currentRating: true, user: { select: { profileImageUrl: true } },
      participations: {
        where: { game: { status: GameStatus.CONFIRMED, deletedAt: null } },
        orderBy: [{ game: { playedAt: "desc" } }, { game: { createdAt: "desc" } }],
        select: { id: true, placement: true, points: true, ratingBefore: true, ratingChange: true, ratingAfter: true, game: { select: { id: true, playedAt: true, participants: { orderBy: { placement: "asc" }, select: { player: { select: { id: true, alias: true } } } } } } },
      },
    },
  });
  if (!player) notFound();
  const rank = await prisma.player.count({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null, currentRating: { gt: player.currentRating } } }) + 1;
  const games = player.participations.length;
  const wins = player.participations.filter((participation) => participation.placement === 1).length;
  const averagePlacement = games ? player.participations.reduce((sum, participation) => sum + participation.placement, 0) / games : null;

  return <main className={styles.page}>
    <Link className={styles.back} href="/">← Zur Rangliste</Link>
    <header className={styles.hero}><PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={104} /><div><p>Öffentliches Spielerprofil</p><h1>{player.alias}</h1><span>Rang {rank} · {Math.round(player.currentRating)} Elo</span></div></header>
    <dl className={styles.stats}><div><dt>Aktueller Rang</dt><dd>{rank}</dd></div><div><dt>Elo</dt><dd>{Math.round(player.currentRating)}</dd></div><div><dt>Partien</dt><dd>{games}</dd></div><div><dt>Siege</dt><dd>{wins}</dd></div><div><dt>Ø Platzierung</dt><dd>{averagePlacement?.toFixed(2).replace(".", ",") ?? "–"}</dd></div></dl>
    <section className={styles.games}><div className={styles.sectionHead}><div><span>Bestätigte Partien</span><h2>Partieverlauf</h2></div><strong>{games}</strong></div>
      {games === 0 ? <p className={styles.empty}>Noch keine bestätigten Partien.</p> : <ol>{player.participations.map((participation) => { const change = Math.round(participation.ratingChange); return <li key={participation.id}><span className={styles.place}>{participation.placement}</span><div><Link href={`/partien/${participation.game.id}`}>{date(participation.game.playedAt)}</Link><small>{participation.points} Punkte · mit {participation.game.participants.filter((item) => item.player.id !== player.id).map((item, index) => <span key={item.player.id}>{index > 0 ? ", " : ""}<PlayerAliasLink playerId={item.player.id} alias={item.player.alias} /></span>)}</small></div><div className={styles.elo}><small>{Math.round(participation.ratingBefore)} → {Math.round(participation.ratingAfter)}</small><strong className={change >= 0 ? styles.positive : styles.negative}>{change > 0 ? "+" : ""}{change}</strong></div></li>; })}</ol>}
    </section>
  </main>;
}
