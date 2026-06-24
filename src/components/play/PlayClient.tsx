"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Settings } from "@/components/Settings";
import { Pitch, type Placed } from "./Pitch";
import { Reveal } from "./Reveal";
import {
  VALID_DRAWS,
  FORMATIONS,
  buildSquad,
  playerFitsSlot,
  styledFormation,
  cupToSeason,
  type FormationName,
  type Nation,
  type Player,
  type Pos,
} from "@/lib/data";
import { rateTeam, simulateCampaign, type Campaign, type Style } from "@/lib/sim";
import { pick, mulberry32 } from "@/lib/rng";

type Stage = "build" | "reveal";
type Draw = { nation: Nation; cup: number };

const REROLL_MAX = 3;
const ATK = new Set<Pos>(["PD", "PE", "ATA", "MEI", "ME"]);
const DEF = new Set<Pos>(["GOL", "ZAG", "LD", "LE"]);
function lineOf(pos: Pos): "atk" | "mid" | "def" {
  if (ATK.has(pos)) return "atk";
  if (DEF.has(pos)) return "def";
  return "mid";
}

// attack / defense halves for the box-score averages
const AVG_ATK = new Set<Pos>(["MC", "MEI", "MD", "ME", "PD", "PE", "ATA"]);
const AVG_DEF = new Set<Pos>(["GOL", "ZAG", "LD", "LE", "VOL"]);
function lineAvg(slots: { pos: Pos }[], placed: Placed, group: Set<Pos>): number | null {
  let sum = 0;
  let n = 0;
  slots.forEach((s, i) => {
    const p = placed[i];
    if (p && group.has(s.pos)) {
      sum += p.rating;
      n++;
    }
  });
  return n ? Math.round(sum / n) : null;
}

// four pitch lines for the glow ramp: GK -> defense -> midfield -> attack
function glowLine(pos: Pos): "gk" | "def" | "mid" | "atk" {
  if (pos === "GOL") return "gk";
  if (pos === "ZAG" || pos === "LD" || pos === "LE") return "def";
  if (pos === "PD" || pos === "PE" || pos === "ATA" || pos === "ME") return "atk";
  return "mid"; // VOL, MC, MEI, MD
}

export function PlayClient() {
  const t = useTranslations();

  const [stage, setStage] = useState<Stage>("build");

  const [formation, setFormation] = useState<FormationName>("4-3-3");
  const [style, setStyle] = useState<Style>("equilibrado");
  const [almanaque, setAlmanaque] = useState(false);
  const [phaseFormat, setPhaseFormat] = useState<"liga" | "grupos">("liga");

  const [placed, setPlaced] = useState<Placed>(() =>
    new Array(FORMATIONS["4-3-3"].length).fill(null)
  );
  const [draw, setDraw] = useState<Draw | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [movingFrom, setMovingFrom] = useState<number | null>(null); // a placed player picked up to move
  const [rerolls, setRerolls] = useState(REROLL_MAX);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // base slots drive fitting (the squad you build is the same per formation);
  // styled slots apply the tactical style (re-roled positions + depth) and feed
  // the pitch, box score and the simulation
  const baseSlots = FORMATIONS[formation];
  const slots = useMemo(() => styledFormation(baseSlots, style), [formation, style]);
  const squad = useMemo(
    () => (draw ? buildSquad(draw.nation.id, draw.cup) : null),
    [draw]
  );

  const placedIds = new Set(placed.filter(Boolean).map((p) => (p as Player).id));
  // a name can only appear once in the XI — block the same legend from other years
  // (different id, same name) so you can't field e.g. Maldini + Maldini in defense
  const placedNames = new Set(placed.filter(Boolean).map((p) => (p as Player).name));
  const filledCount = placed.filter(Boolean).length;
  const allFilled = filledCount === slots.length;

  // pitch glow steps up once each line (GK / defense / midfield / attack) is full
  const lineGlow = useMemo(() => {
    const groups = new Map<string, { total: number; filled: number }>();
    slots.forEach((s, i) => {
      const ln = glowLine(s.pos);
      const g = groups.get(ln) ?? { total: 0, filled: 0 };
      g.total++;
      if (placed[i]) g.filled++;
      groups.set(ln, g);
    });
    let complete = 0;
    groups.forEach((g) => {
      if (g.filled === g.total) complete++;
    });
    return groups.size ? complete / groups.size : 0;
  }, [slots, placed]);
  const pool = squad
    ? squad.players.filter((p) => !placedIds.has(p.id) && !placedNames.has(p.name))
    : [];
  // selectors lock once the run has begun
  const locked = draw !== null || filledCount > 0 || spinning;

  // fitting follows the style-adjusted position exactly: a slot accepts only
  // players of its (re-roled) natural position
  const highlight = useMemo(() => {
    const p = selectedPlayer ?? (movingFrom !== null ? placed[movingFrom] : null);
    if (!p) return [];
    return slots
      .map((s, i) => (!placed[i] && playerFitsSlot(p, s.pos) ? i : -1))
      .filter((i) => i >= 0);
  }, [selectedPlayer, movingFrom, placed, slots]);

  function fitsAnyOpen(p: Player): boolean {
    return slots.some((s, i) => !placed[i] && playerFitsSlot(p, s.pos));
  }

  // if a drawn squad has no player that fits an open slot, auto-reroll for free
  // (doesn't consume a re-roll, even when none are left)
  const noUsable =
    !!draw && !spinning && !allFilled && !!squad && !pool.some((p) => fitsAnyOpen(p));
  useEffect(() => {
    if (noUsable) rollDie(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noUsable]);

  const liveXI = placed
    .map((p, i) => (p ? { player: p, slotPos: slots[i].pos } : null))
    .filter(Boolean) as { player: Player; slotPos: Pos }[];
  const rating = rateTeam(liveXI, style);

  // changing formation before the run resets the (empty) pitch to new slot count
  function chooseFormation(f: FormationName) {
    if (locked) return;
    setFormation(f);
    setPlaced(new Array(FORMATIONS[f].length).fill(null));
  }

  function rollDie(reroll = false) {
    if (spinning) return;
    if (reroll && rerolls <= 0) return;
    setSpinning(true);
    setSelectedPlayer(null);
    setMovingFrom(null);
    const r = mulberry32((Date.now() % 2147483647) >>> 0);
    setTimeout(() => {
      const d = pick(r, VALID_DRAWS);
      setDraw({ nation: d.nation, cup: d.cup });
      setSpinning(false);
      if (reroll) setRerolls((n) => n - 1);
    }, 600);
  }

  function pickPlayer(p: Player) {
    if (!fitsAnyOpen(p)) return;
    setMovingFrom(null);
    setSelectedPlayer((cur) => (cur?.id === p.id ? null : p));
  }

  function onSlotClick(i: number) {
    // moving an already-placed player to another of his positions (frees the old slot)
    if (movingFrom !== null) {
      if (i === movingFrom) {
        setMovingFrom(null);
        return;
      }
      if (!highlight.includes(i)) return;
      setPlaced((prev) => {
        const next = prev.slice();
        next[i] = next[movingFrom];
        next[movingFrom] = null;
        return next;
      });
      setMovingFrom(null);
      return;
    }
    // placing a picked pool player
    if (selectedPlayer) {
      if (!highlight.includes(i)) return;
      const chosen = selectedPlayer;
      setPlaced((prev) => {
        const next = prev.slice();
        next[i] = chosen;
        return next;
      });
      setSelectedPlayer(null);
      setDraw(null);
      return;
    }
    // pick up a placed player to move him
    if (placed[i]) setMovingFrom(i);
  }

  function simulate() {
    if (!allFilled) return;
    const seed = Math.floor(Math.random() * 2_000_000_000);
    setCampaign(simulateCampaign(seed, liveXI, style, formation, phaseFormat));
    setStage("reveal");
  }

  function playAgain() {
    setStage("build");
    setPlaced(new Array(FORMATIONS[formation].length).fill(null));
    setDraw(null);
    setSelectedPlayer(null);
    setRerolls(REROLL_MAX);
    setCampaign(null);
  }

  const styleLabel = t(
    style === "defensivo"
      ? "play.styleDefensivo"
      : style === "ofensivo"
      ? "play.styleOfensivo"
      : "play.styleEquilibrado"
  );
  const modeLabel = almanaque ? t("common.modeAlmanaque") : t("common.modeClassico");
  const configSummary = `${formation} · ${styleLabel} · ${modeLabel}`.toUpperCase();
  const nextPick = filledCount + 1;

  if (stage === "reveal" && campaign) {
    const xi = placed
      .map((p, i) => (p ? { player: p, slotPos: slots[i].pos } : null))
      .filter(Boolean) as { player: Player; slotPos: Pos }[];
    return (
      <main className="play-wrap tx-paper">
        <PlayHead configSummary={configSummary} />
        <Reveal
          campaign={campaign}
          xi={xi}
          slots={slots}
          placed={placed}
          almanaque={almanaque}
          onAgain={playAgain}
        />
      </main>
    );
  }

  return (
    <main className="play-wrap tx-paper">
      <PlayHead configSummary={configSummary} />

      <section className="play-board">
        {/* LEFT — selection panel (until first roll) + roll/pool */}
        <aside className="play-left">
          {!locked && (
          <div className="build-panel">
            <div className="bp-section">
              <span className="bp-label">{t("play.formationLabel")}</span>
              <div className="fmt-grid">
                {(Object.keys(FORMATIONS) as FormationName[]).map((f) => (
                  <button
                    key={f}
                    className={`fmt-btn${formation === f ? " on" : ""}`}
                    aria-pressed={formation === f}
                    onClick={() => chooseFormation(f)}
                    disabled={locked}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="bp-section">
              <span className="bp-label">{t("play.styleLabel")}</span>
              <div className="panel-seg three">
                <button aria-pressed={style === "defensivo"} disabled={locked} onClick={() => setStyle("defensivo")}>
                  {t("play.styleDefensivo")}
                </button>
                <button aria-pressed={style === "equilibrado"} disabled={locked} onClick={() => setStyle("equilibrado")}>
                  {t("play.styleEquilibrado")}
                </button>
                <button aria-pressed={style === "ofensivo"} disabled={locked} onClick={() => setStyle("ofensivo")}>
                  {t("play.styleOfensivo")}
                </button>
              </div>
            </div>

            <div className="bp-section">
              <span className="bp-label">{t("play.modeLabel")}</span>
              <div className="panel-seg">
                <button aria-pressed={!almanaque} disabled={locked} onClick={() => setAlmanaque(false)}>
                  {t("common.modeClassico")}
                </button>
                <button aria-pressed={almanaque} disabled={locked} onClick={() => setAlmanaque(true)}>
                  {t("common.modeAlmanaque")}
                </button>
              </div>
              <div className="panel-seg">
                <button aria-pressed={phaseFormat === "liga"} disabled={locked} onClick={() => setPhaseFormat("liga")}>
                  {t("play.faseLiga")}
                </button>
                <button aria-pressed={phaseFormat === "grupos"} disabled={locked} onClick={() => setPhaseFormat("grupos")}>
                  {t("play.faseGrupos")}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* roll prompt, drawn pool, or simulate */}
          {allFilled ? (
            <button className="btn btn-primary btn-roll" onClick={simulate}>
              {t("play.simulate")}
            </button>
          ) : !draw || spinning ? (
            <div className="roll-zone">
              <div className="roll-prompt">
                {spinning ? t("roll.spinning") : t("roll.idle")}
              </div>
              <button className="btn btn-primary btn-roll" onClick={() => rollDie(false)} disabled={spinning}>
                <span>{spinning ? t("roll.spinning") : t("roll.rollBtn")}</span>
                <span className={`dice-ic${spinning ? " spinning" : ""}`}>🎲</span>
              </button>
            </div>
          ) : (
            <div className="draft-pool">
              <div className="pool-head">
                <div className="roll-drawn sm">
                  <span className="roll-flag">{draw.nation.flag}</span>
                  <span className="roll-nation num">
                    {draw.nation.name} · {cupToSeason(draw.cup)}
                  </span>
                </div>
                <button
                  className="reroll-mini"
                  onClick={() => rollDie(true)}
                  disabled={rerolls <= 0}
                  title={t("roll.reroll", { count: rerolls })}
                >
                  ↺ {rerolls}
                </button>
              </div>
              <div className="pool-title">
                {selectedPlayer ? t("play.hintMove") : t("roll.choosePlayer")}
                <span className="pool-pick num"> · {nextPick}/{slots.length}</span>
              </div>
              <div className="pool-list">
                {pool.map((p) => {
                  const fits = fitsAnyOpen(p);
                  const isSel = selectedPlayer?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      className={`pool-chip${fits ? "" : " dim"}${isSel ? " sel" : ""}`}
                      onClick={() => pickPlayer(p)}
                      disabled={!fits}
                    >
                      <span className="pool-pos num">{p.pos.join("/")}</span>
                      <span className="pool-name">{p.name}</span>
                      {!almanaque && <span className="pool-rating num">{p.rating}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* CENTER — pitch */}
        <div className="play-center">
          <Pitch
            slots={slots}
            placed={placed}
            showRatings={!almanaque}
            highlight={highlight}
            onSlotClick={onSlotClick}
            glow={lineGlow}
            selectedSlot={movingFrom}
          />
        </div>

        {/* RIGHT — box score */}
        <aside className="play-right">
          <BoxScore
            slots={slots}
            placed={placed}
            rating={rating}
            almanaque={almanaque}
            count={filledCount}
          />
        </aside>
      </section>
    </main>
  );
}

function PlayHead({ configSummary }: { configSummary: string }) {
  const t = useTranslations("common");
  return (
    <header className="site-header play-head">
      <Link className="brand" href="/" aria-label="Road to Glory">
        <span className="brand-badge" aria-hidden="true">★</span>
        <span className="brand-word">
          ROAD TO <span className="accent">GLORY</span>
        </span>
      </Link>
      <div className="site-header-right">
        <span className="config-summary num">{configSummary}</span>
        <Link className="profile-link icon-only" aria-label={t("profile")} href="/perfil">
          <svg className="profile-link-ic" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="7" y="9" width="26" height="22" rx="2" />
            <circle cx="15" cy="18" r="3.2" />
            <path d="M10.5 26.5c1.2-3 7.6-3 8.8 0" />
            <line x1="24" y1="16" x2="29.5" y2="16" />
            <line x1="24" y1="21" x2="29.5" y2="21" />
          </svg>
        </Link>
        <Settings />
      </div>
    </header>
  );
}

function BoxScore({
  slots,
  placed,
  rating,
  almanaque,
  count,
}: {
  slots: { pos: Pos }[];
  placed: Placed;
  rating: { attack: number; defense: number; overall: number };
  almanaque: boolean;
  count: number;
}) {
  const t = useTranslations("play");
  return (
    <div className="boxscore-panel">
      <div className="bx-head">
        <span className="bx-title">{t("boxTitle", { count })}</span>
        <span className="bx-ovr num">{count ? rating.overall : "—"}</span>
      </div>
      <div className="bx-legend">
        <span className="lg atk">
          {t("attack")} <b className="num">{almanaque ? "•" : lineAvg(slots, placed, AVG_ATK) ?? "—"}</b>
        </span>
        <span className="lg def">
          {t("defense")} <b className="num">{almanaque ? "•" : lineAvg(slots, placed, AVG_DEF) ?? "—"}</b>
        </span>
      </div>
      <ul className="bx-list">
        {slots.map((s, i) => {
          const p = placed[i];
          const line = lineOf(s.pos);
          return (
            <li key={i} className={`bx-row ${line}`}>
              <span className="bx-pos num">{s.pos}</span>
              <span className="bx-name">{p ? p.name : "—"}</span>
              <span className="bx-num num">
                {p ? (almanaque ? "•" : p.rating) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
