import { OG_SIZE, ogImage } from "@/lib/og";
import { getTool, liveTools } from "@/lib/tools.config";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Lemy by Script Commerce: free Shopify tool";

export function generateStaticParams() {
  return liveTools().map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  return ogImage({
    title: tool?.name ?? "Free Shopify tools",
    subtitle: tool?.outcome ?? "AI-powered tools for Shopify merchants and developers.",
    accent: tool?.accent,
    kicker: "Free Shopify tool",
  });
}
