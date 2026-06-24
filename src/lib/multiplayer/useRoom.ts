// Transport for the room store. Phase 1 ships only the LOCAL transport: a plain
// useReducer, so the hot-seat modes run entirely in-memory and behave exactly
// as before. Phase 2 adds a networked transport (PartyKit) that sends each
// event to the authoritative room and rehydrates from the broadcast snapshot —
// both feed the same reducer in roomState.ts.

import { useReducer } from "react";
import { initialRoom, reducer, type RoomEvent, type RoomState } from "./roomState";

export type Room = {
  state: RoomState;
  dispatch: (e: RoomEvent) => void;
};

export function useRoom(): Room {
  const [state, dispatch] = useReducer(reducer, undefined, initialRoom);
  return { state, dispatch };
}
