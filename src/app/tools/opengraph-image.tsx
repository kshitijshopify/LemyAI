import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Lemy by Script Commerce: free Shopify tools";

export default function Image() {
  return ogImage({
    title: "Free AI tools that X-ray any Shopify store",
    subtitle: "PDP CRO audit · Speed audit with Shopify fixes · Store stack detector",
    kicker: "Lemy tools",
  });
}
