"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveGameReports } from "./actions";

export default function ResolveGameReportsButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function resolve() {
    if (!window.confirm("Alle offenen Meldungen dieser Partie als erledigt markieren?")) return;
    setMessage("");
    startTransition(async () => {
      const result = await resolveGameReports(gameId);
      if ("error" in result) setMessage(result.error ?? "Die Meldung konnte nicht abgeschlossen werden.");
      else { setMessage("Die offenen Meldungen wurden als erledigt markiert."); router.refresh(); }
    });
  }
  return <div className="actions"><button type="button" onClick={resolve} disabled={pending}>{pending ? "Wird abgeschlossen…" : "Meldung als erledigt markieren"}</button>{message && <span role="status">{message}</span>}</div>;
}
