import { lookup } from "node:dns/promises";
import net from "node:net";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export class ToolError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

const hostChecks = new Map<string, number>();

/** Blocks requests to internal networks (SSRF protection) since we fetch user-supplied URLs. */
export async function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const cachedUntil = hostChecks.get(host);
  if (cachedUntil && cachedUntil > Date.now()) return;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ToolError("blocked_host", "That address isn't a public website.");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new ToolError("blocked_host", "That address isn't a public website.");
  } else {
    let addrs: { address: string }[];
    try {
      addrs = await lookup(host, { all: true });
    } catch {
      throw new ToolError("dns", `We couldn't find ${host}. Check the spelling and try again.`);
    }
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      throw new ToolError("blocked_host", "That address isn't a public website.");
    }
  }
  hostChecks.set(host, Date.now() + 5 * 60_000);
}

export type FetchResult = {
  url: string;
  status: number;
  headers: Record<string, string>;
  text: string;
};

async function readCapped(res: Response, maxBytes: number) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function safeFetch(
  url: string,
  opts: { timeoutMs?: number; accept?: string; maxBytes?: number } = {},
): Promise<FetchResult> {
  const { timeoutMs = 15_000, accept = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", maxBytes = 6_000_000 } = opts;
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new ToolError("bad_url", "Only http and https URLs are supported.");
    }
    if (u.port && u.port !== "443" && u.port !== "80") {
      throw new ToolError("bad_url", "Custom ports aren't supported.");
    }
    await assertPublicHost(u.hostname);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: {
          "user-agent": BROWSER_UA,
          accept,
          "accept-language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const e = err as Error;
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        throw new ToolError("timeout", `${u.hostname} took too long to respond.`, 504);
      }
      throw new ToolError("fetch_failed", `We couldn't connect to ${u.hostname}.`, 502);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    const text = await readCapped(res, maxBytes);
    return { url: current, status: res.status, headers, text };
  }
  throw new ToolError("redirects", "That URL redirects too many times.");
}

export async function safeFetchJson<T>(url: string, timeoutMs = 12_000): Promise<T | null> {
  try {
    const r = await safeFetch(url, { timeoutMs, accept: "application/json" });
    if (r.status !== 200) return null;
    return JSON.parse(r.text) as T;
  } catch {
    return null;
  }
}

/** Accepts "store.com", "https://www.store.com/products/x?y" etc. */
export function normalizeInputUrl(raw: string) {
  let s = (raw || "").trim();
  if (!s) throw new ToolError("bad_url", "Enter a store URL to start.");
  if (s.length > 500) throw new ToolError("bad_url", "That URL is too long.");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new ToolError("bad_url", "That doesn't look like a valid URL.");
  }
  if (!u.hostname.includes(".")) throw new ToolError("bad_url", "That doesn't look like a valid domain.");
  u.protocol = "https:";
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  return u;
}
