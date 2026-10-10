"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { Icon } from "../Icon";

export const UNLOCK_KEY = "lemy_email";

export function EmailGate({
  tool,
  url,
  score,
  hiddenCount,
  onUnlock,
}: {
  tool: string;
  url: string;
  score: number | null;
  hiddenCount: number;
  onUnlock: () => void;
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="gate" id="email-gate">
      <span className="icon-tile">
        <Icon name="lock" />
      </span>
      <h3>{hiddenCount > 0 ? `Unlock ${hiddenCount} more fix${hiddenCount === 1 ? "" : "es"} + the PDF` : "Get the full PDF report"}</h3>
      <p>Free. Enter your email to see the full report and download it as a PDF to share with your team.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/leads", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, tool, url, score, consent }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Couldn't save your email.");
            localStorage.setItem(UNLOCK_KEY, email);
            track("email_captured", { tool, consent });
            onUnlock();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="row">
          <input
            type="email"
            required
            placeholder="you@brand.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-label="Email address"
          />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Unlocking…" : "Unlock report"} <Icon name="arrow" />
          </button>
        </div>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Also send me occasional Shopify tips from Script Commerce (optional, unsubscribe anytime).</span>
        </label>
        {error && <span style={{ color: "var(--bad)", fontSize: 13 }}>{error}</span>}
      </form>
    </div>
  );
}
