"use client";

import { useEffect, useState } from "react";
import { AREAS, TOOLS, type ToolTab } from "@/lib/tools.config";
import { ToolCard } from "./ToolCards";

const TABS: { id: ToolTab; label: string }[] = [
  { id: "merchants", label: "Merchants" },
  { id: "developers", label: "Developers" },
];

export function ToolsHub() {
  const [tab, setTab] = useState<ToolTab>("merchants");

  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1);
      if (h === "merchants" || h === "developers") setTab(h);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const tools = TOOLS.filter((t) => t.tabs.includes(tab)).sort((a, b) => (a.status === b.status ? 0 : a.status === "live" ? -1 : 1));

  return (
    <section className="section" id="all-tools">
      <span id="merchants" />
      <span id="developers" />
      <div className="section-head">
        <div>
          <span className="kicker">All tools</span>
          <h2>Pick your side of the store</h2>
        </div>
        <div className="tabs" role="tablist" aria-label="Audience">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className="tab"
              onClick={() => {
                setTab(t.id);
                history.replaceState(null, "", `#${t.id}`);
              }}
            >
              {t.label}
              <span className="count">{TOOLS.filter((x) => x.tabs.includes(t.id) && x.status === "live").length}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "merchants" ? (
        AREAS.map((area) => {
          const list = tools.filter((t) => t.area === area);
          if (!list.length) return null;
          return (
            <div className="area" key={area}>
              <div className="area-head">
                <h3>{area}</h3>
                <span className="rule" />
              </div>
              <div className="tool-grid">
                {list.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="area">
          <div className="tool-grid">
            {tools.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
