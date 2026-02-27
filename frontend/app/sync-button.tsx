"use client";

import { useState } from "react";

export function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function run(): Promise<void> {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok || data.error) {
        setMessage(`Sync failed: ${String(data.error ?? response.statusText)}`);
        return;
      }

      setMessage(
        `Sync ok. fetched=${String(data.fetchedCount ?? "?")}, upserted=${String(data.upsertedCount ?? "?")}, deleted=${String(data.deletedCount ?? "?")}`,
      );
    } catch (error) {
      setMessage(`Sync failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 8 }}>
      <button className="button" onClick={run} disabled={busy}>
        {busy ? "Syncing..." : "Run Sync"}
      </button>
      {message ? <p className="small muted">{message}</p> : null}
    </div>
  );
}
