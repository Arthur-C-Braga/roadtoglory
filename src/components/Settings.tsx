"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { SOUND_KEY, VOLUME_KEY, DEFAULT_VOLUME } from "@/lib/sound";

export function Settings() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [streamer, setStreamer] = useState(false);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStreamer(localStorage.getItem("rtg-streamer") === "1");
    setSound(localStorage.getItem(SOUND_KEY) !== "0");
    const v = localStorage.getItem(VOLUME_KEY);
    setVolume(v === null ? DEFAULT_VOLUME : Math.min(100, Math.max(0, Number(v) || 0)));
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function applyStreamer(next: boolean) {
    setStreamer(next);
    localStorage.setItem("rtg-streamer", next ? "1" : "0");
    document.documentElement.classList.toggle("streamer", next);
  }

  function applySound(next: boolean) {
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? "1" : "0");
  }

  function applyVolume(next: number) {
    setVolume(next);
    localStorage.setItem(VOLUME_KEY, String(next));
  }

  function applyLocale(next: string) {
    router.replace(pathname, { locale: next });
  }

  const panelTitle = t("settingsPanel");

  return (
    <div className="settings" ref={ref}>
      <button
        type="button"
        className="theme-toggle settings-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="tt-label">{t("settings")} ▾</span>
      </button>

      {open && (
        <div className="settings-panel" role="menu">
          <div className="settings-panel-title">{panelTitle}</div>

          <div className="settings-row">
            <span className="settings-row-label">{t("settingsLang")}</span>
            <div className="seg" role="group">
              {routing.locales.map((l) => (
                <button
                  key={l}
                  aria-pressed={locale === l}
                  onClick={() => applyLocale(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">{t("settingsSound")}</span>
            <div className="seg" role="group">
              <button aria-pressed={sound} onClick={() => applySound(true)}>
                {t("settingsOn")}
              </button>
              <button aria-pressed={!sound} onClick={() => applySound(false)}>
                {t("settingsOff")}
              </button>
            </div>
            <div className="settings-volume">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                disabled={!sound}
                aria-label={t("settingsVolume")}
                onChange={(e) => applyVolume(Number(e.target.value))}
              />
              <span className="settings-volume-val num">{volume}%</span>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">{t("settingsStreamer")}</span>
            <div className="seg" role="group">
              <button aria-pressed={streamer} onClick={() => applyStreamer(true)}>
                {t("settingsOn")}
              </button>
              <button aria-pressed={!streamer} onClick={() => applyStreamer(false)}>
                {t("settingsOff")}
              </button>
            </div>
            <p className="settings-hint">{t("settingsStreamerHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
