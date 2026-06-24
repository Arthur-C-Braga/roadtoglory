// shared sound preferences (whistle, goal roar, net), persisted in localStorage
export const SOUND_KEY = "rtg-sound";
export const VOLUME_KEY = "rtg-volume"; // 0..100
export const DEFAULT_VOLUME = 20; // percent, used until the user changes it

/** sound is on unless explicitly turned off */
export function soundOn(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "0";
}

/** playback volume as a 0..1 multiplier (defaults to DEFAULT_VOLUME when unset) */
export function soundVolume(): number {
  const fallback = DEFAULT_VOLUME / 100;
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(VOLUME_KEY);
  if (raw === null) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v / 100));
}
