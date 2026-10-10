import { TtlCache } from "../cache";
import { ToolError, normalizeInputUrl, safeFetch, safeFetchJson, type FetchResult } from "../http";
import type { StoreSummary, ThemeInfo } from "@/lib/report-types";

export type ShopifyProductLite = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  product_type: string;
  vendor: string;
  tags: string[] | string;
  published_at: string;
  created_at: string;
  variants: { id: number; price: string; compare_at_price: string | null; available?: boolean }[];
  images: { src: string; alt?: string | null }[];
  options?: { name: string; values: string[] }[];
};

type MetaJson = {
  name?: string;
  description?: string;
  myshopify_domain?: string;
  currency?: string;
  country?: string;
  ships_to_countries?: string[];
  published_products_count?: number;
  published_collections_count?: number;
  shopify_pay_enabled_card_brands?: string[];
  offers_shop_pay_installments?: boolean;
};

export type StoreXray = {
  origin: string;
  homepage: FetchResult;
  summary: StoreSummary;
  meta: MetaJson | null;
  products: ShopifyProductLite[];
  fetchedAt: number;
  /** Set when the domain redirects to Shopify's checkout/myshopify host: the shopper-facing site is a headless frontend. */
  backendOnly: { requestedHost: string; onlineStoreHost: string } | null;
};

const xrayCache = new TtlCache<StoreXray>(30 * 60_000, 300);
const pageCache = new TtlCache<FetchResult>(30 * 60_000, 600);

/** Extracts the balanced {...} or [...] literal that follows `marker` (string or regex). */
export function extractLiteral(source: string, marker: RegExp, open: "{" | "[" = "{"): unknown | null {
  const m = marker.exec(source);
  if (!m) return null;
  const close = open === "{" ? "}" : "]";
  const start = source.indexOf(open, m.index + m[0].length - 1);
  if (start < 0 || start - (m.index + m[0].length) > 3) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  const limit = Math.min(source.length, start + 400_000);
  for (let i = start; i < limit; i++) {
    const ch = source[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try {
        return JSON.parse(source.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function parseTheme(html: string): ThemeInfo | null {
  const raw = extractLiteral(html, /Shopify\.theme\s*=\s*/) as Record<string, unknown> | null;
  if (!raw) return null;
  const name = typeof raw.name === "string" ? raw.name : null;
  const schemaName = typeof raw.schema_name === "string" ? raw.schema_name : null;
  return {
    name,
    schemaName,
    version: typeof raw.schema_version === "string" ? raw.schema_version : null,
    themeStoreId: typeof raw.theme_store_id === "number" ? raw.theme_store_id : null,
    id: typeof raw.id === "number" ? raw.id : null,
    role: typeof raw.role === "string" ? raw.role : null,
    renamed: !!(name && schemaName && name.trim().toLowerCase() !== schemaName.trim().toLowerCase()),
    // JSON templates render section ids like "shopify-section-template--123__main"
    os2: /shopify-section-template--\d+/.test(html),
    sectionGroups: /shopify-section-sections--\d+/.test(html),
    jquery: /jquery[.-][\d.]*(min\.)?js|\/jquery\.min\.js|jquery\.js/i.test(html),
  };
}

function str(re: RegExp, html: string) {
  return re.exec(html)?.[1] ?? null;
}

function detectShopify(page: FetchResult) {
  const h = page.headers;
  const headerHit = !!(h["x-shopid"] || h["x-shopify-stage"] || /shopify/i.test(h["powered-by"] || "") || h["x-sorting-hat-shopid"]);
  const htmlHit = /cdn\.shopify\.com|Shopify\.shop\s*=|Shopify\.theme|myshopify\.com|\/cdn\/shop\//.test(page.text);
  const hydrogen = /hydrogen/i.test(h["powered-by"] || "") || /oxygen/i.test(h["server"] || "");
  return { isShopify: headerHit || htmlHit, hydrogen };
}

function isPasswordPage(page: FetchResult) {
  const path = new URL(page.url).pathname;
  return path.startsWith("/password") || /<form[^>]+action="\/password"/i.test(page.text) || /template-password/i.test(page.text);
}

function languagesFrom(html: string) {
  const langs = new Set<string>();
  for (const m of html.matchAll(/<link[^>]+hreflang="([a-zA-Z-]+)"/g)) {
    if (m[1].toLowerCase() !== "x-default") langs.add(m[1]);
  }
  return [...langs].slice(0, 30);
}

async function buildXray(origin: string): Promise<StoreXray> {
  const homepage = await safeFetch(origin + "/", { timeoutMs: 15_000 });
  const finalOrigin = new URL(homepage.url).origin;

  if (isPasswordPage(homepage)) {
    throw new ToolError(
      "password",
      "This store is password-protected, so its storefront isn't public yet. Try again after launch or test a live store.",
      422,
    );
  }
  if (homepage.status === 403 || homepage.status === 429 || homepage.status === 503) {
    throw new ToolError(
      "blocked",
      `${new URL(finalOrigin).hostname} blocked our request (HTTP ${homepage.status}). Some stores use bot protection; try again in a minute.`,
      502,
    );
  }
  if (homepage.status >= 400) {
    throw new ToolError("http_error", `The store returned HTTP ${homepage.status}.`, 502);
  }

  const [meta, productsJson] = await Promise.all([
    safeFetchJson<MetaJson>(finalOrigin + "/meta.json"),
    safeFetchJson<{ products: ShopifyProductLite[] }>(finalOrigin + "/products.json?limit=250"),
  ]);

  const { isShopify: shopifyMarkers, hydrogen } = detectShopify(homepage);
  const isShopify = shopifyMarkers || !!meta?.myshopify_domain;
  if (!isShopify) {
    throw new ToolError(
      "not_shopify",
      `We couldn't find Shopify on ${new URL(finalOrigin).hostname}. These tools work on Shopify stores only.`,
      422,
    );
  }

  const html = homepage.text;
  const theme = parseTheme(html);
  const requestedHost = new URL(origin).hostname;
  const finalHost = new URL(finalOrigin).hostname;
  const backendOnly =
    finalHost !== requestedHost && /(^|\.)checkout\.|\.myshopify\.com$/i.test(finalHost) && !/\.myshopify\.com$/i.test(requestedHost)
      ? { requestedHost, onlineStoreHost: finalHost }
      : null;
  const isHeadless = hydrogen || !theme || !!backendOnly;
  const currency =
    (extractLiteral(html, /Shopify\.currency\s*=\s*/) as { active?: string } | null)?.active ?? meta?.currency ?? null;

  const summary: StoreSummary = {
    domain: new URL(finalOrigin).hostname,
    url: finalOrigin,
    name:
      meta?.name ||
      str(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i, html) ||
      str(/<title>([^<]{1,80})/i, html)?.trim() ||
      null,
    myshopifyDomain: str(/Shopify\.shop\s*=\s*"([^"]+)"/, html) || meta?.myshopify_domain || null,
    isShopify: true,
    isHeadless,
    theme,
    currency,
    country: str(/Shopify\.country\s*=\s*"([A-Z]{2})"/, html) || meta?.country || null,
    locale: str(/Shopify\.locale\s*=\s*"([^"]+)"/, html),
    languages: languagesFrom(html),
    productsCount: meta?.published_products_count ?? null,
    collectionsCount: meta?.published_collections_count ?? null,
    shipsToCountries: Array.isArray(meta?.ships_to_countries) ? meta!.ships_to_countries!.slice(0, 250) : [],
  };

  return {
    origin: finalOrigin,
    homepage,
    summary,
    meta,
    products: productsJson?.products ?? [],
    fetchedAt: Date.now(),
    backendOnly,
  };
}

export async function getStoreXray(input: string) {
  const u = normalizeInputUrl(input);
  const origin = u.origin;
  const { value, cached } = await xrayCache.getOrCreate(origin, () => buildXray(origin));
  return { xray: value, inputUrl: u, cached };
}

/** Fetches (and caches) another storefront page of an already X-rayed store. */
export async function getStorePage(url: string) {
  const { value } = await pageCache.getOrCreate(url, () => safeFetch(url, { timeoutMs: 15_000 }));
  return value;
}

export function productHandleFromPath(pathname: string) {
  const m = /\/products\/([^/?#]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Best-selling product handle from /collections/all, falling back to the first product in products.json. */
export async function pickBestSellerHandle(xray: StoreXray) {
  try {
    const page = await getStorePage(xray.origin + "/collections/all?sort_by=best-selling");
    if (page.status === 200) {
      for (const m of page.text.matchAll(/href="[^"]*?\/products\/([a-z0-9][^"?#/]*)/gi)) {
        const handle = decodeURIComponent(m[1]);
        if (!/gift-?card/i.test(handle)) return handle;
      }
    }
  } catch {
    // fall through
  }
  const p = xray.products.find((p) => !/gift-?card/i.test(p.handle));
  if (p) return p.handle;
  const m = /href="[^"]*?\/products\/([a-z0-9][^"?#/]*)/i.exec(xray.homepage.text);
  return m ? decodeURIComponent(m[1]) : null;
}
