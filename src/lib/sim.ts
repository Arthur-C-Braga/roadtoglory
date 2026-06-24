// Simulation engine: derives team strength from the XI, scores matches with a
// Poisson model, and runs a full Champions League campaign from a seed.
// Format: 36-team Swiss league phase (8 games) -> seeding -> two-legged
// knockouts (aggregate, extra time, penalties) -> single-match final.
// Goals are attributed to your XI (scorer/assist, sometimes a penalty); matches
// also produce yellow/red cards, all aggregated into end-of-run stats.

import {
  buildSquad,
  VALID_DRAWS,
  FORMATIONS,
  type FormationName,
  type Player,
  type Pos,
  playerFitsSlot,
} from "./data";
import { mulberry32, pick, shuffle, type Rng } from "./rng";

export type Style = "defensivo" | "equilibrado" | "ofensivo";

export type TeamRating = { attack: number; defense: number; overall: number };

// ---- tuning knobs --------------------------------------------------------
const HOME_ATK = 4; // home team's attack bump
const ET_FACTOR = 30 / 90; // extra-time scoring relative to a full match
const LEAGUE_GAMES = 8;
const LEAGUE_FIELD = 35; // standings = you + 35 random clubs => 36-team Swiss table
const QUAL_DIRECT = 8; // 1..8 -> Round of 16
const QUAL_PLAYOFF = 24; // 9..24 -> Round of 32 playoff; 25..36 out
const PEN_RATE = 0.09; // share of your goals that come from a penalty
const ASSIST_RATE = 0.75; // share of open-play goals that have an assister
const YELLOW_MEAN = 1.2; // mean yellow cards per team per match
const RED_RATE = 0.05; // chance of a red card per team per match

const ATTACK_POS: Pos[] = ["PD", "PE", "ATA", "MEI", "ME"];
const MID_POS: Pos[] = ["MC", "VOL", "MD"];
const DEF_POS: Pos[] = ["GOL", "ZAG", "LD", "LE"];

// Relative likelihoods, by pitched position, for scoring / assisting / cards.
const SCORE_W: Record<Pos, number> = {
  GOL: 0.02, LD: 1, LE: 1, ZAG: 1.2, VOL: 1.5, MC: 3, MEI: 5, MD: 5, ME: 5, PD: 6, PE: 6, ATA: 10,
};
const ASSIST_W: Record<Pos, number> = {
  GOL: 0.1, LD: 4, LE: 4, ZAG: 1, VOL: 2.5, MC: 6, MEI: 9, MD: 8, ME: 8, PD: 7, PE: 7, ATA: 3,
};
const CARD_W: Record<Pos, number> = {
  GOL: 1, LD: 3, LE: 3, ZAG: 4, VOL: 5, MC: 3, MEI: 2, MD: 2, ME: 2, PD: 2, PE: 2, ATA: 2,
};

function group(pos: Pos): "atk" | "mid" | "def" {
  if (ATTACK_POS.includes(pos)) return "atk";
  if (MID_POS.includes(pos)) return "mid";
  return "def";
}

/** XI is the list of {player, slotPos} actually placed on the pitch. */
export function rateTeam(
  xi: { player: Player; slotPos: Pos }[],
  style: Style = "equilibrado"
): TeamRating {
  let atk = 0,
    atkN = 0,
    def = 0,
    defN = 0,
    sum = 0;
  for (const { player, slotPos } of xi) {
    sum += player.rating;
    const g = group(slotPos);
    if (g === "atk") {
      atk += player.rating;
      atkN++;
    } else if (g === "def") {
      def += player.rating;
      defN++;
    } else {
      // midfield contributes to both ends
      atk += player.rating * 0.6;
      atkN += 0.6;
      def += player.rating * 0.6;
      defN += 0.6;
    }
  }
  let attack = atkN ? atk / atkN : 60;
  let defense = defN ? def / defN : 60;
  const overall = xi.length ? sum / xi.length : 60;

  if (style === "ofensivo") {
    attack += 4;
    defense -= 4;
  } else if (style === "defensivo") {
    attack -= 4;
    defense += 4;
  }
  return {
    attack: clamp(attack),
    defense: clamp(defense),
    overall: Math.round(overall),
  };
}

function clamp(v: number) {
  return Math.max(1, Math.min(99, Math.round(v)));
}

/** Build the strongest legal XI for a CPU squad in a given formation. */
export function autoPickXI(
  squadPlayers: Player[],
  formation: FormationName
): { player: Player; slotPos: Pos }[] {
  const slots = FORMATIONS[formation];
  const used = new Set<string>();
  const xi: { player: Player; slotPos: Pos }[] = [];
  for (const slot of slots) {
    const cand = squadPlayers
      .filter((p) => !used.has(p.id) && playerFitsSlot(p, slot.pos))
      .sort((a, b) => b.rating - a.rating)[0];
    const fallback =
      cand ??
      squadPlayers
        .filter((p) => !used.has(p.id))
        .sort((a, b) => b.rating - a.rating)[0];
    if (fallback) {
      used.add(fallback.id);
      xi.push({ player: fallback, slotPos: slot.pos });
    }
  }
  return xi;
}

// ---- scorer / assist / card attribution ---------------------------------

type WEntry = { name: string; w: number };
type ScoreCtx = {
  scoreEntries: WEntry[];
  assistEntries: WEntry[];
  cardEntries: WEntry[];
  penTaker: string;
};

function makeScoreCtx(xi: { player: Player; slotPos: Pos }[]): ScoreCtx {
  const players = xi.map((x) => ({ name: x.player.name, pos: x.slotPos, rating: x.player.rating }));
  const scoreEntries = players.map((p) => ({ name: p.name, w: SCORE_W[p.pos] * (p.rating / 80) }));
  const assistEntries = players.map((p) => ({ name: p.name, w: ASSIST_W[p.pos] * (p.rating / 80) }));
  const cardEntries = players.map((p) => ({ name: p.name, w: CARD_W[p.pos] }));
  const penTaker =
    players
      .map((p) => ({ name: p.name, w: SCORE_W[p.pos] * p.rating }))
      .sort((a, b) => b.w - a.w)[0]?.name ??
    players[0]?.name ??
    "—";
  return { scoreEntries, assistEntries, cardEntries, penTaker };
}

function weightedPick(rng: Rng, entries: WEntry[]): string {
  let total = 0;
  for (const e of entries) total += e.w;
  let r = rng() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e.name;
  }
  return entries[entries.length - 1].name;
}

// ---- match model ---------------------------------------------------------

function poisson(rng: Rng, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function expectedGoals(attack: number, defense: number): number {
  // Diff in [-98,98] -> lambda roughly in [0.3, 4.0]
  const diff = attack - defense;
  return Math.max(0.18, 1.35 + diff * 0.045);
}

export type Phase = "LIGA" | "GRUPOS" | "PLAYOFF" | "OITAVAS" | "QUARTAS" | "SEMI" | "FINAL";

// One timeline event. `kind` distinguishes goals (open play / penalty) from
// cards; `side` is "for" (your team) or "against". For your team's events the
// `player` (scorer / carded) and `assist` are named.
export type EventKind = "goal" | "pen" | "yellow" | "red";
export type MatchEvent = {
  tick: number;
  label: string;
  side: "for" | "against";
  kind: EventKind;
  player?: string;
  assist?: string;
  // a "red" that came from a second yellow in the same match — shown as the red
  // card overlapping the yellow. The player is sent off either way.
  secondYellow?: boolean;
};

// One penalty in a shootout, in kicking order, for kick-by-kick animation.
export type PenaltyKick = { side: "for" | "against"; scored: boolean; player: string };

type TickBounds = { htTick: number; ftTick: number; etHtTick?: number };

export type Fixture = {
  phase: Phase;
  opponent: { nationId: string; name: string; flag: string; cup: number };
  gfor: number; // this match/leg, including extra-time goals
  gagainst: number;
  result: "W" | "D" | "L";
  // two-legged extras (undefined for LIGA and the single-match FINAL):
  leg?: 1 | 2;
  home?: boolean; // was this leg played at home
  agg?: { for: number; against: number }; // running aggregate after leg 2
  advanced?: boolean; // tie outcome, set on the decisive (2nd) leg
  // extra time + shootout:
  extraTime?: boolean; // timeline ran to 120'
  pens?: { for: number; against: number };
  penSeq?: PenaltyKick[]; // ordered kicks, for kick-by-kick animation
  // live timeline (deterministic from the seed):
  events: MatchEvent[];
  totalTicks: number;
  htTick: number; // first-half end (half-time)
  ftTick: number; // second-half end (90'+)
  etHtTick?: number; // extra-time half-time (≈105'), present if extraTime
};

export type StandRow = {
  nationId: string;
  name: string;
  flag: string;
  cup: number;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  isUser: boolean;
};

export type RunStats = {
  scorers: { name: string; goals: number }[]; // sorted desc
  assisters: { name: string; assists: number }[]; // sorted desc
  yellows: number;
  reds: number;
  penGoals: number;
};

export type Campaign = {
  seed: number;
  format: "liga" | "grupos";
  rating: TeamRating;
  fixtures: Fixture[];
  standings: StandRow[];
  leaguePos: number;
  leaguePts: number;
  wins: number;
  gf: number;
  ga: number;
  champion: boolean;
  perfect: boolean; // unbeaten (no losses) across the whole run
  biggestWinMargin: number;
  cleanSheets: number;
  badges: string[];
  stats: RunStats;
};

function metaFromDraw(d: (typeof VALID_DRAWS)[number]): Fixture["opponent"] {
  return { nationId: d.nation.id, name: d.nation.name, flag: d.nation.flag, cup: d.cup };
}

// Knockout opponents follow an ABSOLUTE bracket-difficulty curve (see KO_TARGET)
// rather than scaling to the user's level — so a stronger squad genuinely wins
// more often. The identity (club/season) is a real draw; its strength is set by
// the round, while its real lineup is used to name the opponent's events.
function makeOpponent(
  rng: Rng,
  formation: FormationName,
  targetOvr: number,
  // clubs already faced this run — never draw the same opponent twice in a campaign
  used?: Set<string>
) {
  const choices = used ? VALID_DRAWS.filter((d) => !used.has(d.nation.id)) : VALID_DRAWS;
  const draw = pick(rng, choices.length ? choices : VALID_DRAWS);
  used?.add(draw.nation.id);
  const ovr = clamp(targetOvr + (Math.floor(rng() * 7) - 3)); // ±3
  const tilt = Math.floor(rng() * 7) - 3; // ±3 attack/defense lean
  const ctx = makeScoreCtx(autoPickXI(buildSquad(draw.nation.id, draw.cup).players, formation));
  return {
    meta: metaFromDraw(draw),
    rating: { attack: clamp(ovr + tilt), defense: clamp(ovr - tilt), overall: ovr },
    ctx,
  };
}

/** Label a tick as a match minute, accounting for stoppage and extra time. */
export function tickLabel(tick: number, b: TickBounds): string {
  const { htTick, ftTick, etHtTick } = b;
  if (tick <= 0) return "0";
  if (tick <= 45) return `${tick}`;
  if (tick <= htTick) return `45+${tick - 45}`;
  if (tick <= ftTick) {
    const minute = 45 + (tick - htTick);
    return minute <= 90 ? `${minute}` : `90+${minute - 90}`;
  }
  if (etHtTick != null) {
    if (tick <= etHtTick) {
      const minute = 90 + (tick - ftTick);
      return minute <= 105 ? `${minute}` : `105+${minute - 105}`;
    }
    const minute = 105 + (tick - etHtTick);
    return minute <= 120 ? `${minute}` : `120+${minute - 120}`;
  }
  return `${tick}`;
}

function computeBounds(rng: Rng, extraTime: boolean): TickBounds & { totalTicks: number } {
  const st1 = 1 + Math.floor(rng() * 3); // +1..+3
  const st2 = 2 + Math.floor(rng() * 4); // +2..+5
  const htTick = 45 + st1;
  const ftTick = htTick + 45 + st2;
  let etHtTick: number | undefined;
  let totalTicks = ftTick;
  if (extraTime) {
    const ets1 = 1 + Math.floor(rng() * 2); // +1..+2
    const ets2 = 1 + Math.floor(rng() * 3); // +1..+3
    etHtTick = ftTick + 15 + ets1;
    totalTicks = etHtTick + 15 + ets2;
  }
  return { htTick, ftTick, etHtTick, totalTicks };
}

type GoalCounts = { regFor: number; regAgainst: number; etFor: number; etAgainst: number };

// Build the full timeline: goals (with scorer/assist/penalty for your side) and
// yellow/red cards, scattered across the clock. Regulation goals stay in 0-90',
// extra-time goals in 90-120'; cards can land anytime.
function buildEvents(
  rng: Rng,
  bounds: TickBounds & { totalTicks: number },
  c: GoalCounts,
  ctx: ScoreCtx,
  oppCtx: ScoreCtx
): MatchEvent[] {
  const { ftTick, etHtTick, totalTicks } = bounds;
  const evs: MatchEvent[] = [];
  const at = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

  // First decide *when* each event happens and its type, without naming the
  // player yet. Players are assigned chronologically afterwards so a sending-off
  // (straight red or second yellow) can exclude that player from every later event.
  type Skel = { tick: number; side: "for" | "against"; kind: EventKind; wantsAssist?: boolean };
  const skel: Skel[] = [];

  const addGoal = (side: "for" | "against", lo: number, hi: number) => {
    skel.push({
      tick: at(lo, hi),
      side,
      kind: rng() < PEN_RATE ? "pen" : "goal",
      wantsAssist: rng() < ASSIST_RATE,
    });
  };
  const addCard = (side: "for" | "against", kind: "yellow" | "red") => {
    skel.push({ tick: at(1, totalTicks), side, kind });
  };

  for (let i = 0; i < c.regFor; i++) addGoal("for", 1, ftTick);
  for (let i = 0; i < c.regAgainst; i++) addGoal("against", 1, ftTick);
  if (etHtTick != null) {
    for (let i = 0; i < c.etFor; i++) addGoal("for", ftTick + 1, totalTicks);
    for (let i = 0; i < c.etAgainst; i++) addGoal("against", ftTick + 1, totalTicks);
  }
  for (let i = 0, n = poisson(rng, YELLOW_MEAN); i < n; i++) addCard("for", "yellow");
  for (let i = 0, n = poisson(rng, YELLOW_MEAN); i < n; i++) addCard("against", "yellow");
  if (rng() < RED_RATE) addCard("for", "red");
  if (rng() < RED_RATE) addCard("against", "red");

  // assign players in chronological order, honouring sendings-off per side
  skel.sort((a, b) => a.tick - b.tick);
  const sentOff = { for: new Set<string>(), against: new Set<string>() };
  const yellowCount = { for: new Map<string, number>(), against: new Map<string, number>() };
  const eligible = (entries: WEntry[], off: Set<string>) => {
    const pool = entries.filter((e) => !off.has(e.name));
    return pool.length ? pool : entries; // safety net if a whole side were dismissed
  };

  for (const s of skel) {
    const cx = s.side === "for" ? ctx : oppCtx;
    const off = sentOff[s.side];
    if (s.kind === "goal" || s.kind === "pen") {
      const scorer =
        s.kind === "pen" && !off.has(cx.penTaker)
          ? cx.penTaker
          : weightedPick(rng, eligible(cx.scoreEntries, off));
      let assist: string | undefined;
      if (s.kind === "goal" && s.wantsAssist) {
        // only open-play goals can have an assist — penalties never do
        const pool = eligible(cx.assistEntries, off).filter((e) => e.name !== scorer);
        if (pool.length) assist = weightedPick(rng, pool);
      }
      evs.push({ tick: s.tick, label: "", side: s.side, kind: s.kind, player: scorer, assist });
    } else {
      const player = weightedPick(rng, eligible(cx.cardEntries, off));
      const counts = yellowCount[s.side];
      if (s.kind === "yellow" && (counts.get(player) ?? 0) >= 1) {
        // second booking → off, rendered as a red overlapping the yellow
        counts.set(player, 2);
        off.add(player);
        evs.push({ tick: s.tick, label: "", side: s.side, kind: "red", player, secondYellow: true });
      } else if (s.kind === "yellow") {
        counts.set(player, 1);
        evs.push({ tick: s.tick, label: "", side: s.side, kind: "yellow", player });
      } else {
        off.add(player);
        evs.push({ tick: s.tick, label: "", side: s.side, kind: "red", player });
      }
    }
  }

  for (const e of evs) e.label = tickLabel(e.tick, bounds);
  evs.sort((a, b) => a.tick - b.tick);
  return evs;
}

type MatchResult = {
  gfor: number; // total incl. extra time
  gagainst: number;
  extraTime: boolean;
  pens?: { for: number; against: number };
  penSeq?: PenaltyKick[];
  events: MatchEvent[];
  totalTicks: number;
  htTick: number;
  ftTick: number;
  etHtTick?: number;
};

type MatchOpts = {
  homeFor: boolean;
  allowExtraTime: boolean;
  // for a decisive 2nd leg, the level check is on aggregate (carry leg-1 score):
  aggFor?: number;
  aggAgainst?: number;
};

function playMatch(
  rng: Rng,
  me: TeamRating,
  opp: TeamRating,
  opts: MatchOpts,
  ctx: ScoreCtx,
  oppCtx: ScoreCtx
): MatchResult {
  const meAtk = me.attack + (opts.homeFor ? HOME_ATK : 0);
  const oppAtk = opp.attack + (opts.homeFor ? 0 : HOME_ATK);
  const lf = expectedGoals(meAtk, opp.defense);
  const la = expectedGoals(oppAtk, me.defense);

  const gfor = poisson(rng, lf);
  const gagainst = poisson(rng, la);

  let etFor = 0;
  let etAgainst = 0;
  let extraTime = false;
  let pens: MatchResult["pens"];
  let penSeq: PenaltyKick[] | undefined;

  if (opts.allowExtraTime) {
    const aFor = (opts.aggFor ?? 0) + gfor;
    const aAgainst = (opts.aggAgainst ?? 0) + gagainst;
    if (aFor === aAgainst) {
      extraTime = true;
      etFor = poisson(rng, lf * ET_FACTOR);
      etAgainst = poisson(rng, la * ET_FACTOR);
      if (aFor + etFor === aAgainst + etAgainst) {
        const s = shootout(rng, me.overall, opp.overall, ctx, oppCtx);
        pens = { for: s.for, against: s.against };
        penSeq = s.seq;
      }
    }
  }

  const bounds = computeBounds(rng, extraTime);
  const events = buildEvents(rng, bounds, { regFor: gfor, regAgainst: gagainst, etFor, etAgainst }, ctx, oppCtx);
  return {
    gfor: gfor + etFor,
    gagainst: gagainst + etAgainst,
    extraTime,
    pens,
    penSeq,
    events,
    totalTicks: bounds.totalTicks,
    htTick: bounds.htTick,
    ftTick: bounds.ftTick,
    etHtTick: bounds.etHtTick,
  };
}

// kickers in taking order: best scorers first, then cycle back around
function takerOrder(ctx: ScoreCtx): string[] {
  const order = ctx.scoreEntries
    .slice()
    .sort((a, b) => b.w - a.w)
    .map((e) => e.name);
  return order.length ? order : ["—"];
}

// Best-of-5 alternating penalties, then sudden death; returns the ordered kicks.
function shootout(rng: Rng, me: number, opp: number, ctx: ScoreCtx, oppCtx: ScoreCtx) {
  const pMe = 0.7 + (me - opp) * 0.003;
  const pOpp = 0.7 - (me - opp) * 0.003;
  const seq: PenaltyKick[] = [];
  let f = 0;
  let a = 0;

  const forTakers = takerOrder(ctx);
  const oppTakers = takerOrder(oppCtx);
  let fi = 0;
  let ai = 0;
  const nextFor = () => forTakers[fi++ % forTakers.length];
  const nextOpp = () => oppTakers[ai++ % oppTakers.length];

  const decided = (kicksLeftMe: number, kicksLeftOpp: number) =>
    f > a + kicksLeftOpp || a > f + kicksLeftMe;

  for (let i = 0; i < 5; i++) {
    if (decided(5 - i, 5 - i)) break;
    const sMe = rng() < pMe;
    seq.push({ side: "for", scored: sMe, player: nextFor() });
    if (sMe) f++;
    if (decided(5 - i - 1, 5 - i)) break;
    const sOpp = rng() < pOpp;
    seq.push({ side: "against", scored: sOpp, player: nextOpp() });
    if (sOpp) a++;
  }

  while (f === a) {
    const sMe = rng() < pMe;
    const sOpp = rng() < pOpp;
    seq.push({ side: "for", scored: sMe, player: nextFor() });
    seq.push({ side: "against", scored: sOpp, player: nextOpp() });
    if (sMe) f++;
    if (sOpp) a++;
  }

  return { for: f, against: a, seq };
}

function makeFixture(
  phase: Phase,
  meta: Fixture["opponent"],
  r: MatchResult,
  extra: { leg?: 1 | 2; home?: boolean; agg?: Fixture["agg"]; advanced?: boolean }
): Fixture {
  let result: Fixture["result"];
  if (r.pens) result = r.pens.for > r.pens.against ? "W" : "L";
  else if (r.gfor > r.gagainst) result = "W";
  else if (r.gfor === r.gagainst) result = "D";
  else result = "L";

  return {
    phase,
    opponent: meta,
    gfor: r.gfor,
    gagainst: r.gagainst,
    result,
    leg: extra.leg,
    home: extra.home,
    agg: extra.agg,
    advanced: extra.advanced,
    extraTime: r.extraTime || undefined,
    pens: r.pens,
    penSeq: r.penSeq,
    events: r.events,
    totalTicks: r.totalTicks,
    htTick: r.htTick,
    ftTick: r.ftTick,
    etHtTick: r.etHtTick,
  };
}

// A two-legged tie: home order randomized, decided on aggregate (ET + pens on
// the 2nd leg if level). Returns both leg fixtures and the advancement result.
function playTie(
  rng: Rng,
  phase: Phase,
  me: TeamRating,
  formation: FormationName,
  targetOvr: number,
  ctx: ScoreCtx,
  used?: Set<string>
): { fixtures: Fixture[]; advanced: boolean } {
  const opp = makeOpponent(rng, formation, targetOvr, used);
  const homeFirst = rng() < 0.5;

  const r1 = playMatch(rng, me, opp.rating, { homeFor: homeFirst, allowExtraTime: false }, ctx, opp.ctx);
  const r2 = playMatch(
    rng,
    me,
    opp.rating,
    { homeFor: !homeFirst, allowExtraTime: true, aggFor: r1.gfor, aggAgainst: r1.gagainst },
    ctx,
    opp.ctx
  );

  const aggFor = r1.gfor + r2.gfor;
  const aggAgainst = r1.gagainst + r2.gagainst;
  const advanced = r2.pens ? r2.pens.for > r2.pens.against : aggFor > aggAgainst;

  return {
    advanced,
    fixtures: [
      makeFixture(phase, opp.meta, r1, { leg: 1, home: homeFirst }),
      makeFixture(phase, opp.meta, r2, {
        leg: 2,
        home: !homeFirst,
        agg: { for: aggFor, against: aggAgainst },
        advanced,
      }),
    ],
  };
}

// Lightweight 8-game record for a CPU table team (no live timeline needed).
function lightLeagueRecord(rng: Rng, team: TeamRating, field: TeamRating[]) {
  let pts = 0,
    gf = 0,
    ga = 0;
  for (let i = 0; i < LEAGUE_GAMES; i++) {
    const opp = pick(rng, field);
    const home = rng() < 0.5;
    const f = poisson(rng, expectedGoals(team.attack + (home ? HOME_ATK : 0), opp.defense));
    const a = poisson(rng, expectedGoals(opp.attack + (home ? 0 : HOME_ATK), team.defense));
    gf += f;
    ga += a;
    if (f > a) pts += 3;
    else if (f === a) pts += 1;
  }
  return { pts, gf, ga };
}

// Absolute knockout difficulty curve (opponent overall per round). Lower =
// easier; raise toward ~90 to make deep runs harder. A strong squad sits above
// most of this curve, so top teams win meaningfully more often.
const KO_TARGET: Record<Exclude<Phase, "LIGA" | "GRUPOS">, number> = {
  PLAYOFF: 79,
  OITAVAS: 81,
  QUARTAS: 83,
  SEMI: 85,
  FINAL: 87,
};

// Local multiplayer: a single head-to-head match (extra time + penalties if
// level). The returned fixture is from Team A's perspective (for = A, against = B).
export function simulateMatch(
  seed: number,
  xiA: { player: Player; slotPos: Pos }[],
  styleA: Style,
  xiB: { player: Player; slotPos: Pos }[],
  styleB: Style,
  team2Name: string,
  phase: Phase = "FINAL"
): Fixture {
  const rng = mulberry32(seed);
  const rA = rateTeam(xiA, styleA);
  const rB = rateTeam(xiB, styleB);
  const cA = makeScoreCtx(xiA);
  const cB = makeScoreCtx(xiB);
  const res = playMatch(rng, rA, rB, { homeFor: rng() < 0.5, allowExtraTime: true }, cA, cB);
  return makeFixture(phase, { nationId: "t2", name: team2Name, flag: "", cup: 0 }, res, {});
}

// Two-legged tie between two explicit XIs (local multiplayer). Aggregate decides,
// extra time + penalties on the 2nd leg if level. `winner` is 0 (team A) or 1 (team B).
export function simulateTie(
  seed: number,
  xiA: { player: Player; slotPos: Pos }[],
  styleA: Style,
  xiB: { player: Player; slotPos: Pos }[],
  styleB: Style,
  team2Name: string,
  phase: Phase = "SEMI"
): { legs: [Fixture, Fixture]; winner: 0 | 1 } {
  const rng = mulberry32(seed);
  const rA = rateTeam(xiA, styleA);
  const rB = rateTeam(xiB, styleB);
  const cA = makeScoreCtx(xiA);
  const cB = makeScoreCtx(xiB);
  const meta = { nationId: "t2", name: team2Name, flag: "", cup: 0 };
  const homeFirst = rng() < 0.5;
  const r1 = playMatch(rng, rA, rB, { homeFor: homeFirst, allowExtraTime: false }, cA, cB);
  const r2 = playMatch(
    rng,
    rA,
    rB,
    { homeFor: !homeFirst, allowExtraTime: true, aggFor: r1.gfor, aggAgainst: r1.gagainst },
    cA,
    cB
  );
  const aggFor = r1.gfor + r2.gfor;
  const aggAgainst = r1.gagainst + r2.gagainst;
  const advanced = r2.pens ? r2.pens.for > r2.pens.against : aggFor > aggAgainst;
  return {
    winner: advanced ? 0 : 1,
    legs: [
      makeFixture(phase, meta, r1, { leg: 1, home: homeFirst }),
      makeFixture(phase, meta, r2, {
        leg: 2,
        home: !homeFirst,
        agg: { for: aggFor, against: aggAgainst },
        advanced,
      }),
    ],
  };
}

export function simulateCampaign(
  seed: number,
  xi: { player: Player; slotPos: Pos }[],
  style: Style,
  formation: FormationName,
  format: "liga" | "grupos" = "liga"
): Campaign {
  const rng = mulberry32(seed);
  const rating = rateTeam(xi, style);
  const ctx = makeScoreCtx(xi);
  const fixtures: Fixture[] = [];

  let wins = 0,
    gf = 0,
    ga = 0,
    perfect = true,
    biggestWinMargin = 0,
    cleanSheets = 0;

  // run-stat tallies (your team only)
  const goalsBy = new Map<string, number>();
  const assistsBy = new Map<string, number>();
  let yellows = 0,
    reds = 0,
    penGoals = 0;
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  function record(f: Fixture) {
    fixtures.push(f);
    gf += f.gfor;
    ga += f.gagainst;
    if (f.result === "W") wins++;
    if (f.result === "L") perfect = false;
    if (f.gagainst === 0) cleanSheets++;
    biggestWinMargin = Math.max(biggestWinMargin, f.gfor - f.gagainst);
    for (const e of f.events) {
      if (e.side !== "for") continue;
      if (e.kind === "goal") {
        if (e.player) bump(goalsBy, e.player);
        if (e.assist) bump(assistsBy, e.assist);
      } else if (e.kind === "pen") {
        if (e.player) bump(goalsBy, e.player);
        penGoals++;
      } else if (e.kind === "yellow") yellows++;
      else if (e.kind === "red") {
        reds++;
        if (e.secondYellow) yellows++; // the booking that triggered the red still counts
      }
    }
  }

  // Identify the user's drawn club-season from a player id ("nation-cup-i").
  const uid = xi[0]?.player.id ?? "";
  const [uNation, uCupStr] = uid.split("-");
  const uCup = Number(uCupStr);
  const userDraw =
    VALID_DRAWS.find((d) => d.nation.id === uNation && d.cup === uCup) ?? VALID_DRAWS[0];
  const field = VALID_DRAWS.filter((d) => d !== userDraw);

  let standings: StandRow[];
  let leaguePos: number;
  let leaguePts = 0;
  let path: Exclude<Phase, "LIGA" | "GRUPOS" | "FINAL">[];

  if (format === "grupos") {
    // ---- Group phase: a group of 4 (you + 3 draws), home & away ----------
    const groupOpps = shuffle(rng, field)
      .slice(0, 3)
      .map((d) => {
        const x = autoPickXI(buildSquad(d.nation.id, d.cup).players, formation);
        return { d, r: rateTeam(x), c: makeScoreCtx(x) };
      });
    const oppRec = groupOpps.map(() => ({ pts: 0, gf: 0, ga: 0 }));
    let groupGf = 0,
      groupGa = 0;

    // fixed double round-robin order 1,2,3,3,2,1 (never the same opponent twice
    // in a row); each opponent plays one leg home and one away
    const order = [0, 1, 2, 2, 1, 0];
    const firstLegHome = groupOpps.map(() => rng() < 0.5);
    const seenOpp = new Set<number>();
    const userGames = order.map((idx) => {
      const isFirstLeg = !seenOpp.has(idx);
      seenOpp.add(idx);
      const home = isFirstLeg ? firstLegHome[idx] : !firstLegHome[idx];
      return { idx, home };
    });
    userGames.forEach(({ idx, home }) => {
      const { d, r, c } = groupOpps[idx];
      const res = playMatch(rng, rating, r, { homeFor: home, allowExtraTime: false }, ctx, c);
      record(makeFixture("GRUPOS", metaFromDraw(d), res, { home }));
      groupGf += res.gfor;
      groupGa += res.gagainst;
      if (res.gfor > res.gagainst) leaguePts += 3;
      else if (res.gfor === res.gagainst) leaguePts += 1;
      // mirror into the opponent's group record
      const o = oppRec[idx];
      o.gf += res.gagainst;
      o.ga += res.gfor;
      if (res.gagainst > res.gfor) o.pts += 3;
      else if (res.gagainst === res.gfor) o.pts += 1;
    });

    // the 3 opponents also play each other (home & away), lightly simulated
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        for (const aHome of [true, false]) {
          const A = groupOpps[a].r;
          const B = groupOpps[b].r;
          const ga = poisson(rng, expectedGoals(A.attack + (aHome ? HOME_ATK : 0), B.defense));
          const gb = poisson(rng, expectedGoals(B.attack + (aHome ? 0 : HOME_ATK), A.defense));
          oppRec[a].gf += ga;
          oppRec[a].ga += gb;
          oppRec[b].gf += gb;
          oppRec[b].ga += ga;
          if (ga > gb) oppRec[a].pts += 3;
          else if (ga === gb) {
            oppRec[a].pts += 1;
            oppRec[b].pts += 1;
          } else oppRec[b].pts += 3;
        }
      }
    }

    standings = groupOpps.map((o, i) => ({
      nationId: o.d.nation.id,
      name: o.d.nation.name,
      flag: o.d.nation.flag,
      cup: o.d.cup,
      pts: oppRec[i].pts,
      gf: oppRec[i].gf,
      ga: oppRec[i].ga,
      gd: oppRec[i].gf - oppRec[i].ga,
      isUser: false,
    }));
    standings.push({
      nationId: userDraw.nation.id,
      name: userDraw.nation.name,
      flag: userDraw.nation.flag,
      cup: userDraw.cup,
      pts: leaguePts,
      gf: groupGf,
      ga: groupGa,
      gd: groupGf - groupGa,
      isUser: true,
    });
    standings.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    leaguePos = standings.findIndex((s) => s.isUser) + 1;

    // top 2 advance straight to the round of 16
    path = leaguePos <= 2 ? ["OITAVAS", "QUARTAS", "SEMI"] : [];
  } else {
    // ---- League phase: 8 live games (exactly 4 home, 4 away) --------------
    // you + 35 random clubs form the 36-team Swiss table; you play 8 of them
    const leagueField = shuffle(rng, field).slice(0, LEAGUE_FIELD);
    const leagueXI = leagueField.map((d) =>
      autoPickXI(buildSquad(d.nation.id, d.cup).players, formation)
    );
    const leagueRatings = leagueXI.map((x) => rateTeam(x));
    const allRatings = [rating, ...leagueRatings];
    const leagueOpps = leagueField.slice(0, LEAGUE_GAMES).map((d, i) => ({
      d,
      r: leagueRatings[i],
      c: makeScoreCtx(leagueXI[i]),
    }));
    const haPattern = shuffle(rng, [true, true, true, true, false, false, false, false]);
    let leagueGf = 0,
      leagueGa = 0;
    leagueOpps.forEach(({ d, r, c }, i) => {
      const home = haPattern[i];
      const res = playMatch(rng, rating, r, { homeFor: home, allowExtraTime: false }, ctx, c);
      record(makeFixture("LIGA", metaFromDraw(d), res, { home }));
      leagueGf += res.gfor;
      leagueGa += res.gagainst;
      if (res.gfor > res.gagainst) leaguePts += 3;
      else if (res.gfor === res.gagainst) leaguePts += 1;
    });

    // ---- Standings: user's real row + lightly-simulated field rows --------
    standings = leagueField.map((d, i) => {
      const rec = lightLeagueRecord(rng, leagueRatings[i], allRatings);
      return {
        nationId: d.nation.id,
        name: d.nation.name,
        flag: d.nation.flag,
        cup: d.cup,
        pts: rec.pts,
        gf: rec.gf,
        ga: rec.ga,
        gd: rec.gf - rec.ga,
        isUser: false,
      };
    });
    standings.push({
      nationId: userDraw.nation.id,
      name: userDraw.nation.name,
      flag: userDraw.nation.flag,
      cup: userDraw.cup,
      pts: leaguePts,
      gf: leagueGf,
      ga: leagueGa,
      gd: leagueGf - leagueGa,
      isUser: true,
    });
    standings.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    leaguePos = standings.findIndex((s) => s.isUser) + 1;

    path =
      leaguePos <= QUAL_DIRECT
        ? ["OITAVAS", "QUARTAS", "SEMI"]
        : leaguePos <= QUAL_PLAYOFF
        ? ["PLAYOFF", "OITAVAS", "QUARTAS", "SEMI"]
        : [];
  }

  // ---- Seeding + knockouts ----------------------------------------------
  let alive = path.length > 0;
  // clubs faced across this run's knockout (incl. the final) — never repeated
  const facedClubs = new Set<string>();

  for (const phase of path) {
    const tie = playTie(rng, phase, rating, formation, KO_TARGET[phase], ctx, facedClubs);
    tie.fixtures.forEach(record);
    if (!tie.advanced) {
      alive = false;
      break;
    }
  }

  // ---- Final: single match, extra time + penalties if level --------------
  let champion = false;
  if (alive && path.length) {
    const opp = makeOpponent(rng, formation, KO_TARGET.FINAL, facedClubs);
    const res = playMatch(rng, rating, opp.rating, { homeFor: rng() < 0.5, allowExtraTime: true }, ctx, opp.ctx);
    const f = makeFixture("FINAL", opp.meta, res, {});
    record(f);
    champion = f.result === "W";
  }

  const badges: string[] = [];
  if (biggestWinMargin >= 7) badges.push("esmagador");
  if (cleanSheets >= 4) badges.push("muralha");

  const stats: RunStats = {
    scorers: [...goalsBy].map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals),
    assisters: [...assistsBy]
      .map(([name, assists]) => ({ name, assists }))
      .sort((a, b) => b.assists - a.assists),
    yellows,
    reds,
    penGoals,
  };

  return {
    seed,
    format,
    rating,
    fixtures,
    standings,
    leaguePos,
    leaguePts,
    wins,
    gf,
    ga,
    champion,
    perfect: perfect && champion,
    biggestWinMargin,
    cleanSheets,
    badges,
    stats,
  };
}
