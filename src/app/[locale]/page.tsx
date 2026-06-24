import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { NATIONS, VALID_DRAWS } from "@/lib/data";
import { ROSTERS } from "@/lib/rosters";

// Dream XI shown on the home pitch preview. Pure presentation — the real
// rosters live in the data layer used by /play.
const DREAM_XI = [
  { n: "1",  name: "Casillas",  x: 50, y: 88 },
  { n: "2",  name: "Carvajal",  x: 82, y: 70 },
  { n: "3",  name: "Maldini",   x: 18, y: 70 },
  { n: "4",  name: "Ramos",     x: 60, y: 74 },
  { n: "6",  name: "Van Dijk",  x: 40, y: 74 },
  { n: "8",  name: "Kroos",     x: 30, y: 48 },
  { n: "10", name: "Modrić",    x: 50, y: 52 },
  { n: "5",  name: "Zidane",    x: 70, y: 48 },
  { n: "7",  name: "Cristiano", x: 80, y: 24 },
  { n: "9",  name: "Benzema",   x: 50, y: 18 },
  { n: "11", name: "Vinícius",  x: 22, y: 24 },
];

// derived from the real data so it never goes stale
const COUNTS = {
  nations: NATIONS.length,
  squads: VALID_DRAWS.length,
  players: Object.values(ROSTERS).reduce((n, r) => n + r.length, 0),
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeView />;
}

function HomeView() {
  const t = useTranslations("home");

  return (
    <main className="home-wrap tx-paper">
      <SiteHeader />

      <div className="home-grid">
        <span className="home-watermark" aria-hidden="true">GLORY</span>
        <section className="home-hero">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1 className="home-headline">
            {t.rich("headline", {
              br: () => <br />,
              blue: (chunks) => <span className="hl-blue">{chunks}</span>,
            })}
          </h1>
          <p className="home-sub">{t("sub")}</p>
          <div className="home-ctas">
            <Link className="btn btn-primary home-cta-main" href="/play">
              {t("cta")}
            </Link>
            <Link className="btn btn-secondary home-cta-multi" href="/multi">
              {t("ctaMulti")}
              <span className="home-cta-novo">{t("ctaNew")}</span>
            </Link>
          </div>
        </section>

        <aside className="home-preview">
          <div className="home-pitch" aria-label={t("pitchAria")}>
            <svg
              className="pitch-markings"
              viewBox="0 0 300 400"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line x1="0" y1="200" x2="300" y2="200" />
              <circle cx="150" cy="200" r="46" />
              <circle cx="150" cy="200" r="2.4" className="mk-fill" />
              <path d="M62 0 V60 H238 V0" />
              <path d="M112 0 V22 H188 V0" />
              <circle cx="150" cy="40" r="2.4" className="mk-fill" />
              <path d="M110.8 60 A44 44 0 0 0 189.2 60" />
              <path d="M62 400 V340 H238 V400" />
              <path d="M112 400 V378 H188 V400" />
              <circle cx="150" cy="360" r="2.4" className="mk-fill" />
              <path d="M110.8 340 A44 44 0 0 1 189.2 340" />
            </svg>
            {DREAM_XI.map((p, i) => (
              <div
                key={i}
                className="hp-disc"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <span className="hp-c num">
                  <svg className="hp-shirt" viewBox="0 0 44 34" aria-hidden="true">
                    <path d="M16 3 L18 3 Q22 8 26 3 L28 3 L41 9 L36 16 L31 13 L31 31 L13 31 L13 13 L8 16 L3 9 Z" />
                  </svg>
                  <span className="hp-val">{p.n}</span>
                </span>
                <span className="hp-n">{p.name}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="home-steps">
        <div className="how-step">
          <span className="step-no num">01</span>
          <StepIcon kind="roll" />
          <div className="step-txt">
            <span className="step-t">{t("step1Title")}</span>
            <span className="step-d">{t("step1Desc")}</span>
          </div>
        </div>
        <div className="how-step">
          <span className="step-no num">02</span>
          <StepIcon kind="build" />
          <div className="step-txt">
            <span className="step-t">{t("step2Title")}</span>
            <span className="step-d">{t("step2Desc")}</span>
          </div>
        </div>
        <div className="how-step">
          <span className="step-no num">03</span>
          <StepIcon kind="sim" />
          <div className="step-txt">
            <span className="step-t">{t("step3Title")}</span>
            <span className="step-d">{t("step3Desc")}</span>
          </div>
        </div>
      </section>

      <footer className="home-foot">
        <div className="foot-counts">
          <span className="num">{COUNTS.nations}</span> {t("countNations")}
          <span className="foot-dot">·</span>
          <span className="num">{COUNTS.squads}</span> {t("countSquads")}
          <span className="foot-dot">·</span>
          <span className="num">{COUNTS.players.toLocaleString("pt-BR")}</span>{" "}
          {t("countPlayers")}
          <span className="foot-dot">·</span>
          <Link className="contest-link" href="/contestar">
            {t("contest")}
          </Link>
        </div>
      </footer>

      <SiteFooter />
    </main>
  );
}

function StepIcon({ kind }: { kind: "roll" | "build" | "sim" }) {
  return (
    <span className="step-ic-wrap">
      {kind === "roll" && (
        <svg viewBox="0 0 40 40" className="step-ic" fill="none" stroke="currentColor" strokeWidth="2.4">
          <rect x="6" y="6" width="28" height="28" rx="2" />
          <circle cx="14" cy="14" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="26" cy="14" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="20" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="14" cy="26" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="26" cy="26" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      )}
      {kind === "build" && (
        <svg viewBox="0 0 40 40" className="step-ic" fill="none" stroke="currentColor" strokeWidth="2.4">
          <rect x="5" y="6" width="30" height="28" rx="1.5" />
          <line x1="5" y1="20" x2="35" y2="20" />
          <circle cx="20" cy="20" r="4.5" />
          <rect x="13" y="6" width="14" height="5" />
          <rect x="13" y="29" width="14" height="5" />
        </svg>
      )}
      {kind === "sim" && (
        <svg viewBox="0 0 40 40" className="step-ic" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M8 9h8v9h8" />
          <path d="M8 31h8v-9" />
          <path d="M24 18h8" />
          <circle cx="33" cy="18" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      )}
    </span>
  );
}
