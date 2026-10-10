// Single source of truth for every tool on lemy.ai.
// Adding a tool = add an entry here (+ a runner in src/lib/server/runners.ts for live tools).
// This file is imported by client components, so keep it free of secrets and server code.

export type ToolTab = "merchants" | "developers";
export type ToolArea = "Store" | "Money" | "Marketing" | "Customers" | "Operations";
export type ToolStatus = "live" | "soon";
export type InputType = "url" | "text" | "csv" | "form";
export type IconName =
  | "target"
  | "bolt"
  | "layers"
  | "search"
  | "coins"
  | "megaphone"
  | "users"
  | "truck"
  | "tag"
  | "code";

export type ToolConfig = {
  slug: string;
  name: string;
  /** Page <title>; defaults to the name */
  seoTitle?: string;
  /** One-line outcome shown on cards */
  outcome: string;
  /** SEO description + tool page intro */
  description: string;
  tabs: ToolTab[];
  area: ToolArea;
  featured: boolean;
  status: ToolStatus;
  /** ISO date; tools launched in the last 14 days get a "New" badge */
  launchedAt?: string;
  icon: IconName;
  /** Two accent colours for the card glow */
  accent: [string, string];
  builtOn: string;
  eta: string;
  usesAi: boolean;
  input: {
    type: InputType;
    label: string;
    placeholder: string;
    hint: string;
    examples?: string[];
  };
  /** Ordered progress messages shown while the tool runs */
  steps: string[];
  checks: string[];
  faq: { q: string; a: string }[];
};

export const TOOLS: ToolConfig[] = [
  {
    slug: "pdp-cro-audit",
    name: "PDP CRO Audit",
    seoTitle: "Free Shopify Product Page CRO Audit with Vision AI",
    outcome: "Find what stops shoppers from adding to cart on your product page.",
    description:
      "Free Shopify product page audit. We screenshot your PDP on mobile and desktop, score it against Script Commerce's CRO checklist with a vision model, and return the top fixes ranked by impact.",
    tabs: ["merchants"],
    area: "Store",
    featured: true,
    status: "live",
    launchedAt: "2026-10-10",
    icon: "target",
    accent: ["#ff5fd2", "#a26bff"],
    builtOn: "URL + Vision AI",
    eta: "~40s",
    usesAi: true,
    input: {
      type: "url",
      label: "Product page or store URL",
      placeholder: "yourstore.com/products/best-seller",
      hint: "Paste a product URL, or just the store domain and we audit its best-seller.",
      examples: ["allbirds.com", "snocks.com", "brooklinen.com"],
    },
    steps: [
      "Resolving store and product",
      "Reading product data",
      "Capturing mobile + desktop screenshots",
      "Running the CRO checklist",
      "Vision model reviewing above-the-fold",
      "Ranking fixes by impact",
    ],
    checks: [
      "Mobile above-the-fold: image, price and Add to cart visible without scrolling",
      "Media depth: number of images, video/3D, alt text",
      "Social proof: reviews widget and star rating schema",
      "Buy box: dynamic checkout, BNPL messaging, variant pickers",
      "Risk reducers: shipping, returns, delivery estimate near the CTA",
      "EU price rules: VAT-inclusive pricing shown",
      "Content: description depth, FAQ, size guide",
      "SEO: Product schema, meta title and description",
    ],
    faq: [
      {
        q: "Which page should I audit?",
        a: "Your highest-traffic product page. If you paste just the domain, we pick the store's best-selling product automatically.",
      },
      {
        q: "Does this work for headless stores?",
        a: "Not yet. The audit reads Shopify Online Store product pages, so custom headless frontends aren't supported. The Speed Audit works on any URL.",
      },
      {
        q: "Is my data stored?",
        a: "We only read public pages. Results are cached for 30 minutes to keep the tool free.",
      },
    ],
  },
  {
    slug: "speed-audit",
    name: "Speed Audit + Shopify Fixes",
    seoTitle: "Free Shopify Speed Test with App-by-App Fixes",
    outcome: "Turn PageSpeed scores into Shopify fixes: apps, images and Liquid.",
    description:
      "Free Shopify speed test. We run Google PageSpeed Insights, attribute every slow script to the app or theme file that loaded it, and translate the results into concrete Shopify fixes with Liquid snippets.",
    tabs: ["merchants", "developers"],
    area: "Store",
    featured: true,
    status: "live",
    launchedAt: "2026-10-10",
    icon: "bolt",
    accent: ["#7cf8ff", "#4dffb0"],
    builtOn: "URL + PageSpeed + AI",
    eta: "~45s",
    usesAi: true,
    input: {
      type: "url",
      label: "Page URL",
      placeholder: "yourstore.com",
      hint: "Homepage by default. Paste a product or collection URL to test that template.",
      examples: ["allbirds.com", "skims.com", "brooklinen.com"],
    },
    steps: [
      "Fetching store and theme",
      "Running Lighthouse on mobile",
      "Running Lighthouse on desktop",
      "Attributing scripts to apps and theme files",
      "Writing Shopify-specific fixes",
    ],
    checks: [
      "Core Web Vitals from real Chrome users (CrUX) and lab data",
      "JavaScript weight per app, theme and Shopify platform",
      "LCP image: lazy-loading, fetchpriority, responsive sizes",
      "Render-blocking CSS, fonts and app scripts",
      "Layout shift from app widgets and unsized images",
      "Liquid/server response time and DOM size",
    ],
    faq: [
      {
        q: "Why is my score different each run?",
        a: "Lighthouse runs on Google's servers with simulated throttling, so scores vary by a few points. Focus on the fixes and the field data from real users.",
      },
      {
        q: "Will removing apps break my store?",
        a: "Uninstalling an app doesn't always remove the code it injected into your theme. Our report shows which leftovers to check; ask us if you want it done safely.",
      },
    ],
  },
  {
    slug: "store-stack-detector",
    name: "Store Stack Detector",
    seoTitle: "Shopify Theme & App Detector: See Any Store's Stack",
    outcome: "See any store's theme, apps, pixels and payment methods in seconds.",
    description:
      "Free Shopify store stack detector. Enter any Shopify domain to see its theme name and version, installed apps (by script signature), tracking pixels and payment methods. Built for competitor research.",
    tabs: ["merchants", "developers"],
    area: "Store",
    featured: true,
    status: "live",
    launchedAt: "2026-10-10",
    icon: "layers",
    accent: ["#a26bff", "#7cf8ff"],
    builtOn: "URL + HTML parsing",
    eta: "~10s",
    usesAi: false,
    input: {
      type: "url",
      label: "Store URL",
      placeholder: "competitor.com",
      hint: "Any public Shopify store. Password-protected and headless stores return a partial result.",
      examples: ["allbirds.com", "mvmt.com", "snocks.com"],
    },
    steps: [
      "Fetching homepage",
      "Reading Shopify.theme and store metadata",
      "Scanning a product page",
      "Matching app script signatures",
      "Detecting pixels and payment methods",
    ],
    checks: [
      "Theme name, original theme, version, Theme Store ID, OS 2.0",
      "80+ apps by script signature (reviews, email, subscriptions, upsell, search...)",
      "Pixels with IDs: GA4, Google Ads, GTM, Meta, TikTok, Pinterest and more",
      "Shopify web pixels (Customer Events) count",
      "Payment methods and BNPL widgets",
      "Markets: currency, languages, ships-to countries",
    ],
    faq: [
      {
        q: "How accurate is app detection?",
        a: "We match script signatures in the public HTML of the homepage and a product page. Apps that only run in the admin or checkout aren't visible from the storefront.",
      },
      {
        q: "Is it legal to check a competitor?",
        a: "Yes. We only read what every visitor's browser downloads: public HTML and Shopify's public JSON endpoints.",
      },
    ],
  },

  // Candidates from the roadmap (not final). Remove or flip to "live" as tools ship.
  {
    slug: "catalog-health-check",
    name: "Catalog Health Check",
    outcome: "Missing descriptions, alt text, single-image products and duplicates.",
    description: "Scan a Shopify catalog for content gaps.",
    tabs: ["merchants"],
    area: "Store",
    featured: false,
    status: "soon",
    icon: "search",
    accent: ["#7cf8ff", "#a26bff"],
    builtOn: "URL",
    eta: "~20s",
    usesAi: false,
    input: { type: "url", label: "", placeholder: "", hint: "" },
    steps: [],
    checks: [],
    faq: [],
  },
  {
    slug: "break-even-roas",
    name: "Profit & Break-even ROAS",
    outcome: "Know the ROAS you need before you scale ad spend.",
    description: "Calculator for margin and break-even ROAS.",
    tabs: ["merchants"],
    area: "Money",
    featured: false,
    status: "soon",
    icon: "coins",
    accent: ["#4dffb0", "#7cf8ff"],
    builtOn: "Calculator",
    eta: "instant",
    usesAi: false,
    input: { type: "form", label: "", placeholder: "", hint: "" },
    steps: [],
    checks: [],
    faq: [],
  },
  {
    slug: "ad-hook-generator",
    name: "Ad Hook Generator",
    outcome: "Scroll-stopping ad hooks written from your product page.",
    description: "Generate ad hooks from a product URL.",
    tabs: ["merchants"],
    area: "Marketing",
    featured: false,
    status: "soon",
    icon: "megaphone",
    accent: ["#ff5fd2", "#ffcc66"],
    builtOn: "URL + AI",
    eta: "~20s",
    usesAi: true,
    input: { type: "url", label: "", placeholder: "", hint: "" },
    steps: [],
    checks: [],
    faq: [],
  },
  {
    slug: "review-miner",
    name: "Review Miner",
    outcome: "Objections, customer phrases and copy angles from your reviews.",
    description: "Mine product reviews for copy angles.",
    tabs: ["merchants"],
    area: "Customers",
    featured: false,
    status: "soon",
    icon: "users",
    accent: ["#a26bff", "#ff5fd2"],
    builtOn: "CSV + AI",
    eta: "~30s",
    usesAi: true,
    input: { type: "csv", label: "", placeholder: "", hint: "" },
    steps: [],
    checks: [],
    faq: [],
  },
  {
    slug: "dimensional-weight",
    name: "Shipping & Dim-Weight Calculator",
    outcome: "Pick the box that costs least to ship across EU carriers.",
    description: "Dimensional weight calculator.",
    tabs: ["merchants"],
    area: "Operations",
    featured: false,
    status: "soon",
    icon: "truck",
    accent: ["#ffcc66", "#4dffb0"],
    builtOn: "Calculator",
    eta: "instant",
    usesAi: false,
    input: { type: "form", label: "", placeholder: "", hint: "" },
    steps: [],
    checks: [],
    faq: [],
  },
  {
    slug: "liquid-cheatsheet",
    name: "Liquid Cheatsheet",
    outcome: "Every Liquid object, filter and tag with copy-ready examples.",
    description: "Liquid reference for Shopify developers.",
    tabs: ["developers"],
    area: "Store",
    featured: false,
    status: "soon",
    icon: "code",
    accent: ["#7cf8ff", "#ff5fd2"],
    builtOn: "Resource",
    eta: "instant",
    usesAi: false,
    input: { type: "text", label: "", placeholder: "", hint: "" },
    steps: [],
    checks: [],
    faq: [],
  },
];

export const AREAS: ToolArea[] = ["Store", "Money", "Marketing", "Customers", "Operations"];

export const NEW_BADGE_DAYS = 14;

export function isNew(tool: ToolConfig, now = new Date()) {
  if (!tool.launchedAt || tool.status !== "live") return false;
  const days = (now.getTime() - new Date(tool.launchedAt).getTime()) / 86_400_000;
  return days >= 0 && days <= NEW_BADGE_DAYS;
}

export const liveTools = () => TOOLS.filter((t) => t.status === "live");
export const getTool = (slug: string) => TOOLS.find((t) => t.slug === slug && t.status === "live");
