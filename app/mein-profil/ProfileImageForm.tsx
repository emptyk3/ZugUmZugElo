"use client";

import { FormEvent, useState } from "react";
import { compressClientImage } from "@/lib/images/compress-client-image";
import { changeProfileImage } from "./actions";

const size = (bytes: number) => new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);

export default function ProfileImageForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "uploading">("idle");
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || status !== "idle") return;
    setMessage(""); setInfo(""); setStatus("preparing");
    try {
      const optimized = await compressClientImage(file, "profile");
      setInfo(`Bild optimiert: ${size(file.size)} MB → ${size(optimized.size)} MB`);
      setStatus("uploading");
      const data = new FormData(); data.set("image", optimized);
      await changeProfileImage(data);
      setMessage("Das Profilbild wurde gespeichert."); setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Das Profilbild konnte nicht hochgeladen werden.");
    } finally { setStatus("idle"); }
  }

  return <form className="account-form" onSubmit={submit}>
    <input type="file" accept="image/jpeg,image/png,image/webp" required disabled={status !== "idle"} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(""); setInfo(""); }} />
    {info && <small>{info}</small>}{message && <p className="form-error" role="alert">{message}</p>}
    <button disabled={!file || status !== "idle"}>{status === "preparing" ? "Bild wird vorbereitet …" : status === "uploading" ? "Bild wird hochgeladen …" : "Profilbild hochladen"}</button>
  </form>;
}
