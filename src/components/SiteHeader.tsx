import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Settings } from "./Settings";

export function SiteHeader() {
  const t = useTranslations("common");
  return (
    <header className="site-header site-header--home">
      <div className="site-header-left">
        <Link className="brand" href="/" aria-label="Road to Glory">
          <span className="brand-badge" aria-hidden="true">★</span>
          <span className="brand-word">
            ROAD TO <span className="accent">GLORY</span>
          </span>
        </Link>
      </div>
      <div className="site-header-right">
        <Link className="profile-link" aria-label={t("profile")} href="/perfil">
          <svg className="profile-link-ic" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="7" y="9" width="26" height="22" rx="2" />
            <circle cx="15" cy="18" r="3.2" />
            <path d="M10.5 26.5c1.2-3 7.6-3 8.8 0" />
            <line x1="24" y1="16" x2="29.5" y2="16" />
            <line x1="24" y1="21" x2="29.5" y2="21" />
          </svg>
          <span className="profile-link-label">{t("profile")}</span>
        </Link>
        <Settings />
      </div>
    </header>
  );
}
