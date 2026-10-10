export type Severity = "high" | "medium" | "low";

export type Issue = {
  id: string;
  title: string;
  severity: Severity;
  category?: string;
  detail: string;
  fix: string;
  code?: string;
  evidence?: string[];
  source?: "rule" | "ai";
  effort?: "S" | "M" | "L";
};

export type ThemeInfo = {
  name: string | null;
  schemaName: string | null;
  version: string | null;
  themeStoreId: number | null;
  id: number | null;
  role: string | null;
  renamed: boolean;
  os2: boolean;
  sectionGroups: boolean;
  jquery: boolean;
};

export type StoreSummary = {
  domain: string;
  url: string;
  name: string | null;
  myshopifyDomain: string | null;
  isShopify: boolean;
  isHeadless: boolean;
  theme: ThemeInfo | null;
  currency: string | null;
  country: string | null;
  locale: string | null;
  languages: string[];
  productsCount: number | null;
  collectionsCount: number | null;
  shipsToCountries: string[];
};

type BaseReport = {
  analyzedUrl: string;
  store: StoreSummary | null;
  score: number | null;
  scoreLabel: string;
  summary: string;
  issues: Issue[];
  aiUsed: boolean;
  warnings: string[];
  generatedAt: string;
  durationMs: number;
  cached?: boolean;
};

export type DetectedApp = {
  name: string;
  category: string;
  foundOn: ("home" | "product")[];
  evidence: string;
};

export type DetectedPixel = {
  name: string;
  ids: string[];
  via: string;
};

export type StackData = {
  apps: DetectedApp[];
  pixels: DetectedPixel[];
  webPixels: { app: number; custom: number } | null;
  payments: string[];
  accelerated: string[];
  thirdPartyHosts: { host: string; count: number }[];
  unknownExtensions: string[];
  productPageScanned: string | null;
};

export type StackReport = BaseReport & { tool: "store-stack-detector"; stack: StackData };

export type MetricRating = "good" | "ni" | "poor" | "unknown";

export type SpeedMetric = {
  id: string;
  label: string;
  value: string;
  numeric: number | null;
  rating: MetricRating;
};

export type WeightBucket = { label: string; bytes: number; requests: number; color: string };

export type AppWeight = {
  name: string;
  kind: "app" | "theme" | "shopify" | "third-party" | "tracking";
  bytes: number;
  mainThreadMs: number;
  blockingMs: number;
  requests: number;
};

export type ActionStep = {
  title: string;
  why: string;
  how: string[];
  code: string;
  impact: "high" | "medium" | "low";
  effort: "S" | "M" | "L";
  owner: "merchant" | "developer";
};

export type SpeedData = {
  mobile: { score: number | null; lab: SpeedMetric[]; screenshot: string | null } | null;
  desktop: { score: number | null; lab: SpeedMetric[] } | null;
  field: { scope: "url" | "origin"; overall: MetricRating; metrics: SpeedMetric[] } | null;
  weight: WeightBucket[];
  totalBytes: number;
  totalRequests: number;
  topScripts: AppWeight[];
  plan: ActionStep[];
  lighthouseVersion: string | null;
};

export type SpeedReport = BaseReport & { tool: "speed-audit"; speed: SpeedData };

export type CheckResult = {
  id: string;
  title: string;
  area: string;
  status: "pass" | "fail" | "warn" | "na";
  note: string;
};

export type CroData = {
  product: {
    title: string;
    url: string;
    price: string | null;
    compareAtPrice: string | null;
    available: boolean | null;
    images: number;
    variants: number;
    image: string | null;
  };
  screenshots: { mobile: string | null; desktop: string | null };
  checklistScore: number;
  visionScore: number | null;
  checks: CheckResult[];
  aboveTheFold: { ctaVisible: boolean | null; priceVisible: boolean | null; notes: string } | null;
  strengths: string[];
  quickWins: string[];
};

export type CroReport = BaseReport & { tool: "pdp-cro-audit"; cro: CroData };

export type AnyReport = StackReport | SpeedReport | CroReport;

export function scoreLabel(score: number | null) {
  if (score === null) return "No score";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs work";
  return "Critical";
}

export function sortIssues(issues: Issue[]) {
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return [...issues].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
