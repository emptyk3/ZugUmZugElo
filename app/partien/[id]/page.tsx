import { GameStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import PlayerAvatar from "@/components/PlayerAvatar";
import GamePhoto from "@/components/GamePhoto";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/policy";
import ReportGameButton from "./ReportGameButton";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Vienna",
  }).format(date);
}

function roundRating(value: number) {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const admin = currentUser ? isAdmin(currentUser) : false;
  const game = await prisma.game.findFirst({
    where: {
      id,
      status: GameStatus.CONFIRMED,
      deletedAt: null,
    },
    select: {
      playedAt: true,
      photoUrl: true,
      photoStorageId: true,
      createdByUser: { select: { email: true, player: { select: { alias: true } } } },
      participants: {
        orderBy: { placement: "asc" },
        select: {
          id: true,
          placement: true,
          points: true,
          tiebreakRank: true,
          ratingBefore: true,
          ratingChange: true,
          ratingAfter: true,
          missionKept: true,
          player: { select: { alias: true, user: { select: { profileImageUrl: true } } } },
          mission: { select: { name: true } },
        },
      },
    },
  });

  if (!game) notFound();
  const hasPhoto = Boolean(game.photoUrl);

  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Hauptnavigation">
        <Link className={styles.brand} href="/">ZugUmZugElo</Link>
        <div className={styles.navLinks}>
          <Link href="/partien">Alle Partien</Link>
          <Link className={styles.navPrimary} href="/partie-eintragen">Partie eintragen</Link>
        </div>
      </nav>

      <header className={styles.detailHero}>
        <Link className={styles.backLink} href="/partien">← Zur Partienhistorie</Link>
        <p className={styles.eyebrow}>Partiedetails</p>
        <h1>{formatDate(game.playedAt)}</h1>
        <div className={styles.detailMeta}>
          <span>{game.participants.length} Spieler</span>
          <span>{hasPhoto ? "Foto vorhanden" : "Ältere Partie ohne Foto"}</span>
          <span>Eingetragen von {game.createdByUser.player?.alias ?? game.createdByUser.email}</span>
        </div>
        {admin && <Link className={styles.adminEditButton} href={`/admin/partien/${id}?bearbeiten=1`}>Partie bearbeiten</Link>}
        {currentUser && <ReportGameButton gameId={id} />}
      </header>

      <GamePhoto photoUrl={game.photoUrl} alt={`Foto der Partie vom ${formatDate(game.playedAt)}`} className={styles.detailPhoto} />

      <section className={styles.detailCard} aria-labelledby="result-title">
        <div className={styles.detailHeading}>
          <span>Endergebnis</span>
          <h2 id="result-title">Platzierungen</h2>
        </div>
        <ol className={styles.detailParticipants}>
          {game.participants.map((participant) => {
            const change = roundRating(participant.ratingChange);
            return (
              <li key={participant.id}>
                <span className={styles.detailPlace}>{participant.placement}</span>
                <div className={styles.detailIdentity}>
                  <PlayerAvatar imageUrl={participant.player.user?.profileImageUrl} alias={participant.player.alias} size={42} />
                  <strong>{participant.player.alias}</strong>
                  <small>
                    {participant.mission.name}
                    {!participant.missionKept && <em>Mission nicht behalten</em>}
                    {participant.tiebreakRank && <span>Tiebreak: {participant.tiebreakRank}</span>}
                  </small>
                </div>
                <div className={styles.detailScore}>
                  <strong>{participant.points}</strong>
                  <span>Punkte</span>
                </div>
                <div className={styles.ratingSummary}>
                  <span><small>Elo alt</small><b>{Math.round(participant.ratingBefore)}</b></span>
                  <span><small>± Elo</small><strong className={change >= 0 ? styles.positive : styles.negative}>{change > 0 ? "+" : ""}{change}</strong></span>
                  <span><small>Elo neu</small><b>{Math.round(participant.ratingAfter)}</b></span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
