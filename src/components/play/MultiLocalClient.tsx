"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Pitch, type Placed, type DiscBadge } from "./Pitch";
import { LiveMatch } from "./Reveal";
import {
  VALID_DRAWS,
  FORMATIONS,
  buildSquad,
  playerFitsSlot,
  styledFormation,
  cupToSeason,
  type FormationName,
  type Player,
  type Pos,
  type Slot,
} from "@/lib/data";
import { rateTeam, simulateMatch, simulateTie, type Fixture, type Style } from "@/lib/sim";
import { pick, mulberry32 } from "@/lib/rng";
import { hasChampionImage, championImageSrc } from "@/lib/championImages";
import { hasEliminatedImage, eliminatedImageSrc } from "@/lib/eliminatedImages";
import { useRoom } from "@/lib/multiplayer/useRoom";
import {
  filledCount,
  isFull,
  type Matchup,
  type Mode,
  type TeamCfg,
} from "@/lib/multiplayer/roomState";

const FORMATION_KEYS = Object.keys(FORMATIONS) as FormationName[];
const SPEEDS = ["slow", "normal", "fast", "ultra"] as const;
type Speed = (typeof SPEEDS)[number];

const ATK_POS = new Set<Pos>(["PD", "PE", "ATA", "MEI", "ME"]);
const DEF_POS = new Set<Pos>(["GOL", "ZAG", "LD", "LE"]);
function lineOf(pos: Pos): "atk" | "mid" | "def" {
  if (ATK_POS.has(pos)) return "atk";
  if (DEF_POS.has(pos)) return "def";
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

function teamSlots(t: TeamCfg): Slot[] {
  return styledFormation(FORMATIONS[t.formation], t.style);
}

function teamXI(t: TeamCfg) {
  const slots = teamSlots(t);
  return t.placed
    .map((p, i) => (p ? { player: p, slotPos: slots[i].pos } : null))
    .filter(Boolean) as { player: Player; slotPos: Pos }[];
}

export function MultiLocalClient() {
  const t = useTranslations();
  const { state, dispatch } = useRoom();
  const {
    stage,
    mode,
    teams,
    turn,
    draw,
    rerolls,
    queue,
    qi,
    legIdx,
    matchStarted,
    baseSeed,
    standings,
  } = state;
  const numTeams = teams.length;

  // local UI / playback state — not part of the shared room state
  const [spinning, setSpinning] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [movingFrom, setMovingFrom] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>("slow");
  const [curFixtures, setCurFixtures] = useState<Fixture[]>([]);
  const [curWinner, setCurWinner] = useState(0);
  const [copied, setCopied] = useState(false);
  const [podiumTeam, setPodiumTeam] = useState<number | null>(null);

  const named = (i: number) => teams[i]?.name.trim() || t("multi.local.teamN", { n: i + 1 });
  const mLabel = (m: Matchup) => t(m.labelKey, m.labelN != null ? { n: m.labelN } : {});

  function resetLocalUI() {
    setSpinning(false);
    setSelectedPlayer(null);
    setMovingFrom(null);
  }

  function chooseMode(m: Mode) {
    resetLocalUI();
    dispatch({ t: "chooseMode", mode: m });
  }

  function playAgain() {
    resetLocalUI();
    setCurFixtures([]);
    setCurWinner(0);
    setCopied(false);
    setPodiumTeam(null);
    dispatch({ t: "reset" });
  }

  function patchTeam(idx: number, patch: Partial<TeamCfg>) {
    dispatch({ t: "patchTeam", idx, patch });
  }
  function chooseFormation(idx: number, f: FormationName) {
    dispatch({ t: "chooseFormation", idx, formation: f });
  }

  // ----- draft helpers (active team) -------------------------------------
  const active = teams[turn];
  const activeSlots = useMemo(() => teamSlots(active), [active]);
  const filled = filledCount(active);
  const squad = useMemo(() => (draw ? buildSquad(draw.nationId, draw.cup) : null), [draw]);
  // the exact card (id is nation-cup-index) is locked across ALL teams
  const placedIds = new Set(
    teams.flatMap((tm) => tm.placed).filter(Boolean).map((p) => (p as Player).id)
  );
  // within a single team a name can appear only once
  const activeNames = new Set(active.placed.filter(Boolean).map((p) => (p as Player).name));
  const pool = squad
    ? squad.players.filter((p) => !placedIds.has(p.id) && !activeNames.has(p.name))
    : [];
  const activeRating = rateTeam(teamXI(active), active.style);

  const namesByTeam = useMemo(
    () => teams.map((tm) => tm.placed.map((p) => p?.name ?? null)),
    [teams]
  );

  const highlight = useMemo(() => {
    const p = selectedPlayer ?? (movingFrom !== null ? active.placed[movingFrom] : null);
    if (!p) return [];
    return activeSlots
      .map((s, i) => (!active.placed[i] && playerFitsSlot(p, s.pos) ? i : -1))
      .filter((i) => i >= 0);
  }, [selectedPlayer, movingFrom, active.placed, activeSlots]);

  const fitsAnyOpen = (p: Player) =>
    activeSlots.some((s, i) => !active.placed[i] && playerFitsSlot(p, s.pos));

  const noUsable =
    !!draw && !spinning && filled < activeSlots.length && !!squad && !pool.some((p) => fitsAnyOpen(p));
  useEffect(() => {
    if (noUsable) rollDie(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noUsable]);

  function rollDie(reroll = false) {
    if (spinning) return;
    if (reroll && rerolls[turn] <= 0) return;
    setSpinning(true);
    setSelectedPlayer(null);
    setMovingFrom(null);
    const r = mulberry32((Date.now() % 2147483647) >>> 0);
    setTimeout(() => {
      const d = pick(r, VALID_DRAWS);
      dispatch({ t: "draw", nationId: d.nation.id, cup: d.cup, reroll });
      setSpinning(false);
    }, 600);
  }

  function pickPlayer(p: Player) {
    if (!fitsAnyOpen(p)) return;
    setMovingFrom(null);
    setSelectedPlayer((cur) => (cur?.id === p.id ? null : p));
  }

  function onSlotClick(i: number) {
    if (movingFrom !== null) {
      if (i === movingFrom) {
        setMovingFrom(null);
        return;
      }
      if (!highlight.includes(i)) return;
      dispatch({ t: "movePlaced", from: movingFrom, to: i });
      setMovingFrom(null);
      return;
    }
    if (selectedPlayer) {
      placeAt(i);
      return;
    }
    if (active.placed[i]) setMovingFrom(i);
  }

  function placeAt(i: number) {
    if (!selectedPlayer || !highlight.includes(i)) return;
    dispatch({ t: "place", player: selectedPlayer, slot: i });
    setSelectedPlayer(null);
  }

  function shuffled<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // once the draft fills up, the authority generates the bracket seed + pairings
  // and broadcasts beginReveal (deterministic sim => every client matches).
  useEffect(() => {
    if (stage !== "draft" || !teams.every(isFull)) return;
    const seed = Math.floor(Math.random() * 2_000_000_000);
    let q: Matchup[];
    if (mode === "single") {
      q = [{ labelKey: "multi.local.matchLabel", a: 0, b: 1, legs: 1, phase: "FINAL" }];
    } else if (mode === "twoleg") {
      q = [{ labelKey: "multi.local.twoLeg", a: 0, b: 1, legs: 2, phase: "FINAL" }];
    } else {
      const o = shuffled([0, 1, 2, 3]);
      q = [
        { labelKey: "multi.local.semifinal", labelN: 1, a: o[0], b: o[1], legs: 2, phase: "SEMI" },
        { labelKey: "multi.local.semifinal", labelN: 2, a: o[2], b: o[3], legs: 2, phase: "SEMI" },
      ];
    }
    dispatch({ t: "beginReveal", baseSeed: seed, queue: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, teams]);

  // compute the fixtures for the current matchup whenever it changes
  useEffect(() => {
    if (stage !== "reveal") return;
    const m = queue[qi];
    if (!m) return;
    const seed = baseSeed + qi * 7919;
    const xiA = teamXI(teams[m.a]);
    const xiB = teamXI(teams[m.b]);
    if (m.legs === 2) {
      const tie = simulateTie(seed, xiA, teams[m.a].style, xiB, teams[m.b].style, named(m.b), m.phase);
      setCurFixtures(tie.legs);
      setCurWinner(tie.winner === 0 ? m.a : m.b);
    } else {
      const f = simulateMatch(seed, xiA, teams[m.a].style, xiB, teams[m.b].style, named(m.b), m.phase);
      setCurFixtures([f]);
      setCurWinner(f.result === "W" ? m.a : m.b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, qi, queue]);

  function onLegDone() {
    if (legIdx < curFixtures.length - 1) {
      dispatch({ t: "nextLeg" });
      return;
    }
    dispatch({ t: "finishMatchup", winner: curWinner });
  }

  function shareResult() {
    if (!standings) return;
    const champ = named(standings[0]);
    const txt =
      mode === "tourney"
        ? `🏆 ${champ} · ${t("multi.local.podiumTitle")} · Road to Glory`
        : `${named(standings[0])} 🏆 ${named(standings[1])} · Road to Glory`;
    navigator.clipboard?.writeText(txt).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  // ----- render: menu ----------------------------------------------------
  if (stage === "menu") {
    return (
      <main className="page-wrap tx-paper">
        <MultiHead />
        <div className="page-body ml-setup-body">
          <h1 className="page-title">{t("multi.local.title")}</h1>
          <p className="page-sub">{t("multi.local.sub")}</p>
          <div className="ml-menu">
            <div className="ml-menu-line">
              <span className="ml-menu-label">{t("multi.local.line2p")}</span>
              <div className="ml-menu-row">
                <button className="btn btn-primary big" onClick={() => chooseMode("single")}>
                  {t("multi.local.modeSingle")}
                </button>
                <button className="btn btn-primary big" onClick={() => chooseMode("twoleg")}>
                  {t("multi.local.modeTwoLeg")}
                </button>
              </div>
            </div>
            <div className="ml-menu-line">
              <span className="ml-menu-label">{t("multi.local.line4p")}</span>
              <div className="ml-menu-row">
                <button className="btn btn-primary big" onClick={() => chooseMode("tourney")}>
                  {t("multi.local.modeTourney")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ----- render: setup ---------------------------------------------------
  if (stage === "setup") {
    return (
      <main className="page-wrap tx-paper">
        <MultiHead />
        <div className="page-body ml-setup-body">
          <h1 className="page-title">{t("multi.local.title")}</h1>
          <p className="page-sub">{t("multi.local.sub")}</p>
          <div className={`ml-setup-grid${numTeams === 4 ? " quad" : ""}`}>
            {teams.map((team, idx) => (
              <SetupPanel
                key={idx}
                idx={idx}
                team={team}
                onName={(name) => patchTeam(idx, { name })}
                onFormation={(f) => chooseFormation(idx, f)}
                onStyle={(s) => patchTeam(idx, { style: s })}
                onMode={(a) => patchTeam(idx, { almanaque: a })}
              />
            ))}
          </div>
          <div className="ml-setup-actions">
            <button className="btn btn-secondary" onClick={() => dispatch({ t: "back" })}>
              {t("reveal.reviewBack")}
            </button>
            <button className="btn btn-primary big" onClick={() => dispatch({ t: "startDraft" })}>
              {t("multi.local.startDraft")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ----- render: draft ---------------------------------------------------
  if (stage === "draft") {
    return (
      <main className="play-wrap tx-paper">
        <MultiHead />
        <div className="ml-draft">
          <div className={`ml-turn ml-turn--${turn % 2}`}>
            <span className="ml-turn-label">{t("multi.local.turnOf")}</span>
            <span className="ml-turn-name">{named(turn)}</span>
            <span className="ml-turn-count num">{filled}/{activeSlots.length}</span>
          </div>

          <div className="ml-draft-grid">
            <aside className="ml-draft-left">
              {!draw || spinning ? (
                <div className="roll-zone">
                  <div className="roll-prompt">{spinning ? t("roll.spinning") : t("roll.idle")}</div>
                  <button
                    className="btn btn-primary btn-roll"
                    onClick={() => rollDie(false)}
                    disabled={spinning}
                  >
                    <span>{spinning ? t("roll.spinning") : t("roll.rollBtn")}</span>
                    <span className={`dice-ic${spinning ? " spinning" : ""}`}>🎲</span>
                  </button>
                </div>
              ) : (
                <div className="draft-pool">
                  <div className="pool-head">
                    <div className="roll-drawn sm">
                      <span className="roll-flag">
                        {VALID_DRAWS.find(
                          (d) => d.nation.id === draw.nationId && d.cup === draw.cup
                        )?.nation.flag}
                      </span>
                      <span className="roll-nation num">
                        {squad?.nation.name} · {cupToSeason(draw.cup)}
                      </span>
                    </div>
                    <button
                      className="reroll-mini"
                      onClick={() => rollDie(true)}
                      disabled={rerolls[turn] <= 0}
                    >
                      ↺ {rerolls[turn]}
                    </button>
                  </div>
                  <div className="pool-title">
                    {selectedPlayer ? t("play.hintMove") : t("roll.choosePlayer")}
                    <span className="pool-pick num"> · {filled + 1}/{activeSlots.length}</span>
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
                          {!active.almanaque && <span className="pool-rating num">{p.rating}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>

            <div className="play-center">
              <Pitch
                slots={activeSlots}
                placed={active.placed}
                showRatings={!active.almanaque}
                highlight={highlight}
                onSlotClick={onSlotClick}
                glow={filled / activeSlots.length}
                selectedSlot={movingFrom}
              />
            </div>

            <aside className="play-right">
              <div className="boxscore-panel">
                <div className="bx-head">
                  <span className="bx-title">{t("play.boxTitle", { count: filled })}</span>
                  <span className="bx-ovr num">{filled ? activeRating.overall : "—"}</span>
                </div>
                <div className="bx-legend">
                  <span className="lg atk">
                    {t("play.attack")}{" "}
                    <b className="num">{active.almanaque ? "•" : lineAvg(activeSlots, active.placed, AVG_ATK) ?? "—"}</b>
                  </span>
                  <span className="lg def">
                    {t("play.defense")}{" "}
                    <b className="num">{active.almanaque ? "•" : lineAvg(activeSlots, active.placed, AVG_DEF) ?? "—"}</b>
                  </span>
                </div>
                <ul className="bx-list">
                  {activeSlots.map((s, i) => {
                    const p = active.placed[i];
                    const line = lineOf(s.pos);
                    return (
                      <li key={i} className={`bx-row ${line}`}>
                        <span className="bx-pos num">{s.pos}</span>
                        <span className="bx-name">{p ? p.name : "—"}</span>
                        <span className="bx-num num">{p ? (active.almanaque ? "•" : p.rating) : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  // ----- render: reveal + result ----------------------------------------
  const cur = queue[qi];
  const legTag = cur && cur.legs === 2 ? (legIdx === 0 ? t("reveal.legIda") : t("reveal.legVolta")) : "";

  return (
    <main className="play-wrap tx-paper">
      <MultiHead />
      <section
        className={`reveal-stage card-open${
          stage === "reveal" && !matchStarted ? " gate-wide" : ""
        }`}
      >
        {stage === "reveal" && cur && !matchStarted && (
          <div className="reveal-cardgate">
            <div className="ml-tie-title">
              {mLabel(cur)}
              {legTag && <span className="ml-tie-leg"> · {legTag}</span>}
            </div>
            <div className="seg-mini ml-speed" role="group" aria-label={t("reveal.speedLabel")}>
              {SPEEDS.map((s) => (
                <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {t(
                    s === "slow"
                      ? "reveal.speedSlow"
                      : s === "normal"
                      ? "reveal.speedNormal"
                      : s === "fast"
                      ? "reveal.speedFast"
                      : "reveal.speedUltra"
                  )}
                </button>
              ))}
            </div>
            <button className="btn btn-primary big" onClick={() => dispatch({ t: "startMatch" })}>
              {t("multi.local.revealMatch")}
            </button>
            <span className="ml-vs num">
              {named(cur.a)} <span className="lm-x">×</span> {named(cur.b)}
            </span>
            <div className="ml-reveal-lineups">
              {[cur.a, cur.b].map((teamIdx, side) => {
                const team = teams[teamIdx];
                const tslots = teamSlots(team);
                const placedCount = filledCount(team);
                const overall = rateTeam(teamXI(team), team.style).overall;
                const info = (
                  <div className="boxscore-panel ml-reveal-box">
                    <div className="bx-head">
                      <span className="bx-title">{t("play.boxTitle", { count: placedCount })}</span>
                      <span className="bx-ovr num">{overall}</span>
                    </div>
                    <div className="bx-legend">
                      <span className="lg atk">
                        {t("play.attack")}{" "}
                        <b className="num">{team.almanaque ? "•" : lineAvg(tslots, team.placed, AVG_ATK) ?? "—"}</b>
                      </span>
                      <span className="lg def">
                        {t("play.defense")}{" "}
                        <b className="num">{team.almanaque ? "•" : lineAvg(tslots, team.placed, AVG_DEF) ?? "—"}</b>
                      </span>
                    </div>
                    <ul className="bx-list">
                      {tslots.map((s, i) => {
                        const p = team.placed[i];
                        const line = lineOf(s.pos);
                        return (
                          <li key={i} className={`bx-row ${line}`}>
                            <span className="bx-pos num">{s.pos}</span>
                            <span className="bx-name">{p ? p.name : "—"}</span>
                            <span className="bx-num num">{p ? (team.almanaque ? "•" : p.rating) : "—"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
                const pitch = (
                  <div className="ml-reveal-pitch">
                    <Pitch
                      slots={tslots}
                      placed={team.placed}
                      showRatings={!team.almanaque}
                      highlight={[]}
                      onSlotClick={() => {}}
                    />
                  </div>
                );
                return (
                  <div key={teamIdx} className={`ml-reveal-team t${side}`}>
                    {side === 0 ? (
                      <>
                        {info}
                        {pitch}
                      </>
                    ) : (
                      <>
                        {pitch}
                        {info}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stage === "reveal" && cur && matchStarted && curFixtures[legIdx] && (
          <LiveMatch
            key={`${qi}-${legIdx}`}
            fixture={curFixtures[legIdx]}
            speed={speed}
            slots={teamSlots(teams[cur.a])}
            oppSlots={teamSlots(teams[cur.b])}
            names={namesByTeam[cur.a]}
            oppNames={namesByTeam[cur.b]}
            forName={named(cur.a)}
            againstName={named(cur.b)}
            hideOpponentTag
            onDone={onLegDone}
          />
        )}

        {stage === "result" && standings && mode !== "tourney" && curFixtures.length > 0 && (
          <>
            <div className="result-screen ml-result">
              {[0, 1].map((idx) => (
                <TeamCard
                  key={idx}
                  team={teams[idx]}
                  name={named(idx)}
                  fixture={curFixtures[curFixtures.length - 1]}
                  side={idx === 0 ? "for" : "against"}
                  won={standings[0] === idx}
                />
              ))}
            </div>
            <div className="rc-actions">
              <button className="btn btn-secondary" onClick={shareResult}>
                {copied ? t("card.linkCopied") : t("card.shareLink")}
              </button>
              <button className="btn btn-primary" onClick={playAgain}>
                {t("card.again")}
              </button>
            </div>
          </>
        )}

        {stage === "result" && standings && mode === "tourney" && (
          <div className="ml-podium">
            <h2 className="reveal-title">{t("multi.local.podiumTitle")}</h2>
            <ol className="ml-podium-list">
              {standings.map((teamIdx, i) => (
                <li key={teamIdx}>
                  <button
                    className={`ml-podium-row p${i + 1}`}
                    onClick={() => setPodiumTeam(teamIdx)}
                  >
                    <span className="ml-podium-pos num">{i + 1}º</span>
                    <span className="ml-podium-medal">{["🥇", "🥈", "🥉", ""][i]}</span>
                    <span className="ml-podium-name">{named(teamIdx)}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="rc-actions">
              <button className="btn btn-secondary" onClick={shareResult}>
                {copied ? t("card.linkCopied") : t("card.shareLink")}
              </button>
              <button className="btn btn-primary" onClick={playAgain}>
                {t("card.again")}
              </button>
            </div>

            {podiumTeam !== null && (
              <div
                className="ml-lineup-modal"
                role="dialog"
                aria-modal="true"
                onClick={() => setPodiumTeam(null)}
              >
                <div className="ml-lineup-card" onClick={(e) => e.stopPropagation()}>
                  <div className="ml-lineup-head">
                    <span className="ml-lineup-title">{named(podiumTeam)}</span>
                    <button
                      className="ml-lineup-close"
                      onClick={() => setPodiumTeam(null)}
                      aria-label="×"
                    >
                      ×
                    </button>
                  </div>
                  <div className="rc-pitch">
                    <Pitch
                      slots={teamSlots(teams[podiumTeam])}
                      placed={teams[podiumTeam].placed}
                      showRatings={!teams[podiumTeam].almanaque}
                      highlight={[]}
                      onSlotClick={() => {}}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function MultiHead() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Road to Glory">
        <span className="brand-badge" aria-hidden="true">★</span>
        <span className="brand-word">ROAD TO <span className="accent">GLORY</span></span>
      </Link>
    </header>
  );
}

function SetupPanel({
  idx,
  team,
  onName,
  onFormation,
  onStyle,
  onMode,
}: {
  idx: number;
  team: TeamCfg;
  onName: (v: string) => void;
  onFormation: (f: FormationName) => void;
  onStyle: (s: Style) => void;
  onMode: (a: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <div className="build-panel">
      <div className="bp-section">
        <span className="bp-label">{t("multi.local.teamName")}</span>
        <input
          className="ml-name-input"
          value={team.name}
          placeholder={t("multi.local.teamN", { n: idx + 1 })}
          maxLength={20}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="bp-section">
        <span className="bp-label">{t("play.formationLabel")}</span>
        <div className="fmt-grid">
          {FORMATION_KEYS.map((f) => (
            <button
              key={f}
              className={`fmt-btn${team.formation === f ? " on" : ""}`}
              aria-pressed={team.formation === f}
              onClick={() => onFormation(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="bp-section">
        <span className="bp-label">{t("play.styleLabel")}</span>
        <div className="panel-seg three">
          <button aria-pressed={team.style === "defensivo"} onClick={() => onStyle("defensivo")}>
            {t("play.styleDefensivo")}
          </button>
          <button aria-pressed={team.style === "equilibrado"} onClick={() => onStyle("equilibrado")}>
            {t("play.styleEquilibrado")}
          </button>
          <button aria-pressed={team.style === "ofensivo"} onClick={() => onStyle("ofensivo")}>
            {t("play.styleOfensivo")}
          </button>
        </div>
      </div>
      <div className="bp-section">
        <span className="bp-label">{t("play.modeLabel")}</span>
        <div className="panel-seg">
          <button aria-pressed={!team.almanaque} onClick={() => onMode(false)}>
            {t("common.modeClassico")}
          </button>
          <button aria-pressed={team.almanaque} onClick={() => onMode(true)}>
            {t("common.modeAlmanaque")}
          </button>
        </div>
      </div>
    </div>
  );
}

function tally(
  events: Fixture["events"],
  side: "for" | "against",
  kind: "goal" | "assist"
): { name: string; count: number } | null {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.side !== side) continue;
    if (kind === "goal" && (e.kind === "goal" || e.kind === "pen") && e.player) {
      m.set(e.player, (m.get(e.player) ?? 0) + 1);
    } else if (kind === "assist" && e.assist) {
      m.set(e.assist, (m.get(e.assist) ?? 0) + 1);
    }
  }
  const top = [...m].sort((a, b) => b[1] - a[1])[0];
  return top ? { name: top[0], count: top[1] } : null;
}

function TeamCard({
  team,
  name,
  fixture,
  side,
  won,
}: {
  team: TeamCfg;
  name: string;
  fixture: Fixture;
  side: "for" | "against";
  won?: boolean;
}) {
  const t = useTranslations();
  const xi = teamXI(team);
  const champion = won ?? (side === "for" ? fixture.result === "W" : fixture.result === "L");
  const overall = rateTeam(xi, team.style).overall;
  const gf = side === "for" ? fixture.gfor : fixture.gagainst;
  const ga = side === "for" ? fixture.gagainst : fixture.gfor;
  const penFor = fixture.pens ? (side === "for" ? fixture.pens.for : fixture.pens.against) : null;
  const penAgainst = fixture.pens ? (side === "for" ? fixture.pens.against : fixture.pens.for) : null;

  const scorerEntry = tally(fixture.events, side, "goal");
  const assistEntry = tally(fixture.events, side, "assist");
  const yellows = fixture.events.filter((e) => e.side === side && e.kind === "yellow").length;
  const reds = fixture.events.filter((e) => e.side === side && e.kind === "red").length;

  const sorted = xi.slice().sort((a, b) => b.player.rating - a.player.rating);
  const has = champion ? hasChampionImage : hasEliminatedImage;
  const topScorerName = scorerEntry?.name;
  const topAssistName = assistEntry?.name;
  const scorerStar =
    champion && topScorerName && hasChampionImage(topScorerName)
      ? sorted.find((x) => x.player.name === topScorerName)?.player
      : undefined;
  const assistStar =
    champion && topAssistName && hasChampionImage(topAssistName)
      ? sorted.find((x) => x.player.name === topAssistName)?.player
      : undefined;
  const star =
    scorerStar ??
    assistStar ??
    (sorted.find((x) => has(x.player.name)) ??
      sorted.find((x) => hasChampionImage(x.player.name)) ??
      sorted[0])?.player;
  const heroSrc =
    star && champion && hasChampionImage(star.name)
      ? championImageSrc(star.name)
      : star && !champion && hasEliminatedImage(star.name)
      ? eliminatedImageSrc(star.name)
      : "";

  const scorer = scorerEntry?.name;
  const assister = assistEntry?.name;
  const slots = teamSlots(team);
  const discBadges: Record<number, DiscBadge[]> = {};
  team.placed.forEach((p, i) => {
    if (!p) return;
    const marks: DiscBadge[] = [];
    if (star && p.id === star.id) marks.push("star");
    if (scorer && p.name === scorer) marks.push("boot");
    if (assister && p.name === assister) marks.push("assist");
    if (marks.length) discBadges[i] = marks;
  });

  return (
    <div className={`result-card stats-card${champion ? " champion" : " eliminated"}`}>
      {heroSrc && star ? (
        <div className={`champion-hero${champion ? "" : " hero-out"}`}>
          <img className="champion-hero__img" src={heroSrc} alt={name} />
          <div className="champion-hero__scrim" />
          <div className={`champion-hero__title${champion ? "" : " champion-hero__title--out"}`}>
            {champion ? t("reveal.champion") : t("reveal.eliminated")}
          </div>
          <div className="champion-hero__overlay">
            <div className="champion-hero__identity">
              <div className="champion-hero__team">{name}</div>
              {star && (
                <div className="champion-hero__mvp">
                  {t("card.mvpLabel")}: {star.name}
                </div>
              )}
            </div>
            <div className="champion-hero__score num">{overall}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="rc-top">
            <div className="rc-id">
              <div className="rc-nation num">{name}</div>
              {star && (
                <div className="rc-cup">
                  {t("card.mvpLabel")}: {star.name}
                </div>
              )}
            </div>
            <span className="rc-overall num">{overall}</span>
          </div>
          <div className="rc-verdict">
            <span className={`rc-status${champion ? " champ" : ""}`}>
              {champion ? t("reveal.champion") : t("reveal.eliminated")}
            </span>
          </div>
        </>
      )}

      <div className={`ml-scoreline num${champion ? " win" : " lose"}`}>
        {gf}–{ga}
        {penFor != null && (
          <span className="ml-pens"> ({penFor}-{penAgainst} pên)</span>
        )}
      </div>

      <div className="rc-detail">
        <div className="rc-drow">
          <span className="rc-dlab">{t("card.topScorer")}</span>
          <span className="rc-dval">
            {scorerEntry && (
              <>
                {scorerEntry.name} <b className="num">{scorerEntry.count}</b>
              </>
            )}
          </span>
        </div>
        <div className="rc-drow">
          <span className="rc-dlab">{t("card.topAssist")}</span>
          <span className="rc-dval">
            {assistEntry && (
              <>
                {assistEntry.name} <b className="num">{assistEntry.count}</b>
              </>
            )}
          </span>
        </div>
        <div className="rc-drow">
          <span className="rc-dlab">🟨 / 🟥</span>
          <span className="rc-dval num">
            {yellows} / {reds}
          </span>
        </div>
      </div>

      <div className="rc-pitch">
        <Pitch
          slots={slots}
          placed={team.placed}
          showRatings={!team.almanaque}
          highlight={[]}
          onSlotClick={() => {}}
          badges={discBadges}
        />
      </div>
    </div>
  );
}
