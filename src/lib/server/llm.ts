import { reserveAiCall } from "./limits";

// Thin wrapper over any OpenAI-compatible Chat Completions endpoint with structured JSON output.
// Per-tool prompts live in src/lib/server/prompts/.

export type JsonSchema = Record<string, unknown>;

export type LlmImage = { mime: string; base64: string };

export function llmConfigured() {
  return !!(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY);
}

type ChatContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } })[];

async function call(body: Record<string, unknown>, timeoutMs: number) {
  const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.LLM_API_KEY || process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM returned no content");
  return content;
}

function parseJson<T>(content: string): T {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned) as T;
}

/**
 * Returns structured JSON or null (not configured, daily cap reached, or provider error).
 * Tools must always have a rule-based fallback when this returns null.
 */
export async function generateJson<T>(opts: {
  name: string;
  system: string;
  user: string;
  schema: JsonSchema;
  images?: LlmImage[];
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<{ data: T | null; error?: string }> {
  if (!llmConfigured()) return { data: null, error: "not_configured" };
  if (!reserveAiCall()) return { data: null, error: "daily_cap" };

  const userContent: ChatContent = opts.images?.length
    ? [
        { type: "text", text: opts.user },
        ...opts.images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mime};base64,${img.base64}`, detail: "high" },
        })),
      ]
    : opts.user;

  const base: Record<string, unknown> = {
    model: process.env.LLM_MODEL || "gpt-4.1-mini",
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: userContent },
    ],
    max_completion_tokens: opts.maxTokens ?? 2500,
  };
  if (process.env.LLM_REASONING_EFFORT) base.reasoning_effort = process.env.LLM_REASONING_EFFORT;
  const timeoutMs = opts.timeoutMs ?? 40_000;

  try {
    const content = await call(
      { ...base, response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } } },
      timeoutMs,
    );
    return { data: parseJson<T>(content) };
  } catch (err) {
    const msg = (err as Error).message;
    // Some providers don't support json_schema; retry once with plain JSON mode.
    if (/HTTP 400/.test(msg) && /response_format|json_schema|schema/i.test(msg)) {
      try {
        const content = await call(
          {
            ...base,
            messages: [
              { role: "system", content: `${opts.system}\n\nReturn only JSON matching this JSON Schema:\n${JSON.stringify(opts.schema)}` },
              { role: "user", content: userContent },
            ],
            response_format: { type: "json_object" },
          },
          timeoutMs,
        );
        return { data: parseJson<T>(content) };
      } catch (err2) {
        console.error("[llm] fallback failed", (err2 as Error).message);
        return { data: null, error: "provider_error" };
      }
    }
    console.error("[llm] failed", msg);
    return { data: null, error: "provider_error" };
  }
}
