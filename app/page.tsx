import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Hauptnavigation">
        <a className={styles.brand} href="/">ZugUmZugElo</a>
        <a className={styles.navLink} href="/partie-eintragen">Partie eintragen</a>
      </nav>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Willkommen</p>
        <h1>ZugUmZugElo</h1>
        <p className={styles.intro}>
          Die gemeinsame Rangliste für eure Zug-um-Zug-Partien entsteht hier.
          Als erster Prototyp steht bereits die Partieerfassung bereit.
        </p>
        <a className={styles.primaryLink} href="/partie-eintragen">
          Partie eintragen <span aria-hidden="true">→</span>
        </a>
      </section>

      <footer className={styles.footer}>Weitere Bereiche folgen.</footer>
    </main>
  );
}
