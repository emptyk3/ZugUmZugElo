"use client";
import { useActionState } from "react";
import type { FormState } from "./auth-actions";

export function ActionForm({ action, children, submitLabel }: { action: (state: FormState, data: FormData) => Promise<FormState>; children: React.ReactNode; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="account-form">{children}{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.success && <p className="form-success">{state.success}</p>}<button disabled={pending}>{pending ? "Bitte warten…" : submitLabel}</button></form>;
}
