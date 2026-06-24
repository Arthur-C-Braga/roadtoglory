"use client";

// Local hot-seat: the room store runs in-memory (useRoom) and the shared game
// render gets LOCAL_SEAT, so every team is editable on the one device.

import { MultiGame } from "./MultiGame";
import { useRoom } from "@/lib/multiplayer/useRoom";
import { LOCAL_SEAT } from "@/lib/multiplayer/roomState";

export function MultiLocalClient() {
  const { state, dispatch } = useRoom();
  return <MultiGame state={state} dispatch={dispatch} seat={LOCAL_SEAT} />;
}
