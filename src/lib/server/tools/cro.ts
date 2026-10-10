import * as cheerio from "cheerio";
import { ToolError, safeFetchJson } from "../http";
import { generateJson } from "../llm";
import { CRO_SCHEMA, CRO_SYSTEM } from "../prompts/pdp-cro-audit";
import { takeScreenshot } from "../screenshot";
import { getStorePage, getStoreXray, pickBestSellerHandle, productHandleFromPath, type StoreXray } from "../shopify/xray";
import { detectApps } from "./stack";
import { scoreLabel, sortIssues, type CheckResult, type CroReport, type Issue, type Severity } from "@/lib/report-types";

type ProductJs = {
  title: string;
  handle: string;
  description: string | null;
  available: boolean;
  price: number;
  compare_at_price: number | null;
  featured_image: string | null;
  images: string[];
  options: ({ name: string; values: string[] } | string)[];
  variants: { available: boolean; price: number; title: string }[];
  media?: { alt: string | null; media_type: string; src?: string }[];
};

type CheckDef = { id: string; title: string; area: string; weight: number; fix: string; code?: string };

const CHECKS: Record<string, CheckDef> = {
  media: { id: "media", title: "Enough product media", area: "Media", weight: 3, fix: "Show 5–7 media: front, back, close-up details, in-use/lifestyle and a scale shot. Use one aspect ratio (1:1 or 4:5) so the gallery doesn't jump." },
  video: { id: "video", title: "Video or 3D model", area: "Media", weight: 1, fix: "Add a 15–30 second product video or 3D model to the product's media. Shopify hosts it for free and themes show it in the gallery." },
  alt: { id: "alt", title: "Descriptive image alt text", area: "Media", weight: 1, fix: "Add alt text to each image (Products > media > Add alt text). It helps image SEO and accessibility, which the European Accessibility Act has required since June 2025." },
  reviews: { id: "reviews", title: "Reviews and star rating", area: "Social proof", weight: 3, fix: "Install a reviews app and add its star-rating app block directly under the product title, plus the full reviews widget lower on the page." },
  available: { id: "available", title: "Product is in stock", area: "Buy box", weight: 3, fix: "Turn on back-in-stock alerts, move sold-out products to the end of collections, and pause ads that point here." },
  checkout: { id: "checkout", title: "Dynamic checkout button (Shop Pay, Apple Pay...)", area: "Buy box", weight: 2, fix: "Theme editor > Product template > Buy buttons block > enable 'Show dynamic checkout buttons'." },
  shipping: { id: "shipping", title: "Shipping info near the CTA", area: "Risk reducers", weight: 2, fix: "Add a text block or collapsible row right under the buy buttons, e.g. 'Free shipping over €60 · Delivered in 2–4 working days'." },
  returns: { id: "returns", title: "Returns policy near the CTA", area: "Risk reducers", weight: 2, fix: "Add a line like '30-day free returns' under the buy buttons, linking to your refund policy." },
  delivery: { id: "delivery", title: "Delivery estimate", area: "Risk reducers", weight: 1, fix: "Show an estimated delivery window (e.g. 'Order today, arrives Tue–Thu'). Store per-product dispatch times in a metafield." },
  bnpl: { id: "bnpl", title: "Pay-later messaging for higher prices", area: "Buy box", weight: 1, fix: "Enable Shop Pay Installments or Klarna/PayPal Pay Later messaging under the price for products above €50." },
  description: { id: "description", title: "Description depth", area: "Content", weight: 2, fix: "Write 150–300 words: lead with benefits, then specs as bullets. Keep specs in a product metafield and render them in a collapsible row." },
  faq: { id: "faq", title: "FAQ / collapsible details", area: "Content", weight: 1, fix: "Add collapsible rows (Dawn: 'Collapsible row' block) for Shipping, Returns, Materials & care and FAQ." },
  crosssell: { id: "crosssell", title: "Cross-sell or recommendations", area: "Content", weight: 1, fix: "Add the 'Product recommendations' section, or the 'Complementary products' block powered by Shopify's Search & Discovery app." },
  sizeguide: { id: "sizeguide", title: "Size guide next to size options", area: "Buy box", weight: 2, fix: "Create a page with the size chart and add a 'Pop-up' block (Dawn) or a link next to the size picker." },
  variants: { id: "variants", title: "Variant buttons instead of dropdowns", area: "Buy box", weight: 1, fix: "Theme editor > Variant picker block > Style: Pills (or use color swatches). Dropdowns hide options and add taps on mobile." },
  schema: {
    id: "schema",
    title: "Product structured data",
    area: "SEO",
    weight: 2,
    fix: "Output Product JSON-LD with offers (and aggregateRating from your reviews app) in the main product section. It powers Google rich results and free listings.",
    code: `<script type="application/ld+json">\n  {{ product | structured_data }}\n</script>`,
  },
  meta: { id: "meta", title: "Meta title and description", area: "SEO", weight: 1, fix: "Edit 'Search engine listing' at the bottom of the product in Shopify admin: title ≤ 60 characters, description 120–160 characters." },
  vat: { id: "vat", title: "VAT-inclusive price shown (EU)", area: "Price", weight: 2, fix: "Settings > Taxes and duties: include tax in prices for EU markets. Dawn-based themes then show 'Tax included.' under the price automatically." },
  trust: { id: "trust", title: "Trust signals near the CTA", area: "Risk reducers", weight: 1, fix: "Add payment icons and a short guarantee line ('Secure checkout · 30-day returns') directly under the buy buttons." },
  sticky: { id: "sticky", title: "Sticky Add to cart on mobile", area: "Buy box", weight: 1, fix: "Add a sticky add-to-cart bar on mobile so the CTA stays reachable while shoppers read details and reviews." },
};

const RE = {
  shipping: /free shipping|free delivery|shipping|delivery|versand|lieferung|livraison|envío|envio|spedizione|verzending|bezorging|levering|frakt|wysyłka|dostawa|toimitus/i,
  returns: /return|refund|exchange|rückgabe|retoure|rücksend|umtausch|retour|devoluci|devoluç|reso |resi |rimborso|retur|zwrot|palautus|herroeping/i,
  delivery: /deliver(ed|y)? (by|between|within|in)|arrives?|estimated delivery|ships (in|within|today|tomorrow)|dispatch|lieferzeit|lieferung (bis|in|innerhalb)|zustellung|livraison (estimée|prévue|sous|en)|expédi|entrega (estimada|en)|consegna (prevista|in|entro)|levertijd|bezorgd (binnen|op)|leveranstid|dostawa w/i,
  vat: /tax(es)? included|incl\.? (vat|tax)|including (vat|tax)|inkl\.? ?(mwst|ust)|inklusive mehrwertsteuer|ttc|tva incluse|iva incluid|iva inclusa|incl\.? btw|inclusief btw|inkl\.? moms|inkl\.? mva|z vat|sis\. alv/i,
  bnpl: /klarna|afterpay|clearpay|shopify-installments|shop-pay-installments|installments|paypal-message|data-pp-message|scalapay|alma-widget|getalma|sezzle|affirm|riverty/i,
  sizeOption: /^(size|sizes|größe|grösse|groesse|taille|talla|taglia|maat|storlek|størrelse|rozmiar|koko)$/i,
  sizeGuide: /size (guide|chart)|sizing|fit guide|größentabelle|grössentabelle|größenberater|guide des tailles|guía de tallas|tabla de tallas|guida alle taglie|maattabel|storleksguide|størrelsesguide|tabela rozmiarów|kiwisizing/i,
  trust: /secure (checkout|payment)|sichere zahlung|sicher bezahlen|paiement sécurisé|pago seguro|pagamento sicuro|veilig betalen|money-back|guarantee|garantie|garantía|garanzia|gwarancja/i,
};

const EU = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));

function money(cents: number | null | undefined, currency: string | null) {
  if (cents === null || cents === undefined) return null;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency || "USD" }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

function jsonLdBlocks($: cheerio.CheerioAPI) {
  const out: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const list = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      for (const item of list) if (item && typeof item === "object") out.push(item);
    } catch {
      // ignore malformed blocks
    }
  });
  return out;
}

function isType(o: Record<string, unknown>, t: string) {
  const v = o["@type"];
  return v === t || (Array.isArray(v) && v.includes(t));
}

function runChecks(html: string, product: ProductJs | null, xray: StoreXray) {
  const $ = cheerio.load(html);
  const ld = jsonLdBlocks($);
  const productLd = ld.find((o) => isType(o, "Product") || isType(o, "ProductGroup"));
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  const title = $("title").text().trim();

  const headerText = $('header, [id*="shopify-section-header"], [id*="announcement"], .shopify-section-group-header-group').text().replace(/\s+/g, " ");
  const $main = $("main").length ? $("main").first() : $("body");
  $main.find('script, style, noscript, footer, [id*="shopify-section-footer"], .shopify-section-group-footer-group').remove();
  const mainHtml = $main.html() || "";
  const mainText = $main.text().replace(/\s+/g, " ");

  const results: CheckResult[] = [];
  const add = (id: string, status: CheckResult["status"], note: string) =>
    results.push({ id, title: CHECKS[id].title, area: CHECKS[id].area, status, note });

  const media = product?.media ?? product?.images.map((src) => ({ alt: null as string | null, media_type: "image", src })) ?? [];
  const mediaCount = media.length;
  add("media", mediaCount >= 5 ? "pass" : mediaCount >= 3 ? "warn" : "fail", `${mediaCount} media item${mediaCount === 1 ? "" : "s"} on this product.`);

  const rich = media.filter((m) => m.media_type !== "image").length;
  add("video", rich ? "pass" : "warn", rich ? `${rich} video/3D item${rich === 1 ? "" : "s"}.` : "No video or 3D model in the product media.");

  if (product?.media?.length) {
    const t = product.title.trim().toLowerCase();
    const real = product.media.filter((m) => m.alt && m.alt.trim() && m.alt.trim().toLowerCase() !== t).length;
    const ratio = real / product.media.length;
    add("alt", ratio >= 0.8 ? "pass" : ratio > 0 ? "warn" : "fail", `${real} of ${product.media.length} media have descriptive alt text${real === 0 ? " (empty or just the product title)" : ""}.`);
  } else add("alt", "na", "Media data unavailable.");

  const reviewApps = detectApps([{ key: "product", html }]).filter((a) => a.category === "Reviews");
  const ldRating = !!(productLd && productLd["aggregateRating"]);
  if (reviewApps.length || ldRating) {
    add("reviews", "pass", reviewApps.length ? `Reviews via ${reviewApps.map((a) => a.name).join(", ")}${ldRating ? " with rating schema" : ""}.` : "Rating found in structured data.");
  } else if (/class="[^"]*(review|rating|stars)[^"]*"/i.test(mainHtml)) {
    add("reviews", "warn", "A review/rating element exists but no known reviews app or rating schema was found.");
  } else add("reviews", "fail", "No reviews widget or star rating found on the page.");

  if (product) {
    const soldOut = product.variants.filter((v) => !v.available).length;
    add("available", product.available ? "pass" : "fail", product.available ? (soldOut ? `${soldOut} of ${product.variants.length} variants sold out.` : "All variants available.") : "Every variant is sold out.");
  } else add("available", "na", "Product data unavailable.");

  add("checkout", /shopify-payment-button/i.test(html) ? "pass" : "warn", /shopify-payment-button/i.test(html) ? "Dynamic checkout buttons are enabled." : "No dynamic checkout (Shop Pay / Apple Pay / Google Pay) button found.");

  if (RE.shipping.test(mainText)) add("shipping", "pass", "Shipping information appears in the product area.");
  else if (RE.shipping.test(headerText)) add("shipping", "warn", "Shipping info only appears in the header/announcement bar, not near the buy button.");
  else add("shipping", "fail", "No shipping cost, threshold or delivery info on the product page.");

  add("returns", RE.returns.test(mainText) ? "pass" : "fail", RE.returns.test(mainText) ? "Returns are mentioned on the page." : "No returns or refund information on the product page.");
  add("delivery", RE.delivery.test(mainText) ? "pass" : "warn", RE.delivery.test(mainText) ? "A delivery timeframe is shown." : "No delivery estimate found.");

  const priceMajor = product ? product.price / 100 : 0;
  if (product && priceMajor >= 50) {
    add("bnpl", RE.bnpl.test(html) ? "pass" : "warn", RE.bnpl.test(html) ? "Pay-later messaging found." : `Price is ${money(product.price, xray.summary.currency)} but no pay-later messaging was found.`);
  } else add("bnpl", "na", "Price under 50; pay-later messaging is optional.");

  const descText = cheerio.load(product?.description || "").text().replace(/\s+/g, " ").trim();
  const words = descText ? descText.split(" ").length : 0;
  const structured = /<(li|h[2-4])\b/i.test(product?.description || "");
  add("description", words >= 80 ? "pass" : words >= 30 ? "warn" : "fail", `${words} words${structured ? ", with bullets/headings" : ", no bullets or headings"}.`);

  const faq = $main.find("details, [class*='accordion'], [class*='collapsible']").length > 0;
  add("faq", faq ? "pass" : "warn", faq ? "Collapsible content blocks found." : "No FAQ or collapsible detail rows found.");

  const cross = /product-recommendations|complementary|recommendations|rebuyengine|frequently-bought|cbb-frequently|you may also like/i.test(html);
  add("crosssell", cross ? "pass" : "warn", cross ? "Recommendations or cross-sell found." : "No product recommendations or cross-sell found.");

  const optionNames = (product?.options ?? []).map((o) => (typeof o === "string" ? o : o.name));
  if (optionNames.some((n) => RE.sizeOption.test(n.trim()))) {
    add("sizeguide", RE.sizeGuide.test(html) ? "pass" : "fail", RE.sizeGuide.test(html) ? "Size guide found." : "This product has sizes but no size guide or chart was found.");
  } else add("sizeguide", "na", "No size option on this product.");

  if (product && product.variants.length > 1) {
    const buttons = $main.find('input[type="radio"], [class*="swatch"], variant-radios, [class*="variant-pill"], [class*="option-button"]').length > 0;
    const select = $main.find('select[name^="options"], select[name="id"], variant-selects select').length > 0;
    add("variants", buttons ? "pass" : select ? "warn" : "na", buttons ? "Variants use buttons or swatches." : select ? "Variants are picked from a dropdown." : "Couldn't identify the variant picker.");
  } else add("variants", "na", "Single-variant product.");

  if (productLd) {
    const hasOffers = !!productLd["offers"] || !!productLd["hasVariant"];
    add("schema", hasOffers ? "pass" : "warn", `Product schema found${hasOffers ? " with offers" : " but without offers"}${ldRating ? " and aggregateRating" : ""}.`);
  } else add("schema", "fail", "No Product JSON-LD structured data found.");

  const metaOk = title.length >= 10 && title.length <= 70 && metaDesc.length >= 50 && metaDesc.length <= 170;
  add(
    "meta",
    metaOk ? "pass" : !title || !metaDesc ? "fail" : "warn",
    `Title ${title.length} chars${title.length > 70 ? " (Google cuts off after ~60)" : ""}, meta description ${metaDesc.length} chars${
      metaDesc.length > 170 ? " (too long)" : metaDesc.length < 50 ? " (too short)" : ""
    }.`,
  );

  const s = xray.summary;
  if ((s.country && EU.has(s.country)) || s.currency === "EUR") {
    add("vat", RE.vat.test(mainText) ? "pass" : "warn", RE.vat.test(mainText) ? "Tax-inclusive pricing is stated." : "EU store, but no 'VAT/tax included' text near the price.");
  } else add("vat", "na", "Not an EU storefront.");

  const trust = /pi-[a-z_]+/.test(mainHtml) || RE.trust.test(mainText);
  add("trust", trust ? "pass" : "warn", trust ? "Payment icons or guarantee text near the product." : "No payment icons or guarantee text in the product area.");

  const sticky = /sticky[-_ ]?(atc|add|cart|buy)|sticky-add-to-cart|stickyatc/i.test(html);
  add("sticky", sticky ? "pass" : "warn", sticky ? "Sticky add-to-cart found." : "No sticky add-to-cart bar detected.");

  let total = 0;
  let got = 0;
  for (const r of results) {
    if (r.status === "na") continue;
    const w = CHECKS[r.id].weight;
    total += w;
    got += r.status === "pass" ? w : r.status === "warn" ? w * 0.5 : 0;
  }
  const checklistScore = total ? Math.round((got / total) * 100) : 0;

  return { results, checklistScore, mainText: mainText.slice(0, 2500), pageTitle: title };
}

function checkSeverity(r: CheckResult): Severity {
  const w = CHECKS[r.id].weight;
  if (r.status === "fail") return w >= 3 ? "high" : w === 2 ? "medium" : "low";
  return w >= 3 ? "medium" : "low";
}

type AiCro = {
  score: number;
  summary: string;
  above_the_fold: { cta_visible_mobile: boolean | null; price_visible_mobile: boolean | null; notes: string };
  findings: { title: string; severity: Severity; area: string; observation: string; recommendation: string; effort: "S" | "M" | "L" }[];
  strengths: string[];
  quick_wins: string[];
};

/** Shopify's CDN resizes on the fly; the original can be several MB. */
function thumbnail(src: string) {
  try {
    const u = new URL(src);
    u.searchParams.set("width", "320");
    return u.toString();
  } catch {
    return src;
  }
}

export async function runCroAudit({ url }: { url: string }): Promise<CroReport> {
  const started = Date.now();
  const { xray, inputUrl } = await getStoreXray(url);
  const warnings: string[] = [];

  if (xray.backendOnly) {
    throw new ToolError(
      "headless",
      `${xray.backendOnly.requestedHost} redirects to Shopify's checkout domain (${xray.backendOnly.onlineStoreHost}), which means shoppers see a headless, custom-built storefront. This audit reads Shopify Online Store product pages, so it can't review that site. Try the Speed Audit instead.`,
      422,
    );
  }

  const handle = productHandleFromPath(inputUrl.pathname) || (await pickBestSellerHandle(xray));
  if (!handle) {
    throw new ToolError("no_product", "We couldn't find a product on this store. Paste a full product URL (…/products/your-product).", 422);
  }
  const pdpUrl = productHandleFromPath(inputUrl.pathname)
    ? `${xray.origin}${inputUrl.pathname}`
    : `${xray.origin}/products/${encodeURIComponent(handle)}`;
  if (!productHandleFromPath(inputUrl.pathname)) warnings.push(`No product URL given, so we audited the best-seller: /products/${handle}`);

  const [page, product, mobileShot, desktopShot] = await Promise.all([
    getStorePage(pdpUrl),
    safeFetchJson<ProductJs>(`${xray.origin}/products/${encodeURIComponent(handle)}.js`),
    takeScreenshot(pdpUrl, "mobile"),
    takeScreenshot(pdpUrl, "desktop"),
  ]);
  if (page.status === 404) throw new ToolError("not_found", "That product page returned 404. Check the URL and try again.", 422);
  if (page.status >= 400) throw new ToolError("http_error", `The product page returned HTTP ${page.status}.`, 502);
  if (!product) warnings.push("We couldn't read the product's JSON data, so media and variant checks are limited.");
  if (!mobileShot && !desktopShot) warnings.push("Screenshots couldn't be captured, so the visual review is based on page content only.");

  const { results, checklistScore, mainText, pageTitle } = runChecks(page.text, product, xray);
  const currency = xray.summary.currency;

  let ai: AiCro | null = null;
  const remaining = 57_000 - (Date.now() - started);
  if (remaining > 10_000) {
    const images = [mobileShot, desktopShot].filter((s): s is NonNullable<typeof s> => !!s).map((s) => s.image);
    const context = {
      store: { name: xray.summary.name, domain: xray.summary.domain, country: xray.summary.country, currency, theme: xray.summary.theme?.schemaName },
      product: product
        ? {
            title: product.title,
            price: money(product.price, currency),
            compare_at_price: money(product.compare_at_price, currency),
            available: product.available,
            variants: product.variants.length,
            options: product.options.map((o) => (typeof o === "string" ? o : o.name)),
            media: product.media?.length ?? product.images.length,
          }
        : null,
      automated_checks: results.filter((r) => r.status !== "na").map((r) => `${r.status.toUpperCase()}: ${r.title} — ${r.note}`),
      page_text_excerpt: mainText,
      screenshots: images.length === 2 ? "Image 1 = mobile 390px above the fold, image 2 = desktop 1440px above the fold" : images.length === 1 ? (mobileShot ? "Image 1 = mobile" : "Image 1 = desktop") : "Screenshots unavailable; review page content only and set above_the_fold values to null.",
    };
    const res = await generateJson<AiCro>({
      name: "pdp_cro_audit",
      system: CRO_SYSTEM,
      user: `Audit this Shopify product page: ${pdpUrl}\n\n${JSON.stringify(context)}`,
      schema: CRO_SCHEMA,
      images,
      timeoutMs: remaining - 1500,
      maxTokens: 2500,
    });
    ai = res.data;
    if (!ai && res.error === "daily_cap") warnings.push("Today's AI budget is used up, so this audit uses the automated checklist only.");
    if (!ai && res.error === "not_configured") warnings.push("AI vision review is off (no LLM key configured), so this audit uses the automated checklist only.");
  }

  const issues: Issue[] = [];
  for (const [i, f] of (ai?.findings ?? []).entries()) {
    issues.push({ id: `ai-${i}`, title: f.title, severity: f.severity, category: f.area, detail: f.observation, fix: f.recommendation, effort: f.effort, source: "ai" });
  }
  for (const r of results) {
    if (r.status !== "fail" && r.status !== "warn") continue;
    const def = CHECKS[r.id];
    issues.push({ id: r.id, title: def.title, severity: checkSeverity(r), category: def.area, detail: r.note, fix: def.fix, code: def.code, source: "rule" });
  }

  const visionScore = ai ? Math.max(0, Math.min(100, Math.round(ai.score))) : null;
  const score = visionScore === null ? checklistScore : Math.round(checklistScore * 0.5 + visionScore * 0.5);
  const failed = results.filter((r) => r.status === "fail").length;
  const img = product?.featured_image || product?.images?.[0] || null;

  return {
    tool: "pdp-cro-audit",
    analyzedUrl: pdpUrl,
    store: xray.summary,
    score,
    scoreLabel: scoreLabel(score),
    summary:
      ai?.summary ||
      `"${product?.title || pageTitle}" passes ${results.filter((r) => r.status === "pass").length} of ${results.filter((r) => r.status !== "na").length} checks in our PDP checklist${failed ? `, with ${failed} clear gap${failed === 1 ? "" : "s"}` : ""}. Fix the high-impact items first; they sit closest to the Add to cart decision.`,
    issues: sortIssues(issues),
    aiUsed: !!ai,
    warnings,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    cro: {
      product: {
        title: product?.title || pageTitle,
        url: pdpUrl,
        price: money(product?.price, currency),
        compareAtPrice: product?.compare_at_price && product.compare_at_price > product.price ? money(product.compare_at_price, currency) : null,
        available: product?.available ?? null,
        images: product?.media?.length ?? product?.images.length ?? 0,
        variants: product?.variants.length ?? 0,
        image: img ? thumbnail(img.startsWith("//") ? `https:${img}` : img) : null,
      },
      screenshots: { mobile: mobileShot?.dataUrl ?? null, desktop: desktopShot?.dataUrl ?? null },
      checklistScore,
      visionScore,
      checks: results,
      aboveTheFold: ai
        ? { ctaVisible: ai.above_the_fold.cta_visible_mobile, priceVisible: ai.above_the_fold.price_visible_mobile, notes: ai.above_the_fold.notes }
        : null,
      strengths: ai?.strengths ?? [],
      quickWins: ai?.quick_wins ?? [],
    },
  };
}
