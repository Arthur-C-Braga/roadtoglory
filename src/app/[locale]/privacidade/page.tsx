import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SiteFooter } from "@/components/SiteFooter";

export default async function PrivacidadePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <main className="page-wrap tx-paper">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Road to Glory">
          <span className="brand-badge" aria-hidden="true">★</span>
          <span className="brand-word">ROAD TO <span className="accent">GLORY</span></span>
        </Link>
      </header>
      <div className="page-body">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-sub">{t("body")}</p>
      </div>
      <SiteFooter />
    </main>
  );
}
