"use client";

type Gtag = (cmd: "event", name: string, params?: Record<string, unknown>) => void;

/** GA4 events: tool_run, tool_result, tool_error, email_captured, cta_click, pdf_download, share_click */
export function track(event: string, params: Record<string, unknown> = {}) {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (gtag) gtag("event", event, params);
}
