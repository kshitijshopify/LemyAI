// Per-IP rate limiting and a daily AI call cap. In-memory per server instance;
// move to Upstash/Redis when running multiple instances.

const runs = new Map<string, number[]>();

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

export function checkRateLimit(key: string) {
  const max = Number(process.env.RATE_LIMIT_RUNS || 8);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 10) * 60_000;
  const now = Date.now();
  const hits = (runs.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retryInSec = Math.ceil((windowMs - (now - hits[0])) / 1000);
    runs.set(key, hits);
    return { ok: false as const, retryInSec };
  }
  hits.push(now);
  runs.set(key, hits);
  if (runs.size > 5000) {
    for (const [k, v] of runs) if (!v.some((t) => now - t < windowMs)) runs.delete(k);
  }
  return { ok: true as const };
}

let aiDay = "";
let aiCalls = 0;

/** Returns false once the daily AI budget is spent; tools then fall back to rule-based output. */
export function reserveAiCall() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== aiDay) {
    aiDay = today;
    aiCalls = 0;
  }
  const cap = Number(process.env.AI_DAILY_CALL_CAP || 300);
  if (aiCalls >= cap) return false;
  aiCalls++;
  return true;
}
