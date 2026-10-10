import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { liveTools } from "@/lib/tools.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/tools`, changeFrequency: "weekly", priority: 1 },
    ...liveTools().map((t) => ({
      url: `${SITE.url}/tools/${t.slug}`,
      lastModified: t.launchedAt ? new Date(t.launchedAt) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
