import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ToolRunner } from "@/components/ToolRunner";
import { SITE } from "@/lib/site";
import { getTool, isNew, liveTools } from "@/lib/tools.config";

export const dynamicParams = false;

export function generateStaticParams() {
  return liveTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const title = tool.seoTitle || tool.name;
  return {
    title,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: `${title} | ${SITE.fullName}`, description: tool.outcome, url: `/tools/${tool.slug}`, type: "website" },
    twitter: { card: "summary_large_image", title, description: tool.outcome },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.name,
        url: `${SITE.url}/tools/${tool.slug}`,
        description: tool.description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        publisher: { "@type": "Organization", name: "Script Commerce", url: SITE.scriptCommerceUrl },
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/tools">Tools</Link> <span>/</span> <span>{tool.name}</span>
        </nav>

        <section className="tool-hero" style={{ "--c1": tool.accent[0], "--c2": tool.accent[1] } as React.CSSProperties}>
          <div className="tool-title">
            <span className="icon-tile">
              <Icon name={tool.icon} />
            </span>
            <h1>{tool.name}</h1>
          </div>
          <p className="lead">{tool.description}</p>
          <div className="tool-meta">
            <span className="chip">
              <Icon name="heart" /> Free
            </span>
            <span className="chip">
              <Icon name="clock" /> {tool.eta}
            </span>
            <span className="chip">
              <Icon name="layers" /> {tool.builtOn}
            </span>
            {isNew(tool) && <span className="badge badge-new">New</span>}
          </div>
        </section>

        <div className="page-grid" style={{ "--c1": tool.accent[0], "--c2": tool.accent[1] } as React.CSSProperties}>
          <div style={{ minWidth: 0 }}>
            <ToolRunner tool={tool} />
          </div>
          <aside className="aside-stack">
            <div className="panel">
              <h3>What we check</h3>
              <ul className="check-list">
                {tool.checks.map((c) => (
                  <li key={c}>
                    <Icon name="check" /> {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel faq">
              <h3>FAQ</h3>
              {tool.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <div className="panel">
              <h3>More tools</h3>
              <ul className="check-list">
                {liveTools()
                  .filter((t) => t.slug !== tool.slug)
                  .map((t) => (
                    <li key={t.slug}>
                      <Icon name={t.icon} style={{ color: t.accent[0] }} />
                      <Link href={`/tools/${t.slug}`}>{t.name}</Link>
                    </li>
                  ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter tool={tool.slug} />
    </>
  );
}
