import { mulberry32 } from "@/lib/rng";

// Deterministic star field so the server and client render the same markup
// (no hydration mismatch). ~48 stars + a soft radial glow at the top.
const STARS = (() => {
  const rng = mulberry32(0x51_a2_c3);
  return Array.from({ length: 48 }, () => ({
    left: rng() * 100,
    top: rng() * 100,
    size: 1 + rng() * 2,
    opacity: 0.2 + rng() * 0.6,
    dur: 3 + rng() * 4,
    delay: rng() * 5,
  }));
})();

export function StarryBackground() {
  return (
    <div className="starfield" aria-hidden="true">
      <div className="sky-glow" />
      {STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            ["--dur" as string]: `${s.dur}s`,
            ["--delay" as string]: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
