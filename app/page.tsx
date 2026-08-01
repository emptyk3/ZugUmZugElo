"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/counter")
      .then((r) => r.json())
      .then((d) => setValue(d.value));
  }, []);

  async function increment() {
    setLoading(true);
    try {
      const res = await fetch("/api/counter", { method: "POST" });
      const data = await res.json();
      setValue(data.value);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", margin: 0 }}>Stack-Test</h1>
      <p style={{ fontSize: "4rem", margin: 0, fontWeight: 700 }}>
        {value ?? "…"}
      </p>
      <button
        onClick={increment}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1.125rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "#3b82f6",
          color: "white",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Zähle…" : "+1"}
      </button>
    </main>
  );
}
