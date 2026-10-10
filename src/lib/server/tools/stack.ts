import { APP_SIGNATURES, PIXEL_SIGNATURES, SHOPIFY_HOST_RE, type AppCategory } from "../shopify/signatures";
import { extractLiteral, getStorePage, getStoreXray, pickBestSellerHandle, productHandleFromPath, type StoreXray } from "../shopify/xray";
import {
  scoreLabel,
  sortIssues,
  type DetectedApp,
  type DetectedPixel,
  type Issue,
  type StackData,
  type StackReport,
  type StoreSummary,
} from "@/lib/report-types";

const stripSvg = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/gi, "");

const TOKEN_BOUNDARY = /["'\s<>(),;=`]/;

function tokenAround(text: string, index: number, len: number) {
  let start = index;
  let end = index + len;
  while (start > 0 && index - start < 120 && !TOKEN_BOUNDARY.test(text[start - 1])) start--;
  while (end < text.length && end - index < 160 && !TOKEN_BOUNDARY.test(text[end])) end++;
  const token = text
    .slice(start, end)
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/[?#].*$/, "")
    .replace(/^\/\//, "")
    .replace(/\\+$/, "");
  return token.length > 80 ? token.slice(0, 80) + "…" : token;
}

export function detectApps(pages: { key: "home" | "product"; html: string }[]): DetectedApp[] {
  const found = new Map<string, DetectedApp>();
  for (const { key, html } of pages) {
    const hay = stripSvg(html);
    for (const sig of APP_SIGNATURES) {
      const re = new RegExp(sig.re.source, "i");
      const m = re.exec(hay);
      if (!m) continue;
      const existing = found.get(sig.name);
      if (existing) {
        if (!existing.foundOn.includes(key)) existing.foundOn.push(key);
      } else {
        found.set(sig.name, {
          name: sig.name,
          category: sig.category,
          foundOn: [key],
          evidence: tokenAround(hay, m.index, m[0].length),
        });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

type WebPixel = { type?: string; configuration?: string };

export function detectPixels(html: string) {
  const pixels: DetectedPixel[] = [];
  for (const sig of PIXEL_SIGNATURES) {
    if (!new RegExp(sig.present.source, "i").test(html)) continue;
    const ids = new Set<string>();
    for (const re of sig.ids ?? []) for (const m of html.matchAll(re)) ids.add(m[1]);
    if (sig.ids && !ids.size && sig.name === "Google Analytics 4" && !/gtag|googletagmanager/i.test(html)) continue;
    const via = /web-pixel|webPixelsConfigList/i.test(html) && /pixel_id|pixelCode|google_tag_ids/i.test(html) ? "Script or Shopify web pixel" : "Script tag";
    pixels.push({ name: sig.name, ids: [...ids].slice(0, 6), via });
  }

  let webPixels: StackData["webPixels"] = null;
  const list = extractLiteral(html, /webPixelsConfigList"?\s*:\s*/, "[") as WebPixel[] | null;
  if (Array.isArray(list)) {
    webPixels = {
      app: list.filter((p) => p.type === "APP").length,
      custom: list.filter((p) => p.type === "CUSTOM").length,
    };
  }
  return { pixels, webPixels, marketingPixels: pixels.filter((p) => PIXEL_SIGNATURES.find((s) => s.name === p.name)?.marketing) };
}

const PAYMENT_NAMES: Record<string, string> = {
  shopify_pay: "Shop Pay",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  master: "Mastercard",
  american_express: "American Express",
  diners_club: "Diners Club",
  unionpay: "UnionPay",
  meta_pay: "Meta Pay",
  facebook_pay: "Meta Pay",
};

export function detectPayments(pages: string[], xray: StoreXray) {
  const names = new Map<string, string>();
  for (const html of pages) {
    for (const m of html.matchAll(/<title id="pi-([a-z0-9_-]+)"[^>]*>([^<]{1,40})<\/title>/gi)) {
      names.set(m[1].toLowerCase(), m[2].trim());
    }
    for (const m of html.matchAll(/aria-labelledby="pi-([a-z0-9_-]+)"/gi)) {
      const k = m[1].toLowerCase();
      if (!names.has(k)) names.set(k, PAYMENT_NAMES[k] || k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }
  for (const brand of xray.meta?.shopify_pay_enabled_card_brands ?? []) {
    const k = brand.toLowerCase();
    if (!names.has(k)) names.set(k, PAYMENT_NAMES[k] || brand.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  const all = pages.join("\n");
  const accelerated: string[] = [];
  if (/shopify-payment-button/i.test(all)) accelerated.push("Dynamic checkout buttons");
  if (names.has("shopify_pay") || /shop-pay|shopify_pay|shop_pay/i.test(all)) accelerated.push("Shop Pay");
  if (xray.meta?.offers_shop_pay_installments) accelerated.push("Shop Pay Installments");
  return { payments: [...new Set(names.values())], accelerated: [...new Set(accelerated)] };
}

export function thirdPartyScripts(pages: string[], ownHost: string) {
  const hosts = new Map<string, number>();
  const extensions = new Set<string>();
  const urls: string[] = [];
  for (const html of pages) {
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/gi)) urls.push(m[1]);
    // ScriptTag-injected app scripts are listed in content_for_header's asyncLoad urls array
    const asyncUrls = extractLiteral(html, /var urls\s*=\s*/, "[");
    if (Array.isArray(asyncUrls)) for (const u of asyncUrls) if (typeof u === "string") urls.push(u);
  }
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw.replace(/&amp;/g, "&"), `https://${ownHost}`);
    } catch {
      continue;
    }
    const ext = /\/extensions\/[^/]+\/([^/]+)\/assets\/([^/?]+)/.exec(u.pathname);
    if (ext) extensions.add(`${ext[1]}/${ext[2]}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === ownHost.replace(/^www\./, "") || SHOPIFY_HOST_RE.test(host)) continue;
    hosts.set(host, (hosts.get(host) || 0) + 1);
  }
  return {
    hosts: [...hosts.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count),
    extensions: [...extensions],
  };
}

const OVERLAP_CATEGORIES: AppCategory[] = [
  "Reviews",
  "Email & SMS",
  "Page builder",
  "Upsell & Bundles",
  "Search & Merchandising",
  "Loyalty & Referrals",
  "Consent & Privacy",
  "Support & Chat",
  "Popups & Conversion",
  "Subscriptions",
];

const EU = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE NO IS LI CH GB".split(" "));

function stackIssues(xray: StoreXray, s: StoreSummary, data: StackData, marketingPixels: DetectedPixel[]): Issue[] {
  const issues: Issue[] = [];
  const t = s.theme;
  const byCat = (c: string) => data.apps.filter((a) => a.category === c);
  const sellsToEu = (s.country && EU.has(s.country)) || s.shipsToCountries.some((c) => EU.has(c)) || s.currency === "EUR";
  // Headless frontends load their own scripts, so "missing app" and theme findings would be guesses.
  const headless = s.isHeadless;
  const backendOnly = !!xray.backendOnly;

  if (!headless && marketingPixels.length && !byCat("Consent & Privacy").length) {
    issues.push({
      id: "no-consent",
      title: "Marketing pixels fire without a detectable cookie banner",
      severity: sellsToEu ? "high" : "medium",
      category: "Privacy",
      detail: `We found ${marketingPixels.map((p) => p.name).join(", ")} but no consent banner script in the storefront HTML.${
        sellsToEu ? " This store sells to the EU/UK, where GDPR and ePrivacy require consent before marketing tracking." : ""
      }`,
      fix: "Enable Shopify's cookie banner (Settings > Customer privacy) or a consent app that supports Google Consent Mode v2 and Shopify's Customer Privacy API. Then confirm pixels wait for consent.",
      source: "rule",
    });
  }

  for (const cat of backendOnly ? [] : OVERLAP_CATEGORIES) {
    // Shopify's own banner script is loaded by the platform alongside third-party CMPs; not an overlap on its own.
    const apps = byCat(cat).filter((a) => a.name !== "Shopify cookie banner");
    if (apps.length > 1) {
      issues.push({
        id: `overlap-${cat}`,
        title: `${apps.length} ${cat.toLowerCase()} apps loading at once`,
        severity: apps.length > 2 ? "high" : "medium",
        category: "Apps",
        detail: `${apps.map((a) => a.name).join(", ")} all load on the storefront. Overlapping apps add JavaScript, slow pages and cost monthly fees.`,
        fix: "Keep one app per job. If an app was uninstalled, remove its leftover snippets from theme.liquid and the snippets/ folder, and disable its app embed under Theme editor > App embeds.",
        evidence: apps.map((a) => `${a.name}: ${a.evidence}`),
        source: "rule",
      });
    }
  }

  if (headless) return sortIssues(issues);

  if (t && !t.os2) {
    issues.push({
      id: "vintage-theme",
      title: "Theme looks like a vintage (pre-Online Store 2.0) theme",
      severity: "medium",
      category: "Theme",
      detail: "We didn't find JSON template sections on the homepage or product page. Vintage themes can't use app blocks or sections on every page, so apps inject code into theme files instead.",
      fix: "Plan a migration to an Online Store 2.0 theme (e.g. a current Theme Store theme). App blocks then install and uninstall cleanly without editing code.",
      source: "rule",
    });
  } else if (t && /id="shopify-section-\d{6,}"/.test(xray.homepage.text)) {
    issues.push({
      id: "legacy-index",
      title: "Homepage still uses legacy content_for_index sections",
      severity: "low",
      category: "Theme",
      detail: "Product pages use Online Store 2.0 JSON templates, but the homepage renders numbered legacy sections. App blocks and per-template section settings aren't available there.",
      fix: "Move the homepage to templates/index.json so its sections are managed like the rest of the theme.",
      source: "rule",
    });
  }
  if (t?.jquery) {
    issues.push({
      id: "jquery",
      title: "jQuery is loaded on the storefront",
      severity: "low",
      category: "Theme",
      detail: "Modern Shopify themes don't need jQuery. It's usually added by an older theme or an app and adds ~30 KB of render-delaying JavaScript.",
      fix: "Find which theme file or app includes jQuery (search theme.liquid and snippets for 'jquery'). Remove it if nothing depends on it, or load it with defer.",
      source: "rule",
    });
  }
  if (t && !t.themeStoreId) {
    issues.push({
      id: "custom-theme",
      title: "Custom or non-Theme-Store theme",
      severity: "low",
      category: "Theme",
      detail: `The theme${t.schemaName ? ` (${t.schemaName})` : ""} has no Theme Store ID, so it won't get one-click updates from Shopify.`,
      fix: "Keep a changelog of customizations and schedule a yearly review against Shopify's latest platform features (section groups, metaobjects, Checkout Extensibility).",
      source: "rule",
    });
  }
  if (data.thirdPartyHosts.length > 15) {
    issues.push({
      id: "many-hosts",
      title: `Scripts load from ${data.thirdPartyHosts.length} third-party domains`,
      severity: data.thirdPartyHosts.length > 25 ? "high" : "medium",
      category: "Performance",
      detail: "Every extra domain means DNS lookups, connections and JavaScript competing with your own content on mobile.",
      fix: "Audit which domains belong to apps you still use. Run our Speed Audit to see the weight each app adds.",
      evidence: data.thirdPartyHosts.slice(0, 8).map((h) => h.host),
      source: "rule",
    });
  }
  if (!byCat("Reviews").length) {
    issues.push({
      id: "no-reviews",
      title: "No reviews app detected",
      severity: "medium",
      category: "Conversion",
      detail: "We couldn't find a reviews widget on the homepage or product page. Social proof near the Add to cart button is one of the strongest conversion levers.",
      fix: "Install a reviews app with star ratings and Product schema (e.g. Judge.me, Okendo, Yotpo) and add its app block next to the price.",
      source: "rule",
    });
  }
  if (!byCat("Email & SMS").length) {
    issues.push({
      id: "no-email",
      title: "No email or SMS marketing app detected",
      severity: "low",
      category: "Marketing",
      detail: "No signup forms or tracking from an email/SMS platform were found on the storefront.",
      fix: "Connect an email platform (Shopify Email, Klaviyo, Omnisend) and set up welcome, abandoned cart and post-purchase flows.",
      source: "rule",
    });
  }
  if (!data.pixels.some((p) => p.name === "Google Analytics 4" || p.name === "Google Tag Manager") && !(data.webPixels && data.webPixels.app > 0)) {
    issues.push({
      id: "no-ga4",
      title: "No Google Analytics 4 found",
      severity: "low",
      category: "Analytics",
      detail: "We didn't detect GA4 or Google Tag Manager in the storefront HTML.",
      fix: "Install the Google & YouTube app from Shopify to send GA4 events through Shopify's Customer Events.",
      source: "rule",
    });
  }
  return sortIssues(issues);
}

export async function runStackDetector({ url }: { url: string }): Promise<StackReport> {
  const started = Date.now();
  const { xray, inputUrl, cached } = await getStoreXray(url);
  const warnings: string[] = [];

  let productUrl: string | null = null;
  let productHtml = "";
  const handle = productHandleFromPath(inputUrl.pathname) || (await pickBestSellerHandle(xray));
  if (handle) {
    productUrl = `${xray.origin}/products/${encodeURIComponent(handle)}`;
    try {
      const page = await getStorePage(productUrl);
      if (page.status === 200) productHtml = page.text;
      else productUrl = null;
    } catch {
      productUrl = null;
    }
  }
  if (!productUrl) warnings.push("We couldn't load a product page, so apps that only run on product pages may be missing.");
  if (xray.backendOnly) {
    warnings.push(
      `${xray.backendOnly.requestedHost} redirects to ${xray.backendOnly.onlineStoreHost}, Shopify's checkout domain. That usually means shoppers see a headless (custom-built) storefront, so the theme and apps below belong to the Shopify backend, not the live site. We skipped the health score.`,
    );
  } else if (xray.summary.isHeadless) {
    warnings.push("This looks like a headless or custom storefront. Theme detection needs Shopify's Online Store, so results are partial and we skipped the health score.");
  }

  const inputHost = inputUrl.hostname.replace(/^www\./, "");
  const finalHost = xray.summary.domain.replace(/^www\./, "");
  if (inputHost !== finalHost && !xray.backendOnly) {
    warnings.push(`${inputUrl.hostname} redirected to ${xray.summary.domain}, so that's the storefront we analyzed.`);
  }

  const home = xray.homepage.text;
  const theme = xray.summary.theme
    ? {
        ...xray.summary.theme,
        os2: xray.summary.theme.os2 || /shopify-section-template--\d+/.test(productHtml),
        sectionGroups: xray.summary.theme.sectionGroups || /shopify-section-sections--\d+/.test(productHtml),
      }
    : null;
  const summary = { ...xray.summary, theme };
  const pages = [{ key: "home" as const, html: home }, ...(productHtml ? [{ key: "product" as const, html: productHtml }] : [])];
  const apps = detectApps(pages);
  const { pixels, webPixels, marketingPixels } = detectPixels(home + "\n" + productHtml);
  const { payments, accelerated } = detectPayments([home, productHtml], xray);
  const { hosts, extensions } = thirdPartyScripts([home, productHtml], xray.summary.domain);

  const stack: StackData = {
    apps,
    pixels,
    webPixels,
    payments,
    accelerated,
    thirdPartyHosts: hosts,
    unknownExtensions: extensions.filter((e) => !APP_SIGNATURES.some((s) => new RegExp(s.re.source, "i").test(e))).slice(0, 20),
    productPageScanned: productUrl,
  };

  const issues = stackIssues(xray, summary, stack, marketingPixels);
  const penalty = issues.reduce((sum, i) => sum + (i.severity === "high" ? 15 : i.severity === "medium" ? 8 : 3), 0);
  const score = summary.isHeadless ? null : Math.max(20, 100 - penalty);
  const t = summary.theme;
  const themeText = t ? `${t.schemaName || t.name}${t.version ? ` ${t.version}` : ""}` : "an unknown theme";
  const storeName = xray.summary.name || xray.summary.domain;
  const counts = `${apps.length} detectable app${apps.length === 1 ? "" : "s"} and ${pixels.length} tracking pixel${pixels.length === 1 ? "" : "s"}`;

  return {
    tool: "store-stack-detector",
    analyzedUrl: xray.origin,
    store: summary,
    score,
    scoreLabel: scoreLabel(score),
    summary: summary.isHeadless
      ? `${storeName} runs a headless storefront. Its Shopify Online Store${t ? ` (${themeText})` : ""} shows ${counts}.`
      : `${storeName} runs ${themeText} with ${counts}. The stack health score reflects overlap, privacy and theme risks we found.`,
    issues,
    aiUsed: false,
    warnings,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    cached,
    stack,
  };
}
