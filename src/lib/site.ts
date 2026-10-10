export const SITE = {
  name: "Lemy",
  fullName: "Lemy by Script Commerce",
  tagline: "Free AI tools that X-ray any Shopify store",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://lemy.ai").replace(/\/$/, ""),
  scriptCommerceUrl: process.env.NEXT_PUBLIC_SCRIPT_COMMERCE_URL || "https://scriptcommerce.com",
  contactUrl:
    process.env.NEXT_PUBLIC_SCRIPT_COMMERCE_CONTACT_URL || "https://scriptcommerce.com/contact",
  gaId: "G-PS3NWT75HH",
};

export function ctaHref(tool: string, placement: string) {
  const u = new URL(SITE.contactUrl);
  u.searchParams.set("utm_source", "lemy.ai");
  u.searchParams.set("utm_medium", "tool");
  u.searchParams.set("utm_campaign", tool);
  u.searchParams.set("utm_content", placement);
  return u.toString();
}

export function scriptCommerceHref(placement: string) {
  const u = new URL(SITE.scriptCommerceUrl);
  u.searchParams.set("utm_source", "lemy.ai");
  u.searchParams.set("utm_medium", "referral");
  u.searchParams.set("utm_content", placement);
  return u.toString();
}
