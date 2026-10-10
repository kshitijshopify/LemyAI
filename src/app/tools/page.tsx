import type { Metadata } from "next";
import { HeroScan } from "@/components/HeroScan";
import { Icon } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { FeatureCard } from "@/components/ToolCards";
import { ToolsHub } from "@/components/ToolsHub";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools.config";

export const metadata: Metadata = {
  title: { absolute: `Free Shopify Tools for Merchants & Developers | ${SITE.fullName}` },
  description:
    "X-ray any Shopify store for free: PDP CRO audit with vision AI, PageSpeed audit translated into Shopify fixes, and a stack detector for themes, apps, pixels and payments.",
  alternates: { canonical: "/tools" },
  openGraph: { title: `Free Shopify Tools | ${SITE.fullName}`, url: "/tools" },
};

export default function ToolsPage() {
  const featured = TOOLS.filter((t) => t.featured && t.status === "live").slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="wrap">
            <span className="eyebrow">
              <span className="dot" /> Free · No login · Built by Shopify experts
            </span>
            <h1>
              Free AI tools that <span className="grad-text">X-ray any Shopify store.</span>
            </h1>
            <p className="lead">
              Paste a store URL and get a specific, fix-ready report in under a minute: conversion, speed and the full
              tech stack. Made by Script Commerce for merchants, agencies and developers.
            </p>
            <HeroScan />
            <div className="trust-row">
              <span>
                <Icon name="shield" /> Public data only
              </span>
              <span>
                <Icon name="clock" /> Results in &lt; 60s
              </span>
              <span>
                <Icon name="globe" /> Tested on EU stores
              </span>
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="section" aria-labelledby="featured-title">
            <div className="section-head">
              <div>
                <span className="kicker">Featured</span>
                <h2 id="featured-title">Start with these</h2>
              </div>
            </div>
            <div className="featured-grid">
              {featured.map((t) => (
                <FeatureCard key={t.slug} tool={t} />
              ))}
            </div>
          </section>

          <ToolsHub />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
