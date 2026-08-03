"use client";

import { useRef, useState, useTransition } from "react";
import { reportGame } from "./actions";
import styles from "../page.module.css";

export default function ReportGameButton({ gameId }: { gameId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setFeedback("");
    startTransition(async () => {
      const result = await reportGame(gameId, message);
      if ("error" in result) return setFeedback(result.error ?? "Die Meldung konnte nicht gesendet werden.");
      setMessage("");
      setFeedback("Danke. Die Meldung wurde an die Administration gesendet.");
      dialog.current?.close();
    });
  }

  return <>
    <button className={styles.reportButton} type="button" onClick={() => { setFeedback(""); dialog.current?.showModal(); }}>Partie melden</button>
    {feedback && <p className={styles.reportFeedback} role="status">{feedback}</p>}
    <dialog ref={dialog} className={styles.reportDialog} onClose={() => setMessage("")}>
      <div className={styles.reportDialogHead}><h2>Partie melden</h2><button type="button" aria-label="Fenster schließen" onClick={() => dialog.current?.close()}>×</button></div>
      <p>Beschreibe kurz, was die Administration an dieser Partie prüfen soll.</p>
      <label>Nachricht<textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 100))} maxLength={100} rows={4} autoFocus /></label>
      <small>{message.length}/100 Zeichen</small>
      {feedback && <p className={styles.reportError} role="alert">{feedback}</p>}
      <div className={styles.reportActions}><button type="button" onClick={() => dialog.current?.close()} disabled={pending}>Abbrechen</button><button type="button" onClick={submit} disabled={pending || !message.trim()}>{pending ? "Wird gesendet…" : "Meldung senden"}</button></div>
    </dialog>
  </>;
}
