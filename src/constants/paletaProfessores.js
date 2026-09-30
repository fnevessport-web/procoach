// Paleta categórica pra diferenciar N professores lado a lado (grade de disponibilidade,
// Organizar Grade). Os tokens semânticos --color-state-* não servem pra isso (só 6 cores, e cada
// uma já tem significado de status) — ver exceção documentada no CLAUDE.md.
export const PALETA_PROFESSORES = [
  '#f59e0b', '#10b981', '#3b82f6', '#f472b6', '#a78bfa',
  '#22d3ee', '#fb923c', '#84cc16', '#f87171', '#e879f9',
  '#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#4ade80', '#818cf8',
]

// Versão suave (tons terrosos/pastel que conversam com saibro + verde-court), pra telas onde a cor
// do professor ocupa muita área — Organizar Grade usa como bolinha/borda fina, nunca preenchimento forte.
export const PALETA_PROFESSORES_SUAVE = [
  '#8FA89A', '#C9A27E', '#9DB4C0', '#C7A0A8', '#A89CC8', '#B8B07A',
  '#D4A58F', '#7FA7A0', '#B5A18A', '#9FB38A', '#8C9DB5', '#C49A9A',
  '#A7B8A8', '#BFA3C4', '#D1B48C', '#98A6A0',
]
