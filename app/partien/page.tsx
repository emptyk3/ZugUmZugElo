import { GameStatus } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/policy";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Vienna",
  }).format(date);
}

function formatRatingChange(value: number) {
  const rounded = Math.round(value);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return `${normalized > 0 ? "+" : ""}${normalized}`;
}

async function loadGames() {
  return prisma.game.findMany({
    where: {
      status: GameStatus.CONFIRMED,
      deletedAt: null,
    },
    orderBy: [
      { playedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      playedAt: true,
      photoUrl: true,
      photoStorageId: true,
      participants: {
        orderBy: { placement: "asc" },
        select: {
          id: true,
          placement: true,
          points: true,
          ratingBefore: true,
          ratingChange: true,
          ratingAfter: true,
          missionKept: true,
          player: { select: { id: true, alias: true, user: { select: { profileImageUrl: true } } } },
          mission: { select: { name: true } },
        },
      },
    },
  });
}

export default async function GamesPage() {
  let games: Awaited<ReturnType<typeof loadGames>> = [];
  let loadError = false;
  const currentUser = await getCurrentUser();
  const admin = currentUser ? isAdmin(currentUser) : false;

  try {
    games = await loadGames();
  } catch (error) {
    console.error("Partienhistorie konnte nicht geladen werden:", error);
    loadError = true;
  }

  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Hauptnavigation">
        <Link className={styles.brand} href="/">ZugUmZugElo</Link>
        <div className={styles.navLinks}>
          <Link href="/">Rangliste</Link>
          <Link className={styles.navPrimary} href="/partie-eintragen">Partie eintragen</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>Öffentliche Historie</p>
        <h1>Gespielte Partien</h1>
        <p>Alle bestätigten Partien, chronologisch vom jüngsten Ergebnis bis zum ersten Spiel.</p>
      </header>

      {loadError ? (
        <section className={styles.stateMessage} role="alert">
          <strong>Partien derzeit nicht verfügbar</strong>
          <span>Bitte versuche es in Kürze erneut.</span>
        </section>
      ) : games.length === 0 ? (
        <section className={styles.stateMessage}>
          <strong>Noch keine bestätigten Partien</strong>
          <span>Die erste gespeicherte Partie erscheint automatisch hier.</span>
        </section>
      ) : (
        <section className={styles.gameList} aria-label="Partienhistorie">
          {games.map((game) => {
            const hasPhoto = Boolean(game.photoUrl);
            return (
              <article className={styles.gameCard} key={game.id}>
                <header className={styles.cardHeader}>
                  <div>
                    <span className={styles.cardLabel}>Gespielt am</span>
                    <h2>{formatDate(game.playedAt)}</h2>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{game.participants.length} Spieler</span>
                    <span className={hasPhoto ? styles.photoAvailable : styles.noPhoto}>
                      {hasPhoto ? "Foto vorhanden" : "Ältere Partie ohne Foto"}
                    </span>
                  </div>
                </header>

                <ol className={styles.participants}>
                  {game.participants.map((participant) => (
                    <li key={participant.id}>
                      <span className={styles.place}>{participant.placement}</span>
                      <PlayerAliasLink playerId={participant.player.id} alias={participant.player.alias} className={styles.identity}>
                        <PlayerAvatar imageUrl={participant.player.user?.profileImageUrl} alias={participant.player.alias} size={40} />
                        <div>
                        <strong>{participant.player.alias}</strong>
                        <small>
                          {participant.mission.name}
                          {!participant.missionKept && <em>Mission nicht behalten</em>}
                        </small>
                        </div>
                      </PlayerAliasLink>
                      <span className={styles.points}>{participant.points} <small>Pkt.</small></span>
                      <div className={styles.ratingCell}>
                        <span><small>Elo alt</small><b>{Math.round(participant.ratingBefore)}</b></span>
                        <span><small>± Elo</small><strong className={participant.ratingChange >= 0 ? styles.positive : styles.negative}>{formatRatingChange(participant.ratingChange)}</strong></span>
                        <span><small>Elo neu</small><b>{Math.round(participant.ratingAfter)}</b></span>
                      </div>
                    </li>
                  ))}
                </ol>

                <footer className={styles.cardFooter}>
                  {admin && <Link className={styles.adminEditLink} href={`/admin/partien/${game.id}?bearbeiten=1`}>Partie bearbeiten</Link>}
                  <Link href={`/partien/${game.id}`}>Details <span aria-hidden="true">→</span></Link>
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
