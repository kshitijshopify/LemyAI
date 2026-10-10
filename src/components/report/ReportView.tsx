"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { AnyReport, Issue } from "@/lib/report-types";
import { ctaHref } from "@/lib/site";
import type { ToolConfig } from "@/lib/tools.config";
import { Icon } from "../Icon";
import { CroSections } from "./CroSections";
import { EmailGate, UNLOCK_KEY } from "./EmailGate";
import { IssueCard } from "./IssueCard";
import { ScoreRing } from "./ScoreRing";
import { SpeedPlan, SpeedSections } from "./SpeedSections";
import { StackSections } from "./StackSections";

const FREE_ISSUES = 3;

export function ReportView({ report, tool }: { report: AnyReport; tool: ToolConfig }) {
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUnlocked(!!localStorage.getItem(UNLOCK_KEY));
  }, []);

  const s = report.store;
  const t = s?.theme;
  const freeIssues = report.issues.slice(0, FREE_ISSUES);
  const lockedIssues = report.issues.slice(FREE_ISSUES);
  const plan = report.tool === "speed-audit" ? report.speed.plan : [];
  const hiddenCount = lockedIssues.length + plan.length;

  const downloadPdf = () => {
    if (!unlocked) {
      document.getElementById("email-gate")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    track("pdf_download", { tool: tool.slug });
    window.print();
  };

  const lockedContent = (
    <>
      {plan.length > 0 && <SpeedPlan plan={plan} />}
      {lockedIssues.length > 0 && <IssueList title={`More fixes (${lockedIssues.length})`} issues={lockedIssues} />}
    </>
  );

  return (
    <div className="report" style={{ "--c1": tool.accent[0], "--c2": tool.accent[1] } as React.CSSProperties}>
      <div className="print-only">
        <h1 style={{ fontSize: 26 }}>
          {tool.name}: {s?.name || s?.domain || report.analyzedUrl}
        </h1>
        <p style={{ color: "#555", marginBottom: 12 }}>
          lemy.ai by Script Commerce · {new Date(report.generatedAt).toLocaleString()} · {report.analyzedUrl}
        </p>
      </div>

      <div className="report-head">
        <ScoreRing score={report.score} label={report.scoreLabel} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="kicker">{tool.name} report</span>
          <h2>
            {s?.name || s?.domain || new URL(report.analyzedUrl).hostname}
            <span className="badge">{report.scoreLabel}</span>
            {report.aiUsed && <span className="badge badge-ai">AI</span>}
          </h2>
          <p className="summary">{report.summary}</p>
          <div className="store-chips">
            <span className="chip">
              <Icon name="globe" /> {s?.domain || new URL(report.analyzedUrl).hostname}
            </span>
            {t && (t.schemaName || t.name) && (
              <span className="chip">
                <Icon name="layers" /> {t.schemaName || t.name}
                {t.version ? ` ${t.version}` : ""}
              </span>
            )}
            {s?.currency && (
              <span className="chip">
                <Icon name="coins" /> {s.currency}
                {s.country ? ` · ${s.country}` : ""}
              </span>
            )}
            <span className="chip">
              <Icon name="clock" /> {(report.durationMs / 1000).toFixed(1)}s{report.cached ? " · cached" : ""}
            </span>
          </div>
          <div className="report-actions">
            <button className="btn btn-ghost btn-sm" onClick={downloadPdf}>
              <Icon name={unlocked ? "download" : "lock"} /> Download PDF
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                track("share_click", { tool: tool.slug });
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Icon name="link" /> {copied ? "Link copied" : "Copy share link"}
            </button>
            <a
              className="btn btn-primary btn-sm"
              href={ctaHref(tool.slug, "report_head")}
              target="_blank"
              rel="noopener"
              onClick={() => track("cta_click", { tool: tool.slug, placement: "report_head" })}
            >
              Get this fixed <Icon name="arrow" />
            </a>
          </div>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="alert-list">
          {report.warnings.map((w) => (
            <div key={w} className="alert alert-warn">
              <Icon name="alert" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {report.tool === "pdp-cro-audit" && <CroSections report={report} />}
      {report.tool === "speed-audit" && <SpeedSections report={report} />}
      {report.tool === "store-stack-detector" && <StackSections report={report} />}

      <IssueList
        title={report.issues.length ? `Top issues & fixes` : report.score === null ? "Health checks skipped" : "No issues found"}
        issues={freeIssues}
        empty={
          report.score === null
            ? "We only score stores whose live storefront runs on Shopify's Online Store. See the note above for why this one was skipped."
            : "Nothing major to fix here. Nice work."
        }
      />

      {hiddenCount > 0 &&
        (unlocked ? (
          lockedContent
        ) : (
          <div className="gated">
            <div className="blurred" aria-hidden="true">
              {lockedContent}
            </div>
            <EmailGate tool={tool.slug} url={report.analyzedUrl} score={report.score} hiddenCount={hiddenCount} onUnlock={() => setUnlocked(true)} />
          </div>
        ))}
      {hiddenCount === 0 && !unlocked && (
        <EmailGate tool={tool.slug} url={report.analyzedUrl} score={report.score} hiddenCount={0} onUnlock={() => setUnlocked(true)} />
      )}

      <div className="fix-cta">
        <div>
          <h3>Want us to fix this?</h3>
          <p>
            Script Commerce has fixed these exact issues for Shopify brands across the EU. Send us this report and
            get a free, prioritized quote.
          </p>
        </div>
        <a
          className="btn btn-primary"
          href={ctaHref(tool.slug, "report_bottom")}
          target="_blank"
          rel="noopener"
          onClick={() => track("cta_click", { tool: tool.slug, placement: "report_bottom" })}
        >
          Talk to Script Commerce <Icon name="arrow" />
        </a>
      </div>
      <p className="meta-line">
        Generated {new Date(report.generatedAt).toLocaleString()} · {report.analyzedUrl}
      </p>
    </div>
  );
}

function IssueList({ title, issues, empty }: { title: string; issues: Issue[]; empty?: string }) {
  return (
    <section className="r-section">
      <h3>
        <Icon name="alert" /> {title}
      </h3>
      {issues.length ? issues.map((i) => <IssueCard key={i.id} issue={i} />) : <p className="muted">{empty}</p>}
    </section>
  );
}
