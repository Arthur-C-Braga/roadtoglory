import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SiteFooter } from "@/components/SiteFooter";

export default async function MultiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("multi");

  const modes = [
    { key: "Local", name: t("modeLocal"), desc: t("modeLocalDesc"), href: "/multi/local", soon: false },
    { key: "Online", name: t("modeOnline"), desc: t("modeOnlineDesc"), href: "/multi/online", soon: false },
    { key: "Final", name: t("modeFinal"), desc: t("modeFinalDesc"), href: "/multi/local", soon: true },
    { key: "Copa", name: t("modeCopa"), desc: t("modeCopaDesc"), href: "/multi/local", soon: true },
  ];

  return (
    <main className="page-wrap tx-paper">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Road to Glory">
          <span className="brand-badge" aria-hidden="true">★</span>
          <span className="brand-word">ROAD TO <span className="accent">GLORY</span></span>
        </Link>
      </header>
      <div className="page-body">
        <h1 className="page-title">{t("selectorTitle")}</h1>
        <p className="page-sub">{t("selectorSub")}</p>
        <div className="mode-cards">
          {modes.map((m) =>
            m.soon ? (
              <div key={m.key} className="mode-card">
                <span className="mc-name">{m.name}</span>
                <span className="mc-desc">{m.desc}</span>
                <span className="mc-soon">{t("comingSoon")}</span>
              </div>
            ) : (
              <Link key={m.key} className="mode-card mode-card--link" href={m.href}>
                <span className="mc-name">{m.name}</span>
                <span className="mc-desc">{m.desc}</span>
              </Link>
            )
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
