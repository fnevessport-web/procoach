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
--color-accent-live / -on-live                  #C2D461 / #1E2B24   (uso raro: ao vivo, conquistas, badges)
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

- `logoprocoach.png` (`public/images/`) — logo genérico do app, usado hoje em Header/Sidebar/
  splash/telas de auth/legal. **Ainda não foi substituído** pelos novos selos (assets do
  redesign, ver abaixo) — os `<img src="/images/logoprocoach.png">` não foram tocados na Fase 1
  pra não quebrar a imagem visualmente enquanto o arquivo novo não chega.
- Assets novos do redesign (Passo 4 do prompt original, **ainda não existem em `public/`** — o
  cliente fornece os arquivos, o código já está preparado esperando esses nomes exatos):
  - `public/images/logo-pc-cream.png` — selo creme, pra contexto escuro (Header/Sidebar quando
    forem migrados, splash PWA, Login).
  - `public/images/logo-pc-green.png` — selo verde, pra contexto claro (headers de página clara,
    PDFs/documentos que não sejam o relatório Beyond/Procópio).
  - `public/images/logo-pc-saibro.png` — uso pontual (selos, marca d'água, badges).
  - `public/images/login-bg.jpg` — foto da rede na quadra de saibro, fundo do Login.
  - `public/icons/icon-192.png`, `public/icons/icon-512.png` — ícones PWA (já referenciados em
    `public/manifest.json`).
  - `public/favicon.ico` — favicon (já referenciado em `index.html`).
- Logos de unidade (`logoprocopio.png`, `logobeacharena.png`, `logobeyond.png` + versões
  `_preto.png` pra fundo claro) continuam como estão — usados em `SelecionarEmpresaPage`,
  `FinanceiroPage`, PDFs, `EventoInscricaoPage` — não fazem parte deste redesign.

### O que já foi feito (Fase 1) vs. o que falta (Fase 2)

**Feito**: tokens + camada de tema em `src/index.css`, `temaPorRota.js` + `AppLayout.jsx`,
componentes compartilhados (Header, Sidebar via CSS, BottomNav, Modal, Input/Textarea/Select,
Loading/PageLoading/Skeleton/EmptyState, Button, Card, FotoProfessor, InstallBanner,
ModalTurmaAtivada, SinoAlertas), `LoginPage.jsx` redesenhada, `manifest.json`/`index.html`,
`HomePage.jsx` e `RankingPage.jsx` (prova de conceito do contexto escuro), `AulasCoordenador.jsx`
(prova de conceito do contexto claro, maior arquivo do app).

**Falta** (varredura ainda não feita, mesmo padrão de tokens acima se aplica): `DashboardProfessor.jsx`,
`ModalidadePage.jsx`, `FinanceiroPage.jsx`, `MensagensPage.jsx`, `HomeLeitura.jsx` (escuro
restante); `AulasAdmin.jsx`, `AgendaAluno.jsx`, tudo em `cadastros/`, `professor/`,
`disponibilidade/`, `auth/` (exceto Login, já feito), `legal/` (claro restante); sub-componentes
do `AlunoCard.jsx` (incluindo aplicar as 2 ilhas escuras em `BlocoPontuacaoBeyond`/
`ConquistasCard`). Rodar `grep -roE "#[0-9a-fA-F]{3,8}" src --include="*.jsx"` pra ver quanto
ainda falta a qualquer momento.

### Pegadinha do Tailwind v4 a evitar

O parser do `@tailwindcss/vite` faz uma varredura própria em cima do CSS (inclusive dentro de
comentários `/* */`) procurando por coisas que pareçam sintaxe de classe/tema. Um comentário
multi-linha que mencione texto tipo `var(--algo...)` com parênteses **desbalanceados** (ex:
`"sem precisar de arquivo.config.js)."` — um `)` sem `(` correspondente por perto) pode quebrar o
build inteiro com `CssSyntaxError: Missing opening (`, sem apontar a linha certa. Se isso
acontecer depois de editar `src/index.css`: suspeite primeiro de comentários com parênteses
soltos ou menção literal a `@theme`/`var(...)` antes de qualquer outra coisa — bisseccionar o
arquivo (cortar pela metade, testar `npm run build`, repetir) resolve rápido.
