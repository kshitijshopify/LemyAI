import type { ActionStep, SpeedReport } from "@/lib/report-types";
import { Icon } from "../Icon";
import { CodeBlock } from "./IssueCard";

const kb = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);
const scoreClass = (s: number | null) => (s === null ? "" : s >= 90 ? "good" : s >= 50 ? "ni" : "poor");

export function SpeedSections({ report }: { report: SpeedReport }) {
  const { speed } = report;
  const total = speed.weight.reduce((s, w) => s + w.bytes, 0) || 1;

  return (
    <>
      <section className="r-section">
        <h3>
          <Icon name="gauge" /> Core Web Vitals
          {speed.lighthouseVersion && <span className="badge">Lighthouse {speed.lighthouseVersion}</span>}
        </h3>
        <div className="score-pair" style={{ marginBottom: 16 }}>
          <div className={`mini-score tile ${scoreClass(speed.mobile?.score ?? null)}`}>
            <Icon name="phone" style={{ width: 16 }} /> Mobile <strong>{speed.mobile?.score ?? "–"}</strong>
          </div>
          <div className={`mini-score tile ${scoreClass(speed.desktop?.score ?? null)}`}>
            <Icon name="layers" style={{ width: 16 }} /> Desktop <strong>{speed.desktop?.score ?? "–"}</strong>
          </div>
        </div>

        {speed.field && (
          <>
            <p className="sub-note" style={{ marginTop: 0 }}>
              Real Chrome users, last 28 days ({speed.field.scope === "url" ? "this page" : "whole site"})
            </p>
            <div className="tiles" style={{ marginBottom: 18 }}>
              {speed.field.metrics.map((m) => (
                <div className={`tile ${m.rating}`} key={m.id}>
                  <span>{m.label} · field</span>
                  <strong>{m.value}</strong>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="sub-note" style={{ marginTop: 0 }}>
          Lab test, simulated mobile
        </p>
        <div className="tiles">
          {speed.mobile?.lab.map((m) => (
            <div className={`tile ${m.rating}`} key={m.id}>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="two-col" style={{ gridTemplateColumns: speed.mobile?.screenshot ? "220px 1fr" : "1fr" }}>
        {speed.mobile?.screenshot && (
          <section className="r-section">
            <div className="shot-label">Mobile, fully loaded</div>
            <div className="phone">
              <img src={speed.mobile.screenshot} alt="Mobile screenshot from Lighthouse" />
            </div>
          </section>
        )}
        <section className="r-section">
          <h3>
            <Icon name="layers" /> Where the weight comes from
            <span className="badge">
              {kb(speed.totalBytes)} · {speed.totalRequests} requests
            </span>
          </h3>
          <div className="weight-bar" role="img" aria-label="Page weight breakdown">
            {speed.weight.map((w) => (
              <div key={w.label} style={{ width: `${(w.bytes / total) * 100}%`, background: w.color }} title={`${w.label}: ${kb(w.bytes)}`} />
            ))}
          </div>
          <div className="legend">
            {speed.weight.map((w) => (
              <span key={w.label}>
                <i style={{ background: w.color }} /> {w.label} <b className="mono" style={{ fontSize: 12 }}>{kb(w.bytes)}</b>
              </span>
            ))}
          </div>

          {speed.topScripts.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Script source</th>
                    <th>Type</th>
                    <th className="num">Size</th>
                    <th className="num">CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {speed.topScripts.map((w) => (
                    <tr key={w.name}>
                      <td>{w.name}</td>
                      <td>
                        <span className={`kind ${w.kind}`}>{w.kind}</span>
                      </td>
                      <td className="num">{kb(w.bytes)}</td>
                      <td className="num">{w.mainThreadMs ? ms(w.mainThreadMs) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function SpeedPlan({ plan }: { plan: ActionStep[] }) {
  return (
    <section className="r-section">
      <h3>
        <Icon name="sparkles" /> AI action plan for this store <span className="badge badge-ai">AI</span>
      </h3>
      {plan.map((p, i) => (
        <div className="plan-step" key={i}>
          <span className="plan-num">{i + 1}</span>
          <div>
            <h4>{p.title}</h4>
            <p className="why">{p.why}</p>
            <div className="plan-tags">
              <span className={`sev ${p.impact}`}>{p.impact} impact</span>
              <span className="kind">effort {p.effort}</span>
              <span className="kind">{p.owner}</span>
            </div>
            {p.how.length > 0 && (
              <ol>
                {p.how.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ol>
            )}
            {p.code && <CodeBlock code={p.code} />}
          </div>
        </div>
      ))}
    </section>
  );
}
