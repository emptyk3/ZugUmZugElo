"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePlayerInitialRating } from "./actions";

export default function InitialRatingForm({ playerId, currentInitialRating }: { playerId: string; currentInitialRating: number }) {
  const router = useRouter();
  const [rating, setRating] = useState(String(currentInitialRating));
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = Number(rating);
  const valid = (selected === 1200 || selected === 1500) && selected !== currentInitialRating && reason.trim().length > 0 && confirmed;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!valid) return;
    const formData = new FormData(event.currentTarget); setMessage(null);
    startTransition(async () => {
      const result = await changePlayerInitialRating(playerId, formData);
      if (result.error) setMessage({ type: "error", text: result.error });
      else { setMessage({ type: "success", text: result.success ?? "Das Start-Elo wurde geändert." }); setReason(""); setConfirmed(false); router.refresh(); }
    });
  }
  return <section><h2>Start-Elo</h2><p>Aktuelles Start-Elo: <strong>{Math.round(currentInitialRating)}</strong></p>
    <p className="form-error"><strong>Warnung:</strong> Die Änderung des Start-Elo kann die Elo-Werte dieses Spielers, seiner Gegner und aller späteren Partien verändern.</p>
    <form className="account-form" onSubmit={submit}>
      <label>Neues Start-Elo<select name="initialRating" value={rating} onChange={(event) => setRating(event.target.value)} required><option value="1200">1200 – Anfänger</option><option value="1500">1500 – Fortgeschritten</option></select></label>
      <label>Änderungsgrund<textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
      <label><input type="checkbox" name="confirmed" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required /> Ich bestätige, dass dadurch alle Elo-Werte ab der ersten Partie dieses Spielers neu berechnet werden.</label>
      {message && <p className={message.type === "error" ? "form-error" : "form-success"} role="status">{message.text}</p>}
      <button disabled={!valid || pending}>{pending ? "Elo wird neu berechnet…" : "Start-Elo ändern und Elo neu berechnen"}</button>
    </form>
  </section>;
}
