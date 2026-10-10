import { ToolError, normalizeInputUrl } from "../http";
import { generateJson } from "../llm";
import { SPEED_SCHEMA, SPEED_SYSTEM } from "../prompts/speed-audit";
import { audit, failing, runPsi, type LhAudit, type PsiResult } from "../psi";
import { APP_SIGNATURES, PIXEL_SIGNATURES } from "../shopify/signatures";
import { getStoreXray, type StoreXray } from "../shopify/xray";
import { detectApps } from "./stack";
import {
  scoreLabel,
  sortIssues,
  type ActionStep,
  type AppWeight,
  type Issue,
  type MetricRating,
  type Severity,
  type SpeedMetric,
  type SpeedReport,
  type WeightBucket,
} from "@/lib/report-types";

type Kind = "theme" | "app" | "shopify" | "image" | "font" | "tracking" | "third-party" | "document";

const WEB_PIXELS_LABEL = "Customer events (web pixels)";
const INLINE_LABEL = "Inline scripts in the HTML";
type Classified = { kind: Kind; label: string; shopifyCdnImage?: boolean };

function fileName(path: string) {
  return decodeURIComponent(path.split("/").pop() || path).split("?")[0].slice(0, 60);
}

export function classifyUrl(raw: string, ownHost: string, resourceType?: string): Classified {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { kind: "third-party", label: raw.slice(0, 60) };
  }
  const host = u.hostname.replace(/^www\./, "");
  const own = ownHost.replace(/^www\./, "");
  const path = u.pathname;
  const isShopifyHost = host === own || /(^|\.)shopify\.com$|shopifycdn|shopifycloud/.test(host);

  if (isShopifyHost && /\/t\/\d+\/assets\//.test(path)) {
    if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path)) return { kind: "image", label: "Theme image", shopifyCdnImage: true };
    if (/\.(woff2?|ttf|otf)$/i.test(path)) return { kind: "font", label: "Theme font" };
    return { kind: "theme", label: `Theme: ${fileName(path)}` };
  }
  const ext = /\/extensions\/[^/]+\/([^/]+)\//.exec(path);
  if (isShopifyHost && ext) {
    const sig = APP_SIGNATURES.find((s) => new RegExp(s.re.source, "i").test(raw));
    return { kind: "app", label: sig?.name || `App extension (${ext[1].replace(/-\d[\d.-]*$/, "")})` };
  }
  if (isShopifyHost && /\/cdn\/wpm\/|\/web-pixels|web-pixels-manager/.test(path)) {
    return { kind: "tracking", label: WEB_PIXELS_LABEL };
  }
  if (isShopifyHost && /checkout-web|\/checkouts\//.test(path)) return { kind: "shopify", label: "Shopify checkout prefetch" };
  if (isShopifyHost && /shop-js|portable-wallets|shopify-pay/.test(path)) return { kind: "shopify", label: "Shop Pay & accelerated checkout" };
  const proxy = host === own ? /^\/(?:apps|a)\/([^/]+)\//.exec(path) : null;
  if (proxy) {
    const sig = APP_SIGNATURES.find((s) => new RegExp(s.re.source, "i").test(raw));
    return { kind: "app", label: sig?.name || `App proxy (${proxy[1]})` };
  }
  if (isShopifyHost && /shopifycloud|trekkie|monorail|perf-kit|storefront\/|\/api\/unstable|\/api\/20\d\d|consent-tracking/.test(path + host)) {
    return { kind: "shopify", label: "Shopify platform" };
  }
  if (host === "googletagmanager.com") {
    if (/gtm\.js/.test(path)) return { kind: "tracking", label: "Google Tag Manager" };
    const id = u.searchParams.get("id") || "";
    if (id.startsWith("AW-")) return { kind: "tracking", label: "Google Ads" };
    if (id.startsWith("G-")) return { kind: "tracking", label: "Google Analytics 4" };
    return { kind: "tracking", label: "Google tag" };
  }
  if (resourceType === "Image" || /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(path)) {
    const cdn = isShopifyHost && /\/(files|products|collections)\//.test(path);
    return { kind: "image", label: cdn ? "Shopify CDN images" : `Images from ${host}`, shopifyCdnImage: cdn };
  }
  if (resourceType === "Font" || /fonts\.(googleapis|gstatic)\.com/.test(host) || /\.(woff2?|ttf|otf)(\?|$)/i.test(path)) {
    return { kind: "font", label: /fonts\.(googleapis|gstatic)/.test(host) ? "Google Fonts" : "Fonts" };
  }
  const pixel = PIXEL_SIGNATURES.find((s) => new RegExp(s.present.source, "i").test(raw));
  if (pixel) return { kind: "tracking", label: pixel.name };
  const app = APP_SIGNATURES.find((s) => new RegExp(s.re.source, "i").test(raw));
  if (app) return { kind: "app", label: app.name };
  if (host === own) return resourceType === "Document" ? { kind: "document", label: "HTML document" } : { kind: "shopify", label: "Shopify platform" };
  if (isShopifyHost) return { kind: "shopify", label: "Shopify platform" };
  return { kind: "third-party", label: host };
}

type UrlStat = { url: string; bytes: number; ms: number };

/** Walks Lighthouse details (tables, lists, subItems) and collects url-level rows. Works for LH12 audits and LH13 insights. */
function collectUrls(details: unknown, out: UrlStat[] = []): UrlStat[] {
  if (!details || typeof details !== "object") return out;
  if (Array.isArray(details)) {
    for (const d of details) collectUrls(d, out);
    return out;
  }
  const d = details as Record<string, unknown>;
  if (typeof d.url === "string" && /^https?:/.test(d.url)) {
    const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : 0);
    out.push({
      url: d.url,
      bytes: num("wastedBytes") || num("totalBytes") || num("transferSize"),
      ms: num("wastedMs") || num("blockingTime") || num("mainThreadTime") || num("total"),
    });
  }
  for (const key of ["items", "subItems", "value"]) if (d[key]) collectUrls(d[key], out);
  return out;
}

const kb = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

const LAB: { id: string; label: string; good: number; poor: number; format: (n: number) => string }[] = [
  { id: "largest-contentful-paint", label: "Largest Contentful Paint", good: 2500, poor: 4000, format: ms },
  { id: "total-blocking-time", label: "Total Blocking Time", good: 200, poor: 600, format: ms },
  { id: "cumulative-layout-shift", label: "Cumulative Layout Shift", good: 0.1, poor: 0.25, format: (n) => n.toFixed(2) },
  { id: "first-contentful-paint", label: "First Contentful Paint", good: 1800, poor: 3000, format: ms },
  { id: "speed-index", label: "Speed Index", good: 3400, poor: 5800, format: ms },
];

const rate = (v: number, good: number, poor: number): MetricRating => (v <= good ? "good" : v <= poor ? "ni" : "poor");

function labMetrics(r: PsiResult): SpeedMetric[] {
  return LAB.map((m) => {
    const a = r.audits[m.id];
    const v = typeof a?.numericValue === "number" ? a.numericValue : null;
    return { id: m.id, label: m.label, numeric: v, value: v === null ? "–" : m.format(v), rating: v === null ? "unknown" : rate(v, m.good, m.poor) };
  });
}

const FIELD: { key: string; label: string; scale?: number; format: (n: number) => string; good: number; poor: number }[] = [
  { key: "LARGEST_CONTENTFUL_PAINT_MS", label: "LCP", format: ms, good: 2500, poor: 4000 },
  { key: "INTERACTION_TO_NEXT_PAINT", label: "INP", format: ms, good: 200, poor: 500 },
  { key: "CUMULATIVE_LAYOUT_SHIFT_SCORE", label: "CLS", scale: 100, format: (n) => n.toFixed(2), good: 0.1, poor: 0.25 },
  { key: "FIRST_CONTENTFUL_PAINT_MS", label: "FCP", format: ms, good: 1800, poor: 3000 },
  { key: "EXPERIMENTAL_TIME_TO_FIRST_BYTE", label: "TTFB", format: ms, good: 800, poor: 1800 },
];

function fieldMetrics(r: PsiResult) {
  if (!r.field) return null;
  const metrics = FIELD.flatMap((f) => {
    const p = r.field!.metrics[f.key]?.percentile;
    if (typeof p !== "number") return [];
    const v = f.scale ? p / f.scale : p;
    return [{ id: f.key, label: f.label, numeric: v, value: f.format(v), rating: rate(v, f.good, f.poor) }];
  });
  const overall: MetricRating = r.field.overall === "FAST" ? "good" : r.field.overall === "AVERAGE" ? "ni" : r.field.overall === "SLOW" ? "poor" : "unknown";
  return metrics.length ? { scope: r.field.scope, overall, metrics } : null;
}

const BUCKETS: { kind: Kind; label: string; color: string }[] = [
  { kind: "theme", label: "Theme code", color: "#a26bff" },
  { kind: "app", label: "Apps", color: "#ff5fd2" },
  { kind: "tracking", label: "Tracking pixels", color: "#ffcc66" },
  { kind: "third-party", label: "Other third parties", color: "#ff8a65" },
  { kind: "shopify", label: "Shopify platform", color: "#4dffb0" },
  { kind: "image", label: "Images", color: "#7cf8ff" },
  { kind: "font", label: "Fonts", color: "#8aa2ff" },
  { kind: "document", label: "HTML", color: "#6b7299" },
];

function weightAndScripts(r: PsiResult, host: string) {
  const reqs = (r.audits["network-requests"]?.details?.items ?? []) as { url?: string; transferSize?: number; resourceType?: string }[];
  const buckets = new Map<Kind, WeightBucket>();
  const byLabel = new Map<string, AppWeight>();
  let totalBytes = 0;
  const touch = (c: Classified) => {
    if (c.kind === "image" || c.kind === "font" || c.kind === "document") return null;
    let w = byLabel.get(c.label);
    if (!w) {
      w = { name: c.label, kind: c.kind === "app" ? "app" : c.kind === "theme" ? "theme" : c.kind === "shopify" ? "shopify" : c.kind === "tracking" ? "tracking" : "third-party", bytes: 0, mainThreadMs: 0, blockingMs: 0, requests: 0 };
      byLabel.set(c.label, w);
    }
    return w;
  };

  for (const req of reqs) {
    if (!req.url || !/^https?:/.test(req.url)) continue;
    const c = classifyUrl(req.url, host, req.resourceType);
    const bytes = req.transferSize || 0;
    totalBytes += bytes;
    const b = BUCKETS.find((x) => x.kind === c.kind)!;
    const bucket = buckets.get(c.kind) || { label: b.label, color: b.color, bytes: 0, requests: 0 };
    bucket.bytes += bytes;
    bucket.requests++;
    buckets.set(c.kind, bucket);
    const w = touch(c);
    if (w) {
      w.bytes += bytes;
      w.requests++;
    }
  }
  const docPath = new URL(r.finalUrl).pathname;
  for (const row of collectUrls(audit(r, "bootup-time")?.details)) {
    const u = new URL(row.url);
    const isDoc = u.hostname === host && u.pathname === docPath;
    // Main-document CPU is inline <script> work from theme.liquid and content_for_header (apps).
    const w = touch(isDoc ? { kind: "theme", label: INLINE_LABEL } : classifyUrl(row.url, host));
    if (w) w.mainThreadMs += row.ms;
  }
  for (const row of collectUrls(audit(r, "third-party-summary", "third-parties-insight")?.details)) {
    const w = touch(classifyUrl(row.url, host));
    if (w && row.ms) w.blockingMs = Math.max(w.blockingMs, row.ms);
  }

  const gtmContainers = new Set(reqs.flatMap((q) => (q.url && /googletagmanager\.com\/gtm\.js/.test(q.url) ? [new URL(q.url).searchParams.get("id") || ""] : [])));

  // Theme files are aggregated into one row so apps stay visible in the top list.
  const theme = [...byLabel.values()].filter((w) => w.kind === "theme" && w.name !== INLINE_LABEL);
  if (theme.length > 1) {
    const agg: AppWeight = { name: `Theme (${theme.length} files)`, kind: "theme", bytes: 0, mainThreadMs: 0, blockingMs: 0, requests: 0 };
    for (const t of theme) {
      agg.bytes += t.bytes;
      agg.mainThreadMs += t.mainThreadMs;
      agg.blockingMs += t.blockingMs;
      agg.requests += t.requests;
      byLabel.delete(t.name);
    }
    byLabel.set(agg.name, agg);
  }

  const topScripts = [...byLabel.values()]
    .filter((w) => w.bytes > 0 || w.mainThreadMs > 0)
    .sort((a, b) => b.mainThreadMs + b.bytes / 100 - (a.mainThreadMs + a.bytes / 100))
    .slice(0, 12);
  const weight = BUCKETS.map((b) => buckets.get(b.kind)).filter((b): b is WeightBucket => !!b && b.bytes > 0);
  return { weight, topScripts, totalBytes, totalRequests: reqs.length, gtmContainers: [...gtmContainers].filter(Boolean) };
}

function severityFrom(savingsMs: number, savingsBytes: number, floor: Severity = "low"): Severity {
  const s: Severity = savingsMs >= 1000 || savingsBytes >= 500_000 ? "high" : savingsMs >= 300 || savingsBytes >= 150_000 ? "medium" : "low";
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[s] >= rank[floor] ? s : floor;
}

function savings(a: LhAudit) {
  const m = a.metricSavings || {};
  return {
    ms: Math.max(m.LCP || 0, m.FCP || 0, m.TBT || 0, a.details?.overallSavingsMs || 0),
    bytes: a.details?.overallSavingsBytes || 0,
  };
}

function evidence(rows: UrlStat[], host: string, n = 5) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows.sort((a, b) => b.bytes + b.ms * 100 - (a.bytes + a.ms * 100))) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    const c = classifyUrl(r.url, host);
    const u = new URL(r.url);
    const size = [r.bytes ? kb(r.bytes) : "", r.ms ? ms(r.ms) : ""].filter(Boolean).join(" · ");
    out.push(`${c.label} — ${u.hostname}${fileName(u.pathname) ? "/…/" + fileName(u.pathname) : ""}${size ? ` (${size})` : ""}`);
    if (out.length >= n) break;
  }
  return out;
}

const LCP_SNIPPET = `{%- liquid
  assign loading = 'lazy'
  assign priority = 'auto'
  if section.index == 1
    assign loading = 'eager'
    assign priority = 'high'
  endif
-%}
{{ section.settings.image
  | image_url: width: 1500
  | image_tag: loading: loading, fetchpriority: priority,
    widths: '375, 750, 1100, 1500', sizes: '100vw' }}`;

function speedIssues(m: PsiResult, host: string, topScripts: AppWeight[], totalBytes: number, gtmContainers: string[]): Issue[] {
  const issues: Issue[] = [];
  const push = (i: Omit<Issue, "source">) => issues.push({ ...i, source: "rule" });

  const wpm = topScripts.find((w) => w.name === WEB_PIXELS_LABEL);
  if (wpm && wpm.mainThreadMs > 800) {
    push({
      id: "web-pixels",
      title: `Customer events (web pixels) use ${ms(wpm.mainThreadMs)} of CPU`,
      severity: wpm.mainThreadMs > 2000 ? "high" : "medium",
      category: "Tracking",
      detail: `Shopify runs every app pixel and custom pixel from Settings > Customer events in sandboxes (${kb(wpm.bytes)} across ${wpm.requests} requests here). Each extra pixel adds CPU on every page view.`,
      fix: "Open Settings > Customer events. Disconnect app pixels from apps you no longer use, merge custom pixels that send the same events, and don't track the same platform both in theme code (theme.liquid/GTM) and in Customer events.",
    });
  }

  if (gtmContainers.length > 1) {
    push({
      id: "gtm-duplicate",
      title: `${gtmContainers.length} Google Tag Manager containers load on one page`,
      severity: "medium",
      category: "Tracking",
      detail: `Containers ${gtmContainers.join(", ")} each load their own tags. This usually means an old container was never removed or an app injects its own.`,
      fix: "Consolidate into one container. Search theme.liquid and snippets/ for 'GTM-' and check which apps (e.g. tracking apps) inject a container.",
      evidence: gtmContainers,
    });
  }

  const lcpAudits = ["lcp-lazy-loaded", "prioritize-lcp-image", "lcp-discovery-insight"].map((id) => m.audits[id]).filter(failing) as LhAudit[];
  if (lcpAudits.length) {
    const s = savings(lcpAudits[0]);
    push({
      id: "lcp-image",
      title: "Hero (LCP) image is lazy-loaded or discovered late",
      severity: severityFrom(s.ms, 0, "medium"),
      category: "Images",
      detail: `Lighthouse flagged: ${lcpAudits.map((a) => a.title).join("; ")}. The largest image above the fold should start downloading immediately, not after JavaScript runs.`,
      fix: "In the first section of the template (usually the image banner or product media), render the image with loading: 'eager' and fetchpriority: 'high'. Keep loading: 'lazy' for everything below the fold. Avoid sliders or app-rendered heroes for the first image.",
      code: LCP_SNIPPET,
      evidence: evidence(lcpAudits.flatMap((a) => collectUrls(a.details)), host),
    });
  }

  const rb = audit(m, "render-blocking-resources", "render-blocking-insight");
  if (failing(rb)) {
    const rows = collectUrls(rb!.details);
    const kinds = rows.map((r) => classifyUrl(r.url, host).kind);
    const apps = kinds.filter((k) => k === "app" || k === "third-party" || k === "tracking").length;
    const s = savings(rb!);
    push({
      id: "render-blocking",
      title: `${rows.length || "Several"} render-blocking file${rows.length === 1 ? "" : "s"} delay the first paint`,
      severity: severityFrom(s.ms, 0, "medium"),
      category: "Render path",
      detail: `${rb!.displayValue ? rb!.displayValue + ". " : ""}${apps ? `${apps} of them come from apps or third parties. ` : ""}Browsers can't draw anything until these CSS/JS files download.`,
      fix: "Add defer to app and custom <script> tags in theme.liquid, move app code to app embeds where possible, and only keep critical CSS render-blocking. Self-host fonts through Shopify's font_picker instead of Google Fonts links.",
      code: `{%- comment -%} theme.liquid {%- endcomment -%}\n<script src="{{ 'custom.js' | asset_url }}" defer></script>\n{{ 'base.css' | asset_url | stylesheet_tag: preload: true }}`,
      evidence: evidence(rows, host),
    });
  }

  const appScripts = topScripts.filter((w) => (w.kind === "app" || w.kind === "third-party" || w.kind === "tracking") && w.name !== WEB_PIXELS_LABEL);
  const appBytes = appScripts.reduce((s, w) => s + w.bytes, 0);
  const appMain = appScripts.reduce((s, w) => s + w.mainThreadMs, 0);
  const tbt = m.audits["total-blocking-time"]?.numericValue ?? 0;
  if (appScripts.length && (appBytes > 250_000 || appMain > 800 || tbt > 600)) {
    push({
      id: "app-weight",
      title: `Apps and third parties add ${kb(appBytes)} and ${ms(appMain)} of main-thread work`,
      severity: appMain > 1500 || tbt > 1000 ? "high" : "medium",
      category: "Apps",
      detail: `Total Blocking Time is ${ms(tbt)} on mobile. The heaviest: ${appScripts
        .slice(0, 4)
        .map((w) => `${w.name} (${kb(w.bytes)}${w.mainThreadMs ? `, ${ms(w.mainThreadMs)} CPU` : ""})`)
        .join(", ")}.`,
      fix: "For each heavy app: remove it if it isn't earning revenue, check theme.liquid and snippets/ for leftovers from uninstalled apps, and turn off app embeds you don't use. Load chat, reviews carousels and popups on user interaction instead of on page load.",
      code: `<script>\n  // Load a chat widget only after the first interaction\n  ['scroll','pointerdown','keydown'].forEach(e => addEventListener(e, function load() {\n    if (window.__chatLoaded) return; window.__chatLoaded = true;\n    const s = document.createElement('script'); s.src = 'https://CHAT-WIDGET-URL.js'; s.async = true;\n    document.body.appendChild(s);\n  }, { once: true, passive: true }));\n</script>`,
      evidence: appScripts.slice(0, 6).map((w) => `${w.name} — ${kb(w.bytes)}${w.mainThreadMs ? ` · ${ms(w.mainThreadMs)} CPU` : ""}`),
    });
  }

  const imgAudits = ["uses-optimized-images", "modern-image-formats", "uses-responsive-images", "offscreen-images", "efficient-animated-content", "image-delivery-insight"]
    .map((id) => m.audits[id])
    .filter(failing) as LhAudit[];
  if (imgAudits.length) {
    const rows = imgAudits.flatMap((a) => collectUrls(a.details));
    const wasted = imgAudits.reduce((s, a) => s + savings(a).bytes, 0) || rows.reduce((s, r) => s + r.bytes, 0);
    const external = rows.filter((r) => !classifyUrl(r.url, host).shopifyCdnImage).length;
    const gif = rows.some((r) => /\.gif(\?|$)/i.test(r.url));
    push({
      id: "images",
      title: `Images could be ~${kb(wasted)} lighter`,
      severity: severityFrom(0, wasted, "low"),
      category: "Images",
      detail: `${imgAudits.map((a) => a.title).join("; ")}.${external ? ` ${external} flagged image(s) are not served through Shopify's image CDN (often app-hosted or hardcoded), so they miss automatic WebP/AVIF.` : ""}${gif ? " Animated GIFs were found; use video instead." : ""}`,
      fix: "Render every image through image_url + image_tag with widths and sizes so Shopify serves the right size and modern format. Lazy-load images below the fold. Replace GIFs with an MP4 via the video_tag filter.",
      code: `{{ product.featured_media\n  | image_url: width: 1200\n  | image_tag: widths: '360, 540, 720, 900, 1200',\n    sizes: '(min-width: 990px) 50vw, 100vw', loading: 'lazy' }}`,
      evidence: evidence(rows, host),
    });
  }

  const cls = m.audits["cumulative-layout-shift"]?.numericValue ?? 0;
  const clsAudits = ["layout-shifts", "layout-shift-elements", "cls-culprits-insight", "unsized-images"].map((id) => m.audits[id]).filter(failing) as LhAudit[];
  if (cls > 0.1 || clsAudits.some((a) => a.id === "unsized-images")) {
    push({
      id: "cls",
      title: `Layout shifts while loading (CLS ${cls.toFixed(2)})`,
      severity: cls > 0.25 ? "high" : cls > 0.1 ? "medium" : "low",
      category: "Layout",
      detail: "Content jumps as images without dimensions, late fonts or app widgets (review stars, announcement bars, upsell blocks) render.",
      fix: "Use image_tag (it outputs width and height automatically), reserve space for app blocks with a min-height, and use font_display: 'swap' with matching fallback fonts.",
      code: `.product__rating-placeholder { min-height: 22px; }\n.announcement-bar { min-height: 40px; }`,
      evidence: evidence(clsAudits.flatMap((a) => collectUrls(a.details)), host),
    });
  }

  const fd = audit(m, "font-display", "font-display-insight");
  if (failing(fd)) {
    push({
      id: "fonts",
      title: "Text is invisible while web fonts load",
      severity: "low",
      category: "Fonts",
      detail: "Some fonts don't use font-display: swap, so text stays hidden until the font file downloads.",
      fix: "Load theme fonts with Shopify's font_face filter and preload the heading font. Remove Google Fonts <link> tags added by apps or old customizations.",
      code: `<link rel="preload" as="font" href="{{ settings.type_header_font | font_url }}" type="font/woff2" crossorigin>\n<style>\n  {{ settings.type_header_font | font_face: font_display: 'swap' }}\n</style>`,
      evidence: evidence(collectUrls(fd!.details), host),
    });
  }

  const ttfb = audit(m, "server-response-time", "document-latency-insight");
  if (failing(ttfb)) {
    push({
      id: "ttfb",
      title: "Slow server response (Liquid rendering)",
      severity: "medium",
      category: "Liquid",
      detail: `${ttfb!.displayValue || ttfb!.title}. Shopify's servers are fast, so slow responses usually mean heavy Liquid: big loops, nested collection lookups or many sections.`,
      fix: "Profile the template with Shopify Theme Inspector for Chrome. Look for loops over collections.all or all_products, nested for-loops in mega menus, and replace include with render.",
      code: `{%- comment -%} Avoid: loops over every product {%- endcomment -%}\n{%- for product in collection.products limit: 8 -%}\n  {%- render 'card-product', card_product: product -%}\n{%- endfor -%}`,
    });
  }

  const dom = audit(m, "dom-size", "dom-size-insight");
  if (failing(dom)) {
    push({
      id: "dom-size",
      title: `Large page structure${dom!.displayValue ? ` (${dom!.displayValue})` : ""}`,
      severity: "low",
      category: "Liquid",
      detail: "A big DOM slows style calculation and interactions. On Shopify this usually comes from mega menus rendering every link, duplicate mobile/desktop menus, or long product grids.",
      fix: "Render the mobile menu only once, lazy-render mega menu panels, and limit products per collection row on the homepage.",
    });
  }

  const legacy = ["legacy-javascript", "legacy-javascript-insight", "duplicated-javascript", "duplicated-javascript-insight"].map((id) => m.audits[id]).filter(failing) as LhAudit[];
  if (legacy.length) {
    push({
      id: "legacy-js",
      title: "Duplicated or legacy JavaScript",
      severity: "low",
      category: "Apps",
      detail: `${legacy.map((a) => a.title).join("; ")}. Often several apps each ship their own copy of jQuery or polyfills.`,
      fix: "Check which apps bundle jQuery or polyfills and ask the vendors for a modern build, or replace them.",
      evidence: evidence(legacy.flatMap((a) => collectUrls(a.details)), host),
    });
  }

  const facades = audit(m, "third-party-facades");
  if (failing(facades)) {
    push({
      id: "facades",
      title: "Embeds could load on click instead of on page load",
      severity: "low",
      category: "Apps",
      detail: "Chat widgets and video embeds load their full code up front.",
      fix: "Use a lightweight placeholder (facade) and load the real widget on click, e.g. a YouTube thumbnail that swaps to the iframe.",
      evidence: evidence(collectUrls(facades!.details), host),
    });
  }

  const redirects = audit(m, "redirects");
  if (failing(redirects)) {
    push({
      id: "redirects",
      title: "The page redirects before loading",
      severity: "medium",
      category: "Domain",
      detail: "Each redirect adds a full round trip on mobile.",
      fix: "Link to the primary domain (Settings > Domains) with https:// and the correct www/non-www version everywhere: ads, emails, social bios.",
    });
  }

  if (totalBytes > 4_000_000) {
    push({
      id: "page-weight",
      title: `Page weighs ${kb(totalBytes)}`,
      severity: totalBytes > 7_000_000 ? "high" : "medium",
      category: "Page weight",
      detail: "Heavy pages hurt mobile shoppers on slower EU mobile networks the most.",
      fix: "Start with the biggest buckets in the weight breakdown: oversized images, video heroes without poster images, and app bundles.",
    });
  }

  return sortIssues(issues);
}

function compactForAi(m: PsiResult, d: PsiResult | null, xray: StoreXray | null, issues: Issue[], topScripts: AppWeight[], weight: WeightBucket[], apps: string[]) {
  return JSON.stringify({
    url: m.finalUrl,
    store: xray ? { name: xray.summary.name, theme: xray.summary.theme, apps_detected: apps } : null,
    scores: { mobile: m.score, desktop: d?.score ?? null },
    lab_mobile: labMetrics(m).map((x) => `${x.label}: ${x.value} (${x.rating})`),
    field: fieldMetrics(m),
    weight: weight.map((w) => `${w.label}: ${kb(w.bytes)} / ${w.requests} req`),
    top_scripts: topScripts.map((w) => ({ name: w.name, kind: w.kind, size: kb(w.bytes), cpu: ms(w.mainThreadMs) })),
    findings: issues.map((i) => ({ title: i.title, detail: i.detail, evidence: i.evidence?.slice(0, 4) })),
  });
}

export async function runSpeedAudit({ url }: { url: string }): Promise<SpeedReport> {
  const started = Date.now();
  const target = normalizeInputUrl(url);
  const warnings: string[] = [];

  const xrayP = getStoreXray(target.toString()).then(
    (r) => r.xray,
    (err) => {
      if (err instanceof ToolError && (err.code === "password" || err.code === "dns" || err.code === "blocked_host")) throw err;
      warnings.push(err instanceof ToolError && err.code === "not_shopify" ? "This doesn't look like a Shopify store, so some Shopify-specific fixes may not apply." : "We couldn't read store details; app attribution may be incomplete.");
      return null;
    },
  );
  const [xray, mobile, desktop] = await Promise.all([
    xrayP,
    runPsi(target.toString(), "mobile"),
    runPsi(target.toString(), "desktop").catch(() => null),
  ]);
  if (!desktop) warnings.push("The desktop test didn't finish; showing mobile results.");

  const host = new URL(mobile.finalUrl).hostname;
  const { weight, topScripts, totalBytes, totalRequests, gtmContainers } = weightAndScripts(mobile, host);
  const issues = speedIssues(mobile, host, topScripts, totalBytes, gtmContainers);
  const apps = xray ? detectApps([{ key: "home", html: xray.homepage.text }]).map((a) => a.name) : [];

  let plan: ActionStep[] = [];
  let aiSummary: string | null = null;
  const remaining = 57_000 - (Date.now() - started);
  if (remaining > 9_000) {
    const { data, error } = await generateJson<{ summary: string; steps: ActionStep[] }>({
      name: "speed_plan",
      system: SPEED_SYSTEM,
      user: `PageSpeed data for this Shopify store:\n${compactForAi(mobile, desktop, xray, issues, topScripts, weight, apps)}`,
      schema: SPEED_SCHEMA,
      timeoutMs: remaining - 1500,
      maxTokens: 2200,
    });
    if (data?.steps?.length) {
      plan = data.steps.slice(0, 6);
      aiSummary = data.summary;
    } else if (error === "daily_cap") warnings.push("Today's AI budget is used up, so the action plan is rule-based.");
  }

  const field = fieldMetrics(mobile);
  const lab = labMetrics(mobile);
  const lcp = lab[0];
  const score = mobile.score;
  const summary =
    aiSummary ||
    `Mobile performance scores ${score ?? "–"}/100${desktop?.score != null ? ` (desktop ${desktop.score})` : ""}. Largest Contentful Paint is ${lcp.value}${
      field ? ` in the lab and real-user Core Web Vitals are rated ${field.overall === "good" ? "good" : field.overall === "ni" ? "needs improvement" : field.overall === "poor" ? "poor" : "unknown"}` : ""
    }. ${issues.length ? `We found ${issues.length} Shopify-specific fix${issues.length === 1 ? "" : "es"}.` : "No major issues found."}`;

  return {
    tool: "speed-audit",
    analyzedUrl: mobile.finalUrl,
    store: xray?.summary ?? null,
    score,
    scoreLabel: scoreLabel(score),
    summary,
    issues,
    aiUsed: plan.length > 0,
    warnings,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    speed: {
      mobile: { score: mobile.score, lab, screenshot: (mobile.audits["final-screenshot"]?.details?.data as string) || null },
      desktop: desktop ? { score: desktop.score, lab: labMetrics(desktop) } : null,
      field,
      weight,
      totalBytes,
      totalRequests,
      topScripts,
      plan,
      lighthouseVersion: mobile.lighthouseVersion,
    },
  };
}
