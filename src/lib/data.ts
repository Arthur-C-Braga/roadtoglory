import { ROSTERS } from "./rosters";

export type Pos =
  | "GOL"
  | "LD"
  | "LE"
  | "ZAG"
  | "VOL"
  | "MC"
  | "MEI"
  | "MD"
  | "ME"
  | "PD"
  | "PE"
  | "ATA";

export const POSITIONS: Pos[] = [
  "GOL", "LD", "LE", "ZAG", "VOL", "MC", "MEI", "MD", "ME", "PD", "PE", "ATA",
];

export type Slot = { pos: Pos; x: number; y: number };

export const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "LD", x: 84, y: 70 },
    { pos: "ZAG", x: 62, y: 74 },
    { pos: "ZAG", x: 38, y: 74 },
    { pos: "LE", x: 16, y: 70 },
    { pos: "VOL", x: 50, y: 58 },
    { pos: "MC", x: 70, y: 48 },
    { pos: "MEI", x: 30, y: 48 },
    { pos: "PD", x: 82, y: 24 },
    { pos: "ATA", x: 50, y: 20 },
    { pos: "PE", x: 18, y: 24 },
  ],
  "4-4-2": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "LD", x: 84, y: 70 },
    { pos: "ZAG", x: 62, y: 74 },
    { pos: "ZAG", x: 38, y: 74 },
    { pos: "LE", x: 16, y: 70 },
    { pos: "PD", x: 84, y: 46 },
    { pos: "MC", x: 60, y: 50 },
    { pos: "MEI", x: 40, y: 50 },
    { pos: "PE", x: 16, y: 46 },
    { pos: "ATA", x: 60, y: 22 },
    { pos: "ATA", x: 40, y: 22 },
  ],
  "4-2-3-1": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "LD", x: 84, y: 70 },
    { pos: "ZAG", x: 62, y: 74 },
    { pos: "ZAG", x: 38, y: 74 },
    { pos: "LE", x: 16, y: 70 },
    { pos: "VOL", x: 60, y: 58 },
    { pos: "VOL", x: 40, y: 58 },
    { pos: "PD", x: 82, y: 36 },
    { pos: "MEI", x: 50, y: 38 },
    { pos: "PE", x: 18, y: 36 },
    { pos: "ATA", x: 50, y: 16 },
  ],
  "4-2-4": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "LD", x: 84, y: 70 },
    { pos: "ZAG", x: 62, y: 74 },
    { pos: "ZAG", x: 38, y: 74 },
    { pos: "LE", x: 16, y: 70 },
    { pos: "MC", x: 60, y: 54 },
    { pos: "MEI", x: 40, y: 54 },
    { pos: "PD", x: 82, y: 24 },
    { pos: "ATA", x: 60, y: 18 },
    { pos: "ATA", x: 40, y: 18 },
    { pos: "PE", x: 18, y: 24 },
  ],
  "3-5-2": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "ZAG", x: 70, y: 76 },
    { pos: "ZAG", x: 50, y: 78 },
    { pos: "ZAG", x: 30, y: 76 },
    { pos: "LD", x: 88, y: 52 },
    { pos: "VOL", x: 62, y: 56 },
    { pos: "MEI", x: 50, y: 44 },
    { pos: "VOL", x: 38, y: 56 },
    { pos: "LE", x: 12, y: 52 },
    { pos: "ATA", x: 60, y: 20 },
    { pos: "ATA", x: 40, y: 20 },
  ],
  "5-3-2": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "LD", x: 90, y: 62 },
    { pos: "ZAG", x: 70, y: 76 },
    { pos: "ZAG", x: 50, y: 78 },
    { pos: "ZAG", x: 30, y: 76 },
    { pos: "LE", x: 10, y: 62 },
    { pos: "VOL", x: 50, y: 54 },
    { pos: "MC", x: 70, y: 48 },
    { pos: "MEI", x: 30, y: 48 },
    { pos: "ATA", x: 60, y: 20 },
    { pos: "ATA", x: 40, y: 20 },
  ],
  "4-5-1": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "LD", x: 84, y: 70 },
    { pos: "ZAG", x: 62, y: 74 },
    { pos: "ZAG", x: 38, y: 74 },
    { pos: "LE", x: 16, y: 70 },
    { pos: "PD", x: 86, y: 44 },
    { pos: "MC", x: 64, y: 50 },
    { pos: "VOL", x: 50, y: 58 },
    { pos: "MEI", x: 36, y: 50 },
    { pos: "PE", x: 14, y: 44 },
    { pos: "ATA", x: 50, y: 18 },
  ],
  "3-4-3": [
    { pos: "GOL", x: 50, y: 90 },
    { pos: "ZAG", x: 70, y: 76 },
    { pos: "ZAG", x: 50, y: 78 },
    { pos: "ZAG", x: 30, y: 76 },
    { pos: "LD", x: 86, y: 52 },
    { pos: "MC", x: 60, y: 54 },
    { pos: "MEI", x: 40, y: 54 },
    { pos: "LE", x: 14, y: 52 },
    { pos: "PD", x: 80, y: 22 },
    { pos: "ATA", x: 50, y: 18 },
    { pos: "PE", x: 20, y: 22 },
  ],
};

export type FormationName = keyof typeof FORMATIONS;

export type Player = {
  id: string;
  name: string;
  pos: Pos[];
  rating: number;
};

export type Nation = { id: string; name: string; flag: string };

export type Squad = {
  nationId: string;
  nation: Nation;
  cup: number;
  players: Player[];
};

export const NATIONS: Nation[] = [
  { id: "psg", name: "PSG",            flag: "🇫🇷" },
  { id: "rm",  name: "Real Madrid",    flag: "🇪🇸" },
  { id: "mci", name: "Man. City",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "che", name: "Chelsea",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "bay", name: "Bayern",         flag: "🇩🇪" },
  { id: "liv", name: "Liverpool",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "bar", name: "Barcelona",      flag: "🇪🇸" },
  { id: "int", name: "Inter",          flag: "🇮🇹" },
  { id: "por", name: "Porto",          flag: "🇵🇹" },
  { id: "mil", name: "Milan",          flag: "🇮🇹" },
  { id: "mun", name: "Man. United",    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "ben", name: "Benfica",        flag: "🇵🇹" },
  { id: "aja", name: "Ajax",           flag: "🇳🇱" },
  { id: "nfo", name: "Nottm Forest",   flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "avi", name: "Aston Villa",    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "hsv", name: "Hamburger SV",   flag: "🇩🇪" },
  { id: "ste", name: "Steaua",         flag: "🇷🇴" },
  { id: "psv", name: "PSV",            flag: "🇳🇱" },
  { id: "rsb", name: "Red Star",       flag: "🇷🇸" },
  { id: "dor", name: "Dortmund",       flag: "🇩🇪" },
  { id: "cel", name: "Celtic",         flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: "fey", name: "Feyenoord",      flag: "🇳🇱" },
  { id: "juv", name: "Juventus",       flag: "🇮🇹" },
  { id: "mar", name: "Marseille",      flag: "🇫🇷" },
];

// Season start years for every European Cup / Champions League winner (1955–2025).
export const CUPS: number[] = Array.from({ length: 2025 - 1955 + 1 }, (_, i) => 1955 + i);

// All valid club-season combinations derived from the roster data.
export const VALID_DRAWS: { nation: Nation; cup: number }[] = Object.keys(ROSTERS).map(
  (key) => {
    const dash = key.lastIndexOf("-");
    const nationId = key.slice(0, dash);
    const cup = Number(key.slice(dash + 1));
    const nation = NATIONS.find((n) => n.id === nationId)!;
    return { nation, cup };
  }
);

// "2025" → "2025/26", "1999" → "1999/00"
export function cupToSeason(year: number): string {
  const next = (year + 1) % 100;
  return `${year}/${String(next).padStart(2, "0")}`;
}

// Short season label = the END year. "2024" → "25", "1999" → "00".
export function cupYY(year: number): string {
  return String((year + 1) % 100).padStart(2, "0");
}

export function buildSquad(nationId: string, cup: number): Squad {
  const nation = NATIONS.find((n) => n.id === nationId) ?? NATIONS[0];
  const key = `${nationId}-${cup}`;
  const raw =
    ROSTERS[key] ??
    ROSTERS[Object.keys(ROSTERS).find((k) => k.startsWith(nationId + "-")) ?? "rm-2023"];

  const players: Player[] = raw.map((p, i) => ({
    id: `${nationId}-${cup}-${i}`,
    name: p.name,
    // primary role first, then any secondary roles — a player fits any of them
    pos: [p.pos, ...(p.alt ?? [])] as Pos[],
    rating: p.rating,
  }));

  return { nationId, nation, cup, players };
}

export function playerFitsSlot(p: Player, slotPos: Pos): boolean {
  return p.pos.includes(slotPos);
}

// Tactical style re-roles and repositions the formation. The squad you build is
// the same (slot order/count unchanged, so fitting still uses the base
// positions), but a defensive setup drops players deeper and pulls them into
// more conservative roles, while an offensive one pushes up and forward.
const DEF_REMAP: Partial<Record<Pos, Pos>> = {
  MEI: "MC", // attacking mid → central mid
  MC: "VOL", // central mid → holding mid
  PD: "MEI", // wingers tuck inside
  PE: "MEI",
};
const ATK_REMAP: Partial<Record<Pos, Pos>> = {
  VOL: "MC", // holding mid → box-to-box
  MC: "MEI", // central mid → attacking mid
};

export function styledFormation(
  base: Slot[],
  style: "defensivo" | "equilibrado" | "ofensivo"
): Slot[] {
  if (style === "equilibrado") return base;
  const dy = style === "defensivo" ? 8 : -8; // +y = deeper, -y = higher up
  const widthScale = style === "defensivo" ? 0.86 : 1.08; // compact vs spread
  const remap = style === "defensivo" ? DEF_REMAP : ATK_REMAP;
  return base.map((s) => {
    if (s.pos === "GOL") return s;
    return {
      pos: remap[s.pos] ?? s.pos,
      x: Math.max(8, Math.min(92, 50 + (s.x - 50) * widthScale)),
      y: Math.max(14, Math.min(86, s.y + dy)),
    };
  });
}
