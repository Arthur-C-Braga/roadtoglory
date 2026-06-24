"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { SiteFooter } from "@/components/SiteFooter";

export function ContestForm() {
  const t = useTranslations("contest");
  const [sent, setSent] = useState(false);

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
        <p className="page-sub">{t("sub")}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="field">
            <label htmlFor="player">{t("labelPlayer")}</label>
            <input id="player" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="sel">{t("labelSel")}</label>
            <input id="sel" type="text" />
          </div>
          <div className="field">
            <label htmlFor="copa">{t("labelCopa")}</label>
            <input id="copa" type="number" min={1950} max={2026} />
          </div>
          <div className="field">
            <label htmlFor="rating">{t("labelRating")}</label>
            <input id="rating" type="number" min={1} max={99} />
          </div>
          <div className="field">
            <label htmlFor="reason">{t("labelReason")}</label>
            <textarea id="reason" rows={4} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={sent}>
            {sent ? "✓" : t("submit")}
          </button>
        </form>
      </div>
      <SiteFooter />
    </main>
  );
}
