import { ToolError } from "./http";

// Google PageSpeed Insights v5. Lighthouse 12 uses classic audit ids, Lighthouse 13 replaced many with
// "*-insight" audits; callers should look up both.

export type LhAudit = {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  metricSavings?: Record<string, number>;
  details?: {
    type?: string;
    items?: Record<string, unknown>[];
    data?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
  };
};

export type PsiMetric = { percentile?: number; category?: string };

export type PsiResult = {
  strategy: "mobile" | "desktop";
  score: number | null;
  audits: Record<string, LhAudit>;
  lighthouseVersion: string | null;
  finalUrl: string;
  fullPageScreenshot: string | null;
  field: { scope: "url" | "origin"; overall: string | null; metrics: Record<string, PsiMetric> } | null;
};

type PsiResponse = {
  loadingExperience?: { id?: string; overall_category?: string; metrics?: Record<string, PsiMetric>; origin_fallback?: boolean };
  originLoadingExperience?: { overall_category?: string; metrics?: Record<string, PsiMetric> };
  lighthouseResult?: {
    finalDisplayedUrl?: string;
    finalUrl?: string;
    lighthouseVersion?: string;
    categories?: { performance?: { score: number | null } };
    audits?: Record<string, LhAudit>;
    fullPageScreenshot?: { screenshot?: { data?: string } };
    runtimeError?: { code?: string; message?: string };
  };
  error?: { code?: number; message?: string };
};

export async function runPsi(url: string, strategy: "mobile" | "desktop", timeoutMs = 55_000): Promise<PsiResult> {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", strategy);
  api.searchParams.set("category", "performance");
  if (process.env.PSI_API_KEY) api.searchParams.set("key", process.env.PSI_API_KEY);

  let res: Response;
  try {
    res = await fetch(api, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ToolError("psi_timeout", "Google PageSpeed took too long to test this page. Please try again.", 504);
  }
  const json = (await res.json().catch(() => ({}))) as PsiResponse;
  if (!res.ok || json.error) {
    if (res.status === 429) {
      throw new ToolError(
        "psi_quota",
        process.env.PSI_API_KEY
          ? "Google PageSpeed's daily quota is used up. Please try again later."
          : "Google PageSpeed's shared quota is busy. Add a free PSI_API_KEY to .env.local to fix this.",
        503,
      );
    }
    const msg = json.error?.message || `HTTP ${res.status}`;
    throw new ToolError("psi_error", `Google PageSpeed couldn't test this page: ${msg.slice(0, 160)}`, 502);
  }
  const lh = json.lighthouseResult;
  if (!lh?.audits) throw new ToolError("psi_error", "Google PageSpeed returned no results for this page.", 502);
  if (lh.runtimeError?.code && lh.runtimeError.code !== "NO_ERROR") {
    throw new ToolError("psi_error", `Lighthouse couldn't load the page: ${lh.runtimeError.message || lh.runtimeError.code}`, 502);
  }

  const le = json.loadingExperience;
  const useOrigin = !le?.metrics || le.origin_fallback;
  const fieldSrc = useOrigin ? json.originLoadingExperience : le;
  const score = lh.categories?.performance?.score;

  return {
    strategy,
    score: typeof score === "number" ? Math.round(score * 100) : null,
    audits: lh.audits,
    lighthouseVersion: lh.lighthouseVersion ?? null,
    finalUrl: lh.finalDisplayedUrl || lh.finalUrl || url,
    fullPageScreenshot: lh.fullPageScreenshot?.screenshot?.data ?? null,
    field: fieldSrc?.metrics
      ? { scope: useOrigin ? "origin" : "url", overall: fieldSrc.overall_category ?? null, metrics: fieldSrc.metrics }
      : null,
  };
}

export function audit(r: PsiResult, ...ids: string[]) {
  for (const id of ids) if (r.audits[id]) return r.audits[id];
  return undefined;
}

export function failing(a: LhAudit | undefined) {
  if (!a) return false;
  if (a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "manual") return false;
  return a.score !== null && a.score < 0.9;
}
