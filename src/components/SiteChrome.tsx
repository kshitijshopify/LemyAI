import Link from "next/link";
import { ctaHref, scriptCommerceHref, SITE } from "@/lib/site";
import { Icon } from "./Icon";
import { TrackedLink } from "./TrackedLink";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/tools" className="brand" aria-label="Lemy by Script Commerce: all tools">
          <span className="brand-mark">L</span>
          <span className="brand-text">
            <strong>Lemy</strong>
            <span>by Script Commerce</span>
          </span>
        </Link>
        <nav className="nav">
          <Link href="/tools" className="nav-link">
            All tools
          </Link>
          <Link href="/tools#merchants" className="nav-link">
            Merchants
          </Link>
          <Link href="/tools#developers" className="nav-link">
            Developers
          </Link>
          <TrackedLink
            href={scriptCommerceHref("header")}
            event="cta_click"
            params={{ placement: "header" }}
            className="btn btn-ghost btn-sm"
            external
          >
            Script Commerce <Icon name="external" />
          </TrackedLink>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ tool = "hub" }: { tool?: string }) {
  return (
    <>
      <div className="wrap">
        <section className="cta-band" aria-labelledby="cta-title">
          <div>
            <span className="kicker">Shopify experts · EU & global</span>
            <h2 id="cta-title" style={{ marginTop: 10 }}>
              Need this fixed? <span className="grad-text">Talk to Script Commerce.</span>
            </h2>
            <p>
              Lemy finds the problems. Our Shopify team fixes them: speed, CRO, theme builds, apps and migrations for
              merchants and agencies.
            </p>
          </div>
          <div className="actions">
            <TrackedLink
              href={ctaHref(tool, "footer")}
              event="cta_click"
              params={{ tool, placement: "footer" }}
              className="btn btn-primary"
              external
            >
              Book a free call <Icon name="arrow" />
            </TrackedLink>
            <TrackedLink
              href={scriptCommerceHref("footer")}
              event="cta_click"
              params={{ tool, placement: "footer_site" }}
              className="btn btn-ghost"
              external
            >
              Visit scriptcommerce
            </TrackedLink>
            <span className="fine">Free 20-min review · no obligation</span>
          </div>
        </section>
      </div>
      <footer className="site-footer">
        <div className="wrap">
          <span>
            © {new Date().getFullYear()} {SITE.fullName}
          </span>
          <span>
            <Link href="/tools">All tools</Link> ·{" "}
            <a href={scriptCommerceHref("footer_legal")} target="_blank" rel="noopener">
              scriptcommerce
            </a>{" "}
            · Free forever · Public data only
          </span>
        </div>
      </footer>
    </>
  );
}
