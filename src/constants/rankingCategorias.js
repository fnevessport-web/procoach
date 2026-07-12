// Colapso dos níveis de turma (mais granulares, tabela `niveis`) nas 3 categorias adultas do
// ranking (tabela `ranking_categorias`) — mesma ideia de PESOS_POR_MODALIDADE em pcScore.js:
// config isolada por modalidade, fácil de estender (ex.: categorias equivalentes pra Kids,
// dentro da faixa etária deles) sem mexer na lógica de cálculo.
const CATEGORIA_POR_NIVEL_TENIS = {
  'Iniciante 1': 'Iniciante',
  'Iniciante 2': 'Iniciante',
  'Intermediário 1': 'Intermediário',
  'Intermediário 2': 'Intermediário',
  'Avançado': 'Avançado',
}

const CATEGORIA_POR_NIVEL_POR_MODALIDADE = {
  'Tênis': CATEGORIA_POR_NIVEL_TENIS,
}

// Retorna o nome da categoria do ranking (Iniciante/Intermediário/Avançado) a partir do nível
// de turma do aluno, ou null se o nível não mapeia pra nenhuma categoria adulta (Kids, Damas,
// Senior, Individual etc.) — esses alunos ficam de fora do ranking por enquanto.
export function nomeCategoriaPorNivel(nivelNome, modalidadeNome) {
  return CATEGORIA_POR_NIVEL_POR_MODALIDADE[modalidadeNome]?.[nivelNome] || null
}

// Ciclo de 3 meses alinhado ao trimestre do calendário (mesmo período do corte de categoria
// e do ciclo de reavaliação técnica — REAVALIACAO_PRAZO_DIAS em pcScore.js). Ex.: '2026-T3'.
export function cicloAtual(dataReferencia) {
  const d = dataReferencia
    ? (typeof dataReferencia === 'string' ? new Date(dataReferencia + 'T12:00') : dataReferencia)
    : new Date()
  const trimestre = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-T${trimestre}`
}
