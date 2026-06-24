import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <a
          className="kofi-btn"
          href="https://ko-fi.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("kofi")}
        </a>
        <span className="footer-credit">
          {t("credit")}{" "}
          <Link className="footer-link" href="/privacidade">
            {t("privacy")}
          </Link>
        </span>
      </div>
    </footer>
  );
}
