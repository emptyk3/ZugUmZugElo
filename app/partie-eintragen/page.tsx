"use client";

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import { createPlayer, getGameFormOptions, saveGame } from "./actions";
import styles from "./page.module.css";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { reviewReasonLabel } from "@/lib/games/review-labels";
import { compressClientImage } from "@/lib/images/compress-client-image";

type PlayerOption = { id: string; alias: string; user?: { profileImageUrl: string | null } | null };
type MissionOption = { id: string; name: string };
type SavedGame = {
  gameId: string;
  status: "CONFIRMED" | "PENDING";
  reviewReasons: string[];
  results: Array<{
    playerId: string;
    alias: string;
    imageUrl: string | null;
    placement: number;
    ratingBefore: number;
    ratingChange: number;
    ratingAfter: number;
  }>;
};

type Participant = {
  id: number;
  playerId: string;
  player: string;
  playerQuery: string;
  imageUrl: string | null;
  points: string;
  mission: string;
  missionKept: boolean;
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
    playerId: "",
    player: "",
    playerQuery: "",
    imageUrl: null,
    points: "",
    mission: "",
    missionKept: true,
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ungültiger Zeitpunkt";
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default function AddGamePage() {
  const [playedAt, setPlayedAt] = useState(currentLocalDateTime);
  const [playerCount, setPlayerCount] = useState<4 | 5>(4);
  const [participants, setParticipants] = useState<Participant[]>(() =>
    Array.from({ length: 4 }, (_, index) => createParticipant(index + 1)),
  );
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [focusedPlayerId, setFocusedPlayerId] = useState<number | null>(null);
  const [newPlayerTargetId, setNewPlayerTargetId] = useState<number | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerLevel, setNewPlayerLevel] = useState<"beginner" | "advanced">("beginner");
  const [newPlayerError, setNewPlayerError] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoInfo, setPhotoInfo] = useState("");
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [mode, setMode] = useState<"edit" | "review" | "confirmation">("edit");
  const [tiebreakRanks, setTiebreakRanks] = useState<Record<number, string>>({});
  const [saveError, setSaveError] = useState("");
  const [savedGame, setSavedGame] = useState<SavedGame | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isCreatingPlayer, startCreatingPlayer] = useTransition();

  useEffect(() => {
    let active = true;
    getGameFormOptions()
      .then((options) => {
        if (!active) return;
        setPlayers(options.players);
        setMissions(options.missions);
      })
      .catch(() => {
        if (active) setOptionsError("Spieler und Missionen konnten nicht geladen werden.");
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function changePlayerCount(count: 4 | 5) {
    setPlayerCount(count);
    setParticipants((current) =>
      count === 5 && current.length === 4
        ? [...current, createParticipant(5)]
        : current.slice(0, count),
    );
    setTiebreakRanks({});
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
    setTiebreakRanks({});
    setSaveError("");
  }

  function updatePlayerQuery(id: number, query: string) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              playerId: participant.player === query ? participant.playerId : "",
              player: participant.player === query ? participant.player : "",
              playerQuery: query,
              imageUrl: participant.player === query ? participant.imageUrl : null,
            }
          : participant,
      ),
    );
    setTiebreakRanks({});
    setSaveError("");
  }

  function selectPlayer(id: number, player: PlayerOption) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id
          ? { ...participant, playerId: player.id, player: player.alias, playerQuery: player.alias, imageUrl: player.user?.profileImageUrl ?? null }
          : participant,
      ),
    );
    setFocusedPlayerId(null);
    setTiebreakRanks({});
    setSaveError("");
  }

  function availablePlayers(participantId: number, query: string) {
    const selectedElsewhere = new Set(
      participants
        .filter((participant) => participant.id !== participantId)
        .map(({ playerId }) => playerId)
        .filter(Boolean),
    );
    return players.filter(
      (player) =>
        !selectedElsewhere.has(player.id) &&
        player.alias.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")),
    );
  }

  function openNewPlayerDialog(targetId?: number) {
    const resolvedTarget =
      targetId ??
      focusedPlayerId ??
      participants.find(({ playerId }) => !playerId)?.id ??
      participants[0].id;
    setNewPlayerTargetId(resolvedTarget);
    setNewPlayerName("");
    setNewPlayerLevel("beginner");
    setNewPlayerError("");
    setFocusedPlayerId(null);
  }

  function closeNewPlayerDialog() {
    if (isCreatingPlayer) return;
    setNewPlayerTargetId(null);
    setNewPlayerError("");
  }

  function createAndSelectPlayer() {
    if (newPlayerTargetId === null || !newPlayerName.trim() || isCreatingPlayer) return;
    setNewPlayerError("");
    startCreatingPlayer(async () => {
      const result = await createPlayer({ alias: newPlayerName, level: newPlayerLevel });
      if (result.error || !result.player) {
        setNewPlayerError(result.error ?? "Der Spieler konnte nicht angelegt werden.");
        return;
      }
      setPlayers((current) =>
        [...current, result.player].sort((left, right) => left.alias.localeCompare(right.alias, "de")),
      );
      selectPlayer(newPlayerTargetId, result.player);
      setNewPlayerTargetId(null);
      setNewPlayerName("");
    });
  }

  function missionName(missionId: string) {
    return missions.find(({ id }) => id === missionId)?.name ?? "Keine Mission gewählt";
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPhotoError(""); setPhotoInfo("");
    if (!file) return;
    setIsPreparingPhoto(true);
    try {
      const optimized = await compressClientImage(file, "game");
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoName(optimized.name);
      setPhotoFile(optimized);
      setPhotoPreview(URL.createObjectURL(optimized));
      const mb = (bytes: number) => new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
      setPhotoInfo(`Bild optimiert: ${mb(file.size)} MB → ${mb(optimized.size)} MB`);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Das Bild konnte nicht verarbeitet werden.");
      event.target.value = "";
    } finally {
      setIsPreparingPhoto(false);
    }
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoName("");
    setPhotoFile(null);
    setPhotoError("");
    setPhotoInfo("");
    setPhotoInfo("");
  }

  const editValidation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const selectedPlayers = participants.map(({ playerId }) => playerId).filter(Boolean);
    const selectedDate = new Date(playedAt);
    const now = new Date();

    if (!playedAt || Number.isNaN(selectedDate.getTime())) {
      errors.push("Bitte gib Datum und Uhrzeit der Partie an.");
    } else {
      if (selectedDate.getTime() > now.getTime() + 5 * 60 * 1000) {
        errors.push("Die Partie darf nicht in der Zukunft liegen.");
      }
      if ((now.getTime() - selectedDate.getTime()) / 86_400_000 > 14) {
        warnings.push("Die Partie liegt mehr als 14 Tage zurück und sollte geprüft werden.");
      }
    }
    if ((playerCount !== 4 && playerCount !== 5) || participants.length !== playerCount) {
      errors.push("Eine Partie muss genau 4 oder 5 Spieler enthalten.");
    }
    if (selectedPlayers.length !== playerCount) {
      errors.push(`Bitte wähle alle ${playerCount} Spieler aus.`);
    }
    if (new Set(selectedPlayers).size !== selectedPlayers.length) {
      errors.push("Jeder Spieler darf nur einmal teilnehmen.");
    }
    participants.forEach((participant, index) => {
      const label = participant.player || `Teilnehmer ${index + 1}`;
      if (participant.points === "" || !Number.isInteger(Number(participant.points))) {
        errors.push(`${label}: Punkte müssen eine ganze Zahl sein.`);
      }
      if (!participant.mission) {
        errors.push(`${label}: Bitte wähle eine Mission aus.`);
      }
    });
    if (!photoFile) errors.push("Bitte füge ein Foto der Partie hinzu.");
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }, [participants, playedAt, playerCount, photoFile]);

  const tieGroups = useMemo(() => {
    const groups = new Map<number, Participant[]>();
    participants.forEach((participant) => {
      if (participant.points === "" || !Number.isInteger(Number(participant.points))) return;
      const points = Number(participant.points);
      groups.set(points, [...(groups.get(points) ?? []), participant]);
    });
    return [...groups.entries()]
      .filter(([, group]) => group.length > 1)
      .sort(([left], [right]) => right - left);
  }, [participants]);

  const tiebreakErrors = useMemo(() => {
    const errors: string[] = [];
    tieGroups.forEach(([points, group]) => {
      const values = group.map(({ id }) => tiebreakRanks[id] ?? "");
      if (values.some((value) => value === "")) {
        errors.push(`Bei ${points} Punkten fehlt noch eine vollständige Tiebreak-Reihenfolge.`);
        return;
      }
      const ranks = values.map(Number);
      const expected = Array.from({ length: group.length }, (_, index) => index + 1);
      if ([...ranks].sort((a, b) => a - b).some((rank, index) => rank !== expected[index])) {
        errors.push(`Bei ${points} Punkten muss jeder Rang von 1 bis ${group.length} genau einmal vergeben sein.`);
      }
    });
    return errors;
  }, [tieGroups, tiebreakRanks]);

  const ranking = useMemo<RankedParticipant[]>(() => {
    return [...participants]
      .map((participant) => ({
        ...participant,
        numericPoints: Number(participant.points),
        place: 0,
      }))
      .sort((left, right) => {
        if (left.numericPoints !== right.numericPoints) return right.numericPoints - left.numericPoints;
        return Number(tiebreakRanks[left.id] || Number.MAX_SAFE_INTEGER) - Number(tiebreakRanks[right.id] || Number.MAX_SAFE_INTEGER);
      })
      .map((participant, index) => ({ ...participant, place: index + 1 }));
  }, [participants, tiebreakRanks]);

  const reviewReady = editValidation.errors.length === 0 && tiebreakErrors.length === 0;

  function enterReview() {
    if (editValidation.errors.length > 0) return;
    setMode("review");
    setSaveError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToEdit() {
    setMode("edit");
    setSaveError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function persistReviewedGame() {
    if (!reviewReady || isSaving) return;
    setSaveError("");
    startSaving(async () => {
      const result = await saveGame({
        playedAt: new Date(playedAt).toISOString(),
        participants: participants.map((participant) => ({
          playerId: participant.playerId,
          points: Number(participant.points),
          missionId: participant.mission,
          missionKept: participant.missionKept,
          tiebreakRank: tiebreakRanks[participant.id]
            ? Number(tiebreakRanks[participant.id])
            : undefined,
        })),
      }, photoFile);
      if ("error" in result) {
        setSaveError(result.error);
        return;
      }
      setSavedGame(result);
      setMode("confirmation");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function startNewGame() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPlayedAt(currentLocalDateTime());
    setPlayerCount(4);
    setParticipants(Array.from({ length: 4 }, (_, index) => createParticipant(index + 1)));
    setPhotoName("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError("");
    setTiebreakRanks({});
    setSaveError("");
    setSavedGame(null);
    setMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatRating(value: number) {
    return new Intl.NumberFormat("de-AT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <a className={styles.backLink} href="/">← Zur Übersicht</a>
        <div className={styles.eyebrow}>{mode === "edit" ? "Neue Wertung" : mode === "review" ? "Prüfschritt" : "Gespeichert"}</div>
        <h1>{mode === "edit" ? "Partie eintragen" : mode === "review" ? "Partie prüfen" : "Partie gespeichert"}</h1>
        <p>{mode === "edit" ? "Erfasse das Ergebnis eurer Runde." : mode === "review" ? "Kontrolliere alle Angaben und löse mögliche Punktegleichstände auf." : "Die Elo-Werte wurden erfolgreich aktualisiert."}</p>
        <div className={styles.prototypeBadge}>{mode === "confirmation" ? "Ergebnis bestätigt" : "ZugUmZugElo"}</div>
      </header>

      {mode === "edit" ? (
        <div className={styles.layout}>
          <form className={styles.formColumn} onSubmit={(event) => event.preventDefault()} noValidate>
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div><span>01</span><h2>Zeitpunkt</h2></div>
                <p>Wann wurde gespielt?</p>
              </div>
              <label className={styles.field}>
                <span>Datum und Uhrzeit</span>
                <input type="datetime-local" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} />
              </label>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div><span>02</span><h2>Teilnehmer</h2></div>
                <p>Wer saß am Tisch?</p>
              </div>
              <div className={styles.segmented} aria-label="Anzahl der Spieler">
                {([4, 5] as const).map((count) => (
                  <button key={count} type="button" className={playerCount === count ? styles.segmentActive : ""} onClick={() => changePlayerCount(count)} aria-pressed={playerCount === count}>
                    {count} Spieler
                  </button>
                ))}
              </div>

              {optionsLoading && <p className={styles.infoMessage}>Spieler und Missionen werden geladen…</p>}
              {optionsError && <p className={styles.inlineError}>{optionsError}</p>}

              <div className={styles.participantGrid}>
                {participants.map((participant, index) => {
                  const suggestions = availablePlayers(participant.id, participant.playerQuery);
                  const showSuggestions = focusedPlayerId === participant.id && !participant.player;
                  return (
                    <article className={styles.participantCard} key={participant.id}>
                      <div className={styles.cardTitle}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <PlayerAvatar imageUrl={participant.imageUrl} alias={participant.player || `Teilnehmer ${index + 1}`} size={38} />
                        <h3>{participant.playerId ? <PlayerAliasLink playerId={participant.playerId} alias={participant.player} /> : `Teilnehmer ${index + 1}`}</h3>
                      </div>
                      <div className={styles.autocomplete}>
                        <label className={styles.field}>
                          <span>Spieler suchen</span>
                          <input
                            type="search"
                            role="combobox"
                            aria-expanded={showSuggestions}
                            aria-controls={`player-options-${participant.id}`}
                            autoComplete="off"
                            placeholder="Alias eingeben"
                            value={participant.playerQuery}
                            onFocus={() => setFocusedPlayerId(participant.id)}
                            onBlur={() => window.setTimeout(() => setFocusedPlayerId(null), 100)}
                            onChange={(event) => updatePlayerQuery(participant.id, event.target.value)}
                          />
                        </label>
                        {showSuggestions && (
                          <ul className={styles.suggestions} id={`player-options-${participant.id}`} role="listbox">
                            {suggestions.length > 0 ? suggestions.map((player) => (
                              <li key={player.id}>
                                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectPlayer(participant.id, player)}>
                                  <PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={30} />
                                  {player.alias}
                                </button>
                              </li>
                            )) : <li className={styles.noSuggestion}>Kein verfügbarer Alias gefunden.</li>}
                            <li className={styles.createSuggestion}>
                              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => openNewPlayerDialog(participant.id)}>＋ Spieler nicht gefunden? Neu anlegen</button>
                            </li>
                          </ul>
                        )}
                      </div>
                      <label className={styles.field}>
                        <span>Punkte</span>
                        <input type="number" step="1" placeholder="z. B. 126" value={participant.points} onChange={(event) => updateParticipant(participant.id, "points", event.target.value)} />
                      </label>
                      <label className={styles.field}>
                        <span>Mission</span>
                        <select value={participant.mission} onChange={(event) => updateParticipant(participant.id, "mission", event.target.value)}>
                          <option value="">Bitte auswählen</option>
                          {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}
                        </select>
                      </label>
                      <label className={styles.checkboxRow}>
                        <input type="checkbox" checked={!participant.missionKept} onChange={(event) => updateParticipant(participant.id, "missionKept", !event.target.checked)} />
                        Mission nicht behalten
                      </label>
                    </article>
                  );
                })}
              </div>

              <button className={styles.addButton} type="button" onClick={() => openNewPlayerDialog()}><span>＋</span> Neuer Spieler</button>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div><span>03</span><h2>Belegfoto</h2></div>
                <p>Pflichtfeld · wird sicher gespeichert</p>
              </div>
              {!photoPreview ? (
                <label className={styles.uploadArea}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} required disabled={isPreparingPhoto} />
                  <span className={styles.uploadIcon}>＋</span><strong>Foto auswählen</strong><small>JPG, PNG oder WebP · Original maximal 15 MB</small>
                </label>
              ) : (
                <div className={styles.photoPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Lokale Vorschau des Ergebnisfotos" />
                  <div><span>{photoName}</span><button type="button" onClick={removePhoto}>Entfernen</button></div>
                </div>
              )}
              {isPreparingPhoto && <p>Bild wird vorbereitet …</p>}{photoInfo && <p>{photoInfo}</p>}
              {photoError && <p className={styles.inlineError}>{photoError}</p>}
            </section>
          </form>

          <aside className={styles.summaryColumn}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryTopline}><span>Live-Vorschau</span><i /></div>
              <h2>Partiezusammenfassung</h2>
              <dl className={styles.singleStat}><div><dt>Spieler</dt><dd>{playerCount}</dd></div></dl>
              <ol className={styles.ranking}>
                {ranking.map((participant) => (
                  <li key={participant.id}>
                    <span className={styles.place}>{participant.place}</span>
                    <PlayerAvatar imageUrl={participant.imageUrl} alias={participant.player || "Noch offen"} size={38} />
                    <div><strong>{participant.playerId ? <PlayerAliasLink playerId={participant.playerId} alias={participant.player} /> : "Noch offen"}</strong><small>{missionName(participant.mission)}{!participant.missionKept ? " · nicht behalten" : ""}</small></div>
                    <b>{participant.points || "–"}<small> Pkt.</small></b>
                  </li>
                ))}
              </ol>
              <div className={styles.validation}>
                <h3>Plausibilitätsprüfung</h3>
                {editValidation.errors.length === 0 && editValidation.warnings.length === 0 ? <p className={styles.success}>✓ Bereit für den Prüfschritt.</p> : <>
                  {editValidation.errors.map((error) => <p className={styles.error} key={error}>× {error}</p>)}
                  {editValidation.warnings.map((warning) => <p className={styles.warning} key={warning}>! {warning}</p>)}
                </>}
              </div>
              <button className={styles.primaryButton} type="button" disabled={editValidation.errors.length > 0 || isPreparingPhoto} onClick={enterReview}>Partie prüfen</button>
              <p className={styles.noSave}>Tiebreaks werden bei Bedarf im nächsten Schritt festgelegt.</p>
            </div>
          </aside>
        </div>
      ) : mode === "review" ? (
        <section className={styles.reviewShell}>
          <div className={styles.reviewMeta}>
            <div><span>Datum und Uhrzeit</span><strong>{formatDateTime(playedAt)}</strong></div>
            <div><span>Teilnehmerzahl</span><strong>{playerCount} Spieler</strong></div>
            <div><span>Foto</span><strong>{photoName || "Kein Foto gewählt"}</strong></div>
          </div>

          {tieGroups.length > 0 && (
            <div className={styles.tiebreakSection}>
              <div className={styles.sectionHeading}>
                <div><span>!</span><h2>Tiebreak festlegen</h2></div>
                <p>Jeden Rang genau einmal vergeben</p>
              </div>
              {tieGroups.map(([points, group]) => (
                <fieldset className={styles.tieGroup} key={points}>
                  <legend>{points} Punkte · {group.length} Spieler</legend>
                  {group.map((participant) => (
                    <label key={participant.id}>
                      <PlayerAvatar imageUrl={participant.imageUrl} alias={participant.player} size={34} />
                      <span><PlayerAliasLink playerId={participant.playerId} alias={participant.player} /></span>
                      <select value={tiebreakRanks[participant.id] ?? ""} onChange={(event) => setTiebreakRanks((current) => ({ ...current, [participant.id]: event.target.value }))}>
                        <option value="">Rang wählen</option>
                        {Array.from({ length: group.length }, (_, index) => index + 1).map((rank) => <option key={rank} value={rank}>{rank}. im Gleichstand</option>)}
                      </select>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          )}

          <div className={styles.reviewCard}>
            <div className={styles.summaryTopline}><span>Prüfansicht</span><i /></div>
            <h2>Berechnete Platzierungen</h2>
            <ol className={styles.reviewRanking}>
              {ranking.map((participant) => (
                <li key={participant.id}>
                  <span className={styles.reviewPlace}>{participant.place}</span>
                  <PlayerAvatar imageUrl={participant.imageUrl} alias={participant.player} size={42} />
                  <div className={styles.reviewPlayer}><strong><PlayerAliasLink playerId={participant.playerId} alias={participant.player} /></strong><small>{missionName(participant.mission)}{!participant.missionKept && <em>Mission nicht behalten</em>}</small></div>
                  <b>{participant.points} <small>Punkte</small></b>
                </li>
              ))}
            </ol>
          </div>

          {tiebreakErrors.length > 0 && <div className={styles.reviewErrors}>{tiebreakErrors.map((error) => <p key={error}>× {error}</p>)}</div>}
          {saveError && <div className={styles.reviewErrors} role="alert"><p>× {saveError}</p></div>}
          <div className={styles.reviewActions}>
            <button className={styles.secondaryButton} type="button" onClick={returnToEdit}>Zurück zur Bearbeitung</button>
            <button className={styles.primaryButton} type="button" disabled={!reviewReady || isSaving} onClick={persistReviewedGame}>{isSaving ? "Bild wird hochgeladen …" : "Partie speichern"}</button>
          </div>
          <p className={styles.noSave}>Partie und Elo-Änderungen werden gemeinsam gespeichert.</p>
        </section>
      ) : (
        <section className={styles.confirmationShell}>
          <div className={styles.confirmationMark} aria-hidden="true">✓</div>
          <h2>{savedGame?.status === "PENDING" ? "Die Partie wartet auf Prüfung." : "Die Partie wurde gespeichert."}</h2>
          <p>{savedGame?.status === "PENDING" ? `Noch keine Elo-Änderung. ${savedGame.reviewReasons.map(reviewReasonLabel).join(" · ")}.` : "Alle Elo-Änderungen wurden atomar übernommen."}</p>
          {photoPreview && <a href={photoPreview} target="_blank" rel="noreferrer" className={styles.savedPhoto}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Foto der gespeicherten Partie in größerer Ansicht öffnen" />
          </a>}
          {savedGame?.status === "CONFIRMED" && <ol className={styles.eloResults}>
            {savedGame?.results.map((result) => (
              <li key={result.playerId}>
                <span className={styles.reviewPlace}>{result.placement}</span>
                <PlayerAvatar imageUrl={result.imageUrl} alias={result.alias} size={42} />
                <div>
                  <strong><PlayerAliasLink playerId={result.playerId} alias={result.alias} /></strong>
                  <small>{formatRating(result.ratingBefore)} → {formatRating(result.ratingAfter)} Elo</small>
                </div>
                <b className={result.ratingChange >= 0 ? styles.positiveChange : styles.negativeChange}>
                  {result.ratingChange >= 0 ? "+" : ""}{formatRating(result.ratingChange)}
                </b>
              </li>
            ))}
          </ol>}
          <div className={styles.reviewActions}>
            <button className={styles.secondaryButton} type="button" onClick={startNewGame}>Neue Partie</button>
            <a className={styles.primaryLink} href="/">Zur Rangliste</a>
          </div>
        </section>
      )}

      {newPlayerTargetId !== null && (
        <div className={styles.dialogBackdrop} role="presentation">
          <section className={styles.playerDialog} role="dialog" aria-modal="true" aria-labelledby="new-player-title">
            <button className={styles.dialogClose} type="button" onClick={closeNewPlayerDialog} aria-label="Dialog schließen">×</button>
            <div className={styles.eyebrow}>Spieler nicht gefunden</div>
            <h2 id="new-player-title">Neuen Spieler anlegen</h2>
            <p>Der Spieler wird sofort in der Datenbank angelegt und für diese Partie ausgewählt.</p>
            <label className={styles.field}>
              <span>Alias</span>
              <input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="Spieler-Alias" maxLength={80} autoFocus />
            </label>
            <fieldset className={styles.levelChoice}>
              <legend>Startniveau</legend>
              <label><input type="radio" name="level" checked={newPlayerLevel === "beginner"} onChange={() => setNewPlayerLevel("beginner")} /><span><strong>Anfänger</strong><small>Startet mit 1200 Elo</small></span></label>
              <label><input type="radio" name="level" checked={newPlayerLevel === "advanced"} onChange={() => setNewPlayerLevel("advanced")} /><span><strong>Fortgeschritten</strong><small>Startet mit 1500 Elo</small></span></label>
            </fieldset>
            {newPlayerError && <p className={styles.inlineError} role="alert">{newPlayerError}</p>}
            <div className={styles.dialogActions}>
              <button className={styles.secondaryButton} type="button" onClick={closeNewPlayerDialog} disabled={isCreatingPlayer}>Abbrechen</button>
              <button className={styles.primaryButton} type="button" onClick={createAndSelectPlayer} disabled={!newPlayerName.trim() || isCreatingPlayer}>{isCreatingPlayer ? "Wird angelegt…" : "Spieler anlegen"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
