"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useNetworkedRoom } from "@/lib/multiplayer/useNetworkedRoom";
import { MultiGame, MultiHead } from "./MultiGame";
import type { Mode, Seat } from "@/lib/multiplayer/roomState";

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
    id = crypto.randomUUID?.() ?? `p${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("rtg_pid", id);
  }
  return id;
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
      <RoomView
        roomId={roomId}
        playerId={playerId}
        name={name.trim() || "Jogador"}
        onLeave={() => setRoomId(null)}
      />
    );
  }

  return (
    <main className="page-wrap tx-paper">
      <MultiHead />
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
            <button className="btn btn-primary big" disabled={!canEnter} onClick={() => setRoomId(genCode())}>
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

function RoomView({
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
  const { state, dispatch, connected } = useNetworkedRoom({ roomId, playerId, playerName: name });

  // once the host starts, hand off to the shared game render
  if (state.stage !== "lobby") {
    const me = state.players.find((p) => p.id === playerId);
    const seat: Seat = {
      playerId,
      isHost: state.hostId === playerId,
      myTeamIdx: me?.teamIdx ?? null,
      isOnline: true,
    };
    return <MultiGame state={state} dispatch={dispatch} seat={seat} />;
  }

  return <Lobby state={state} dispatch={dispatch} connected={connected} roomId={roomId} playerId={playerId} onLeave={onLeave} />;
}

function Lobby({
  state,
  dispatch,
  connected,
  roomId,
  playerId,
  onLeave,
}: {
  state: ReturnType<typeof useNetworkedRoom>["state"];
  dispatch: ReturnType<typeof useNetworkedRoom>["dispatch"];
  connected: boolean;
  roomId: string;
  playerId: string;
  onLeave: () => void;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const players = state.players.filter((p) => p.connected);
  const isHost = state.hostId === playerId;
  const isReady = state.ready.includes(playerId);
  const others = players.filter((p) => p.id !== state.hostId);
  const allReady = others.length > 0 && others.every((p) => state.ready.includes(p.id));
  const n = players.length;

  function copyCode() {
    navigator.clipboard?.writeText(roomId).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  }

  function start(mode: Mode) {
    dispatch({ t: "chooseMode", mode });
  }

  return (
    <main className="page-wrap tx-paper">
      <MultiHead />
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

        {isHost ? (
          <div className="mo-host-start">
            {!allReady ? (
              <span className="mo-host-hint">{t("multi.online.waitingReady")}</span>
            ) : (
              <>
                <span className="ml-menu-label">{t("multi.online.pickMode")}</span>
                <div className="ml-menu-row">
                  <button className="btn btn-primary" disabled={n < 2} onClick={() => start("single")}>
                    {t("multi.local.modeSingle")}
                  </button>
                  <button className="btn btn-primary" disabled={n < 2} onClick={() => start("twoleg")}>
                    {t("multi.local.modeTwoLeg")}
                  </button>
                  <button className="btn btn-primary" disabled={n < 4} onClick={() => start("tourney")}>
                    {t("multi.local.modeTourney")}
                  </button>
                </div>
                {n < 4 && <span className="mo-host-hint">{t("multi.online.needFour")}</span>}
              </>
            )}
          </div>
        ) : (
          <div className="ml-setup-actions">
            <button
              className={`btn ${isReady ? "btn-secondary" : "btn-primary"} big`}
              onClick={() => dispatch({ t: "setReady", id: playerId, ready: !isReady })}
            >
              {isReady ? t("multi.online.cancelReady") : t("multi.online.markReady")}
            </button>
          </div>
        )}

        <button className="btn btn-secondary mo-leave" onClick={onLeave}>
          {t("multi.online.leave")}
        </button>
      </div>
    </main>
  );
}
