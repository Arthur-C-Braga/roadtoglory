# 7a0 — clone (estudo)

Clone do jogo 7a0 (Copa dos sonhos) em **Next.js 15 + React 19 + next-intl**, CSS puro.
Projeto de estudo, dados de seleções são gerados (mock).

## Rodar em outra máquina

Pré-requisitos: **Node.js 18+** (testado no 24) e **internet** na primeira instalação
(o `npm install` baixa as dependências e o `next/font` baixa as fontes do Google na
primeira build).

```bash
# 1. instalar dependências (gera node_modules/)
npm install

# 2. rodar em desenvolvimento
npm run dev
# abre em http://localhost:3000  (ou PORT=3210 npm run dev)

# build de produção (opcional)
npm run build
npm start
```

## O que NÃO enviar por e-mail / copiar

Estas pastas são recriadas pelos comandos acima — não copie:

- `node_modules/` — reinstalada por `npm install` (contém binários da plataforma)
- `.next/` — cache de build, recriada por `npm run dev`/`build`

## Estrutura

- `src/app/[locale]/` — rotas (home, play, multi, perfil, privacidade, contestar)
- `src/components/play/` — `PlayClient` (loop), `Pitch`, `Reveal` (simulação ao vivo)
- `src/lib/` — `data.ts` (seleções/formações/elencos), `sim.ts` (motor Poisson + timeline),
  `rng.ts` (PRNG seedado)
- `src/app/globals.css` — design system (temas `panini` claro e `terrace` escuro)
- `src/messages/` — textos pt/en/es (en/es são cópias do pt por enquanto)
