# Prompt para o Claude Code — Refatorar o estilo do projeto

> Cole o texto abaixo no Claude Code, com este pacote (`design_handoff_champions_identity/`) dentro do seu projeto.
> Inclua no contexto: `DESIGN_SPEC.md`, `reference/Champions Dream Club.dc.html`, `reference/Pitch.dc.html`, `reference/home-v4.png`, `reference/montar.png`.

---

## 📋 Prompt (copie a partir daqui)

Você vai **refatorar a camada visual (skin) do meu jogo de futebol** ("Role o dado, monte seu clube") para a identidade **"Champions / Road to Glory"**: noite estrelada, azul-marinho profundo, azul elétrico, prata, tipografia esportiva condensada. **Não altere a lógica, as rotas, os dados nem o comportamento** — é só troca de estilo.

### Materiais de referência (leia ANTES de codar)
- `design_handoff_champions_identity/DESIGN_SPEC.md` — especificação completa: tokens de cor, tipografia, espaçamento, sombras, animações e descrição de cada tela.
- `design_handoff_champions_identity/reference/home-v4.png` — **screenshot da home definitiva (a referência canônica)**.
- `design_handoff_champions_identity/reference/montar.png` — **screenshot da tela de montagem de escalação**.
- `design_handoff_champions_identity/reference/Champions Dream Club.dc.html` — protótipo HTML com TODAS as telas (home + montagem + resultado). Referência visual fiel — **recrie no stack do meu projeto**, não copie literalmente.
- `design_handoff_champions_identity/reference/Pitch.dc.html` — componente do campo de futebol.

> ⚠️ O emblema "starball" e o logo oficial da UEFA são marcas registradas. **Não** reproduza o emblema oficial. Use apenas a *linguagem* visual: campo de estrelas, brilho radial azul, raios de luz, estrela de 5 pontas genérica, azul-noite e prata.

### As duas telas-âncora (recriar com alta fidelidade)

**1. Home — `home-v4.png` (layout editorial imersivo).**
Grid de 2 colunas sobre fundo azul-noite com campo de estrelas e marca-d'água "GLORY" gigante (Anton, `rgba(63,118,255,.07)`). Esquerda: eyebrow "A NOITE É NOSSA · CHAMPIONS LEAGUE", H1 em Anton ~92px "Role o dado. / Monte o time / **dos sonhos**" (última linha azul elétrico, com text-shadow dramático), parágrafo em prata-azulado, CTAs ("Jogar agora →" azul gradiente + glow / "Com amigos" contorno + badge dourada "NOVO"), e 3 cards de passo (01 Role / 02 Monte / 03 Simule). Direita: o campo de futebol com a escalação. Header no topo: marca "★ DREAM CLUB UCL" à esquerda, "Perfil" e "Ajustes ▾" à direita.

**2. Montagem da escalação — `montar.png` (3 colunas).**
- **Coluna esquerda (card):** "FORMAÇÃO" — grid 3×3 de chips (4-3-3, 4-4-2, 4-2-3-1, 4-2-4, 3-5-2, 5-3-2, 4-5-1, 3-4-3; selecionado = preenchido azul elétrico). "ESTILO" — segmentado Defensivo / Equilibrado / Ofensivo. "MODO · DIFICULDADE" — segmentado Clássico / De almanaque. Abaixo, caixa de status (tracejada "Role para sortear um clube e uma temporada da Champions" antes de rolar; card do clube sorteado depois) e o botão grande **"Rolar 🎲"** (azul gradiente + glow — **não use o vermelho/laranja antigo**).
- **Coluna central:** campo vertical com **slots de posição**. Antes de rolar: círculos tracejados com a sigla da posição (GOL, LD, ZAG, LE, VOL, MC, MEI, PD, CA, PE). Depois de rolar: tokens preenchidos (número + sobrenome do jogador). **A formação selecionada reposiciona os slots em tempo real.**
- **Coluna direita (card):** "BOX SCORE · 0/11" com legenda Ataque (azul) / Defesa (prata) e uma linha por posição: sigla + duas barras (ataque/defesa) + nome do jogador (ou "—" enquanto não sorteado).
- Acima das colunas: título "MONTE SEU ONZE" (Anton) + a string de config "{formação} · {estilo} · {modo}" à direita.

### Tarefa
1. **Implemente um sistema de tema** a partir do `DESIGN_SPEC.md` (variáveis CSS / tokens) e refatore os componentes para consumi-lo — nada de valores soltos espalhados.
2. **Recrie a home e a tela de montagem** com fidelidade às referências acima.
3. **Adapte todas as outras telas/componentes** (resultado da partida, perfil, ajustes, etc.) à mesma identidade. Para o **resultado**, siga o protótipo (placar "7—0", pílula "Campeão da Europa", lista de gols). O placar final **continua 7–0** — é o desfecho do jogo, não a marca.
4. **Preserve 100% da lógica e do funcionamento.** Esta é uma troca de skin. Não mexa em regras, sorteio, dados de clubes/jogadores, navegação ou estado.
5. **Use o stack e os padrões que já existem no projeto** (framework, biblioteca de UI, convenções de componente). Se algo não existir no protótipo, derive o estilo do mesmo sistema — não invente cores novas; use as do spec (ou gere harmônicas em oklch a partir delas).

### Critérios de aceite
- Home e montagem renderizadas indistinguíveis das referências (fonte, tamanhos, cores, espaçamentos, glow, estrelas, campo, chips, box score).
- Fontes: **Anton**, **Saira Condensed**, **Saira** (Google Fonts).
- Botão primário = azul elétrico com gradiente e glow; segmentados com item ativo azul; chips de formação ativos azuis; badge "NOVO" dourada.
- Slots de posição tracejados antes do sorteio; tokens preenchidos depois; trocar de formação reposiciona os slots.
- Nenhuma regressão funcional. Sem emoji fora os ícones funcionais já usados (🎲, ⚽, 🏆). Sem o emblema oficial da UEFA.

Comece lendo o `DESIGN_SPEC.md` por completo e me apresente um **plano de implementação** (quais arquivos/componentes vai tocar, e como vai estruturar os tokens) **antes** de aplicar as mudanças.
