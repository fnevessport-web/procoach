# CLAUDE.md

Instruções para o Claude Code trabalhando neste repositório (ProCoach — gestão de escola
esportiva. React + Vite + Tailwind v4 + Supabase + Vercel).

## Identidade visual

Redesign "quadra de saibro" (branch `feature/nova-identidade-visual`). Regras abaixo valem pra
qualquer trabalho futuro de UI neste projeto — siga sem precisar reexplicar.

### Paleta

Definida em `src/index.css`, dentro do bloco `@theme`, como variáveis `--color-*` (Tailwind v4
CSS-first já converte isso em classe utilitária automaticamente, ex: `--color-action-primary`
vira `bg-action-primary`/`text-action-primary`; na prática o app usa quase só `style={{}}`
inline, então o uso real é `var(--color-action-primary)`).

```
--color-brand-verde-court   #1E2B24
--color-brand-verde-card    #303C33
--color-brand-saibro        #A54C2E
--color-brand-areia         #F0EAD8
--color-brand-lima          #C2D461

--color-surface-dark-base/-raised/-overlay      #1E2B24 / #303C33 / #3A4840
--color-border-dark / -dark-subtle              #44534A / #38463E
--color-text-dark-primary/-secondary/-muted     #F0EAD8 / #B4BFB6 / #7E8C82

--color-surface-light-base/-raised/-overlay     #F0EAD8 / #F7F3E8 / #FFFFFF
--color-border-light / -light-subtle            #DED5C0 / #E8E0CE
--color-text-light-primary/-secondary/-muted    #1E2B24 / #4A5850 / #8A8577

--color-action-primary/-hover/-active/-on-primary/-disabled   #A54C2E / #8E4126 / #77361F / #FDF8F0 / #A54C2E66
--color-accent-live / -on-live                  #A54C2E / #FDF8F0   (uso raro: ao vivo, conquistas, badges — mesmo tom do saibro)
--color-state-success/-warning/-danger/-info    #4B8B6A / #C98A3C / #B4472F / #3D6B7A

--font-family-sans   'Inter' (corpo, tabelas, labels)
--font-display        'Playfair Display' (títulos, nomes de seção, números-herói — nunca em texto corrido/tabela densa)
```

Nunca usar hex solto em componente novo — sempre `var(--color-...)`. Playfair Display é
carregada via `<link>` no `index.html` (mesmo padrão da Inter), não precisa de `@import` no CSS.

### Contexto claro vs escuro — por tipo de tela, não por empresa

Cada página pertence a um contexto fixo, decidido pelo TIPO de conteúdo (dashboard/análise vs.
operação do dia a dia), nunca pela unidade (Procópio/Beach Arena — a distinção entre unidades é
só o logo/nome, não o tema).

- **Escuro**: Dashboard/Home, Ranking (Pontuação Beyond), Conquistas/gamificação, telas de
  análise/métricas (ex: página de modalidade), Financeiro, Mensagens, Login.
- **Claro**: Agenda/grade de aulas, Cadastros (alunos/professores/turmas/níveis/quadras/eventos),
  ficha do aluno, Match de Aulas, disponibilidade de professores, Reposições, páginas públicas
  (`/disponibilidade/:token`, `/eventos/:slug`), Configurações.
- **Ilhas escuras dentro de página clara**: o card de Pontuação Beyond
  (`BlocoPontuacaoBeyond.jsx`) e o card de Conquistas (`ConquistasCard.jsx`), mesmo aparecendo
  dentro da ficha do aluno (página clara) — mantêm o tratamento escuro que já têm no
  Ranking/Home, envolvidos numa `className="theme-dark"` própria.
- **Intocado**: `src/pages/kpis/**` (relatório mensal completo) e `src/lib/relatorioPdf.js`
  (gerador de PDF) mantêm a identidade Beyond/Procópio de sempre — não redesenhar. Telas que só
  *disparam* a geração de um PDF (ex: botão "Exportar PDF" no Ranking) não são afetadas por essa
  regra — só o conteúdo do PDF em si fica intocado.

### Arquitetura de tema (como aplicar em página nova)

Como o app é quase 100% `style={{}}` inline (não `className` com utilitários Tailwind), a troca
de contexto não usa dark-mode media query nem prop de tema espalhada — usa duas coisas:

1. **Páginas normais** (não compartilhadas): usam os tokens `--color-*-dark-*` OU
   `--color-*-light-*` diretos, conforme o contexto fixo da página (uma página nunca muda de
   contexto em runtime). Ex: `AulasCoordenador.jsx` usa só tokens `-light-*`; `RankingPage.jsx`
   usa só `-dark-*`.
2. **Componentes compartilhados usados nos dois contextos** (Modal, Input/Textarea/Select,
   Loading, Button, Card, FotoProfessor, InstallBanner): usam os **aliases genéricos**
   `var(--surface)`, `var(--surface-raised)`, `var(--surface-overlay)`, `var(--border)`,
   `var(--border-subtle)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)` —
   definidos em `src/index.css` dentro de `.theme-dark { ... }` / `.theme-light { ... }`, que
   redirecionam esses nomes genéricos pros tokens `-dark-*`/`-light-*` de verdade. `AppLayout.jsx`
   aplica a classe certa no `<main>` com base na rota atual, via `src/constants/temaPorRota.js`
   (`temaDaRota(pathname)` — só lista os prefixos de rota do contexto escuro; qualquer rota fora
   da lista cai em claro por padrão).
   - **Componentes que usam `createPortal(..., document.body)` (ex: `Modal.jsx`) precisam
     resolver o tema sozinhos** (`useLocation()` + `temaDaRota()`, aplicando a classe no próprio
     wrapper do portal) — um portal escapa da árvore DOM do `<main class="theme-x">`, então não
     herda a classe/variáveis por cascata normal mesmo que logicamente esteja "dentro" de uma
     página com tema definido.
3. **Chrome fixo do app** (`Header.jsx`, `Sidebar.jsx`, `BottomNav.jsx`, `SinoAlertas.jsx`): fica
   sempre escuro, tokens `-dark-*` diretos, independente da página carregada — não faz parte da
   troca de contexto (é a barra de navegação, não conteúdo).

### Mapeamento de cores de status (não quebrar reconhecimento)

`CORES_SEMAFORO` (`src/constants/semaforo.js`) é o ponto central de "bom/atenção/crítico/info",
mas o resto do app (principalmente `AulasCoordenador.jsx`) historicamente repetia os hex
antigos direto (`#22c55e`/`#fcc825`/`#EF4444`/`#3b82f6`) sem importar a constante. Ao mexer em
código antigo que ainda tiver esses hex, o mapeamento 1:1 por significado é:

| Significado antigo | Hex antigo | Token novo |
|---|---|---|
| bom / presente / confirmada / sucesso | `#22c55e`, `#1D9E75`, `#16a34a` | `--color-state-success` |
| atenção / falta justificada / aviso | `#fcc825` (quando usado como aviso, não marca), `#f97316`, `#f59e0b`, `#e0a856` | `--color-state-warning` |
| crítico / falta / erro / sem aula | `#EF4444`, `#ef4444`, `#e24b4a`, `#dc2626` | `--color-state-danger` |
| info / cancelada / reposição / feriado (roxo antigo) | `#3b82f6`, `#22d3ee`, `#a855f7`, `#168,85,247` | `--color-state-info` |
| marca / ação / destaque / selecionado | `#fcc825` (marca), `linear-gradient(135deg, #fcc825, #cf1b9b)` | `--color-action-primary` (sólido — nunca recriar o gradiente amarelo→magenta antigo) |
| "ao vivo" (indicador de aula rolando agora) | `#e24b4a` só nesse uso específico | `--color-accent-live` |

`COR_VAGA`/`CORES_CLUBE` (`src/constants/coresClube.js`, só usado em `EventoInscricaoPage.jsx`)
é uma paleta à parte, intencionalmente desacoplada — não mexer, já documentado no próprio
arquivo. `NIVEIS_ASSIDUIDADE`/`corNivel()` (`src/lib/pontuacaoBeyond.js`) também fica como está
— compartilhado com o PDF de evolução técnica (fora do escopo do redesign).

### Logos

- `public/images/logo-pc-cream.png` — selo creme, contexto escuro. Usado em `Header.jsx`,
  `Sidebar.jsx`, `PageLoading` (`components/ui/Loading.jsx`) — chrome/splash, sempre escuro — e
  no PDF de "Grade de Aulas" gerado inline em `AulasCoordenador.jsx` (fundo do PDF é escuro,
  `COR_FUNDO`/`COR_TEXTO` locais àquela função).
- `public/images/logo-pc-green.png` — selo verde, contexto claro. Usado nas telas de
  auth/legal que ficam fora do `AppLayout` (`EsqueciSenha`, `TrocarSenha`,
  `SelecionarEmpresaPage`, `PoliticaPrivacidadePage`, `ComoFuncionaAPontuacaoPage`,
  `ComoFuncionaORankingPage`) — todas full-page standalone, sem wrapper `.theme-x` herdado, por
  isso usam os tokens `-light-*` diretos (mesma lógica de "páginas normais").
- `public/images/logo-pc-saibro.png` — ainda sem uso definido no código (uso pontual futuro:
  selos, marca d'água, badges).
- `public/images/login-bg.png` — fundo do Login (nota: extensão real é `.png`, não `.jpg` como o
  prompt original previa — `LoginPage.jsx` aponta pro nome real).
- `public/images/icon-192.png`, `public/images/icon-512.png` — ícones PWA, referenciados em
  `public/manifest.json` (ficaram em `public/images/`, não `public/icons/` como o plano original
  prévia — path ajustado pro que o cliente entregou).
- `public/images/favicon.png` — favicon, referenciado em `index.html` como
  `<link rel="icon" type="image/png">` (não é mais `.ico` — arquivo entregue é PNG).
- `logoprocoach.png` (`public/images/`) — logo antiga, **não é mais referenciada em lugar
  nenhum** do app (substituída pelos selos acima); o arquivo físico não foi apagado (pode ficar
  ou ser removido, sem impacto).
- Logos de unidade (`logoprocopio.png`, `logobeacharena.png`, `logobeyond.png` + versões
  `_preto.png` pra fundo claro) continuam como estão — usados em `SelecionarEmpresaPage`,
  `FinanceiroPage`, PDFs, `EventoInscricaoPage` — não fazem parte deste redesign.

### Status: Fase 1 + Fase 2 completas

Toda a varredura de hex→token das ~60 páginas/componentes foi concluída (`grep -roE
"#[0-9a-fA-F]{3,8}" src --include="*.jsx"` só retorna as exceções abaixo, todas intencionais):

- `src/pages/kpis/**` e `src/lib/relatorioPdf.js` — intocados por regra explícita (identidade
  Beyond/Procópio do relatório mensal).
- `src/constants/coresClube.js`, `src/lib/pontuacaoBeyond.js` (`NIVEIS_ASSIDUIDADE`),
  `src/lib/pcScore.js` (`NIVEIS_PC_SCORE`) — paletas compartilhadas com o PDF ou documentadas
  como à parte; qualquer tela que só **referencia** essas constantes (`n.cor`, `corNivel()`)
  também fica intocada nesse ponto específico, mesmo já estando no contexto novo.
- `src/pages/legal/ComoFuncionaORankingPage.jsx` — `COR_VITORIA`/`COR_DERROTA`/
  `COR_VITORIA_TORNEIO`/`COR_DERROTA_TORNEIO` ficam de propósito iguais às cores do PDF de
  regras (comentário no próprio arquivo explica o motivo).
- `src/pages/cadastros/GradeDisponibilidade.jsx` — `PALETA` (16 tons) é uma escala categórica
  pra diferenciar N professores, papel diferente dos tokens semânticos `--color-state-*`.
- Verde do WhatsApp (`#25D166`/`rgba(37,211,102,...)`) — cor de marca de terceiro, não do
  ProCoach.
- `src/components/ui/Badge.jsx`, `src/components/ui/SearchBar.jsx` — confirmados sem nenhum
  import em uso no app (componentes mortos); não retematizados por não fazerem parte de nenhuma
  tela real.

Ilhas escuras (`BlocoPontuacaoBeyond.jsx`, `ConquistasCard.jsx`) recebem `className="theme-dark"`
no próprio wrapper e usam tokens `-dark-*` diretos. Os dois sub-componentes realmente
dual-contexto que moram dentro de `ConquistasCard.jsx` (`IconeConquista`, `FileiraConquistas` —
usados também direto em `EvolucaoTecnicaTenis.jsx`, que é Claro) usam os **aliases genéricos**
(`var(--surface)`, `var(--text-secondary)`), não tokens diretos, senão ficam ilegíveis fora da
ilha. Os modais de `ConquistasCard.jsx` (`ModalDetalheConquista`, `ModalCatalogo`) precisaram de
um ajuste na própria `Modal.jsx`: ela normalmente resolve tema pela rota atual
(`temaDaRota(pathname)`), o que quebraria ao abrir um modal sempre-escuro a partir de uma página
Clara (a ficha do aluno) — por isso `Modal.jsx` agora aceita uma prop opcional `theme` que, se
passada, sobrepõe a resolução por rota; `ConquistasCard.jsx` passa `theme="theme-dark"` nos dois
modais. Todo outro uso de `Modal` (20+ call sites) continua sem essa prop e se comporta como
antes.

`ModalDetalhesDia` (definido em `ProfessoresPage.jsx`, usado só por `DashboardProfessor.jsx`) usa
tokens `-dark-*` diretos com um comentário explicando o porquê, como planejado.

### Pegadinha do Tailwind v4 a evitar

O parser do `@tailwindcss/vite` faz uma varredura própria em cima do CSS (inclusive dentro de
comentários `/* */`) procurando por coisas que pareçam sintaxe de classe/tema. Um comentário
multi-linha que mencione texto tipo `var(--algo...)` com parênteses **desbalanceados** (ex:
`"sem precisar de arquivo.config.js)."` — um `)` sem `(` correspondente por perto) pode quebrar o
build inteiro com `CssSyntaxError: Missing opening (`, sem apontar a linha certa. Se isso
acontecer depois de editar `src/index.css`: suspeite primeiro de comentários com parênteses
soltos ou menção literal a `@theme`/`var(...)` antes de qualquer outra coisa — bisseccionar o
arquivo (cortar pela metade, testar `npm run build`, repetir) resolve rápido.
