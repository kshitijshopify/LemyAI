import { checkRateLimit, clientIp } from "@/lib/server/limits";
import { leadsToCsv, readLeads, saveLead } from "@/lib/server/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!checkRateLimit(`${ip}:leads`).ok) return Response.json({ error: "Too many requests." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  await saveLead({
    email,
    tool: String(body.tool || "").slice(0, 60),
    url: String(body.url || "").slice(0, 300),
    score: typeof body.score === "number" ? body.score : null,
    consent: body.consent === true,
    createdAt: new Date().toISOString(),
    ip,
    userAgent: (req.headers.get("user-agent") || "").slice(0, 200),
  });
  return Response.json({ ok: true });
}

/** CSV/JSON export: GET /api/leads?key=LEADS_ADMIN_KEY&format=csv */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const key = process.env.LEADS_ADMIN_KEY;
  if (!key || params.get("key") !== key) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const leads = await readLeads();
  if (params.get("format") === "csv") {
    return new Response(leadsToCsv(leads), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="lemy-leads.csv"' },
    });
  }
  return Response.json({ count: leads.length, leads });
}
