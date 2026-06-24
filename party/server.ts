// Authoritative room server — a Cloudflare Durable Object via PartyServer.
//
// One DO instance per room code. Holds the single source of truth (RoomState),
// runs the SAME pure reducer the client uses, and broadcasts the full snapshot
// after every accepted event. Presence (join/leave) is server-managed.
//
// Deployed to your own Cloudflare account with Wrangler (workers.dev), so it
// doesn't depend on the shared partykit.dev zone. Client lib stays partysocket.

import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
} from "partyserver";
import {
  reducer,
  initialRoom,
  type RoomEvent,
  type RoomState,
} from "../src/lib/multiplayer/roomState";
import type { ClientToServer, ServerToClient } from "../src/lib/multiplayer/protocol";

type EventName = RoomEvent["t"];

// host-only flow controls
const HOST_ONLY = new Set<EventName>([
  "reset",
  "back",
  "chooseMode",
  "startDraft",
  "beginReveal",
  "setSpeed",
  "startMatch",
  "nextLeg",
  "finishMatchup",
]);
// draft actions, only valid from the player on the clock
const DRAFT_EVENTS = new Set<EventName>(["draw", "place", "movePlaced"]);

export class Room extends Server {
  // keep the DO in memory while connected so roomState survives between
  // messages (no hibernation eviction mid-session)
  static options = { hibernate: false };

  roomState: RoomState = { ...initialRoom(), stage: "lobby" };

  onConnect(conn: Connection, ctx: ConnectionContext) {
    const name = new URL(ctx.request.url).searchParams.get("name") || "Jogador";
    this.applyEvent({ t: "playerJoin", id: conn.id, name });
    // make sure the just-connected client has the snapshot even if it missed
    // the broadcast race
    conn.send(JSON.stringify({ kind: "state", state: this.roomState } satisfies ServerToClient));
  }

  onClose(conn: Connection) {
    this.applyEvent({ t: "playerLeave", id: conn.id });
  }

  onMessage(conn: Connection, message: string | ArrayBuffer | ArrayBufferView) {
    if (typeof message !== "string") return;
    let msg: ClientToServer;
    try {
      msg = JSON.parse(message) as ClientToServer;
    } catch {
      return;
    }
    if (msg.kind !== "event") return;
    const ev = this.authorize(msg.event, conn.id);
    if (ev) this.applyEvent(ev);
  }

  // run the reducer and push the new snapshot to everyone
  private applyEvent(ev: RoomEvent) {
    this.roomState = reducer(this.roomState, ev);
    this.broadcast(
      JSON.stringify({ kind: "state", state: this.roomState } satisfies ServerToClient)
    );
  }

  // gate each client intention by role
  private authorize(ev: RoomEvent, senderId: string): RoomEvent | null {
    // presence is server-managed — clients can't forge it
    if (ev.t === "playerJoin" || ev.t === "playerLeave") return null;
    // you may only toggle your OWN ready flag
    if (ev.t === "setReady") return ev.id === senderId ? ev : null;
    // host-only flow controls
    if (HOST_ONLY.has(ev.t)) return senderId === this.roomState.hostId ? ev : null;
    // draft actions: only the player whose team is on the clock
    if (DRAFT_EVENTS.has(ev.t)) {
      const me = this.roomState.players.find((p) => p.id === senderId);
      return me && me.teamIdx === this.roomState.turn ? ev : null;
    }
    return null;
  }
}

interface Env {
  Room: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env as never)) ??
      new Response("Not found", { status: 404 })
    );
  },
};
