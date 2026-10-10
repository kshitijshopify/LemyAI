"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { liveTools } from "@/lib/tools.config";
import { Icon } from "./Icon";

export function HeroScan() {
  const router = useRouter();
  const tools = liveTools();
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("store-stack-detector");

  const go = (target = url, toolSlug = slug) => {
    const v = target.trim();
    if (!v) return;
    router.push(`/tools/${toolSlug}?url=${encodeURIComponent(v)}`);
  };

  return (
    <>
      <form
        className="scan-box"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <label className="field">
          <Icon name="globe" />
          <span className="sr-only">Shopify store URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any Shopify store, e.g. allbirds.com"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
          />
        </label>
        <label className="sr-only" htmlFor="hero-tool">
          Tool
        </label>
        <select id="hero-tool" value={slug} onChange={(e) => setSlug(e.target.value)}>
          {tools.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          X-ray it <Icon name="arrow" />
        </button>
      </form>
      <div className="hero-hints">
        <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
          Try:
        </span>
        {["allbirds.com", "brooklinen.com", "snocks.com"].map((d) => (
          <button key={d} type="button" className="chip" onClick={() => go(d)}>
            <Icon name="store" /> {d}
          </button>
        ))}
      </div>
    </>
  );
}
