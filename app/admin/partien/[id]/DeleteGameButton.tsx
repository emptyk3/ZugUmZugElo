"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteGame } from "./actions";

export default function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function confirmDelete() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await deleteGame(gameId);
      if ("error" in result) { setError(result.error ?? "Die Partie konnte nicht gelöscht werden."); return; }
      router.push("/admin/partien?geloescht=1"); router.refresh();
    });
  }
  return <section className="danger">
    <h2>Gefahrenbereich</h2><p>Die Partie und ihre Teilnehmerdaten werden endgültig entfernt.</p>
    <button type="button" onClick={() => { setError(""); setOpen(true); }}>🗑 Partie löschen</button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="delete-game-title" className="data-row">
      <h3 id="delete-game-title">Partie wirklich löschen?</h3>
      <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
      <p>Alle Elo-Werte und Statistiken werden anschließend automatisch neu berechnet.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions"><button type="button" onClick={() => setOpen(false)} disabled={pending}>Abbrechen</button><button type="button" onClick={confirmDelete} disabled={pending}>{pending ? "Partie wird gelöscht …" : "Endgültig löschen"}</button></div>
    </div>}
  </section>;
}
