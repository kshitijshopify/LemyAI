import type { StackReport } from "@/lib/report-types";
import { Icon } from "../Icon";

const PALETTE = ["#7cf8ff", "#a26bff", "#ff5fd2", "#4dffb0", "#ffcc66", "#8aa2ff", "#ff8a65"];
const colorFor = (s: string) => PALETTE[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

export function StackSections({ report }: { report: StackReport }) {
  const { stack, store } = report;
  const t = store?.theme;
  const groups = new Map<string, typeof stack.apps>();
  for (const a of stack.apps) groups.set(a.category, [...(groups.get(a.category) || []), a]);

  return (
    <>
      <section className="r-section">
        <h3>
          <Icon name="layers" /> Theme
          {t?.os2 !== undefined && <span className="badge">{t.os2 ? "Online Store 2.0" : "Vintage theme"}</span>}
        </h3>
        {t ? (
          <div className="theme-card">
            <div className="tile">
              <span>Theme</span>
              <strong>{t.schemaName || t.name || "Unknown"}</strong>
              {t.renamed && <small>Renamed in admin to “{t.name}”</small>}
            </div>
            <div className="tile">
              <span>Version</span>
              <strong>{t.version || "–"}</strong>
            </div>
            <div className="tile">
              <span>Theme Store ID</span>
              <strong>{t.themeStoreId ?? "Custom"}</strong>
              <small>{t.themeStoreId ? "Official Theme Store theme" : "Not from the Theme Store"}</small>
            </div>
            <div className="tile">
              <span>Section groups</span>
              <strong>{t.sectionGroups ? "Yes" : "No"}</strong>
              <small>Header/footer groups (2023+ themes)</small>
            </div>
            <div className="tile">
              <span>jQuery</span>
              <strong>{t.jquery ? "Loaded" : "Not found"}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">No Shopify.theme object found. The store is probably headless or uses a custom storefront.</p>
        )}
      </section>

      <section className="r-section">
        <h3>
          <Icon name="sparkles" /> Apps detected <span className="badge">{stack.apps.length}</span>
        </h3>
        <p className="sub-note">
          Matched by script signature on the homepage{stack.productPageScanned ? " and a product page" : ""}. Admin-only and
          checkout-only apps aren&apos;t visible from the storefront.
        </p>
        {stack.apps.length ? (
          <div className="app-groups">
            {[...groups.entries()].map(([cat, apps]) => (
              <div className="app-group" key={cat}>
                <h5>{cat}</h5>
                {apps.map((a) => (
                  <div className="app-row" key={a.name} title={a.evidence}>
                    <span className="app-av" style={{ background: colorFor(a.name) }}>
                      {a.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}
                    </span>
                    <div>
                      <div className="nm">{a.name}</div>
                      <div className="where">{a.foundOn.map((f) => (f === "home" ? "homepage" : "product page")).join(" + ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No known app signatures found.</p>
        )}
      </section>

      <div className="two-col">
        <section className="r-section">
          <h3>
            <Icon name="pixel" /> Pixels & tracking <span className="badge">{stack.pixels.length}</span>
          </h3>
          {stack.webPixels && (
            <p className="sub-note">
              Shopify Customer Events: {stack.webPixels.app} app pixel{stack.webPixels.app === 1 ? "" : "s"}, {stack.webPixels.custom} custom pixel
              {stack.webPixels.custom === 1 ? "" : "s"}.
            </p>
          )}
          {stack.pixels.length ? (
            stack.pixels.map((p) => (
              <div className="pixel-row" key={p.name}>
                <strong style={{ fontWeight: 500 }}>{p.name}</strong>
                <div className="ids">
                  {p.ids.length ? p.ids.map((id) => <code key={id}>{id}</code>) : <span className="muted" style={{ fontSize: 13 }}>{p.via}</span>}
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No tracking pixels found in the HTML.</p>
          )}
        </section>

        <section className="r-section">
          <h3>
            <Icon name="card" /> Payments
          </h3>
          {stack.payments.length ? (
            <div className="pay-list">
              {stack.payments.map((p) => (
                <span className="chip" key={p}>
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No payment icons shown on the storefront.</p>
          )}
          {stack.accelerated.length > 0 && (
            <>
              <p className="sub-note" style={{ marginTop: 16, marginBottom: 8 }}>
                Accelerated checkout
              </p>
              <div className="pay-list">
                {stack.accelerated.map((p) => (
                  <span className="chip" key={p}>
                    <Icon name="bolt" /> {p}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {store && (
        <section className="r-section">
          <h3>
            <Icon name="store" /> Store facts
          </h3>
          <div className="tiles">
            <div className="tile">
              <span>myshopify domain</span>
              <strong style={{ fontSize: 14.5 }}>{store.myshopifyDomain || "–"}</strong>
            </div>
            <div className="tile">
              <span>Products</span>
              <strong>{store.productsCount?.toLocaleString() ?? "–"}</strong>
            </div>
            <div className="tile">
              <span>Collections</span>
              <strong>{store.collectionsCount?.toLocaleString() ?? "–"}</strong>
            </div>
            <div className="tile">
              <span>Currency · Country</span>
              <strong>
                {store.currency || "–"} · {store.country || "–"}
              </strong>
            </div>
            <div className="tile">
              <span>Languages</span>
              <strong>{store.languages.length || 1}</strong>
              {store.languages.length > 0 && <small>{store.languages.slice(0, 6).join(", ")}{store.languages.length > 6 ? "…" : ""}</small>}
            </div>
            <div className="tile">
              <span>Ships to</span>
              <strong>{store.shipsToCountries.length || "–"}</strong>
              <small>countries</small>
            </div>
          </div>
        </section>
      )}

      {(stack.thirdPartyHosts.length > 0 || stack.unknownExtensions.length > 0) && (
        <section className="r-section">
          <h3>
            <Icon name="code" /> For developers
          </h3>
          {stack.thirdPartyHosts.length > 0 && (
            <>
              <p className="sub-note" style={{ marginTop: 0 }}>
                Third-party script domains ({stack.thirdPartyHosts.length})
              </p>
              <div className="host-list">
                {stack.thirdPartyHosts.map((h) => (
                  <code key={h.host}>
                    {h.host}
                    {h.count > 1 ? ` ×${h.count}` : ""}
                  </code>
                ))}
              </div>
            </>
          )}
          {stack.unknownExtensions.length > 0 && (
            <>
              <p className="sub-note" style={{ marginTop: 16 }}>
                Unrecognized theme app extensions
              </p>
              <div className="host-list">
                {stack.unknownExtensions.map((e) => (
                  <code key={e}>{e}</code>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
