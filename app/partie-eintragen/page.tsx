"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const MISSIONS = [
  "Brest – Petrograd",
  "Cádiz – Stockholm",
  "Edinburgh – Athína",
  "København – Erzurum",
  "Lisboa – Danzig",
  "Palermo – Moskva",
];

const INITIAL_PLAYERS = [
  "Anna",
  "Ben",
  "Clara",
  "David",
  "Elif",
  "Felix",
  "Greta",
  "Hannes",
];

type Participant = {
  id: number;
  player: string;
  points: string;
  mission: string;
  missionKept: boolean;
  tiebreak: string;
};

type RankedParticipant = Participant & {
  numericPoints: number;
  place: number;
};

function currentLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function createParticipant(id: number): Participant {
  return {
    id,
    player: "",
    points: "",
    mission: "",
    missionKept: false,
    tiebreak: "",
  };
}

export default function AddGamePage() {
  const [playedAt, setPlayedAt] = useState(currentLocalDateTime);
  const [isBackdated, setIsBackdated] = useState(false);
  const [playerCount, setPlayerCount] = useState<4 | 5>(4);
  const [participants, setParticipants] = useState<Participant[]>(() =>
    Array.from({ length: 4 }, (_, index) => createParticipant(index + 1)),
  );
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function changePlayerCount(count: 4 | 5) {
    setPlayerCount(count);
    setParticipants((current) => {
      if (count === 5 && current.length === 4) {
        return [...current, createParticipant(5)];
      }
      return current.slice(0, count);
    });
  }

  function updateParticipant<K extends keyof Participant>(
    id: number,
    field: K,
    value: Participant[K],
  ) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id ? { ...participant, [field]: value } : participant,
      ),
    );
  }

  function addMockPlayer() {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName || players.some((player) => player.toLowerCase() === trimmedName.toLowerCase())) {
      return;
    }
    setPlayers((current) => [...current, trimmedName]);
    setNewPlayerName("");
    setShowNewPlayer(false);
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPhotoError("");

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Bitte wähle eine Bilddatei aus.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Das Foto darf höchstens 5 MB groß sein.");
      event.target.value = "";
      return;
    }

    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoName(file.name);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoName("");
    setPhotoError("");
  }

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const selectedPlayers = participants.map(({ player }) => player).filter(Boolean);
    const selectedDate = new Date(playedAt);
    const now = new Date();

    if (!playedAt || Number.isNaN(selectedDate.getTime())) {
      errors.push("Bitte gib Datum und Uhrzeit der Partie an.");
    } else {
      if (selectedDate.getTime() > now.getTime() + 5 * 60 * 1000) {
        errors.push("Die Partie darf nicht in der Zukunft liegen.");
      }
      const ageInDays = (now.getTime() - selectedDate.getTime()) / 86_400_000;
      if (ageInDays > 14) {
        warnings.push("Die Partie liegt mehr als 14 Tage zurück und sollte geprüft werden.");
      }
    }

    if (selectedPlayers.length !== playerCount) {
      errors.push(`Bitte wähle alle ${playerCount} Spieler aus.`);
    }
    if (new Set(selectedPlayers).size !== selectedPlayers.length) {
      errors.push("Jeder Spieler darf nur einmal teilnehmen.");
    }

    participants.forEach((participant, index) => {
      const label = participant.player || `Teilnehmer ${index + 1}`;
      const points = Number(participant.points);
      if (participant.points === "" || !Number.isInteger(points) || points < 0 || points > 300) {
        errors.push(`${label}: Punkte müssen eine ganze Zahl zwischen 0 und 300 sein.`);
      }
      if (!participant.mission) {
        errors.push(`${label}: Bitte wähle eine Mission aus.`);
      }
      if (participant.tiebreak && (!Number.isInteger(Number(participant.tiebreak)) || Number(participant.tiebreak) < 1)) {
        errors.push(`${label}: Der Tiebreak muss eine positive ganze Zahl sein.`);
      }
      if (participant.missionKept && points < 80) {
        warnings.push(`${label}: Mission behalten bei weniger als 80 Punkten prüfen.`);
      }
    });

    const groups = new Map<string, Participant[]>();
    participants.forEach((participant) => {
      if (participant.points === "") return;
      const group = groups.get(participant.points) ?? [];
      group.push(participant);
      groups.set(participant.points, group);
    });
    groups.forEach((group, points) => {
      if (group.length > 1 && group.some(({ tiebreak }) => !tiebreak)) {
        errors.push(`Bei ${points} Punkten ist für alle Gleichplatzierten ein Tiebreak nötig.`);
      }
      const tiebreaks = group.map(({ tiebreak }) => tiebreak).filter(Boolean);
      if (new Set(tiebreaks).size !== tiebreaks.length) {
        errors.push(`Bei ${points} Punkten müssen die Tiebreak-Werte eindeutig sein.`);
      }
    });

    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }, [isBackdated, participants, playedAt, playerCount]);

  const ranking = useMemo<RankedParticipant[]>(() => {
    const sorted = participants
      .map((participant) => ({
        ...participant,
        numericPoints: participant.points === "" ? 0 : Number(participant.points),
        place: 0,
      }))
      .sort((a, b) => {
        const pointDifference = b.numericPoints - a.numericPoints;
        if (pointDifference !== 0) return pointDifference;
        const aTiebreak = a.tiebreak ? Number(a.tiebreak) : Number.MAX_SAFE_INTEGER;
        const bTiebreak = b.tiebreak ? Number(b.tiebreak) : Number.MAX_SAFE_INTEGER;
        return aTiebreak - bTiebreak;
      });

    return sorted.map((participant, index) => ({ ...participant, place: index + 1 }));
  }, [participants]);

  const totalPoints = participants.reduce(
    (sum, participant) => sum + (Number(participant.points) || 0),
    0,
  );

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <a className={styles.backLink} href="/">← Zur Übersicht</a>
        <div className={styles.eyebrow}>Neue Wertung</div>
        <h1>Partie eintragen</h1>
        <p>Erfasse das Ergebnis eurer Runde. Deine Eingaben werden hier nur als Vorschau verarbeitet.</p>
        <div className={styles.prototypeBadge}>UI-Prototyp · keine Speicherung</div>
      </header>

      <div className={styles.layout}>
        <form className={styles.formColumn} onSubmit={(event) => event.preventDefault()} noValidate>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><span>01</span><h2>Zeitpunkt</h2></div>
              <p>Wann wurde gespielt?</p>
            </div>
            <label className={styles.field}>
              <span>Datum und Uhrzeit</span>
              <input
                type="datetime-local"
                value={playedAt}
                max={currentLocalDateTime()}
                onChange={(event) => setPlayedAt(event.target.value)}
              />
            </label>
            <label className={styles.switchRow}>
              <input
                type="checkbox"
                checked={isBackdated}
                onChange={(event) => setIsBackdated(event.target.checked)}
              />
              <span><strong>Frühere Partie nachtragen</strong><small>Öffnet den Hinweis zum Rückdatieren.</small></span>
            </label>
            {isBackdated && (
              <div className={styles.infoBox}>Rückdatierte Partien können später eine zusätzliche Prüfung benötigen.</div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><span>02</span><h2>Teilnehmer</h2></div>
              <p>Wer saß am Tisch?</p>
            </div>
            <div className={styles.segmented} aria-label="Anzahl der Spieler">
              {([4, 5] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  className={playerCount === count ? styles.segmentActive : ""}
                  onClick={() => changePlayerCount(count)}
                  aria-pressed={playerCount === count}
                >
                  {count} Spieler
                </button>
              ))}
            </div>

            <div className={styles.participantGrid}>
              {participants.map((participant, index) => (
                <article className={styles.participantCard} key={participant.id}>
                  <div className={styles.cardTitle}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{participant.player || `Teilnehmer ${index + 1}`}</h3>
                  </div>
                  <label className={styles.field}>
                    <span>Spieler</span>
                    <select
                      value={participant.player}
                      onChange={(event) => updateParticipant(participant.id, "player", event.target.value)}
                    >
                      <option value="">Bitte auswählen</option>
                      {players.map((player) => <option key={player} value={player}>{player}</option>)}
                    </select>
                  </label>
                  <div className={styles.twoColumns}>
                    <label className={styles.field}>
                      <span>Punkte</span>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        placeholder="z. B. 126"
                        value={participant.points}
                        onChange={(event) => updateParticipant(participant.id, "points", event.target.value)}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Tiebreak</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="optional"
                        value={participant.tiebreak}
                        onChange={(event) => updateParticipant(participant.id, "tiebreak", event.target.value)}
                      />
                    </label>
                  </div>
                  <label className={styles.field}>
                    <span>Mission</span>
                    <select
                      value={participant.mission}
                      onChange={(event) => updateParticipant(participant.id, "mission", event.target.value)}
                    >
                      <option value="">Bitte auswählen</option>
                      {MISSIONS.map((mission) => <option key={mission} value={mission}>{mission}</option>)}
                    </select>
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={participant.missionKept}
                      onChange={(event) => updateParticipant(participant.id, "missionKept", event.target.checked)}
                    />
                    Mission behalten
                  </label>
                </article>
              ))}
            </div>

            <button className={styles.addButton} type="button" onClick={() => setShowNewPlayer((value) => !value)}>
              <span>＋</span> Neuer Spieler
            </button>
            {showNewPlayer && (
              <div className={styles.newPlayerPanel}>
                <label className={styles.field}>
                  <span>Name des Mock-Spielers</span>
                  <input
                    value={newPlayerName}
                    onChange={(event) => setNewPlayerName(event.target.value)}
                    placeholder="Vorname oder Alias"
                    autoFocus
                  />
                </label>
                <button type="button" onClick={addMockPlayer} disabled={!newPlayerName.trim()}>Zur Liste hinzufügen</button>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><span>03</span><h2>Belegfoto</h2></div>
              <p>Optional, nur lokal angezeigt</p>
            </div>
            {!photoPreview ? (
              <label className={styles.uploadArea}>
                <input type="file" accept="image/*" onChange={handlePhoto} />
                <span className={styles.uploadIcon}>＋</span>
                <strong>Foto auswählen</strong>
                <small>JPG, PNG oder WebP · maximal 5 MB</small>
              </label>
            ) : (
              <div className={styles.photoPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Lokale Vorschau des Ergebnisfotos" />
                <div><span>{photoName}</span><button type="button" onClick={removePhoto}>Entfernen</button></div>
              </div>
            )}
            {photoError && <p className={styles.inlineError}>{photoError}</p>}
          </section>
        </form>

        <aside className={styles.summaryColumn}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTopline}><span>Live-Vorschau</span><i /></div>
            <h2>Partiezusammenfassung</h2>
            <dl className={styles.stats}>
              <div><dt>Spieler</dt><dd>{playerCount}</dd></div>
              <div><dt>Punkte gesamt</dt><dd>{totalPoints}</dd></div>
              <div><dt>Ø Punkte</dt><dd>{Math.round(totalPoints / playerCount)}</dd></div>
            </dl>
            <ol className={styles.ranking}>
              {ranking.map((participant) => (
                <li key={participant.id}>
                  <span className={styles.place}>{participant.place}</span>
                  <div><strong>{participant.player || "Noch offen"}</strong><small>{participant.mission || "Keine Mission gewählt"}</small></div>
                  <b>{participant.points || "–"}<small> Pkt.</small></b>
                </li>
              ))}
            </ol>

            <div className={styles.validation}>
              <h3>Plausibilitätsprüfung</h3>
              {validation.errors.length === 0 && validation.warnings.length === 0 ? (
                <p className={styles.success}>✓ Alle Eingaben wirken plausibel.</p>
              ) : (
                <>
                  {validation.errors.map((error) => <p className={styles.error} key={error}>× {error}</p>)}
                  {validation.warnings.map((warning) => <p className={styles.warning} key={warning}>! {warning}</p>)}
                </>
              )}
            </div>

            <button className={styles.primaryButton} type="button" disabled={validation.errors.length > 0}>
              Partie prüfen
            </button>
            <p className={styles.noSave}>Dieser Prototyp übermittelt oder speichert keine Daten.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
