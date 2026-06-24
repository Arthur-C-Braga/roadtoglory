import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SiteFooter } from "@/components/SiteFooter";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("perfil");

  const stats = [
    { val: 0, lab: t("statGames") },
    { val: 0, lab: t("statWins") },
    { val: 0, lab: t("statChampions") },
    { val: 0, lab: t("statPerfect") },
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
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-sub">{t("loginExplain")}</p>
        <button className="btn btn-primary">{t("loginEmail")}</button>

        <div className="stat-grid">
          {stats.map((s) => (
            <div key={s.lab} className="stat-cell">
              <div className="sc-val">{s.val}</div>
              <div className="sc-lab">{s.lab}</div>
            </div>
          ))}
        </div>

        <h2 className="page-title" style={{ fontSize: "1.4rem", marginTop: 24 }}>
          {t("achievementsTitle")}
        </h2>
        <p className="page-sub">—</p>
      </div>
      <SiteFooter />
    </main>
  );
}
