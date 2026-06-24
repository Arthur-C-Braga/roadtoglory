"use client";

import { type CSSProperties, useState } from "react";
import { type Slot, type Player } from "@/lib/data";

export type Placed = (Player | null)[];
export type DiscBadge = "star" | "boot" | "assist";

function BadgeIcon({ kind }: { kind: DiscBadge }) {
  if (kind === "star") return <span className="disc-badge disc-badge--star">★</span>;
  if (kind === "assist") {
    return (
      <span className="disc-badge disc-badge--assist" aria-hidden="true">
        <svg
          viewBox="0 0 32 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <circle cx="16" cy="4" r="1.4" fill="currentColor" stroke="none" />
          <path d="M6 13 Q16 3.5 26 13" />
          <line x1="4" y1="15" x2="28" y2="15" />
        </svg>
      </span>
    );
  }
  return (
    <span className="disc-badge disc-badge--boot" aria-hidden="true">
      <svg viewBox="0 0 32 24" fill="currentColor">
        <path d="M3 4v9c0 1.7 1.2 2.8 3 2.8h17.5c3.2 0 5.5-1.7 5.5-4.3 0-1.6-1-2.7-3.2-3.3l-9-2.4c-1.6-.4-2.7-1.3-3.7-2.8L11.8 4z" />
        <circle cx="8.5" cy="20" r="1.5" />
        <circle cx="14.5" cy="20" r="1.5" />
        <circle cx="20.5" cy="20" r="1.5" />
      </svg>
    </span>
  );
}

export function Pitch({
  slots,
  placed,
  showRatings,
  highlight,
  onSlotClick,
  badges,
  glow,
  selectedSlot,
  stats,
}: {
  slots: Slot[];
  placed: Placed;
  showRatings: boolean;
  /** indices of slots to highlight as valid drop targets for the picked player */
  highlight: number[];
  onSlotClick: (i: number) => void;
  /** small decorations overlaid on a slot's circle (e.g. MVP star, top scorer boot) */
  badges?: Record<number, DiscBadge[]>;
  /** 0..1 — ramps up the pitch glow as the lineup fills */
  glow?: number;
  /** a placed player picked up to move — its slot shows the selected state */
  selectedSlot?: number | null;
  /** when set, clicking a player toggles a popover with his goals/assists */
  stats?: (player: Player) => { goals: number; assists: number };
}) {
  const hl = new Set(highlight);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  return (
    <div className="pitch-wrap">
      <div
        className="pitch"
        style={glow != null ? ({ "--glow-level": String(glow) } as CSSProperties) : undefined}
      >
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
          <path d="M62 400 V340 H238 V400" />
          <path d="M112 400 V378 H188 V400" />
        </svg>

        {slots.map((slot, i) => {
          const p = placed[i];
          const isHl = hl.has(i);
          const slotBadges = badges?.[i] ?? [];
          return (
            <button
              key={i}
              type="button"
              className={`disc${p ? " filled" : " empty"}${isHl ? " hl" : ""}${i === selectedSlot ? " sel" : ""}${stats && openSlot === i ? " open" : ""}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onClick={() => {
                onSlotClick(i);
                if (stats && p) setOpenSlot((cur) => (cur === i ? null : i));
              }}
              aria-label={p ? p.name : slot.pos}
            >
              <span className="disc-circle num">
                <svg className="disc-shirt" viewBox="0 0 44 34" aria-hidden="true">
                  <path d="M16 3 L18 3 Q22 8 26 3 L28 3 L41 9 L36 16 L31 13 L31 31 L13 31 L13 13 L8 16 L3 9 Z" />
                </svg>
                <span className="disc-val">{p ? (showRatings ? p.rating : "?") : slot.pos}</span>
                {slotBadges.length > 0 && (
                  <span className="disc-badges">
                    {slotBadges.map((b) => (
                      <BadgeIcon key={b} kind={b} />
                    ))}
                  </span>
                )}
              </span>
              <span className="disc-name">{p ? p.name : slot.pos}</span>
              {stats && p && openSlot === i && (
                <span className="disc-stats">
                  <span className="ds-stat">
                    <BadgeIcon kind="boot" /> {stats(p).goals}
                  </span>
                  <span className="ds-stat">
                    <BadgeIcon kind="assist" /> {stats(p).assists}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
