import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { formatElo } from "@/lib/format/elo";

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

      <section className={styles.leaderboard} aria-labelledby="leaderboard-title">
        <div className={styles.tableHeading}>
          <div>
            <span>Stand jetzt</span>
            <h2 id="leaderboard-title">Rangliste</h2>
          </div>
          <div className={styles.playerCount} aria-label={`${players.length} aktive Spieler`}>
            <strong>{players.length}</strong>
            <span>aktive Spieler</span>
          </div>
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
                      <PlayerAliasLink playerId={player.id} alias={player.alias} className={styles.playerIdentity}>
                        <PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={44} className={styles.avatar} />
                        <strong>{player.alias}</strong>
                      </PlayerAliasLink>
                    </td>
                    <td data-label="Partien">
                      <span className={styles.games}>{player._count.participations}</span>
                    </td>
                    <td data-label="Elo">
                      <strong className={styles.rating}>{formatElo(player.currentRating)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  );
}
