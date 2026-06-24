// Wire protocol between the client transport and the PartyKit room.
//
// The client sends intentions (RoomEvents it wants applied); the authoritative
// room validates each one, runs the pure reducer, and broadcasts the full
// RoomState snapshot back. Snapshots are small, so we never diff.

import type { RoomEvent, RoomState } from "./roomState";

export type ClientToServer = { kind: "event"; event: RoomEvent };

export type ServerToClient = { kind: "state"; state: RoomState };

// the realtime room name (kebab-case of the "Room" Durable Object binding)
export const ROOM_PARTY = "room";

// local default points at `wrangler dev` (127.0.0.1:8787); production sets
// NEXT_PUBLIC_PARTYKIT_HOST to the deployed *.workers.dev host
export const DEFAULT_PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:8787";
