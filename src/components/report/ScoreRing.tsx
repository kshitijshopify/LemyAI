"use client";

import { useEffect, useId, useState } from "react";

export function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const id = useId();
  const [shown, setShown] = useState(0);
  const r = 56;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;

  useEffect(() => {
    const t = setTimeout(() => setShown(value), 80);
    return () => clearTimeout(t);
  }, [value]);

  const [c1, c2] = value >= 90 ? ["#4dffb0", "#7cf8ff"] : value >= 50 ? ["#ffcc66", "#ff8a65"] : ["#ff6b8a", "#ff5fd2"];

  return (
    <div className="ring" aria-label={`Score ${score ?? "not available"} out of 100, ${label}`}>
      <svg viewBox="0 0 132 132">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle className="track" cx="66" cy="66" r={r} fill="none" strokeWidth="10" />
        <circle
          className="bar"
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * shown) / 100}
        />
      </svg>
      <div className="val">
        <div>
          <strong>{score ?? "–"}</strong>
          <span>/ 100</span>
        </div>
      </div>
    </div>
  );
}
