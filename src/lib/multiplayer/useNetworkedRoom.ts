"use client";

// Networked transport: connects to the authoritative PartyKit room over a
// WebSocket, sends RoomEvents as intentions, and mirrors the broadcast
// snapshots. The reducer runs only on the server here — the client just
// reflects what the room says. Same { state, dispatch } shape as useRoom.

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { initialRoom, type RoomEvent, type RoomState } from "./roomState";
import {
  DEFAULT_PARTYKIT_HOST,
  ROOM_PARTY,
  type ClientToServer,
  type ServerToClient,
} from "./protocol";
import type { Room } from "./useRoom";

export function useNetworkedRoom(opts: {
  roomId: string;
  playerId: string;
  playerName: string;
}): Room & { connected: boolean } {
  const [state, setState] = useState<RoomState>(() => ({ ...initialRoom(), stage: "lobby" }));
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!opts.roomId || !opts.playerId) return;
    const socket = new PartySocket({
      host: DEFAULT_PARTYKIT_HOST,
      party: ROOM_PARTY,
      room: opts.roomId,
      id: opts.playerId,
      query: { name: opts.playerName },
    });
    socketRef.current = socket;

    const onMessage = (e: MessageEvent) => {
      let msg: ServerToClient;
      try {
        msg = JSON.parse(e.data) as ServerToClient;
      } catch {
        return;
      }
      if (msg.kind === "state") setState(msg.state);
    };
    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);

    socket.addEventListener("message", onMessage);
    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);

    return () => {
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.close();
      socketRef.current = null;
    };
  }, [opts.roomId, opts.playerId, opts.playerName]);

  const dispatch = useCallback((event: RoomEvent) => {
    socketRef.current?.send(JSON.stringify({ kind: "event", event } satisfies ClientToServer));
  }, []);

  return { state, dispatch, connected };
}
