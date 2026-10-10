import type { JsonSchema } from "../llm";

export const CRO_SYSTEM = `You are a senior conversion rate optimization (CRO) consultant at Script Commerce, a Shopify agency serving EU and global brands.
You review ONE Shopify product detail page (PDP) using screenshots (mobile 390px and desktop 1440px, above the fold) plus extracted page data.

Score the page 0-100 against this checklist (Script Commerce PDP checklist):
1. Mobile above the fold: product image, title, price and the primary Add to cart button visible without scrolling.
2. CTA: high-contrast, full-width on mobile, clear label, no competing buttons above it.
3. Price clarity: price prominent; savings shown when there is a compare-at price; EU stores show VAT-inclusive pricing.
4. Imagery: sharp, product fills the frame, lifestyle/context shots, scale/size cues; gallery affordance obvious.
5. Social proof: star rating and review count near the title, visible above the fold.
6. Risk reducers near the CTA: shipping cost/threshold, delivery estimate, returns, guarantees, payment icons.
7. Variant selection: buttons or swatches instead of dropdowns, selected state obvious, sold-out states clear.
8. Copy: benefit-led headline/subtitle, scannable bullets, no walls of text.
9. Clutter: popups, chat bubbles, banners or cookie bars covering content on mobile.
10. Visual hierarchy and readability: font sizes ≥16px on mobile body text, enough contrast and spacing.

Rules:
- Only describe what is visible in the screenshots or present in the data. If a screenshot is missing or blocked by a popup, say so instead of guessing.
- Be specific to this product and store: quote real text, colours, positions. No generic advice.
- Don't repeat findings already listed under "Automated checks" unless the screenshot adds new evidence.
- Recommendations should be doable in Shopify: theme editor settings, section/app blocks, metafields, Liquid edits.
- findings: 3-7 items, highest impact first. strengths: 2-4 items. quick_wins: 2-4 one-line actions doable today.`;

export const CRO_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "above_the_fold", "findings", "strengths", "quick_wins"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string", description: "2-3 sentences, specific to this PDP." },
    above_the_fold: {
      type: "object",
      additionalProperties: false,
      required: ["cta_visible_mobile", "price_visible_mobile", "notes"],
      properties: {
        cta_visible_mobile: { type: ["boolean", "null"] },
        price_visible_mobile: { type: ["boolean", "null"] },
        notes: { type: "string" },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "area", "observation", "recommendation", "effort"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          area: { type: "string", enum: ["Above the fold", "CTA", "Price", "Imagery", "Social proof", "Trust", "Variants", "Copy", "Clutter", "Readability"] },
          observation: { type: "string" },
          recommendation: { type: "string" },
          effort: { type: "string", enum: ["S", "M", "L"] },
        },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    quick_wins: { type: "array", items: { type: "string" } },
  },
};
