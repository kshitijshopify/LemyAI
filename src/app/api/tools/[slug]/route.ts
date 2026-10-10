import { ToolError } from "@/lib/server/http";
import { checkRateLimit, clientIp } from "@/lib/server/limits";
import { RUNNERS } from "@/lib/server/runners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const runner = RUNNERS[slug];
  if (!runner) return Response.json({ error: "Unknown tool." }, { status: 404 });

  const limit = checkRateLimit(`${clientIp(req)}:${slug}`);
  if (!limit.ok) {
    return Response.json(
      { error: `You've run this tool a lot in a short time. Try again in ${Math.ceil(limit.retryInSec / 60)} min.`, code: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryInSec) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return Response.json({ error: "Enter a store URL to start.", code: "bad_url" }, { status: 400 });

  try {
    const report = await runner({ url });
    return Response.json(report);
  } catch (err) {
    if (err instanceof ToolError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error(`[tool:${slug}]`, err);
    return Response.json({ error: "Something went wrong while analyzing this store. Please try again.", code: "internal" }, { status: 500 });
  }
}
