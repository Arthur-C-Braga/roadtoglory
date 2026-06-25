"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Slot } from "@/lib/data";

// per-tick live inputs delivered via a stable ref so they DON'T re-render the
// component every match tick (progress changes ~every step)
export type MatchLive = { progress: number };

type Base = { homeX: number; homeY: number; team: 0 | 1; n: number; name: string | null };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// frame-rate independent easing: `rate` is the fraction covered per 60fps frame
const ease = (rate: number, dt: number) => 1 - Math.pow(1 - rate, dt / 16.667);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TRAIL = 5; // ball after-images
const BUF = 16; // ball position history for the trail
const PLAY_TOP = 4; // sideline bounds (out of play beyond these)
const PLAY_BOT = 96;
// support runs ahead of the carrier: forward depth + lateral spread (varied options)
const SUPPORT_RUNS = [
  { fx: 12, fy: 0 }, // short option ahead
  { fx: 8, fy: -13 }, // wide left
  { fx: 23, fy: 5 }, // deep run
  { fx: 8, fy: 13 }, // wide right
];

// opponent: fixed 4-3-3 on the right half (also the fallback shape for "you")
const OPP_433: { x: number; y: number }[] = [
  { x: 95, y: 50 }, // GK
  { x: 80, y: 18 }, { x: 80, y: 39 }, { x: 80, y: 61 }, { x: 80, y: 82 }, // DEF
  { x: 66, y: 30 }, { x: 66, y: 50 }, { x: 66, y: 70 }, // MID
  { x: 56, y: 26 }, { x: 56, y: 50 }, { x: 56, y: 74 }, // FWD
];

// map the chosen (vertical) formation onto the left half (GK left, forwards mid)
function buildPlayers(
  slots: Slot[],
  oppSlots?: Slot[],
  names?: (string | null)[],
  oppNames?: (string | null)[]
): Base[] {
  const you: Base[] = slots.length
    ? slots.map((s, i) => ({
        homeX: clamp((100 - s.y) * 0.5, 4, 46),
        homeY: clamp(s.x, 8, 92),
        team: 0,
        n: i + 1,
        name: names?.[i] ?? null,
      }))
    : OPP_433.map((p, i) => ({ homeX: 100 - p.x, homeY: p.y, team: 0, n: i + 1, name: null }));
  const opp: Base[] =
    oppSlots && oppSlots.length
      ? oppSlots.map((s, i) => ({
          homeX: clamp(100 - (100 - s.y) * 0.5, 54, 96),
          homeY: clamp(s.x, 8, 92),
          team: 1,
          n: i + 1,
          name: oppNames?.[i] ?? null,
        }))
      : OPP_433.map((p, i) => ({ homeX: p.x, homeY: p.y, team: 1, n: i + 1, name: null }));
  return [...you, ...opp];
}

function MatchFieldImpl({
  slots,
  goalFlash,
  upcomingGoalSide,
  oppSlots,
  names,
  oppNames,
  sentOffFor,
  sentOffAgainst,
  score,
  breakKey,
  live,
}: {
  slots: Slot[];
  goalFlash: "for" | "against" | null;
  /** side of the next goal in the script — biases who attacks before it happens */
  upcomingGoalSide?: "for" | "against" | null;
  oppSlots?: Slot[];
  /** player names aligned to slots / oppSlots, shown under each dot */
  names?: (string | null)[];
  oppNames?: (string | null)[];
  /** names of players sent off so far — their dots disappear from the pitch */
  sentOffFor?: string[];
  sentOffAgainst?: string[];
  /** live scoreline — drives momentum (changes only on goals) */
  score?: { for: number; against: number };
  /** increments at half-time / extra-time breaks — triggers a recentre */
  breakKey?: number;
  /** how far the match has run (0..1) — read live, never as a per-tick prop */
  live: { current: MatchLive };
}) {
  const players = useMemo(
    () => buildPlayers(slots, oppSlots, names, oppNames),
    [slots, oppSlots, names, oppNames]
  );
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ballRef = useRef<HTMLSpanElement | null>(null);
  const trailRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const goalReq = useRef<"for" | "against" | null>(null);
  const upcomingRef = useRef<"for" | "against" | null>(null);
  const hiddenRef = useRef<Set<number>>(new Set());
  const scoreRef = useRef({ for: 0, against: 0 });
  const breakRef = useRef(0);
  const [flash, setFlash] = useState<"for" | "against" | null>(null);

  // forward goal events into the sim loop + flash the net briefly
  useEffect(() => {
    if (!goalFlash) return;
    goalReq.current = goalFlash;
    setFlash(goalFlash);
    const t = window.setTimeout(() => setFlash(null), 1200);
    return () => window.clearTimeout(t);
  }, [goalFlash]);

  // keep live inputs fresh without restarting the RAF loop
  useEffect(() => {
    upcomingRef.current = upcomingGoalSide ?? null;
  }, [upcomingGoalSide]);
  useEffect(() => {
    scoreRef.current = score ?? { for: 0, against: 0 };
  }, [score]);
  useEffect(() => {
    breakRef.current = breakKey ?? 0;
  }, [breakKey]);

  // which dots are sent off (matched by name) — read live by the loop
  useEffect(() => {
    const offFor = new Set(sentOffFor ?? []);
    const offAg = new Set(sentOffAgainst ?? []);
    const h = new Set<number>();
    players.forEach((p, i) => {
      if (!p.name) return;
      if (p.team === 0 && offFor.has(p.name)) h.add(i);
      if (p.team === 1 && offAg.has(p.name)) h.add(i);
    });
    hiddenRef.current = h;
  }, [players, sentOffFor, sentOffAgainst]);

  // FM-style highlight engine: possession, passing, shots into the right net,
  // restarts — all reacting to the match script. Movement is smooth and holds shape.
  useIso(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const field = fieldRef.current;
    const size = { w: field?.clientWidth || 480, h: field?.clientHeight || 270 };
    let ro: ResizeObserver | undefined;
    if (field && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => {
        size.w = field.clientWidth;
        size.h = field.clientHeight;
      });
      ro.observe(field);
    }

    const pos = players.map((p) => ({ x: p.homeX, y: p.homeY }));
    const ball = { x: 50, y: 50 };
    const buf = Array.from({ length: BUF }, () => ({ x: 50, y: 50 }));
    const teamIdx: number[][] = [
      players.map((_, i) => i).filter((i) => players[i].team === 0),
      players.map((_, i) => i).filter((i) => players[i].team === 1),
    ];
    const aliveIdx = (t: 0 | 1) => teamIdx[t].filter((i) => !hiddenRef.current.has(i));
    // outfielders only — the keeper never joins open play (stays in its box)
    const outfield = (t: 0 | 1) => aliveIdx(t).filter((i) => players[i].n !== 1);
    const gkOf = (t: 0 | 1) => teamIdx[t].find((i) => players[i].n === 1) ?? teamIdx[t][0];

    let carrier = 0;
    let possTeam: 0 | 1 = 0;
    let mode: "dribble" | "pass" | "shot" | "dead" = "dribble";
    let scoringShot = false;
    let passTarget = 0;
    let passLeadX = 0;
    let passLeadY = 0;
    let passHoming = true;
    let passLoose = false;
    let deadKind: "kickoff" | "goalkick" | "throwin" | "corner" | "halftime" = "kickoff";
    let deadUntil = 0;
    const deadBall = { x: 50, y: 50 };
    let nextActionAt = performance.now() + 900;
    let tempo = 0.5; // 0 = patient build-up, 1 = quick attack
    let transitionTeam: 0 | 1 | -1 = -1; // side on a counter right after winning the ball
    let transitionUntil = 0;
    const flight = { ox: 50, oy: 50, tx: 50, ty: 50, p: 0, dur: 300, arc: 0 };
    let breakSeen = breakRef.current;
    let last = performance.now();
    let raf = 0;

    const px = (v: number, dim: "w" | "h") => (v / 100) * (dim === "w" ? size.w : size.h);
    const place = (el: HTMLElement | null, x: number, y: number) => {
      if (el) el.style.transform = `translate3d(${px(x, "w")}px, ${px(y, "h")}px, 0) translate(-50%, -50%)`;
    };
    const setDot = (i: number, x: number, y: number) => place(dotRefs.current[i], x, y);
    const setBall = (x: number, y: number) => place(ballRef.current, x, y);

    const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
    const attackDir = (t: 0 | 1) => (t === 0 ? 1 : -1); // +x for you, -x for opp
    const attackGoalX = (t: 0 | 1) => (t === 0 ? 98 : 2);
    const d2ball = (i: number) => (pos[i].x - ball.x) ** 2 + (pos[i].y - ball.y) ** 2;
    const nearest = (idxs: number[], x: number, y: number) =>
      idxs.reduce((b, i) => ((pos[i].x - x) ** 2 + (pos[i].y - y) ** 2 < (pos[b].x - x) ** 2 + (pos[b].y - y) ** 2 ? i : b), idxs[0]);
    // team that is behind on the scoreline (-1 = level)
    const chasingTeam = (): 0 | 1 | -1 => {
      const d = scoreRef.current.for - scoreRef.current.against;
      return d < 0 ? 0 : d > 0 ? 1 : -1;
    };
    // how far up the pitch a point is for a team (0 = own goal, 100 = opponent goal)
    const advancement = (t: 0 | 1, x: number) => (attackDir(t) > 0 ? x : 100 - x);
    // gap until the next pass/shot — short when the tempo is high (quick), long when patient
    const nextGap = () => 360 + (1 - tempo) * 560 + Math.random() * 160;

    if (reduce) {
      players.forEach((p, i) => setDot(i, p.homeX, p.homeY));
      setBall(50, 50);
      trailRefs.current.forEach((el) => el && (el.style.opacity = "0"));
      return () => ro?.disconnect();
    }

    function startPass(now: number) {
      const dir = attackDir(possTeam);
      const mates = outfield(possTeam).filter((i) => i !== carrier);
      if (!mates.length) {
        nextActionAt = now + 400;
        return;
      }
      const adv = advancement(possTeam, pos[carrier].x);
      const zone = adv < 35 ? "build" : adv < 66 ? "mid" : "attack";

      // pick a receiver according to intent: safe & short when building, forward in attack
      let best = mates[0];
      let bestScore = -Infinity;
      for (const i of mates) {
        const fwd = (pos[i].x - pos[carrier].x) * dir; // forward positive
        const dist = Math.hypot(pos[i].x - pos[carrier].x, pos[i].y - pos[carrier].y);
        let s: number;
        if (zone === "build") s = -Math.abs(fwd + 2) * 0.5 - Math.abs(dist - 18) * 0.3 + Math.random() * 7;
        else if (zone === "mid") s = fwd * 0.7 - Math.abs(dist - 24) * 0.25 + Math.random() * 7;
        else s = fwd * 1.5 - Math.abs(dist - 26) * 0.2 + Math.random() * 8;
        if (s > bestScore) {
          bestScore = s;
          best = i;
        }
      }

      passHoming = true;
      passLoose = false;
      passLeadX = 0;
      passLeadY = 0;
      let receiver = best;
      const roll = Math.random();
      const switchChance = zone === "attack" ? 0.04 : 0.16; // switch play more from deep
      if (roll < 0.08) {
        // a loose ball that drifts out for a throw-in
        passLoose = true;
        passHoming = false;
        flight.tx = clamp(ball.x + dir * 16, 6, 94);
        flight.ty = ball.y < 50 ? 1 : 99;
        flight.arc = 0;
        flight.dur = 520;
      } else if (roll < 0.08 + switchChance) {
        // switch of play: long diagonal to the opposite flank
        receiver = mates.reduce((a, b) => (Math.abs(pos[b].y - ball.y) > Math.abs(pos[a].y - ball.y) ? b : a), mates[0]);
        const d = Math.hypot(pos[receiver].x - ball.x, pos[receiver].y - ball.y);
        flight.dur = clamp(d * 10, 340, 720);
        flight.arc = (pos[receiver].y < ball.y ? -1 : 1) * Math.min(10, d * 0.3);
      } else if (zone === "attack" && roll < 0.55) {
        // through ball into space ahead of the receiver
        passLeadX = dir * 11;
        passLeadY = (50 - pos[receiver].y) * 0.15;
        const d = Math.hypot(pos[receiver].x + passLeadX - ball.x, pos[receiver].y - ball.y);
        flight.dur = clamp(d * 6, 180, 440);
        flight.arc = 0;
      } else {
        const d = Math.hypot(pos[receiver].x - ball.x, pos[receiver].y - ball.y);
        flight.dur = clamp(d * (zone === "build" ? 8 : 9), 180, 560);
        flight.arc = (Math.random() < 0.5 ? -1 : 1) * Math.min(6, d * 0.22);
      }

      if (!passLoose) {
        // interception risk: safe when building, riskier in attack; script + counter-press
        const upc = upcomingRef.current;
        const upcTeam = upc === "for" ? 0 : upc === "against" ? 1 : -1;
        const chase = chasingTeam();
        let pInt = zone === "build" ? 0.06 : zone === "mid" ? 0.14 : 0.22;
        if (upcTeam >= 0) pInt = upcTeam === possTeam ? Math.min(pInt, 0.05) : Math.max(pInt, 0.3);
        else if (chase >= 0 && chase !== possTeam) pInt += 0.06;
        if (transitionTeam === possTeam && now < transitionUntil) pInt += 0.1; // under counter-press
        const foes = outfield(other(possTeam));
        if (Math.random() < pInt && foes.length) {
          receiver = nearest(foes, pos[receiver].x + passLeadX, pos[receiver].y + passLeadY);
          passLeadX = 0;
          passLeadY = 0;
        }
        passTarget = receiver;
      }
      flight.ox = ball.x;
      flight.oy = ball.y;
      flight.p = 0;
      mode = "pass";
    }

    function startShot(scoring: boolean) {
      scoringShot = scoring;
      flight.ox = ball.x;
      flight.oy = ball.y;
      flight.tx = attackGoalX(possTeam);
      flight.ty = clamp(50 + (Math.random() * 2 - 1) * (scoring ? 11 : 20), 18, 82);
      flight.p = 0;
      flight.arc = (Math.random() * 2 - 1) * 4;
      flight.dur = scoring ? 300 : 270;
      mode = "shot";
    }

    function startDead(
      kind: "kickoff" | "goalkick" | "throwin" | "corner" | "halftime",
      now: number,
      newPoss: 0 | 1,
      spot?: { x: number; y: number }
    ) {
      mode = "dead";
      deadKind = kind;
      possTeam = newPoss;
      const out = outfield(newPoss);
      const fallback = aliveIdx(newPoss)[0] ?? teamIdx[newPoss][0];
      if (kind === "kickoff" || kind === "halftime") {
        deadBall.x = 50;
        deadBall.y = 50;
        carrier = out.length ? nearest(out, 50, 50) : fallback;
        deadUntil = now + (kind === "halftime" ? 1100 : 760);
      } else if (kind === "goalkick") {
        const gk = gkOf(newPoss);
        carrier = hiddenRef.current.has(gk) ? out[0] ?? fallback : gk;
        deadBall.x = pos[carrier].x;
        deadBall.y = pos[carrier].y;
        deadUntil = now + 560;
      } else {
        deadBall.x = spot ? spot.x : 50;
        deadBall.y = spot ? spot.y : 50;
        carrier = out.length ? nearest(out, deadBall.x, deadBall.y) : fallback;
        deadUntil = now + 560;
      }
      ball.x = deadBall.x;
      ball.y = deadBall.y;
    }

    // ball over a sideline → throw-in to the other team
    function checkOut(now: number): boolean {
      if (ball.y < PLAY_TOP || ball.y > PLAY_BOT) {
        const y = ball.y < PLAY_TOP ? PLAY_TOP : PLAY_BOT;
        startDead("throwin", now, other(possTeam), { x: clamp(ball.x, 6, 94), y });
        return true;
      }
      return false;
    }

    function frame(now: number) {
      const dt = Math.min(50, now - last);
      last = now;
      const hidden = hiddenRef.current;

      // half-time / extra-time break → brief recentre
      if (breakRef.current !== breakSeen) {
        breakSeen = breakRef.current;
        startDead("halftime", now, possTeam);
      }

      // if the ball carrier was just sent off, hand it to a teammate still on
      if (hidden.has(carrier)) {
        const pool = outfield(possTeam);
        const alive = pool.length ? pool : aliveIdx(possTeam);
        if (alive.length) carrier = nearest(alive, ball.x, ball.y);
      }

      // tempo: patient near own goal, quicker up the pitch, faster on a counter and
      // for the chasing side late on
      {
        let target = 0.32 + 0.42 * (advancement(possTeam, pos[carrier].x) / 100);
        if (transitionTeam === possTeam && now < transitionUntil) target += 0.35;
        if (chasingTeam() === possTeam) target += 0.22 * (0.35 + 0.65 * live.current.progress);
        tempo += (clamp(target, 0.15, 1) - tempo) * ease(0.05, dt);
      }

      // a scripted goal: the scoring side finishes from where it is into the right net
      if (goalReq.current && !(mode === "shot" && scoringShot)) {
        const team: 0 | 1 = goalReq.current === "for" ? 0 : 1;
        goalReq.current = null;
        possTeam = team;
        const gx = attackGoalX(team);
        const atk = aliveIdx(team).filter((i) => players[i].n !== 1);
        if (atk.length) carrier = atk.sort((a, b) => Math.abs(pos[a].x - gx) - Math.abs(pos[b].x - gx))[0];
        startShot(true);
      }

      if (mode === "dribble") {
        if (now > nextActionAt) {
          const dir = attackDir(possTeam);
          const c = pos[carrier];
          const intoThird = (attackGoalX(possTeam) - c.x) * dir < 28;
          if (intoThird && Math.random() < 0.45) startShot(false);
          else startPass(now);
        } else {
          const dir = attackDir(possTeam);
          const c = pos[carrier];
          if (players[carrier].n === 1) {
            ball.x += (c.x - ball.x) * ease(0.3, dt);
            ball.y += (c.y - ball.y) * ease(0.3, dt);
          } else {
            // shorter carries when building up, longer when breaking quickly
            const reach = 12 + 18 * tempo;
            c.x += (clamp(c.x + dir * reach, 6, 94) - c.x) * ease(0.04 + 0.03 * tempo, dt);
            c.y = clamp(c.y + Math.sin(now * 0.0016 + carrier) * 0.9 * (dt / 16.667), 8, 92);
            ball.x += (clamp(c.x + dir * 2, 2, 98) - ball.x) * ease(0.3, dt);
            ball.y += (c.y - ball.y) * ease(0.3, dt);
          }
        }
      } else if (mode === "pass") {
        if (passHoming) {
          flight.tx = clamp(pos[passTarget].x + passLeadX, 2, 98);
          flight.ty = clamp(pos[passTarget].y + passLeadY, 2, 98);
        }
        flight.p += dt / flight.dur;
        const t = Math.min(1, flight.p);
        const e = easeOut(t);
        ball.x = flight.ox + (flight.tx - flight.ox) * e;
        ball.y = flight.oy + (flight.ty - flight.oy) * e + Math.sin(t * Math.PI) * flight.arc;
        if (!passLoose && checkOut(now)) {
          // overshot out — throw-in handled
        } else if (passLoose && (ball.y < PLAY_TOP || ball.y > PLAY_BOT)) {
          checkOut(now);
        } else if (flight.p >= 1) {
          if (passLoose) {
            startDead("throwin", now, other(possTeam), { x: clamp(ball.x, 6, 94), y: clamp(ball.y, PLAY_TOP, PLAY_BOT) });
          } else {
            const newTeam = players[passTarget].team;
            if (newTeam !== possTeam) {
              // ball won → that side breaks (counter), the other counter-presses
              transitionTeam = newTeam;
              transitionUntil = now + 1800;
            }
            carrier = passTarget;
            possTeam = newTeam;
            mode = "dribble";
            nextActionAt = now + nextGap();
          }
        }
      } else if (mode === "shot") {
        flight.p += dt / flight.dur;
        const t = Math.min(1, flight.p);
        const e = easeOut(t);
        ball.x = flight.ox + (flight.tx - flight.ox) * e;
        ball.y = flight.oy + (flight.ty - flight.oy) * e + Math.sin(t * Math.PI) * flight.arc;
        if (flight.p >= 1) {
          if (scoringShot) {
            startDead("kickoff", now, other(possTeam));
          } else {
            // saved / off target → goal kick; sometimes deflected for a corner
            const def = other(possTeam);
            if (Math.random() < 0.32) {
              startDead("corner", now, possTeam, {
                x: attackGoalX(possTeam),
                y: ball.y < 50 ? PLAY_TOP + 1 : PLAY_BOT - 1,
              });
            } else {
              startDead("goalkick", now, def);
            }
          }
          scoringShot = false;
        }
      } else {
        // dead ball — settles at the restart spot; play resumes after the pause
        ball.x += (deadBall.x - ball.x) * ease(0.2, dt);
        ball.y += (deadBall.y - ball.y) * ease(0.2, dt);
        if (now > deadUntil) {
          mode = "dribble";
          nextActionAt = now + nextGap();
        }
      }

      // ---- team shape: press / support / block, with scoreline momentum ----
      const resting = mode === "dead";
      const dir = attackDir(possTeam);
      const defs = outfield(other(possTeam)).sort((a, b) => d2ball(a) - d2ball(b));
      // the side that just lost the ball counter-presses (one extra, tighter) briefly
      const counterPress = transitionTeam === possTeam && now < transitionUntil;
      const press = new Set(resting ? [] : defs.slice(0, counterPress ? 4 : 3));
      const mates = outfield(possTeam)
        .filter((i) => i !== carrier)
        .sort((a, b) => d2ball(a) - d2ball(b));
      const support = new Map<number, number>(
        resting ? [] : mates.slice(0, 4).map((i, k) => [i, k] as [number, number])
      );
      const shiftX = (ball.x - 50) * 0.28;
      const shiftY = (ball.y - 50) * 0.3;
      const chase = chasingTeam();
      const intensity = Math.min(1.4, Math.abs(scoreRef.current.for - scoreRef.current.against)) * (0.35 + 0.65 * live.current.progress);
      const tt = now * 0.001;

      players.forEach((p, i) => {
        const el = dotRefs.current[i];
        if (hidden.has(i)) {
          if (el) el.style.opacity = "0";
          return;
        }
        if (el && el.style.opacity !== "1") el.style.opacity = "1";

        if (p.n === 1) {
          // keeper: shuffles with the play but never leaves its penalty area
          const lo = p.team === 0 ? 2 : 85;
          const hi = p.team === 0 ? 15 : 98;
          const tx = clamp(p.homeX + (ball.x - 50) * 0.04, lo, hi);
          const ty = clamp(p.homeY + (ball.y - p.homeY) * 0.18, 26, 74);
          pos[i].x += (tx - pos[i].x) * ease(0.05, dt);
          pos[i].y += (ty - pos[i].y) * ease(0.05, dt);
          pos[i].x = clamp(pos[i].x, lo, hi);
          pos[i].y = clamp(pos[i].y, 24, 76);
          setDot(i, pos[i].x, pos[i].y);
          return;
        }

        if (resting && i === carrier) {
          // the taker walks to the dead ball (throw-in / goal kick / kickoff)
          pos[i].x += (clamp(ball.x, 3, 97) - pos[i].x) * ease(0.08, dt);
          pos[i].y += (clamp(ball.y, 5, 95) - pos[i].y) * ease(0.08, dt);
          setDot(i, pos[i].x, pos[i].y);
          return;
        }

        if (mode === "dribble" && i === carrier) {
          const fx = Math.sin(tt + i) * 0.25;
          setDot(i, clamp(pos[i].x + fx, 1, 99), clamp(pos[i].y, 2, 98));
          return;
        }
        let tx: number;
        let ty: number;
        if (resting) {
          tx = p.homeX;
          ty = p.homeY;
        } else if (p.team !== possTeam && press.has(i)) {
          tx = ball.x + dir * (counterPress ? 0.5 : 2); // close down from the goal side
          ty = ball.y;
        } else if (p.team === possTeam && support.has(i)) {
          // supporters make varied runs: short option, wide, deep
          const run = SUPPORT_RUNS[support.get(i) ?? 0] ?? SUPPORT_RUNS[0];
          tx = clamp(pos[carrier].x + dir * run.fx, 6, 94);
          ty = clamp(p.homeY + (ball.y - p.homeY) * 0.4 + run.fy, 6, 94);
        } else if (p.team !== possTeam) {
          // defending and not pressing → man-mark the nearest attacker, goal-side,
          // while keeping defensive shape (blend mark + block)
          const atks = outfield(possTeam);
          let m = -1;
          let md = Infinity;
          for (const a of atks) {
            const dd = (pos[a].x - pos[i].x) ** 2 + (pos[a].y - pos[i].y) ** 2;
            if (dd < md) {
              md = dd;
              m = a;
            }
          }
          const bx = p.homeX + shiftX;
          const by = p.homeY + shiftY;
          if (m >= 0) {
            // hold the compact block, only a light tuck toward the nearest man
            const mx = pos[m].x - attackDir(p.team) * 4; // goal-side of the man
            tx = bx * 0.78 + mx * 0.22;
            ty = by * 0.7 + pos[m].y * 0.3;
          } else {
            tx = bx;
            ty = by;
          }
        } else {
          // attacking, off the ball → push up and fan out to offer options
          let push = dir * (7 + 6 * tempo);
          if (chase === p.team) push += attackDir(p.team) * 7 * intensity;
          else if (chase >= 0) push += -attackDir(p.team) * 4 * intensity;
          const lane = (((i % 3) - 1) * 8);
          tx = p.homeX + shiftX + push;
          ty = clamp(p.homeY + shiftY + lane * 0.25, 6, 94);
        }
        pos[i].x += (clamp(tx, 3, 97) - pos[i].x) * ease(resting ? 0.06 : 0.05, dt);
        pos[i].y += (clamp(ty, 5, 95) - pos[i].y) * ease(resting ? 0.06 : 0.05, dt);
        const fx = i === carrier ? 0 : Math.sin(tt * 0.9 + i * 1.3) * 0.35;
        const fy = i === carrier ? 0 : Math.cos(tt * 1.1 + i * 2.1) * 0.35;
        setDot(i, clamp(pos[i].x + fx, 1, 99), clamp(pos[i].y + fy, 2, 98));
      });

      // ball + fading trail
      for (let k = BUF - 1; k > 0; k--) {
        buf[k].x = buf[k - 1].x;
        buf[k].y = buf[k - 1].y;
      }
      buf[0].x = ball.x;
      buf[0].y = ball.y;
      setBall(ball.x, ball.y);
      for (let j = 0; j < TRAIL; j++) {
        const b = buf[Math.min(BUF - 1, (j + 1) * 3)];
        place(trailRefs.current[j], b.x, b.y);
      }

      raf = requestAnimationFrame(frame);
    }

    // kick off from the centre with the home side (team 0) — never the keeper
    startDead("kickoff", performance.now(), 0);

    // place once before paint, then animate
    players.forEach((p, i) => setDot(i, p.homeX, p.homeY));
    setBall(50, 50);
    trailRefs.current.forEach((el) => el && place(el, 50, 50));
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
    // `live` is a stable ref (read inside the loop); it never re-triggers
  }, [players, live]);

  return (
    <div className="mf-field" ref={fieldRef} aria-hidden="true">
      <svg className="mf-mk" viewBox="0 0 160 90" preserveAspectRatio="none">
        <line x1="80" y1="0" x2="80" y2="90" />
        <circle cx="80" cy="45" r="12" />
        <circle cx="80" cy="45" r="1.2" className="mf-mk-fill" />
        <rect x="0" y="22" width="22" height="46" />
        <rect x="0" y="34" width="9" height="22" />
        <circle cx="15" cy="45" r="1.2" className="mf-mk-fill" />
        <path d="M22 37 A 10 10 0 0 1 22 53" />
        <rect x="138" y="22" width="22" height="46" />
        <rect x="151" y="34" width="9" height="22" />
        <circle cx="145" cy="45" r="1.2" className="mf-mk-fill" />
        <path d="M138 37 A 10 10 0 0 0 138 53" />
      </svg>
      <span className={`mf-goal mf-goal-l${flash === "against" ? " flash" : ""}`} />
      <span className={`mf-goal mf-goal-r${flash === "for" ? " flash" : ""}`} />

      {Array.from({ length: TRAIL }).map((_, j) => (
        <span
          key={`t${j}`}
          ref={(el) => {
            trailRefs.current[j] = el;
          }}
          className="mf-trail"
          style={{ opacity: 0.38 * (1 - j / TRAIL) }}
        />
      ))}

      {players.map((p, i) => (
        <span
          key={i}
          ref={(el) => {
            dotRefs.current[i] = el;
          }}
          className={`mf-dot mf-dot--${p.team === 0 ? "you" : "opp"}`}
        >
          <span className="mf-dot-inner num">{p.n}</span>
          {p.name && <span className="mf-name">{p.name}</span>}
        </span>
      ))}

      <span ref={ballRef} className="mf-ball" />
    </div>
  );
}

// memoised: progress now arrives via the `live` ref, so the per-tick re-renders
// of LiveMatch (its clock) no longer reconcile the pitch — it re-renders only
// when its real props change (a goal, a sending-off, a break)
export const MatchField = memo(MatchFieldImpl);
