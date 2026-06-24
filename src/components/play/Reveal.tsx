"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import {
  type Campaign,
  type Fixture,
  type MatchEvent,
  type PenaltyKick,
  tickLabel,
} from "@/lib/sim";
import { cupYY, type Player, type Pos, type Slot } from "@/lib/data";
import { Pitch, type Placed, type DiscBadge } from "./Pitch";
import { MatchField } from "./MatchField";
import { hasChampionImage, championImageSrc } from "@/lib/championImages";
import { hasEliminatedImage, eliminatedImageSrc } from "@/lib/eliminatedImages";
import { hasGoalImage, goalImageSrc } from "@/lib/goalImages";
import { soundOn, soundVolume } from "@/lib/sound";

type XI = { player: Player; slotPos: Pos }[];
type Mode = "manual" | "auto";
type Speed = "slow" | "normal" | "fast" | "ultra";

// ms per simulated minute-tick, per speed
const SPEED_MS: Record<Speed, number> = {
  slow: 150,
  normal: 70,
  fast: 28,
  ultra: 9,
};
const SPEEDS: Speed[] = ["slow", "normal", "fast", "ultra"];

function resultClass(f: Fixture): string {
  return f.result === "W" ? "won" : f.result === "L" ? "lost" : "draw";
}

// the highlighted "destaque": on a title run the top scorer (then the top assister)
// wins it outright if he has a champion portrait; otherwise prefer the best-rated
// legend with the run's outcome image (champion / eliminated), then any champion
// legend, then best-rated. Eliminated runs are never influenced by scorer/assister.
function pickStar(
  xi: XI,
  champion: boolean,
  topScorerName?: string,
  topAssistName?: string
): Player | undefined {
  const sorted = xi.slice().sort((a, b) => b.player.rating - a.player.rating);
  if (champion && topScorerName && hasChampionImage(topScorerName)) {
    const scorer = sorted.find((x) => x.player.name === topScorerName);
    if (scorer) return scorer.player;
  }
  if (champion && topAssistName && hasChampionImage(topAssistName)) {
    const assister = sorted.find((x) => x.player.name === topAssistName);
    if (assister) return assister.player;
  }
  const hasOutcome = champion ? hasChampionImage : hasEliminatedImage;
  const withOutcome = sorted.find((x) => hasOutcome(x.player.name));
  const withChamp = sorted.find((x) => hasChampionImage(x.player.name));
  return (withOutcome ?? withChamp ?? sorted[0])?.player;
}

function evIcon(e: MatchEvent): ReactNode {
  if (e.kind === "red" && e.secondYellow)
    return (
      <span className="ev-2y" role="img" aria-label="segundo amarelo">
        <span className="ev-2y-y">🟨</span>
        <span className="ev-2y-r">🟥</span>
      </span>
    );
  if (e.kind === "yellow") return "🟨";
  if (e.kind === "red") return "🟥";
  return "⚽";
}

// shrinks the font just enough for the event text to fit its fixed slot,
// falling back to an ellipsis once it hits the minimum size
function FitText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 9 && guard < 40) {
        size -= 1;
        el.style.fontSize = `${size}px`;
        guard++;
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [children]);
  return (
    <span ref={ref} className="ev-txt">
      {children}
    </span>
  );
}

// two-column goal/card timeline (your team left, opponent right), shared by the
// live match and the expandable fixture rows
function EventColumns({ events }: { events: Fixture["events"] }) {
  const txt = (e: MatchEvent) => (
    <FitText>
      {e.player}
      {e.kind === "pen" && <span className="ev-pen"> (P)</span>}
      {e.assist && <span className="lm-assist"> ({e.assist})</span>}
    </FitText>
  );
  return (
    <div className="lm-events">
      <ol className="lm-ev-col for-col">
        {events
          .filter((e) => e.side === "for")
          .map((e, i) => (
            <li key={`f${i}`} className={`lm-ev for k-${e.kind}`}>
              <span className="ev-min num">{e.label}&apos;</span>
              <span className="ev-ic">{evIcon(e)}</span>
              {txt(e)}
            </li>
          ))}
      </ol>
      <ol className="lm-ev-col against-col">
        {events
          .filter((e) => e.side === "against")
          .map((e, i) => (
            <li key={`a${i}`} className={`lm-ev against k-${e.kind}`}>
              {txt(e)}
              <span className="ev-ic">{evIcon(e)}</span>
              <span className="ev-min num">{e.label}&apos;</span>
            </li>
          ))}
      </ol>
    </div>
  );
}

export function Reveal({
  campaign,
  xi,
  slots,
  placed,
  almanaque,
  onAgain,
}: {
  campaign: Campaign;
  xi: XI;
  slots: Slot[];
  placed: Placed;
  almanaque: boolean;
  onAgain: () => void;
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<Mode>("auto");
  const [speed, setSpeed] = useState<Speed>("fast");
  const [revealed, setRevealed] = useState(0); // # of completed fixtures
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false); // league phase kicked off
  const [koUnlocked, setKoUnlocked] = useState(false); // knockout phase entered
  const [cardRevealed, setCardRevealed] = useState(false); // final card screen shown
  const [reviewStage, setReviewStage] = useState<"league" | "ko" | null>(null); // viewing a past stage

  const total = campaign.fixtures.length;
  const done = revealed >= total && !playing;
  // the first stage is the league or the group phase, depending on the format
  const firstPhase = campaign.format === "grupos" ? "GRUPOS" : "LIGA";
  const leagueCount = useMemo(
    () => campaign.fixtures.filter((f) => f.phase === firstPhase).length,
    [campaign, firstPhase]
  );
  const hasLeague = leagueCount > 0;
  const hasKo = total > leagueCount;
  const leagueFixtures = useMemo(
    () => campaign.fixtures.filter((f) => f.phase === firstPhase),
    [campaign, firstPhase]
  );
  const koFixtures = useMemo(
    () => campaign.fixtures.filter((f) => f.phase !== firstPhase),
    [campaign, firstPhase]
  );
  const star = useMemo(
    () => pickStar(xi, campaign.champion, campaign.stats.scorers[0]?.name, campaign.stats.assisters[0]?.name),
    [xi, campaign.champion, campaign.stats]
  );
  // your lineup names for the pitch dots (aligned to slots)
  const matchNames = useMemo(() => placed.map((p) => p?.name ?? null), [placed]);

  // league wrapped up, waiting for the player to reveal the knockout stage
  // (only when a knockout stage actually exists — eliminated teams have none)
  const atLeagueGate =
    leagueCount > 0 && leagueCount < total && revealed >= leagueCount && !koUnlocked;
  // once the knockout stage starts, the league list + table drop away
  const inKo = koUnlocked || leagueCount === 0;
  const firstKo = campaign.fixtures[leagueCount];
  const koPhaseLabel = firstKo ? t(`phases.${firstKo.phase}`) : "";

  // Automático: kick off the next match on its own (paused at the knockout gate)
  useEffect(() => {
    if (mode === "auto" && started && !playing && revealed < total && !atLeagueGate && !reviewStage) {
      const id = setTimeout(() => setPlaying(true), 700);
      return () => clearTimeout(id);
    }
  }, [mode, started, playing, revealed, total, atLeagueGate, reviewStage]);

  function onMatchDone() {
    setPlaying(false);
    setRevealed((c) => c + 1);
  }

  // start the league phase: fast + automatic by default
  function startLeague() {
    setMode("auto");
    setSpeed("fast");
    setStarted(true);
  }

  // enter the knockout stage: normal speed + game-by-game by default
  function unlockKo() {
    setKoUnlocked(true);
    setMode("manual");
    setSpeed("normal");
    setPlaying(true);
  }

  const shownLeague = campaign.fixtures.slice(0, revealed).filter((f) => f.phase === firstPhase);
  const shownKo = campaign.fixtures.slice(0, revealed).filter((f) => f.phase !== firstPhase);

  // keep newly revealed content (fixture result, standings, gate button, result
  // card) in view as the campaign unfolds. The live match centers itself on
  // mount, so we only follow the tail when a match is *not* playing.
  const endRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!started || playing) return;
    // the revealed card is tall with its hero image up top — show its start;
    // otherwise follow the tail so the latest fixture/table/button is visible.
    if (done && cardRevealed) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [started, playing, revealed, koUnlocked, atLeagueGate, done, cardRevealed]);

  return (
    <section className={`reveal-stage${done && cardRevealed ? " card-open" : ""}`}>
      {reviewStage && (
        <div className="reveal-review">
          <button className="btn btn-secondary" onClick={() => setReviewStage(null)}>
            {t("reveal.reviewBack")}
          </button>
          {reviewStage === "ko" ? (
            <>
              <div className="reveal-head">
                <h2 className="reveal-title">{t("reveal.koStage")}</h2>
              </div>
              <ol className="fixtures">
                {koFixtures.map((f, i) => (
                  <FixtureRow key={`rk${i}`} f={f} />
                ))}
              </ol>
            </>
          ) : (
            <>
              {leagueFixtures.length > 0 && (
                <ol className="fixtures">
                  {leagueFixtures.map((f, i) => (
                    <FixtureRow key={`rl${i}`} f={f} />
                  ))}
                </ol>
              )}
              <StandingsTable campaign={campaign} />
            </>
          )}
        </div>
      )}

      {!reviewStage && (
        <>
      {!cardRevealed && (
        <div className="reveal-head">
          <span className="eyebrow">
            {t("reveal.campaignSeed", { seed: campaign.seed })}
          </span>
          <h2 className="reveal-title">
            {campaign.champion ? t("reveal.titleChampion") : t("reveal.titleDefault")}
          </h2>
          {star && (
            <div className="roll-drawn sm">
              <span className="roll-nation num">★ {star.name}</span>
            </div>
          )}
        </div>
      )}

      {started && !done && (
        <div className="reveal-controls">
          <div className="seg-mini" role="group">
            <button aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
              {t("reveal.modeManual")}
            </button>
            <button aria-pressed={mode === "auto"} onClick={() => setMode("auto")}>
              {t("reveal.modeAuto")}
            </button>
          </div>
          <div className="seg-mini" role="group" aria-label={t("reveal.speedLabel")}>
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
        </div>
      )}

      {/* intro — reveal button + assembled lineup, both vanish on start */}
      {!started && (
        <div className="reveal-intro">
          <button className="btn btn-primary big" onClick={startLeague}>
            {firstPhase === "GRUPOS" ? t("reveal.revealGroup") : t("reveal.revealLeague")}
          </button>
          <div className="reveal-lineup">
            <Pitch
              slots={slots}
              placed={placed}
              showRatings={!almanaque}
              highlight={[]}
              onSlotClick={() => {}}
            />
          </div>
        </div>
      )}

      {/* league fixtures — hidden once the knockout stage begins / run ends */}
      {!done && !inKo && shownLeague.length > 0 && (
        <ol className="fixtures">
          {shownLeague.map((f, i) => (
            <FixtureRow key={`l${i}`} f={f} />
          ))}
        </ol>
      )}

      {/* standings table — once the league phase wraps up, before the knockout */}
      {!done && !inKo && leagueCount > 0 && revealed >= leagueCount && (
        <StandingsTable campaign={campaign} />
      )}

      {/* gate into the knockout stage */}
      {atLeagueGate && !playing && (
        <button className="btn btn-primary big" onClick={unlockKo}>
          {t("reveal.revealKo", { phase: koPhaseLabel })}
        </button>
      )}

      {/* knockout fixtures */}
      {!done && inKo && shownKo.length > 0 && (
        <ol className="fixtures">
          {shownKo.map((f, i) => (
            <FixtureRow key={`k${i}`} f={f} />
          ))}
        </ol>
      )}

      {/* during the knockout: jump back to the league / group results */}
      {!done && inKo && hasLeague && !playing && (
        <button className="btn btn-secondary" onClick={() => setReviewStage("league")}>
          {t("reveal.viewPrevStage")}
        </button>
      )}

      {/* live match in progress */}
      {playing && (
        <LiveMatch
          key={revealed}
          fixture={campaign.fixtures[revealed]}
          speed={speed}
          slots={slots}
          names={matchNames}
          onDone={onMatchDone}
        />
      )}

      {/* manual "next match" button */}
      {started && !playing && !done && !atLeagueGate && mode === "manual" && revealed < total && (
        <button className="btn btn-primary big" onClick={() => setPlaying(true)}>
          {revealed === 0 ? t("reveal.revealFirst") : t("reveal.revealNext")}
        </button>
      )}

      {/* run over — its own screen: a gate, then just the card */}
      {done && !cardRevealed && (
        <div className="reveal-cardgate">
          <span className={`rc-status${campaign.champion ? " champ" : ""}`}>
            {campaign.champion ? t("reveal.champion") : t("reveal.eliminated")}
          </span>
          <button className="btn btn-primary big" onClick={() => setCardRevealed(true)}>
            {t("reveal.revealCard")}
          </button>
        </div>
      )}

      {done && cardRevealed && (
        <div ref={resultRef} style={{ scrollMarginTop: 16, width: "100%" }}>
          <ResultCard
            campaign={campaign}
            star={star}
            slots={slots}
            placed={placed}
            almanaque={almanaque}
            onAgain={onAgain}
          />
        </div>
      )}

      {/* on the closing card: review the previous stage (knockout, else league) */}
      {done && cardRevealed && (
        <button
          className="btn btn-secondary"
          onClick={() => setReviewStage(hasKo ? "ko" : "league")}
        >
          {t("reveal.viewPrevStage")}
        </button>
      )}

      <div ref={endRef} aria-hidden="true" />
        </>
      )}
    </section>
  );
}

function FixtureRow({ f }: { f: Fixture }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const phaseLabel = t(`phases.${f.phase}`);
  const legTag =
    f.leg === 1 ? t("reveal.legIda") : f.leg === 2 ? t("reveal.legVolta") : null;
  const hasEvents = f.events.length > 0;
  return (
    <li
      className={`fixture shown ${resultClass(f)}${hasEvents ? " clickable" : ""}${
        open ? " open" : ""
      }`}
      onClick={hasEvents ? () => setOpen((o) => !o) : undefined}
      aria-expanded={hasEvents ? open : undefined}
    >
      <span className="fx-phase num">
        {phaseLabel}
        {legTag && <span className="fx-leg"> · {legTag}</span>}
      </span>
      <span className="fx-opp">
        <span className="fx-flag">{f.opponent.flag}</span>
        {f.opponent.name}{" "}
        <span className="fx-cup">'{cupYY(f.opponent.cup)}</span>
        {f.home != null && (
          <span className="fx-ha">{f.home ? ` (${t("reveal.home")})` : ` (${t("reveal.away")})`}</span>
        )}
      </span>
      <span className="fx-score num">
        {f.gfor}–{f.gagainst}
        {f.pens && (
          <span className="fx-pen">
            {" "}
            ({f.pens.for}-{f.pens.against} pên)
          </span>
        )}
        {f.agg && (
          <span className="fx-agg">
            {" "}
            · {t("reveal.agg")} {f.agg.for}-{f.agg.against}
            {f.advanced != null && (
              <> · {f.advanced ? t("reveal.advanced") : t("reveal.out")}</>
            )}
          </span>
        )}
        {hasEvents && <span className="fx-caret" aria-hidden="true">▾</span>}
      </span>
      {open && hasEvents && (
        <div className="fx-events">
          <EventColumns events={f.events} />
        </div>
      )}
    </li>
  );
}

function StandingsTable({ campaign }: { campaign: Campaign }) {
  const t = useTranslations();
  const group = campaign.format === "grupos";
  return (
    <div className="standings">
      <div className="st-head">
        <span className="st-title">
          {group ? t("reveal.standingsTitleGroup") : t("reveal.standingsTitle")}
        </span>
        <span className="st-pos num">
          {group
            ? t("reveal.groupPos", { pos: campaign.leaguePos })
            : t("reveal.leaguePos", { pos: campaign.leaguePos })}
        </span>
      </div>
      <ol className="st-list">
        {campaign.standings.map((s, i) => {
          const pos = i + 1;
          const band = group
            ? pos <= 2
              ? "r16"
              : "out"
            : pos <= 8
            ? "r16"
            : pos <= 24
            ? "playoff"
            : "out";
          return (
            <li
              key={`${s.nationId}-${s.cup}`}
              className={`st-row ${band}${s.isUser ? " you" : ""}`}
            >
              <span className="st-rk num">{pos}</span>
              <span className="st-team">
                {s.isUser ? (
                  t("card.dreamTeam")
                ) : (
                  <>
                    {s.flag} {s.name} <span className="fx-cup">'{cupYY(s.cup)}</span>
                  </>
                )}
              </span>
              <span className="st-gd num">{s.gd >= 0 ? `+${s.gd}` : s.gd}</span>
              <span className="st-pts num">{s.pts}</span>
            </li>
          );
        })}
      </ol>
      <div className="st-legend">
        {group ? (
          <>
            <span className="lg r16">{t("reveal.qualGroup")}</span>
            <span className="lg out">{t("reveal.qualGroupOut")}</span>
          </>
        ) : (
          <>
            <span className="lg r16">{t("reveal.qualR16")}</span>
            <span className="lg playoff">{t("reveal.qualPlayoff")}</span>
            <span className="lg out">{t("reveal.qualOut")}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function LiveMatch({
  fixture,
  speed,
  slots,
  onDone,
  forName,
  againstName,
  hideOpponentTag,
  oppSlots,
  names,
  oppNames,
}: {
  fixture: Fixture;
  speed: Speed;
  slots: Slot[];
  onDone: () => void;
  /** label overrides for local multiplayer (Team 1 / Team 2) */
  forName?: string;
  againstName?: string;
  hideOpponentTag?: boolean;
  oppSlots?: Slot[];
  /** player names aligned to slots / oppSlots, for the pitch dots */
  names?: (string | null)[];
  oppNames?: (string | null)[];
}) {
  const t = useTranslations();
  const [tick, setTick] = useState(0);
  const [score, setScore] = useState({ f: 0, a: 0 });
  const [events, setEvents] = useState<Fixture["events"]>([]);
  const [goalFlash, setGoalFlash] = useState<"for" | "against" | null>(null);
  const [penKicks, setPenKicks] = useState<PenaltyKick[]>([]);
  const [penScore, setPenScore] = useState({ f: 0, a: 0 });
  // one celebration popup per side, so a goal by one team never dismisses the
  // other team's popup — only a new goal by the SAME side replaces it
  type GoalPop = { src: string; name: string; key: number };
  const [goalPopFor, setGoalPopFor] = useState<GoalPop | null>(null);
  const [goalPopAgainst, setGoalPopAgainst] = useState<GoalPop | null>(null);
  const popKey = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // goal sounds — loaded once, replayed from the start on every goal (either side):
  // the crowd roar and the "ball in the net" hit play together
  const goalAudio = useRef<HTMLAudioElement | null>(null);
  const netAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const crowd = new Audio("/goal-sound.mp3");
    const net = new Audio("/goalnet.mp3");
    crowd.preload = "auto";
    net.preload = "auto";
    goalAudio.current = crowd;
    netAudio.current = net;
    return () => {
      crowd.pause();
      net.pause();
      goalAudio.current = null;
      netAudio.current = null;
    };
  }, []);
  const playGoalSound = () => {
    if (!soundOn()) return;
    const vol = soundVolume();
    [goalAudio.current, netAudio.current].forEach((a) => {
      if (!a) return;
      a.volume = vol;
      a.currentTime = 0;
      a.play().catch(() => {}); // ignore autoplay-policy rejections
    });
  };

  // kickoff whistle — loaded once, blown at the start of each match
  const whistleAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio("/whistle.mp3");
    a.preload = "auto";
    whistleAudio.current = a;
    return () => {
      a.pause();
      whistleAudio.current = null;
    };
  }, []);
  const playWhistle = () => {
    if (!soundOn()) return;
    const a = whistleAudio.current;
    if (!a) return;
    a.volume = soundVolume();
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  // keep the live match in view as it appears and grows — anchor its *bottom*
  // so the newest events / the penalty shootout never fall below the fold.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events, penKicks]);

  useEffect(() => {
    let cur = 0;
    let sf = 0;
    let sa = 0;
    let pf = 0;
    let pa = 0;
    let pi = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const ms = SPEED_MS[speed];

    function stepPen() {
      if (cancelled) return;
      const seq = fixture.penSeq!;
      const k = seq[pi];
      if (k.scored) {
        playGoalSound();
        k.side === "for" ? pf++ : pa++;
      }
      setPenKicks((prev) => [...prev, k]);
      setPenScore({ f: pf, a: pa });
      pi++;
      if (pi >= seq.length) {
        timer = setTimeout(() => !cancelled && onDoneRef.current(), 1400);
        return;
      }
      timer = setTimeout(stepPen, Math.max(450, ms * 8));
    }

    function finish() {
      if (fixture.penSeq && fixture.penSeq.length) {
        timer = setTimeout(stepPen, 700);
      } else {
        timer = setTimeout(() => !cancelled && onDoneRef.current(), 900);
      }
    }

    function step() {
      if (cancelled) return;
      cur++;
      setTick(cur);
      const evs = fixture.events.filter((e) => e.tick === cur);
      if (evs.length) {
        const goals = evs.filter((e) => e.kind === "goal" || e.kind === "pen");
        goals.forEach((e) => (e.side === "for" ? sf++ : sa++));
        if (goals.length) {
          playGoalSound();
          setScore({ f: sf, a: sa });
          const last = goals[goals.length - 1];
          setGoalFlash(last.side);
          setTimeout(() => !cancelled && setGoalFlash(null), Math.max(400, ms * 6));
          // celebration popup for the scorer (yours on the left, theirs on the
          // right), if they have a goal portrait
          if (last.player && hasGoalImage(last.player)) {
            popKey.current += 1;
            const pop = { src: goalImageSrc(last.player), name: last.player, key: popKey.current };
            (last.side === "for" ? setGoalPopFor : setGoalPopAgainst)(pop);
          }
        }
        setEvents((prev) => [...prev, ...evs]);
      }
      if (cur >= fixture.totalTicks) {
        finish();
        return;
      }
      // brief pause at half-time and at the end of regulation (before ET)
      const pause = cur === fixture.htTick || (fixture.etHtTick != null && cur === fixture.ftTick);
      timer = setTimeout(step, pause ? ms * 12 : ms);
    }

    playWhistle(); // kickoff whistle first…
    timer = setTimeout(step, 700); // …then the match kicks off after it rings out
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the side of the next goal in the script — lets the pitch bias its attack
  const upcomingGoalSide = useMemo(() => {
    const g = fixture.events.find((e) => e.tick > tick && (e.kind === "goal" || e.kind === "pen"));
    return g ? g.side : null;
  }, [fixture.events, tick]);

  // players sent off so far (red / second yellow) — their pitch dots disappear
  const sentOffFor = useMemo(
    () => events.filter((e) => e.side === "for" && e.kind === "red" && e.player).map((e) => e.player as string),
    [events]
  );
  const sentOffAgainst = useMemo(
    () => events.filter((e) => e.side === "against" && e.kind === "red" && e.player).map((e) => e.player as string),
    [events]
  );

  // live score, how far the match has run, and a counter that ticks at each break
  // (half-time / start of extra time) — these drive the pitch's momentum + recentre
  const matchScore = useMemo(() => ({ for: score.f, against: score.a }), [score.f, score.a]);
  const matchProgress = fixture.totalTicks ? tick / fixture.totalTicks : 0;
  const breakKey =
    (tick >= fixture.htTick ? 1 : 0) +
    (fixture.etHtTick != null && tick >= fixture.ftTick ? 1 : 0);

  const ended = tick >= fixture.totalTicks;
  const phasePart = periodLabel(tick, fixture, t);
  const phaseLabel = t(`phases.${fixture.phase}`);
  const legTag =
    fixture.leg === 1 ? t("reveal.legIda") : fixture.leg === 2 ? t("reveal.legVolta") : null;

  // running aggregate for a 2nd leg
  const showAgg = fixture.leg === 2 && fixture.agg;
  const carryF = showAgg ? fixture.agg!.for - fixture.gfor : 0;
  const carryA = showAgg ? fixture.agg!.against - fixture.gagainst : 0;

  return (
    <div ref={rootRef} className={`live-match${goalFlash ? ` flash-${goalFlash}` : ""}`}>
      {goalPopFor && (
        <div
          className="goal-pop goal-pop--for"
          key={`f${goalPopFor.key}`}
          onAnimationEnd={() => setGoalPopFor(null)}
        >
          <img src={goalPopFor.src} alt={goalPopFor.name} />
        </div>
      )}
      {goalPopAgainst && (
        <div
          className="goal-pop goal-pop--against"
          key={`a${goalPopAgainst.key}`}
          onAnimationEnd={() => setGoalPopAgainst(null)}
        >
          <img src={goalPopAgainst.src} alt={goalPopAgainst.name} />
        </div>
      )}

      <div className="lm-top">
        <span className="lm-phase num">
          {phaseLabel}
          {legTag && <span className="fx-leg"> · {legTag}</span>}
          {fixture.home != null && (
            <span className="fx-ha"> · {fixture.home ? t("reveal.home") : t("reveal.away")}</span>
          )}
        </span>
        <span className="lm-part">{phasePart}</span>
      </div>

      <div className="lm-clock num">{tickLabel(tick, fixture)}'</div>

      <div className="lm-score">
        <span className="lm-team you">{forName ?? t("reveal.yourTeam")}</span>
        <span className="lm-sc num">{score.f}</span>
        <span className="lm-x">×</span>
        <span className="lm-sc num">{score.a}</span>
        <span className="lm-team">
          {hideOpponentTag ? (
            againstName ?? fixture.opponent.name
          ) : (
            <>
              {fixture.opponent.flag} {fixture.opponent.name}{" "}
              <span className="fx-cup">'{cupYY(fixture.opponent.cup)}</span>
            </>
          )}
        </span>
      </div>

      {showAgg && (
        <div className="lm-agg num">
          {t("reveal.agg")} {carryF + score.f}-{carryA + score.a}
        </div>
      )}

      {goalFlash && <div className="lm-gol num">GOL!</div>}

      {/* the live pitch only suits the slower knockout games — hide it in the
          league / group phase, which the player tends to run at high speed.
          The pitch renders first; events build up below it. */}
      {penKicks.length === 0 && fixture.phase !== "LIGA" && fixture.phase !== "GRUPOS" && (
        <MatchField
          slots={slots}
          oppSlots={oppSlots}
          goalFlash={goalFlash}
          upcomingGoalSide={upcomingGoalSide}
          names={names}
          oppNames={oppNames}
          sentOffFor={sentOffFor}
          sentOffAgainst={sentOffAgainst}
          score={matchScore}
          progress={matchProgress}
          breakKey={breakKey}
        />
      )}

      {events.length > 0 && <EventColumns events={events} />}

      {penKicks.length > 0 && (
        <div className="lm-pens">
          <div className="lm-pens-head num">
            {t("reveal.shootout")} · {penScore.f}-{penScore.a}
          </div>
          <div className="lm-events">
            <ol className="lm-ev-col for-col">
              {penKicks
                .filter((k) => k.side === "for")
                .map((k, i) => (
                  <li key={`pf${i}`} className={`lm-ev for pk-${k.scored ? "made" : "miss"}`}>
                    <span className="ev-ic">{k.scored ? "⚽" : "❌"}</span>
                    <FitText>{k.player}</FitText>
                  </li>
                ))}
            </ol>
            <ol className="lm-ev-col against-col">
              {penKicks
                .filter((k) => k.side === "against")
                .map((k, i) => (
                  <li key={`pa${i}`} className={`lm-ev against pk-${k.scored ? "made" : "miss"}`}>
                    <FitText>{k.player}</FitText>
                    <span className="ev-ic">{k.scored ? "⚽" : "❌"}</span>
                  </li>
                ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function periodLabel(
  tick: number,
  f: Fixture,
  t: ReturnType<typeof useTranslations>
): string {
  if (tick >= f.totalTicks) return t("reveal.ft");
  if (tick === f.htTick) return t("reveal.ht");
  if (f.etHtTick != null) {
    if (tick === f.ftTick) return t("reveal.ht");
    if (tick <= f.htTick) return "1ºT";
    if (tick <= f.ftTick) return "2ºT";
    if (tick <= f.etHtTick) return t("reveal.et1");
    return t("reveal.et2");
  }
  return tick <= f.htTick ? "1ºT" : "2ºT";
}

function RunStatsPanel({ campaign }: { campaign: Campaign }) {
  const t = useTranslations();
  const top = campaign.stats.scorers[0];
  const topA = campaign.stats.assisters[0];
  return (
    <div className="rc-detail">
      {top && (
        <div className="rc-drow">
          <span className="rc-dlab">{t("card.topScorer")}</span>
          <span className="rc-dval">
            {top.name} <b className="num">{top.goals}</b>
          </span>
        </div>
      )}
      {topA && (
        <div className="rc-drow">
          <span className="rc-dlab">{t("card.topAssist")}</span>
          <span className="rc-dval">
            {topA.name} <b className="num">{topA.assists}</b>
          </span>
        </div>
      )}
      <div className="rc-drow">
        <span className="rc-dlab">{t("card.penGoals")}</span>
        <span className="rc-dval num">{campaign.stats.penGoals}</span>
      </div>
      <div className="rc-drow">
        <span className="rc-dlab">🟨 / 🟥</span>
        <span className="rc-dval num">
          {campaign.stats.yellows} / {campaign.stats.reds}
        </span>
      </div>
    </div>
  );
}

// celebratory fireworks over the champion card (loops while it's open).
// Each burst scatters particles at random angles/distances with varied colours
// and a gravity fall, so it reads as a real firework rather than a tidy ring.
const FW_COLORS = ["#ffd24a", "#ff7ad4", "#7fd4ff", "#9cff7a", "#ffa14a", "#c9a3ff", "#ff6b6b", "#fff1a8"];

function Fireworks() {
  const bursts = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        left: `${8 + Math.random() * 84}%`,
        top: `${10 + Math.random() * 46}%`,
        delay: `${(i * 0.5 + Math.random() * 0.4).toFixed(2)}s`,
        dur: `${(1.7 + Math.random() * 0.8).toFixed(2)}s`,
        particles: Array.from({ length: 26 }, () => {
          const a = Math.random() * Math.PI * 2;
          const r = 24 + Math.random() * 48;
          return {
            dx: `${(Math.cos(a) * r).toFixed(1)}px`,
            dy: `${(Math.sin(a) * r).toFixed(1)}px`,
            c: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
            s: `${(1.6 + Math.random() * 2.4).toFixed(1)}px`,
          };
        }),
      })),
    []
  );

  return (
    <div className="fireworks" aria-hidden="true">
      {bursts.map((b, i) => (
        <span
          key={i}
          className="fw"
          style={{ left: b.left, top: b.top, animationDelay: b.delay, animationDuration: b.dur }}
        >
          {b.particles.map((p, j) => (
            <i
              key={j}
              style={
                {
                  "--dx": p.dx,
                  "--dy": p.dy,
                  "--c": p.c,
                  "--s": p.s,
                  animationDelay: b.delay,
                  animationDuration: b.dur,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}

function ResultCard({
  campaign,
  star,
  slots,
  placed,
  almanaque,
  onAgain,
}: {
  campaign: Campaign;
  star: Player | undefined;
  slots: Slot[];
  placed: Placed;
  almanaque: boolean;
  onAgain: () => void;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const showChampionImage = !!(campaign.champion && star && hasChampionImage(star.name));
  const showEliminatedImage = !!(!campaign.champion && star && hasEliminatedImage(star.name));
  const showHero = showChampionImage || showEliminatedImage;
  const teamLabel = campaign.champion ? t("card.dreamTeam") : t("card.notThisTime");
  const heroSrc =
    star && showChampionImage
      ? championImageSrc(star.name)
      : star && showEliminatedImage
      ? eliminatedImageSrc(star.name)
      : "";

  // when eliminated in a knockout tie, the card reports that round (opponent +
  // aggregate) instead of the league campaign; league exits keep showing the table position
  const lastFx = campaign.fixtures[campaign.fixtures.length - 1];
  const koExit =
    !campaign.champion &&
    !!lastFx &&
    lastFx.phase !== "LIGA" &&
    lastFx.phase !== "GRUPOS";
  const posLabel =
    campaign.format === "grupos"
      ? t("reveal.groupPos", { pos: campaign.leaguePos })
      : t("reveal.leaguePos", { pos: campaign.leaguePos });

  // champions: the score of the final, shown under the league-phase result
  const finalFx = campaign.champion
    ? [...campaign.fixtures].reverse().find((f) => f.phase === "FINAL")
    : undefined;
  const finalScore = finalFx
    ? `${finalFx.agg ? `${t("reveal.agg")} ${finalFx.agg.for}–${finalFx.agg.against}` : `${finalFx.gfor}–${finalFx.gagainst}`}${
        finalFx.pens ? ` (${finalFx.pens.for}-${finalFx.pens.against} pên)` : ""
      }`
    : null;

  // mark the MVP (star), top scorer and top assister on the lineup pitch
  const topScorerName = campaign.stats.scorers[0]?.name;
  const topAssistName = campaign.stats.assisters[0]?.name;
  const discBadges = useMemo(() => {
    const map: Record<number, DiscBadge[]> = {};
    placed.forEach((p, i) => {
      if (!p) return;
      const marks: DiscBadge[] = [];
      if (star && p.id === star.id) marks.push("star");
      if (topScorerName && p.name === topScorerName) marks.push("boot");
      if (topAssistName && p.name === topAssistName) marks.push("assist");
      if (marks.length) map[i] = marks;
    });
    return map;
  }, [placed, star, topScorerName, topAssistName]);

  // goals / assists per player over the whole run — shown on click on the pitch
  const goalsBy = useMemo(
    () => new Map(campaign.stats.scorers.map((s) => [s.name, s.goals])),
    [campaign.stats]
  );
  const assistsBy = useMemo(
    () => new Map(campaign.stats.assisters.map((s) => [s.name, s.assists])),
    [campaign.stats]
  );
  const playerStats = (p: Player) => ({
    goals: goalsBy.get(p.name) ?? 0,
    assists: assistsBy.get(p.name) ?? 0,
  });

  function share() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}?seed=${campaign.seed}`
        : "";
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  return (
    <div className="result-screen">
      {campaign.champion && <Fireworks />}
      <div
        className={`result-card stats-card${
          campaign.champion ? " champion" : showEliminatedImage ? " eliminated" : ""
        }`}
      >
      {showHero && star ? (
        <div className={`champion-hero${campaign.champion ? "" : " hero-out"}`}>
          <img
            className="champion-hero__img"
            src={heroSrc}
            alt={`${t("card.dreamTeam")} — ${
              campaign.champion ? t("reveal.champion") : t("reveal.eliminated")
            }`}
          />
          <div className="champion-hero__scrim" />
          <div className={`champion-hero__title${campaign.champion ? "" : " champion-hero__title--out"}`}>
            {campaign.champion ? t("reveal.champion") : t("card.notThisTime")}
          </div>
          <div className="champion-hero__overlay">
            <div className="champion-hero__identity">
              {campaign.champion ? (
                <>
                  <div className="champion-hero__team">{t("card.dreamTeam")}</div>
                  {star && (
                    <div className="champion-hero__mvp">
                      {t("card.mvpLabel")}: {star.name}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {star && (
                    <div className="champion-hero__mvp">
                      {t("card.mvpLabel")}: {star.name}
                    </div>
                  )}
                  <div className="champion-hero__team">{t("reveal.eliminated")}</div>
                </>
              )}
              <div className="champion-hero__meta">
                {koExit && lastFx ? (
                  <span className="num">
                    {t(`phases.${lastFx.phase}`)} · {lastFx.opponent.flag} {lastFx.opponent.name}{" "}
                    &apos;{cupYY(lastFx.opponent.cup)}
                    {lastFx.agg
                      ? ` · ${t("reveal.agg")} ${lastFx.agg.for}–${lastFx.agg.against}`
                      : ` · ${lastFx.gfor}–${lastFx.gagainst}`}
                  </span>
                ) : (
                  <span className="num">
                    {posLabel} · {campaign.leaguePts} pts
                  </span>
                )}
                {finalFx && finalScore && (
                  <span className="champion-hero__final num">
                    {t("phases.FINAL")} · {finalFx.opponent.flag} {finalFx.opponent.name} · {finalScore}
                  </span>
                )}
                {campaign.badges.map((b) => (
                  <span key={b} className="badge num">
                    {t(`badges.${b}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="champion-hero__score num">{campaign.rating.overall}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="rc-top">
            <div className="rc-id">
              <div className="rc-nation num">{teamLabel}</div>
              {star && (
                <div className="rc-cup">
                  {t("card.mvpLabel")}: {star.name}
                </div>
              )}
            </div>
            <span className="rc-overall num">{campaign.rating.overall}</span>
          </div>

          <div className="rc-verdict">
            <span className={`rc-status${campaign.champion ? " champ" : ""}`}>
              {campaign.champion ? t("reveal.champion") : t("reveal.eliminated")}
            </span>
            {campaign.perfect && <span className="rc-perfect">★ {t("card.perfect")}</span>}
          </div>

          {koExit && lastFx ? (
            <div className="rc-elim">
              <span className="rc-elim-phase">{t(`phases.${lastFx.phase}`)}</span>
              <span className="rc-elim-opp">
                {lastFx.opponent.flag} {lastFx.opponent.name}{" "}
                <span className="fx-cup">&apos;{cupYY(lastFx.opponent.cup)}</span>
              </span>
              <span className="rc-elim-score num">
                {lastFx.agg
                  ? `${t("reveal.agg")} ${lastFx.agg.for}–${lastFx.agg.against}`
                  : `${lastFx.gfor}–${lastFx.gagainst}`}
                {lastFx.pens && ` (${lastFx.pens.for}-${lastFx.pens.against} pên)`}
              </span>
            </div>
          ) : (
            <div className="rc-league num">
              {t("reveal.leaguePos", { pos: campaign.leaguePos })} · {campaign.leaguePts} pts
            </div>
          )}

          {finalFx && finalScore && (
            <div className="rc-final num">
              <span className="rc-final-phase">{t("phases.FINAL")}</span>
              <span className="rc-final-opp">
                {finalFx.opponent.flag} {finalFx.opponent.name}{" "}
                <span className="fx-cup">&apos;{cupYY(finalFx.opponent.cup)}</span>
              </span>
              <span className="rc-final-score">{finalScore}</span>
            </div>
          )}

          {campaign.badges.length > 0 && (
            <div className="rc-badges">
              {campaign.badges.map((b) => (
                <span key={b} className="rc-badge num">
                  {t(`badges.${b}`)}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {showChampionImage && campaign.perfect && (
        <div className="rc-verdict">
          <span className="rc-perfect">★ {t("card.perfect")}</span>
        </div>
      )}

      <div className="rc-stats">
        <div className="rc-stat">
          <span className="rc-val num">{campaign.gf}</span>
          <span className="rc-lab">{t("card.gf")}</span>
        </div>
        <div className="rc-stat">
          <span className="rc-val num">{campaign.ga}</span>
          <span className="rc-lab">{t("card.ga")}</span>
        </div>
        <div className="rc-stat">
          <span className="rc-val num">{campaign.wins}</span>
          <span className="rc-lab">{t("card.wins")}</span>
        </div>
      </div>

      <RunStatsPanel campaign={campaign} />

      {almanaque && <div className="rc-alma">{t("card.almanaque")}</div>}
      <div className="rc-url">{t("card.url")}</div>

      <div className="rc-actions">
        <button className="btn btn-secondary" onClick={share}>
          {copied ? t("card.linkCopied") : t("card.shareLink")}
        </button>
        <button className="btn btn-primary" onClick={onAgain}>
          {t("card.again")}
        </button>
      </div>
      </div>

      <div className="result-card field-card">
        <div className="rc-pitch">
          <Pitch
            slots={slots}
            placed={placed}
            showRatings={!almanaque}
            highlight={[]}
            onSlotClick={() => {}}
            badges={discBadges}
            stats={playerStats}
          />
        </div>
      </div>
    </div>
  );
}
