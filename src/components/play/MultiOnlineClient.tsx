"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useNetworkedRoom } from "@/lib/multiplayer/useNetworkedRoom";

// unambiguous code alphabet (no 0/O, 1/I)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(n = 4): string {
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("rtg_pid");
  if (!id) {
    id = (crypto.randomUUID?.() ?? `p${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("rtg_pid", id);
  }
  return id;
}

function Head() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Road to Glory">
        <span className="brand-badge" aria-hidden="true">★</span>
        <span className="brand-word">ROAD TO <span className="accent">GLORY</span></span>
      </Link>
    </header>
  );
}

export function MultiOnlineClient() {
  const t = useTranslations();
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => setPlayerId(getPlayerId()), []);

  const canEnter = name.trim().length > 0;

  if (roomId) {
    return (
      <LobbyRoom
        roomId={roomId}
        playerId={playerId}
        name={name.trim() || "Jogador"}
        onLeave={() => setRoomId(null)}
      />
    );
  }

  return (
    <main className="page-wrap tx-paper">
      <Head />
      <div className="page-body ml-setup-body">
        <h1 className="page-title">{t("multi.online.title")}</h1>
        <p className="page-sub">{t("multi.online.sub")}</p>

        <div className="mo-entry">
          <label className="mo-field">
            <span className="bp-label">{t("multi.online.yourName")}</span>
            <input
              className="ml-name-input"
              value={name}
              maxLength={20}
              placeholder={t("multi.online.yourName")}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="mo-actions">
            <button
              className="btn btn-primary big"
              disabled={!canEnter}
              onClick={() => setRoomId(genCode())}
            >
              {t("multi.online.create")}
            </button>
          </div>

          <div className="mo-join">
            <input
              className="ml-name-input mo-code-input"
              value={joinCode}
              maxLength={6}
              placeholder={t("multi.online.codePlaceholder")}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <button
              className="btn btn-secondary"
              disabled={!canEnter || joinCode.trim().length < 3}
              onClick={() => setRoomId(joinCode.trim())}
            >
              {t("multi.online.join")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function LobbyRoom({
  roomId,
  playerId,
  name,
  onLeave,
}: {
  roomId: string;
  playerId: string;
  name: string;
  onLeave: () => void;
}) {
  const t = useTranslations();
  const { state, dispatch, connected } = useNetworkedRoom({ roomId, playerId, playerName: name });
  const [copied, setCopied] = useState(false);

  const players = state.players.filter((p) => p.connected);
  const isHost = state.hostId === playerId;
  const isReady = state.ready.includes(playerId);
  const others = players.filter((p) => p.id !== state.hostId);
  const allReady = others.length > 0 && others.every((p) => state.ready.includes(p.id));

  function copyCode() {
    navigator.clipboard?.writeText(roomId).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  }

  return (
    <main className="page-wrap tx-paper">
      <Head />
      <div className="page-body ml-setup-body">
        <h1 className="page-title">{t("multi.online.lobbyTitle")}</h1>

        <button className="mo-code" onClick={copyCode} aria-label={t("multi.online.codeLabel")}>
          <span className="mo-code-label">{t("multi.online.codeLabel")}</span>
          <span className="mo-code-value num">{roomId}</span>
          <span className="mo-code-copy">{copied ? t("card.linkCopied") : "⧉"}</span>
        </button>

        {!connected && <p className="mo-status">{t("multi.online.connecting")}</p>}

        <ul className="mo-players">
          {players.map((p) => {
            const ready = state.ready.includes(p.id);
            const host = p.id === state.hostId;
            const you = p.id === playerId;
            return (
              <li key={p.id} className={`mo-player${ready ? " ready" : ""}`}>
                <span className="mo-player-name">
                  {p.name}
                  {you && <span className="mo-tag you"> · {t("multi.online.you")}</span>}
                  {host && <span className="mo-tag host"> · {t("multi.online.host")}</span>}
                </span>
                <span className="mo-player-state">
                  {host ? "—" : ready ? t("multi.online.ready") : t("multi.online.notReady")}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="ml-setup-actions">
          <button className="btn btn-secondary" onClick={onLeave}>
            {t("multi.online.leave")}
          </button>
          {isHost ? (
            <span className="mo-host-hint">
              {allReady ? t("multi.online.allReady") : t("multi.online.waitingReady")}
            </span>
          ) : (
            <button
              className={`btn ${isReady ? "btn-secondary" : "btn-primary"} big`}
              onClick={() => dispatch({ t: "setReady", id: playerId, ready: !isReady })}
            >
              {isReady ? t("multi.online.cancelReady") : t("multi.online.markReady")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
