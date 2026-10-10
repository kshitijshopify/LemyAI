import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type Lead = {
  email: string;
  tool: string;
  url: string;
  score: number | null;
  consent: boolean;
  createdAt: string;
  ip: string;
  userAgent: string;
};

const FILE = path.join(process.cwd(), ".data", "leads.jsonl");

/** Sends the lead to LEADS_WEBHOOK_URL (if set) and appends it to .data/leads.jsonl when writable. */
export async function saveLead(lead: Lead) {
  let stored = false;
  const hook = process.env.LEADS_WEBHOOK_URL;
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(8000),
      });
      stored = res.ok;
      if (!res.ok) console.error("[leads] webhook HTTP", res.status);
    } catch (err) {
      console.error("[leads] webhook failed", (err as Error).message);
    }
  }
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await appendFile(FILE, JSON.stringify(lead) + "\n", "utf8");
    stored = true;
  } catch {
    // read-only filesystem (e.g. serverless); the webhook is the source of truth there
  }
  if (!stored) console.log("[leads] not persisted", lead.email, lead.tool);
  return stored;
}

export async function readLeads(): Promise<Lead[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Lead);
  } catch {
    return [];
  }
}

export function leadsToCsv(leads: Lead[]) {
  const cols: (keyof Lead)[] = ["createdAt", "email", "tool", "url", "score", "consent", "ip", "userAgent"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...leads.map((l) => cols.map((c) => esc(l[c])).join(","))].join("\n");
}
