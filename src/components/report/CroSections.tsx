import type { CroReport } from "@/lib/report-types";
import { Icon } from "../Icon";

const STATUS_ICON = { pass: "check", fail: "x", warn: "alert", na: "minus" } as const;

export function CroSections({ report }: { report: CroReport }) {
  const { cro } = report;
  const p = cro.product;
  const counts = {
    pass: cro.checks.filter((c) => c.status === "pass").length,
    total: cro.checks.filter((c) => c.status !== "na").length,
  };

  return (
    <>
      <section className="r-section">
        <h3>
          <Icon name="target" /> Product audited
        </h3>
        <div className="product-strip">
          {p.image && (
            <img src={p.image} alt="" loading="lazy" />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{p.title}</strong>
            <div className="price">
              {p.price}
              {p.compareAtPrice && <s>{p.compareAtPrice}</s>}
              {p.available === false && <span style={{ color: "var(--bad)", marginLeft: 8 }}>Sold out</span>}
            </div>
            <a href={p.url} target="_blank" rel="noopener nofollow" className="mono muted" style={{ fontSize: 12, wordBreak: "break-all" }}>
              {p.url.replace(/^https?:\/\//, "")}
            </a>
          </div>
          <div className="score-pair">
            <div className="mini-score">
              Checklist <strong>{cro.checklistScore}</strong>
            </div>
            <div className="mini-score">
              Vision AI <strong>{cro.visionScore ?? "–"}</strong>
            </div>
          </div>
        </div>
      </section>

      {(cro.screenshots.mobile || cro.screenshots.desktop) && (
        <section className="r-section">
          <h3>
            <Icon name="phone" /> What shoppers see first
          </h3>
          <div className="shots" style={{ gridTemplateColumns: cro.screenshots.mobile && cro.screenshots.desktop ? undefined : "1fr" }}>
            {cro.screenshots.mobile && (
              <div>
                <div className="shot-label">Mobile · 390px</div>
                <div className="phone" style={{ maxWidth: 260 }}>
                  <img src={cro.screenshots.mobile} alt="Mobile product page above the fold" />
                </div>
              </div>
            )}
            {cro.screenshots.desktop && (
              <div>
                <div className="shot-label">Desktop · 1440px</div>
                <div className="browser">
                  <div className="bar">
                    <i />
                    <i />
                    <i />
                  </div>
                  <img src={cro.screenshots.desktop} alt="Desktop product page above the fold" />
                </div>
                {cro.aboveTheFold && (
                  <div className="tiles" style={{ marginTop: 14 }}>
                    <div className={`tile ${cro.aboveTheFold.ctaVisible === null ? "" : cro.aboveTheFold.ctaVisible ? "good" : "poor"}`}>
                      <span>Add to cart on mobile</span>
                      <strong>{cro.aboveTheFold.ctaVisible === null ? "Unclear" : cro.aboveTheFold.ctaVisible ? "Visible" : "Below the fold"}</strong>
                    </div>
                    <div className={`tile ${cro.aboveTheFold.priceVisible === null ? "" : cro.aboveTheFold.priceVisible ? "good" : "poor"}`}>
                      <span>Price on mobile</span>
                      <strong>{cro.aboveTheFold.priceVisible === null ? "Unclear" : cro.aboveTheFold.priceVisible ? "Visible" : "Hidden"}</strong>
                    </div>
                  </div>
                )}
                {cro.aboveTheFold?.notes && <p className="muted" style={{ marginTop: 10, fontSize: 14 }}>{cro.aboveTheFold.notes}</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {(cro.strengths.length > 0 || cro.quickWins.length > 0) && (
        <div className="two-col">
          <section className="r-section">
            <h3>
              <Icon name="heart" /> What works
            </h3>
            <ul className="bullets">
              {cro.strengths.map((s) => (
                <li key={s}>
                  <Icon name="check" style={{ color: "var(--ok)" }} /> {s}
                </li>
              ))}
            </ul>
          </section>
          <section className="r-section">
            <h3>
              <Icon name="bolt" /> Quick wins for today
            </h3>
            <ul className="bullets">
              {cro.quickWins.map((s) => (
                <li key={s}>
                  <Icon name="arrow" style={{ color: "var(--a)" }} /> {s}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section className="r-section">
        <h3>
          <Icon name="list" /> PDP checklist <span className="badge">{counts.pass}/{counts.total} passed</span>
        </h3>
        <div className="checks-grid">
          {cro.checks.map((c) => (
            <div className={`check ${c.status}`} key={c.id}>
              <span className="ic">
                <Icon name={STATUS_ICON[c.status]} />
              </span>
              <div>
                <strong>{c.title}</strong>
                <small>{c.note}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
