"use client";

import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGame } from "./actions";

type Option = { id: string; label: string; active?: boolean };
type Row = { playerId: string; points: string; missionId: string; missionKept: boolean; tiebreakRank: string };
type Props = { gameId: string; playedAt: string; hasPhoto: boolean; participants: Row[]; players: Option[]; missions: Option[]; initialOpen?: boolean };

export default function GameEditor(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  const [playedAt, setPlayedAt] = useState(props.playedAt);
  const [rows, setRows] = useState(props.participants);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const valid = useMemo(() => {
    const ids = rows.map((row) => row.playerId).filter(Boolean);
    return (rows.length === 4 || rows.length === 5) && ids.length === rows.length && new Set(ids).size === ids.length &&
      rows.every((row) => row.points !== "" && Number.isInteger(Number(row.points)) && row.missionId) &&
      (props.hasPhoto || Boolean(photo)) && !photoError;
  }, [rows, photo, photoError, props.hasPhoto]);

  function update(index: number, patch: Partial<Row>) { setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  function changeCount(count: number) {
    setRows((current) => count === 5 && current.length === 4
      ? [...current, { playerId: "", points: "", missionId: "", missionKept: true, tiebreakRank: "" }]
      : current.slice(0, count));
  }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null; setPhotoError(""); setPhoto(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setPhotoError("Bitte wähle JPEG, PNG oder WebP aus.");
    if (file.size > 2 * 1024 * 1024 || file.size <= 0) return setPhotoError("Das Foto darf höchstens 2 MB groß sein.");
    setPhoto(file);
  }
  function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); if (!valid || !window.confirm("Partie wirklich ändern? Bei älteren Partien werden spätere Elo-Werte neu berechnet.")) return;
    const formData = new FormData();
    formData.set("payload", JSON.stringify({ playedAt: new Date(playedAt).toISOString(), reason, participants: rows.map((row) => ({ playerId: row.playerId, points: Number(row.points), missionId: row.missionId, missionKept: row.missionKept, tiebreakRank: row.tiebreakRank ? Number(row.tiebreakRank) : undefined })) }));
    if (photo) formData.set("photo", photo);
    startTransition(async () => { const result = await updateGame(props.gameId, formData); if ("error" in result) setMessage(result.error ?? "Die Partie konnte nicht bearbeitet werden."); else { setMessage("Partie erfolgreich aktualisiert."); setOpen(false); router.refresh(); } });
  }

  if (!open) return <div className="actions"><button type="button" onClick={() => setOpen(true)}>Partie bearbeiten</button>{message && <span className="form-success">{message}</span>}</div>;
  return <section>
    <h2>Partie bearbeiten</h2>
    <p className="form-error"><strong>Hinweis:</strong> Änderungen an einer älteren Partie können die Elo-Werte aller späteren Partien neu berechnen.</p>
    <form className="account-form" onSubmit={submit}>
      <label>Datum und Uhrzeit<input type="datetime-local" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} required /></label>
      <label>Teilnehmerzahl<select value={rows.length} onChange={(event) => changeCount(Number(event.target.value))}><option value={4}>4 Spieler</option><option value={5}>5 Spieler</option></select></label>
      {rows.map((row, index) => <fieldset className="data-row" key={index}><legend>Teilnehmer {index + 1}</legend>
        <label>Spieler<select value={row.playerId} onChange={(event) => update(index, { playerId: event.target.value })} required><option value="">Auswählen</option>{props.players.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
        <label>Punkte<input type="number" step="1" value={row.points} onChange={(event) => update(index, { points: event.target.value })} required /></label>
        <label>Mission<select value={row.missionId} onChange={(event) => update(index, { missionId: event.target.value })} required><option value="">Auswählen</option>{props.missions.map((option) => <option value={option.id} key={option.id}>{option.label}{option.active === false ? " (historisch)" : ""}</option>)}</select></label>
        <label><input type="checkbox" checked={!row.missionKept} onChange={(event) => update(index, { missionKept: !event.target.checked })} /> Mission nicht behalten</label>
        <label>Tiebreak-Rang (nur bei Punktegleichstand)<input type="number" min="1" step="1" value={row.tiebreakRank} onChange={(event) => update(index, { tiebreakRank: event.target.value })} /></label>
      </fieldset>)}
      <label>{props.hasPhoto ? "Foto ersetzen (optional)" : "Foto ergänzen (Pflicht)"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} required={!props.hasPhoto} /></label>
      {photoError && <p className="form-error">{photoError}</p>}
      <label>Admin-Kommentar / Änderungsgrund<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {message && <p className="form-error" role="alert">{message}</p>}
      <div className="actions"><button type="button" onClick={() => setOpen(false)} disabled={pending}>Abbrechen</button><button disabled={!valid || pending}>{pending ? "Wird gespeichert…" : "Änderungen speichern"}</button></div>
    </form>
  </section>;
}
