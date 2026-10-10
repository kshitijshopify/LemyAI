import Link from "next/link";
import { isNew, type ToolConfig } from "@/lib/tools.config";
import { Icon } from "./Icon";

const accentStyle = (t: ToolConfig) => ({ "--c1": t.accent[0], "--c2": t.accent[1] }) as React.CSSProperties;

export function FeatureCard({ tool }: { tool: ToolConfig }) {
  return (
    <article className="feature-card" style={accentStyle(tool)}>
      <div className="card-top">
        <span className="icon-tile">
          <Icon name={tool.icon} />
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {tool.usesAi && <span className="badge badge-ai">AI</span>}
          {isNew(tool) && <span className="badge badge-new">New</span>}
        </div>
      </div>
      <h3>{tool.name}</h3>
      <p>{tool.outcome}</p>
      <div className="card-meta">
        <span>
          <Icon name="clock" /> {tool.eta}
        </span>
        <span>
          <Icon name="layers" /> {tool.builtOn}
        </span>
      </div>
      <div className="card-foot">
        <Link href={`/tools/${tool.slug}`} className="open-link stretched">
          Open tool <Icon name="arrow" />
        </Link>
      </div>
    </article>
  );
}

export function ToolCard({ tool }: { tool: ToolConfig }) {
  const live = tool.status === "live";
  return (
    <article className={`tool-card${live ? "" : " soon"}`} style={accentStyle(tool)}>
      <div className="card-top">
        <span className="icon-tile">
          <Icon name={tool.icon} />
        </span>
        {isNew(tool) && <span className="badge badge-new">New</span>}
        {!live && <span className="badge badge-soon">Soon</span>}
      </div>
      <h4>{tool.name}</h4>
      <p>{tool.outcome}</p>
      <div className="card-foot">
        {live ? (
          <Link href={`/tools/${tool.slug}`} className="open-link stretched">
            Open <Icon name="arrow" />
          </Link>
        ) : (
          <span className="card-meta">{tool.builtOn}</span>
        )}
      </div>
    </article>
  );
}
