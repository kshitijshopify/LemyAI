import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ padding: "90px 20px 20px" }}>
        <div className="empty">
          <span className="icon-tile">
            <Icon name="search" />
          </span>
          <h3>This page doesn&apos;t exist (yet)</h3>
          <p>The tool may still be on our roadmap.</p>
          <Link href="/tools" className="btn btn-primary" style={{ marginTop: 18 }}>
            See all tools <Icon name="arrow" />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
