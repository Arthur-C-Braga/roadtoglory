# Plano de Implementação — Multiplayer Online

**Stack:** site na **Vercel** · tempo-real no **PartyKit** (Cloudflare Durable Objects)

## Decisões fixadas (deste briefing)

- **Host controla o "Continuar"** — só ele avança o grupo entre etapas/partidas.
- **Não-host só dá "Pronto"** — botão único; sem controle de fluxo.
- **Gate:** o "Continuar" do host só **habilita quando todos os não-host estão "Pronto"**. Ao continuar, o servidor **zera os "Pronto"** e avança todos juntos.
- **Torneio:** draft compartilhado, **3 picks por turno** (igual ao local de hoje), **todos veem a mesma tela**; revelação **uma partida por vez**, **todos assistem à mesma partida**.

---

## Princípio que guia tudo

A simulação é **determinística por seed** (`simulateMatch`/`simulateTie` em `src/lib/sim.ts`). Logo:

- **Não transmitimos a partida.** Sincronizamos **escalações + `baseSeed`**; cada cliente roda `simulateMatch` local → vê o **mesmo `LiveMatch`**.
- O servidor (sala) é **autoritativo** sobre: dado, travas do draft, turno, seed, e o **gate Pronto→Continuar**.
- O **mesmo código** de regras (`roomState.ts`, `sim.ts`, `data.ts`) roda no **cliente e no worker PartyKit** — sem duplicação.

---

## Infra / dependências

```bash
npm i partykit partysocket
# dev:    npx partykit dev        (worker em 127.0.0.1:1999)
# deploy: npx partykit deploy     → host  rtg.<conta>.partykit.dev
```

- **Vercel:** env `NEXT_PUBLIC_PARTYKIT_HOST=rtg.<conta>.partykit.dev`.
- `partykit.json` na raiz aponta `main: "party/room.ts"`.
- O worker importa de `src/lib/**` (tudo TS puro, sem DOM → roda no edge).

---

## Arquivos novos / tocados

| Arquivo | Papel |
|---|---|
| `partykit.json` | config do worker |
| `party/room.ts` | **servidor da sala** (autoritativo) — usa o reducer + `sim.ts` |
| `src/lib/multiplayer/roomState.ts` | **estado + reducer puros** (compartilhado cliente/servidor) |
| `src/lib/multiplayer/protocol.ts` | tipos das mensagens cliente↔sala |
| `src/lib/multiplayer/useRoom.ts` | hook de transporte (local **ou** networked) |
| `src/components/play/MultiLocalClient.tsx` | refator: passa a consumir o store |
| `src/components/play/MultiOnlineClient.tsx` | lobby + sala online (reusa Pitch/LiveMatch/pool) |
| `src/app/[locale]/multi/online/page.tsx` | rota nova |
| `messages/*`, `globals.css` | rótulos de lobby/pronto/continuar + estilos |

---

## Fase 1 — Extrair o store agnóstico de transporte *(sem online ainda)*

**Objetivo:** tirar a lógica de jogo de dentro do componente e torná-la um **reducer puro**, dirigido por **eventos**. A aleatoriedade vira **payload de evento** (quem é autoritativo a produz). Hot-seat continua idêntico → zero regressão.

`src/lib/multiplayer/roomState.ts`:

```ts
export type RoomState = {
  stage: "lobby" | "setup" | "draft" | "reveal" | "result";
  mode: "single" | "twoleg" | "tourney";
  hostId: string;
  players: { id: string; name: string; teamIdx: number | null; connected: boolean }[];
  teams: TeamCfg[];                                  // tipo movido pra cá
  draft: { turn: number; turnPicks: number; dir: 1 | -1;
           draw: Draw | null; rerolls: number[]; placedIds: string[] };
  baseSeed: number | null;
  queue: Matchup[];
  revealIdx: number;                                 // partida atual da fila
  results: { winner: 0 | 1 }[];                      // bracket do torneio
  ready: string[];                                   // ids prontos (gate)
};

export type Event =
  | { t: "setConfig"; mode; numTeams }               // host
  | { t: "setTeam"; teamIdx; cfg }                   // dono do time
  | { t: "startDraft" }                              // host
  | { t: "draw"; result: Draw }                      // produzido pelo autoritativo
  | { t: "place"; teamIdx; playerId; slot }
  | { t: "movePlaced"; teamIdx; from; to }
  | { t: "advanceDraft" }
  | { t: "beginReveal"; baseSeed; queue }            // autoritativo fixa seed+fila
  | { t: "ready"; playerId } | { t: "unready"; playerId }
  | { t: "continue" };                               // host (gateado)

export function reducer(s: RoomState, e: Event): RoomState { /* puro */ }
// + helpers movidos do componente: fitsAnyOpen, advanceDraft, buildQueue, isFull…
```

`useRoom.ts` (transporte **local** nesta fase):

```ts
function useRoom(): { state: RoomState; dispatch: (e: Event) => void } // local: aplica reducer em memória
```

**Refator do `MultiLocalClient`:** trocar os `useState` espalhados por `const { state, dispatch } = useRoom()`. `rollDie` → produz `{t:"draw"}`; `placeAt` → `{t:"place"}`; etc. **UI intacta.**

**Aceite:** hot-seat (1v1, ida-volta, torneio 4p) funciona **exatamente** como hoje; `npx tsc --noEmit` limpo.

---

## Fase 2 — Servidor PartyKit + Lobby

`party/room.ts` (autoritativo, reusa o reducer):

```ts
export default class RoomServer implements Party.Server {
  state: RoomState = initialRoom();
  onConnect(conn) { /* registra player/spectador; envia "state" */ }
  onMessage(raw, sender) {
    const msg = parse(raw);                          // protocol.ts
    if (!this.authorize(msg, sender)) return;        // turno? host? dono do time?
    const event = this.toEvent(msg, sender);         // ex.: "roll" → faz o sorteio aqui
    this.state = reducer(this.state, event);
    this.party.broadcast(JSON.stringify({ t: "state", state: this.state }));
  }
}
```

- **Snapshot completo** a cada mudança (estado é pequeno → simples e à prova de dessync).
- `useRoom` ganha o transporte **networked** (`partysocket`): envia intenções, recebe `state`.

**Lobby (`MultiOnlineClient`):** criar sala (host gera código) · entrar por código · lista de presença · botão "Pronto". Sem vaga → **espectador**.

**Aceite:** dois navegadores entram na mesma sala e veem a lista sincronizar; reconectar reidrata o estado.

---

## Fase 3 — Setup + Draft online

- **Setup:** host define modo/nº de times (`setConfig`); cada player edita **só o seu** card (`setTeam`, autorizado por `teamIdx`).
- **Draft autoritativo:**
  - `roll`/`reroll` → **servidor** sorteia de `VALID_DRAWS` e emite `{t:"draw"}` (dado justo e único pra todos).
  - `place` → servidor valida **vez** (`sender.teamIdx === draft.turn`), **carta livre** (`placedIds` global), **nome único por time**, **encaixe no slot**; aplica e avança a serpentina (`picksPerTurn = 3` no torneio).
  - Todos enxergam o **campo do time da vez** ao vivo (via `state.teams[].placed`). Só o dono da vez tem os botões ativos.

**Aceite (torneio 4p):** serpentina 1-2-3-4-4-3-2-1, 3 picks/turno, pula time cheio, travas globais respeitadas, todos veem a mesma tela.

---

## Fase 4 — Revelação sincronizada + gate Pronto→Continuar

- Fim do draft → **servidor** fixa `baseSeed` e monta a `queue` (torneio: sorteia **SF1/SF2**; depois **3º** e **Final**) → `{t:"beginReveal"}`, `stage:"reveal"`, `revealIdx:0`.
- **Cada cliente** simula a partida atual **localmente**: `seed = baseSeed + revealIdx*7919` → `simulateMatch`/`simulateTie` → `LiveMatch`. **Todos veem a mesma partida.**
- **Gate (a regra deste MVP):**
  - Não-host vê **"Pronto"** → envia `{t:"ready"}`.
  - Host vê **"Continuar"**, **desabilitado** até `ready ⊇ todos os não-host`.
  - Host `{t:"continue"}` → servidor: **valida que todos prontos**, calcula o **resultado** da partida (roda `simulateMatch` no worker → `winner`, alimenta o bracket do torneio), `revealIdx++` (ou monta 3º/Final), **zera `ready`**, broadcast.
- **Uma partida por vez:** a fila garante SF1 → SF2 → 3º → Final, todos juntos.

**Aceite:** host não avança sem todos prontos; ao avançar, todos pulam pra mesma próxima partida; bracket do torneio progride igual em todas as telas.

---

## Fase 5 — Resultado / Pódio + Revanche

- Servidor computa `standings`; **pódio** idêntico pra todos (reusa o modal de escalação por time já feito).
- Host "Jogar de novo" → `stage` volta a `setup`/`lobby`, estado limpo, **mesma sala**.

---

## Fase 6 — Bordas & polimento

- **Reconexão:** reentrou com o código → recebe `state` e cai onde parou.
- **Saiu no meio:** host escolhe **substituir por CPU** (`autoPickXI`) ou pausar.
- **Espectador:** recebe `state`, sem ações.
- **Erros:** toasts ("não é sua vez", "sala cheia", "host caiu" → migração de host pro próximo conectado).

---

## Ordem de execução e validação

1. **Fase 1** (refator store) — destrava tudo e **já melhora o código** sem online. ✅ via hot-seat + `tsc`.
2. **Fase 2** (sala/lobby) — 2 abas sincronizando.
3. **Fase 3** no **1v1 primeiro** (fila trivial) → depois **torneio 4p**.
4. **Fase 4** (gate Pronto/Continuar) — o coração do seu MVP.
5. **Fases 5–6**.

Cada fase termina com `npx tsc --noEmit` limpo, `partykit dev` + `npm run dev` validados em 2+ navegadores, e **um deploy de teste** (`partykit deploy` + preview Vercel).

**Custo:** Vercel free (site) + PartyKit/Cloudflare DO free tier (salas pequenas, turn-based) → **~R$0**; só o domínio é recorrente.
