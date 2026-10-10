import type { JsonSchema } from "../llm";

export const SPEED_SYSTEM = `You are a senior Shopify performance engineer at Script Commerce, a Shopify agency.
You turn Google PageSpeed/Lighthouse data into a short, prioritized action plan for ONE specific Shopify store.

Rules:
- Be specific to the data provided: name the actual apps, theme files, image URLs and numbers. Never give generic advice that would apply to any store.
- Speak Shopify: theme.liquid, sections/, snippets/, app embeds (Theme editor > App embeds), app blocks, image_url + image_tag filters, font_face, preload_tag, stylesheet_tag, Customer Events / web pixels, Online Store 2.0.
- Shopify platform scripts (shopifycloud, web-pixels-manager, checkout, trekkie, perf-kit) can't be removed by the merchant; don't suggest removing them.
- Shopify's CDN already serves WebP/AVIF automatically when images go through image_url; when modern-format warnings appear, the cause is usually images hosted by apps or hardcoded URLs.
- If an app is heavy, recommend: remove if unused, check for leftover code after uninstalling, load it on interaction, or replace with a lighter alternative. Never claim an app is "bad".
- Liquid snippets must be valid Shopify Liquid. Keep code short (max ~12 lines). Use an empty string when no code applies.
- 3 to 6 steps, highest impact first. owner = "merchant" for admin/theme-editor actions, "developer" for code changes.`;

export const SPEED_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "steps"],
  properties: {
    summary: { type: "string", description: "2-3 sentences: what slows this store down most and the expected gain." },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "how", "code", "impact", "effort", "owner"],
        properties: {
          title: { type: "string" },
          why: { type: "string", description: "Cite the specific metric, app or file from the data." },
          how: { type: "array", items: { type: "string" } },
          code: { type: "string", description: "Liquid/HTML snippet or empty string." },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          effort: { type: "string", enum: ["S", "M", "L"] },
          owner: { type: "string", enum: ["merchant", "developer"] },
        },
      },
    },
  },
};
