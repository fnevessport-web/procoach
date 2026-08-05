// Contexto visual (claro/escuro) por rota — ver CLAUDE.md "Identidade visual" pra regra
// completa de qual tipo de tela usa qual contexto. Só lista os prefixos de rota do contexto
// escuro (dashboard, análise, gamificação, financeiro, mensagens); qualquer rota fora dessa
// lista cai em claro por padrão — inclusive /kpis e /relatorios-leitura, que usam a própria
// identidade Beyond/Procópio e não são retematizadas por este mecanismo (a classe .theme-light
// aplicada ali é inofensiva: só declara variáveis CSS que essas páginas não consomem).
const PREFIXOS_ESCUROS = [
  '/',
  '/modalidade',
  '/dashboard-professor',
  '/ranking',
  '/financeiro',
  '/meu-financeiro',
  '/mensagens',
]

export function temaDaRota(pathname) {
  const escuro = PREFIXOS_ESCUROS.some(prefixo =>
    prefixo === '/' ? pathname === '/' : pathname === prefixo || pathname.startsWith(prefixo + '/')
  )
  return escuro ? 'theme-dark' : 'theme-light'
}
