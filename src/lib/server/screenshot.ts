import type { LlmImage } from "./llm";

// Screenshot API: ScreenshotOne when SCREENSHOTONE_ACCESS_KEY is set, otherwise Microlink (free tier, key optional).

export type Shot = { image: LlmImage; dataUrl: string };

type Device = "mobile" | "desktop";

const VIEWPORTS: Record<Device, { width: number; height: number; scale: number; mobile: boolean }> = {
  mobile: { width: 390, height: 844, scale: 2, mobile: true },
  desktop: { width: 1440, height: 900, scale: 1, mobile: false },
};

async function toShot(res: Response): Promise<Shot> {
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const base64 = buf.toString("base64");
  return { image: { mime, base64 }, dataUrl: `data:${mime};base64,${base64}` };
}

async function screenshotOne(url: string, device: Device, timeoutMs: number) {
  const v = VIEWPORTS[device];
  const api = new URL("https://api.screenshotone.com/take");
  api.searchParams.set("access_key", process.env.SCREENSHOTONE_ACCESS_KEY!);
  api.searchParams.set("url", url);
  api.searchParams.set("viewport_width", String(v.width));
  api.searchParams.set("viewport_height", String(v.height));
  api.searchParams.set("device_scale_factor", String(v.scale));
  api.searchParams.set("viewport_mobile", String(v.mobile));
  api.searchParams.set("format", "jpg");
  api.searchParams.set("image_quality", "70");
  api.searchParams.set("block_cookie_banners", "true");
  api.searchParams.set("block_chats", "true");
  api.searchParams.set("block_ads", "true");
  api.searchParams.set("delay", "2");
  const res = await fetch(api, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`ScreenshotOne HTTP ${res.status}`);
  return toShot(res);
}

async function microlink(url: string, device: Device, timeoutMs: number) {
  const v = VIEWPORTS[device];
  const key = process.env.MICROLINK_API_KEY;
  const api = new URL(key ? "https://pro.microlink.io" : "https://api.microlink.io");
  api.searchParams.set("url", url);
  api.searchParams.set("screenshot", "true");
  api.searchParams.set("meta", "false");
  api.searchParams.set("embed", "screenshot.url");
  api.searchParams.set("viewport.width", String(v.width));
  api.searchParams.set("viewport.height", String(v.height));
  api.searchParams.set("viewport.deviceScaleFactor", String(v.scale));
  api.searchParams.set("viewport.isMobile", String(v.mobile));
  api.searchParams.set("screenshot.type", "jpeg");
  api.searchParams.set("adblock", "true");
  // App-heavy storefronts rarely reach network idle, which makes Microlink time out (HTTP 408).
  api.searchParams.set("waitUntil", "domcontentloaded");
  api.searchParams.set("waitForTimeout", "2500");
  const res = await fetch(api, {
    headers: key ? { "x-api-key": key } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Microlink HTTP ${res.status}`);
  if (!(res.headers.get("content-type") || "").startsWith("image/")) throw new Error("Microlink returned no image");
  return toShot(res);
}

export async function takeScreenshot(url: string, device: Device, timeoutMs = 28_000): Promise<Shot | null> {
  try {
    return process.env.SCREENSHOTONE_ACCESS_KEY
      ? await screenshotOne(url, device, timeoutMs)
      : await microlink(url, device, timeoutMs);
  } catch (err) {
    console.error(`[screenshot] ${device} failed`, (err as Error).message);
    return null;
  }
}
