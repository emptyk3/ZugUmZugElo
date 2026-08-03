import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";
import PlayerAvatar from "@/components/PlayerAvatar";

export const dynamic = "force-dynamic";

async function loadLeaderboard() {
  return prisma.player.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      mergedIntoPlayerId: null,
    },
    orderBy: [
      { currentRating: "desc" },
      { alias: "asc" },
    ],
    select: {
      id: true,
      alias: true,
      currentRating: true,
      user: { select: { profileImageUrl: true } },
      _count: {
        select: {
          participations: {
            where: {
              game: {
                status: GameStatus.CONFIRMED,
                deletedAt: null,
              },
            },
          },
        },
      },
    },
  });
}

export default async function Home() {
  let players: Awaited<ReturnType<typeof loadLeaderboard>> = [];
  let loadError = false;

  try {
    players = await loadLeaderboard();
  } catch (error) {
    console.error("Rangliste konnte nicht geladen werden:", error);
    loadError = true;
  }

  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Hauptnavigation">
        <a className={styles.brand} href="/">ZugUmZugElo</a>
        <a className={styles.navLink} href="/partie-eintragen">Partie eintragen</a>
      </nav>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Öffentliche Rangliste</p>
          <h1>Wer führt die Strecke an?</h1>
          <p className={styles.intro}>
            Die aktuellen Elo-Werte aller aktiven Spieler – berechnet aus bestätigten Partien.
          </p>
        </div>
        <div className={styles.playerCount}>
          <strong>{players.length}</strong>
          <span>aktive Spieler</span>
        </div>
      </header>

      <section className={styles.leaderboard} aria-labelledby="leaderboard-title">
        <div className={styles.tableHeading}>
          <div>
            <span>Stand jetzt</span>
            <h2 id="leaderboard-title">Rangliste</h2>
          </div>
          <p>Elo wird für die Anzeige auf ganze Zahlen gerundet.</p>
        </div>

        {loadError ? (
          <div className={styles.stateMessage} role="alert">
            <strong>Rangliste derzeit nicht verfügbar</strong>
            <span>Bitte versuche es in Kürze erneut.</span>
          </div>
        ) : players.length === 0 ? (
          <div className={styles.stateMessage}>
            <strong>Noch keine aktiven Spieler</strong>
            <span>Sobald Spieler angelegt wurden, erscheinen sie hier.</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Spieler</th>
                  <th scope="col">Partien</th>
                  <th scope="col">Elo</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={player.id} className={index < 3 ? styles.topPlayer : undefined}>
                    <td data-label="Rang">
                      <span className={styles.rank}>{index + 1}</span>
                    </td>
                    <td data-label="Spieler">
                      <div className={styles.playerIdentity}>
                        <PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={44} className={styles.avatar} />
                        <strong>{player.alias}</strong>
                      </div>
                    </td>
                    <td data-label="Partien">
                      <span className={styles.games}>{player._count.participations}</span>
                    </td>
                    <td data-label="Elo">
                      <strong className={styles.rating}>{Math.round(player.currentRating)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <span>Öffentlich sichtbar · keine Anmeldung erforderlich</span>
        <a href="/partie-eintragen">Neue Partie erfassen →</a>
      </footer>
    </main>
  );
}
