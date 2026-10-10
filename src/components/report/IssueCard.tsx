"use client";

import { useState } from "react";
import type { Issue } from "@/lib/report-types";
import { Icon } from "../Icon";

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <pre>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <article className={`issue ${issue.severity}`}>
      <span className="bar" />
      <div>
        <div className="issue-top">
          <span className={`sev ${issue.severity}`}>{issue.severity}</span>
          {issue.category && <span className="cat">{issue.category}</span>}
          {issue.source === "ai" && <span className="badge badge-ai">Vision AI</span>}
          {issue.effort && <span className="cat">Effort {issue.effort}</span>}
          <h4>{issue.title}</h4>
        </div>
        <p>{issue.detail}</p>
        {!!issue.evidence?.length && (
          <div className="evidence">
            {issue.evidence.map((e, i) => (
              <code key={i}>{e}</code>
            ))}
          </div>
        )}
        <div className="fix">
          <b>
            <Icon name="check" style={{ width: 12, height: 12, verticalAlign: -1 }} /> Fix
          </b>
          {issue.fix}
        </div>
        {issue.code && <CodeBlock code={issue.code} />}
      </div>
    </article>
  );
}
