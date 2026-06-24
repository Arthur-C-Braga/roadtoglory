# Design Spec — Identidade "Champions / Road to Glory"

Sistema visual para o jogo de futebol **"Role o dado, monte seu clube dos sonhos"**, inspirado na linguagem da Champions League (noite estrelada, azul-noite, azul elétrico, prata). Elementos **originais** — não usa o emblema oficial da UEFA.

## Sobre os arquivos de referência
Os arquivos em `reference/` são **protótipos em HTML** (Design Components) que mostram o visual e o comportamento pretendidos — **não são código de produção para copiar diretamente**. A tarefa é **recriar esses designs no ambiente já existente do projeto** (React, Vue, etc.), usando os padrões e bibliotecas dele. Se o projeto ainda não tiver um sistema definido, escolha a abordagem mais adequada e implemente os tokens abaixo como tema.

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos e interações são finais. A **home (Variação 3)** deve ser recriada pixel-perfect; as demais telas adaptadas com o mesmo sistema.

---

## Design Tokens

### Cores
| Token | Valor | Uso |
|---|---|---|
| `--bg-deep` | `#05091c` | Fundo base (body) |
| `--bg-radial` | `radial-gradient(120% 90% at 50% -10%, #15336f 0%, #0a1840 38%, #05091c 78%)` | Fundo da página inteira |
| `--navy-1` | `#15336f` | Topo do gradiente / brilho |
| `--navy-2` | `#0a1840` | Meio do gradiente |
| `--blue-electric` | `#3f76ff` | **Accent principal**: CTAs, números, destaques, "—" do placar |
| `--blue-grad` | `linear-gradient(180deg, #3f76ff, #1f4fe0)` | Preenchimento do botão primário |
| `--blue-bright` | `#5d8bff` | Eyebrows, bordas de foco, ring dos tokens de jogador |
| `--blue-soft` | `#9db8ff` | Subtítulos, "dos sonhos" |
| `--blue-paragraph` | `#b3c2e6` | Parágrafo na V3 |
| `--silver` | `#9fb0d8` | Texto de corpo / parágrafos |
| `--silver-muted` | `#8ea3cf` | Labels secundárias, rodapé |
| `--silver-dim` | `#7e93c0` / `#6f84b0` | Texto desativado / nome do rival |
| `--white` | `#fff` | Headlines principais |
| `--white-warm` | `#eaf0ff` | Texto sobre painéis |
| `--white-cool` | `#f3f7ff` | Numerais grandes (Anton) |
| `--gold` | `#d8b65f` | Badge "NOVO", troféu, estrela de campeão |
| `--gold-bright` | `#e8cd84` | Texto "Campeão da Europa" |
| `--star` | `#cfe0ff` (glow `#8fb4ff`) | Estrelas do fundo |
| `--panel-bg` | `rgba(255,255,255,.04)` | Fundo de botões secundários / painéis |
| `--panel-border` | `rgba(150,180,255,.28)` | Bordas de painéis (variações .16 / .22 / .35 / .40 conforme ênfase) |
| `--pitch-grad` | `linear-gradient(160deg, #0d2a18, #0a2114)` | Gramado |
| `--pitch-lines` | `rgba(255,255,255,.16)` | Linhas do campo |
| `--token-grad` | `radial-gradient(circle at 35% 30%, #2a52b8, #0e2356)` | Bolinha do jogador |

### Tipografia
Carregar do Google Fonts:
`https://fonts.googleapis.com/css2?family=Anton&family=Saira:wght@300;400;500;600;700;800;900&family=Saira+Condensed:wght@600;700;800;900&display=swap`

| Família | Uso |
|---|---|
| **Anton** | Numerais gigantes, headlines display, wordmark "Road to Glory", marca-d'água, placar |
| **Saira Condensed** (700/800/900) | Eyebrows, rótulos de botão, labels de passo, "Campeão", formação |
| **Saira** (300–900) | Corpo de texto, UI geral, nomes de jogador, estatísticas |

#### Escala de tipo (valores exatos)
| Elemento | Fonte | Tamanho / line-height | Tracking | Transform | Cor |
|---|---|---|---|---|---|
| Eyebrow | Saira Condensed 800 | 13px | `.22em`–`.24em` | uppercase | `#5d8bff` |
| H1 home V1 | Anton | 74px / .94 | — | uppercase | `#fff` (+ `#9db8ff`) |
| H1 home V2 | Anton | 88px / .9 | — | uppercase | `#fff` |
| H1 home V3 | Anton | 96px / .88 | — | uppercase | `#fff` (+ `#3f76ff`) |
| Wordmark "Road to Glory" V1 | Anton | 70px / .9 | `.01em` | uppercase | `#f3f7ff` (+ `#3f76ff`) |
| Wordmark V2 (2 linhas) | Anton | 104px / .84 | — | uppercase | `#f3f7ff` (+ `#3f76ff`) |
| Marca-d'água "GLORY" V3 | Anton | 240px / .7 | — | uppercase | `rgba(63,118,255,.08)` |
| Placar "7—0" | Anton | 108–150px / .82–.85 | — | — | `#f3f7ff` (traço `#3f76ff`) |
| Parágrafo | Saira 400 | 18–19px / 1.5 | — | — | `#9fb0d8` / `#b3c2e6` |
| Botão (label) | Saira Condensed 800 | 20–22px | `.04em` | uppercase | `#fff` / `#eaf0ff` |
| Número de passo (01/02/03) | Anton | 30px | — | — | `#3f76ff` |
| Nome do jogador | Saira 600 | 11px | — | — | `#eaf0ff` sobre `rgba(5,9,28,.7)` |

### Raio de borda
- Botões: `4px` · Painéis/cards: `5–8px` · Pílulas/badges arredondadas: `100px` · Campo: `10px` · Token do jogador: `50%` · Botão do dado: `18px`

### Sombras e brilhos
- Botão primário: `0 10px 30px rgba(47,109,255,.5)` → hover `0 14px 40px rgba(47,109,255,.75)`
- Campo: `0 24px 60px rgba(0,0,0,.5), inset 0 0 80px rgba(0,0,0,.35)`
- Token do jogador: `0 6px 16px rgba(0,0,0,.5), 0 0 14px rgba(63,118,255,.5)`
- Glow radial do topo: `radial-gradient(closest-side, rgba(63,118,255,.30), transparent 70%)`
- Text-shadow dos numerais: `0 0 40–50px rgba(63,118,255,.45–.6)`

### Espaçamento
- Container principal: `max-width: 1320px` (home/montar), `1100px` (resultado), centralizado, padding lateral `48px`.
- Header: padding `26px 48px`.
- Gap entre colunas (grid home V1): `60px`. Montar: `54px`.

### Animações (keyframes)
| Nome | Definição | Uso |
|---|---|---|
| `floatUp` | `from{opacity:0;translateY(14px)} to{opacity:1;translateY(0)}` — `.5–.7s ease both` | Entrada de seções |
| `twinkle` | `0/100%{opacity:.15} 50%{opacity:.9}` — 3–7s infinite | Estrelas piscando |
| `glowPulse` | `0/100%{opacity:.45} 50%{opacity:.85}` — 5–6s infinite | Brilho radial / conic |
| `spinDie` | rotaciona 360° + scale 1.15 no meio — `.6s ease` | Dado ao rolar |
| `sweep` | `translateX(-120%→120%)` — 2.5s | Brilho varrendo o card sorteado |

---

## Campo de Estrelas (background)
Camada `position:absolute; inset:0; z-index:0` com ~48 estrelas geradas aleatoriamente: cada uma `left/top` em %, tamanho 1–3px, `border-radius:50%`, `background:#cfe0ff`, `box-shadow:0 0 6px #8fb4ff`, opacidade 0.2–0.8, animação `twinkle` com duração/atraso aleatórios. Mais um glow radial elíptico no topo (`1100×700px`, `glowPulse`).

---

## Telas

> **Home definitiva = Variação 4** (`reference/home-v4.png`): estrutura editorial de 2 colunas (V1) com o título imersivo (V3). É o layout canônico do projeto. As demais variações ficam abaixo só como referência histórica.

### 1. Home — Variação 4 (DEFINITIVA) — `reference/home-v4.png`
- **Layout:** grid 2 colunas `max-width:1320px`, padding `30px 48px 70px`, gap `60px`, `align-items:center`. Esquerda = conteúdo; direita = campo vertical (componente Pitch) com a escalação all-time.
- **Fundo:** gradiente radial + campo de estrelas + glow. **Marca-d'água** "GLORY" em Anton ~220px, `rgba(63,118,255,.07)`, `left:40px; top:-10px`, `z-index:0` (conteúdo em `z-index:2`).
- **Conteúdo (esquerda):**
  - Eyebrow: "A NOITE É NOSSA · CHAMPIONS LEAGUE" (`#5d8bff`).
  - H1 Anton ~92px: "Role o dado. / Monte o time / **dos sonhos**" (última linha `#3f76ff`, `text-shadow:0 0 50px rgba(0,0,0,.6)`).
  - Parágrafo (`#b3c2e6`, 18px): "Vários clubes campeões. Uma temporada. Monte seus 11 dos sonhos, entre em campo sob as estrelas e alcance a glória."
  - CTAs: **"Jogar agora →"** (primário azul gradiente + glow) e **"Com amigos"** (secundário contorno + badge dourada "NOVO" rotacionada 6°).
  - **3 cards de passo** (grid 3 colunas, gap 14px, max-width 560px): 01 Role / 02 Monte / 03 Simule — número em Anton 30px `#3f76ff`, título em Saira Condensed 800, descrição em `#8ea3cf`.
- **Header (em todas as telas):** esquerda = marca "★ DREAM CLUB **UCL**"; direita = "Perfil" e "Ajustes ▾" (secundários contorno).

### (histórico) Home — Variação 3 (IMERSIVA)
- **Layout:** seção `max-width:1320px`, `min-height:72vh`, flex centralizado verticalmente, padding `40px 48px 90px`.
- **Fundo:** gradiente radial + campo de estrelas + glow.
- **Marca-d'água:** "GLORY" em Anton 240px, `rgba(63,118,255,.08)`, posicionada `left:48px; top:30px`, `z-index:0`.
- **Campo ao fundo (direita):** componente Pitch, `position:absolute; right:20px; top:50%; translateY(-50%); width:560px; opacity:.72; filter:saturate(.9)`. Mostra a escalação "all-time" (Casillas, Maldini, Van Dijk, Ramos, Carvajal, Kroos, Modrić, Kaká, Vinícius, Benzema, Cristiano) em 4-3-3.
- **Conteúdo (esquerda, z-index:2, max-width:620px):**
  - Eyebrow: "A NOITE É NOSSA · CHAMPIONS LEAGUE" (`#5d8bff`).
  - H1 Anton 96px: "Role o dado. / Monte o time / **dos sonhos**" (última linha em `#3f76ff`).
  - Parágrafo (`#b3c2e6`, 19px): "Um clube campeão, uma temporada lendária e onze craques. Entre em campo sob as estrelas e alcance a glória."
  - CTAs: **"Entrar em campo →"** (primário azul gradiente + glow) e **"Com amigos"** (secundário contorno, com badge dourada "NOVO" rotacionada 6°).
- **Rodapé de estatísticas:** "**19** clubes · **36** elencos · **611** jogadores · _Discorda de alguma avaliação?_" (link em `#5d8bff`).
- **Header (em todas as telas):** esquerda = marca "★ DREAM CLUB **UCL**" (UCL em `#5d8bff`); direita = botões "Perfil" e "Ajustes ▾" (secundários contorno).
- **Switcher de variação** (rodapé central, pílula): só na home — alterna V1/V2/V3/V4. *No app real é opcional; a V4 é a definitiva.*

### Variações alternativas da home (referência histórica)
- **V1 — Editorial:** grid 2 colunas. Esquerda: eyebrow, wordmark "Road to Glory" (Anton 70px), H1 "Role o dado. Monte seu clube dos sonhos", parágrafo, CTAs ("Jogar agora →" / "Com amigos"), e 3 cards de passo (01 Role / 02 Monte / 03 Simule). Direita: campo vertical com a escalação. Mais fiel ao layout original do print.
- **V2 — Central:** wordmark "Road to / Glory" (Anton 104px) dentro de um glow cônico giratório, headline centralizada "Monte seu clube dos sonhos", CTAs, e campo em orientação horizontal (16:10) abaixo.

### 2. Tela "Montagem da escalação" — `reference/montar.png` (3 colunas)
Título "MONTE SEU ONZE" (Anton ~46px) + string de config "{formação} · {estilo} · {modo}" à direita (Saira Condensed, `#9db8ff`). Botão "← Início" acima. Grid `340px 1fr 310px`, gap 32px, `align-items:start`.
- **Coluna esquerda — controles (card `rgba(255,255,255,.03)`, borda `rgba(150,180,255,.22)`, raio 10px):**
  - **FORMAÇÃO** (label Saira Condensed 12px `#5d8bff`): grid 3 colunas de chips — `4-3-3, 4-4-2, 4-2-3-1, 4-2-4, 3-5-2, 5-3-2, 4-5-1, 3-4-3`. Chip ativo = preenchido `#3f76ff`, texto branco, borda azul; inativo = fundo `rgba(255,255,255,.03)`, texto `#cdd9ff`.
  - **ESTILO**: segmentado (borda + padding 4px) Defensivo / Equilibrado / Ofensivo — item ativo `#3f76ff`.
  - **MODO · DIFICULDADE**: segmentado Clássico / De almanaque — ativo `#3f76ff`.
  - **Caixa de status** (abaixo do card): antes de rolar = tracejada `rgba(150,180,255,.3)` "Role para sortear um clube e uma temporada da Champions"; depois = card do clube sorteado (gradiente azul + brilho `sweep`, label "CLUBE SORTEADO", nome Anton 32px, pílula "★ Campeão {temporada}").
  - **Botão primário**: antes = **"Rolar 🎲"** (azul gradiente + glow, 🎲 gira via `spinDie`); depois = **"Simular partida →"** + link secundário "🎲 Sortear outro clube".
- **Coluna central — campo** (`aspect-ratio:3/3.6`, mesmo gramado/marcações do componente Pitch): **slots de posição** posicionados pela formação. Antes de rolar = círculo 44px **tracejado** `rgba(150,180,255,.45)` com a sigla (GOL/LD/ZAG/LE/VOL/MC/MEI/PD/CA/PE) + sigla repetida abaixo em `#7e93c0`. Depois de rolar = token preenchido (número + sobrenome). **Trocar a formação reposiciona os slots em tempo real.**
- **Coluna direita — BOX SCORE (card):** cabeçalho "BOX SCORE · {assigned}/11" + traço dourado. Legenda: Ataque (`#3f76ff`) / Defesa (`#9fb0d8`). Uma linha por posição (na ordem da formação): sigla (Saira Condensed `#cdd9ff`) + duas mini-barras empilhadas (ataque azul / defesa prata, largura conforme rating da posição) + nome do jogador à direita (ou "—" em `#6f84b0` enquanto não sorteado).
- **Ratings por posição** (ataque/defesa %, para as barras): GOL 8/92 · LE·LD 48/68 · ZAG 18/93 · VOL 40/82 · MC 60/60 · MEI·ME·MD 72–80/40–46 · PE·PD 86/32 · CA 92/20.
- **Mapas de formação:** cada formação define 11 posições (sigla + x/y % no campo vertical, ataque no topo). O protótipo traz os 8 mapas em `Champions Dream Club.dc.html` (objeto `this.formations`). Slots e linhas do box score derivam do mesmo mapa, na mesma ordem.
- **Dados dos clubes** (no protótipo): Real Madrid 2016/17, Barcelona 2010/11, Bayern 2019/20, Liverpool 2018/19, Milan 2006/07, Inter 2009/10 — cada um com formação, XI (número, nome, posição x/y%), rival e blurb. *Use os dados reais do seu projeto; a estrutura do card é o que importa.*

### 3. Tela "Resultado"
- `max-width:1100px`, centralizada. Botão "← Refazer escalação".
- Eyebrow "FINAL · CHAMPIONS LEAGUE · {temporada}".
- **Placar:** [Nome do clube + "Seu time"] — **"7—0"** (Anton 108px, traço azul) — [Rival + "Adversário"].
- Pílula dourada "🏆 CAMPEÃO DA EUROPA".
- **Lista de gols:** "GOLS DA PARTIDA" + 7 linhas (minuto em `#3f76ff` · número do jogador em círculo · nome · ⚽ dourada), ordenadas por minuto.
- CTAs: "🎲 Jogar de novo" (primário) e "Início" (secundário).

---

## Componente: Campo (Pitch)
- Wrapper `aspect-ratio: 3/4` (vertical) ou `16/10` (horizontal), raio 10px, gradiente de gramado, borda `rgba(150,180,255,.25)`, sombra + inset.
- Listras do gramado: `repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 9%, transparent 9% 18%)`.
- Marcações (linhas brancas `.16`): borda interna, linha do meio, círculo central 120px, ponto central, duas grandes áreas.
- **Tokens de jogador** (`position:absolute`, `left/top` em % vindos dos dados, `translate(-50%,-50%)`): bolinha 42px com `--token-grad`, borda 2px `#5d8bff`, número em Saira 800 15px branco; abaixo o sobrenome em chip `rgba(5,9,28,.7)`.

---

## Estados / Interações
- **Hover botão primário:** intensifica o glow. **Hover secundário:** borda → `#5d8bff`, fundo → `rgba(63,118,255,.12)`.
- **Navegação:** Home → (Entrar em campo) → Montar → (Rolar dado → Simular partida) → Resultado → (Jogar de novo → Montar | Início → Home).
- **Roll:** sorteia clube aleatório, troca a escalação do campo, anima o dado por ~650ms.
- **Resultado:** gera 7 artilheiros a partir do ataque/meio da escalação, com minutos aleatórios ordenados.

## Assets
Nenhuma imagem externa — tudo é CSS/gradientes/Unicode. Ícones usados: estrela `★`, dado `🎲`, bola `⚽`, troféu `🏆`. Fontes via Google Fonts. **Não** usar o emblema/starball oficial da UEFA.

## Arquivos de referência
- `reference/home-v4.png` — **home definitiva (Variação 4)**.
- `reference/montar.png` — **tela de montagem da escalação**.
- `reference/Champions Dream Club.dc.html` — todas as telas + 4 variações de home.
- `reference/Pitch.dc.html` — componente do campo.
- `reference/variation-3-reference.png` — screenshot da Variação 3 (histórico).
