"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { AnyReport } from "@/lib/report-types";
import type { ToolConfig } from "@/lib/tools.config";
import { Icon } from "./Icon";
import { ReportView } from "./report/ReportView";

type State =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number }
  | { kind: "done"; report: AnyReport }
  | { kind: "error"; message: string };

export function ToolRunner({ tool }: { tool: ToolConfig }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const etaSec = Number(/\d+/.exec(tool.eta)?.[0] || 30);

  const run = useCallback(
    async (target: string) => {
      const value = target.trim();
      if (!value) return;
      setState({ kind: "running", startedAt: Date.now() });
      setStep(0);
      setElapsed(0);
      track("tool_run", { tool: tool.slug });
      const qs = new URLSearchParams({ url: value });
      history.replaceState(null, "", `?${qs}`);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      try {
        const res = await fetch(`/api/tools/${tool.slug}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: value }),
        });
        const json = await res.json().catch(() => ({ error: "The server returned an unexpected response." }));
        if (!res.ok) {
          track("tool_error", { tool: tool.slug, code: json.code || res.status });
          setState({ kind: "error", message: json.error || `Request failed (${res.status}).` });
          return;
        }
        const report = json as AnyReport;
        track("tool_result", { tool: tool.slug, score: report.score, ai: report.aiUsed });
        setState({ kind: "done", report });
      } catch {
        setState({ kind: "error", message: "Network error. Check your connection and try again." });
      }
    },
    [tool.slug],
  );

  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const initial = new URLSearchParams(window.location.search).get("url");
    if (initial) {
      setUrl(initial);
      run(initial);
    }
  }, [run]);

  useEffect(() => {
    if (state.kind !== "running") return;
    const perStep = (etaSec * 1000) / Math.max(1, tool.steps.length);
    const t = setInterval(() => {
      const ms = Date.now() - state.startedAt;
      setElapsed(ms);
      setStep(Math.min(tool.steps.length - 1, Math.floor(ms / perStep)));
    }, 250);
    return () => clearInterval(t);
  }, [state, etaSec, tool.steps.length]);

  const running = state.kind === "running";

  return (
    <div className="runner">
      <form
        className="run-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(url);
        }}
      >
        <label className="field">
          <Icon name="globe" />
          <span className="sr-only">{tool.input.label}</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tool.input.placeholder}
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={running}>
          {running ? "Analyzing…" : `Run ${tool.usesAi ? "AI " : ""}audit`} <Icon name={running ? "clock" : "arrow"} />
        </button>
      </form>
      <div className="run-hint">
        <span>{tool.input.hint}</span>
        {tool.input.examples?.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip"
            disabled={running}
            onClick={() => {
              setUrl(ex);
              run(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div ref={resultRef} style={{ marginTop: 26, scrollMarginTop: 90 }}>
        {state.kind === "idle" && (
          <div className="empty">
            <span className="icon-tile">
              <Icon name={tool.icon} />
            </span>
            <h3>Your report appears here</h3>
            <p>
              Paste a URL above. Typical run time: {tool.eta}. We only read public pages.
            </p>
          </div>
        )}

        {state.kind === "running" && (
          <div className="progress" role="status" aria-live="polite">
            <div className="progress-head">
              <h3>X-raying {url.replace(/^https?:\/\//, "").split("/")[0]}…</h3>
              <span className="timer">{(elapsed / 1000).toFixed(1)}s</span>
            </div>
            <ol className="steps">
              {tool.steps.map((s, i) => (
                <li key={s} className={i < step ? "done" : i === step ? "active" : ""}>
                  <span className="st">{i < step && <Icon name="check" />}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="skeleton">
              <div style={{ width: "92%" }} />
              <div style={{ width: "76%" }} />
              <div style={{ width: "84%" }} />
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="alert alert-error" role="alert">
            <Icon name="alert" />
            <div>
              <strong>We couldn&apos;t finish this one.</strong>
              <div style={{ marginTop: 4 }}>{state.message}</div>
            </div>
          </div>
        )}

        {state.kind === "done" && <ReportView report={state.report} tool={tool} />}
      </div>
    </div>
  );
}
