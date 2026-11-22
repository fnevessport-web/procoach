import { PROFESSORES_META_OCUPACAO, capacidadeDoNivel } from './modalidades'

// Configuração de meta do professor (null = professor pago por aula, o padrão).
export function metaOcupacaoDoProfessor(professorId) {
  return PROFESSORES_META_OCUPACAO[professorId] || null
}

// Ocupação das turmas em que o professor é titular.
// - Vagas: capacidade fixa do produto por nível (Individual 1, grupo 4, Kids 1 8, demais Kids 6).
// - Ocupadas: só alunos MATRICULADOS (turmas_alunos ativo). Reposição e cortesia ficam só na
//   lista de presença de cada aula, nunca na matrícula, então não entram aqui.
// - Turma acima do limite conta no máximo a capacidade (a % nunca passa de 100).
export function calcularOcupacao(turmas = []) {
  const linhas = turmas
    .filter(t => t.ativo !== false && !t.eh_turma_reposicao)
    .map(t => {
      const vagas = capacidadeDoNivel(t.niveis?.nome)
      const inscritos = (t.turmas_alunos || []).filter(v => v.ativo && v.alunos && v.alunos.ativo !== false).length
      return { turma: t, vagas, inscritos, ocupadas: Math.min(inscritos, vagas), livres: Math.max(vagas - inscritos, 0) }
    })
  const vagas = linhas.reduce((s, l) => s + l.vagas, 0)
  const ocupadas = linhas.reduce((s, l) => s + l.ocupadas, 0)
  // Arredonda para baixo: 79,9% ainda não é 80%.
  const pct = vagas ? Math.floor((ocupadas / vagas) * 100) : 0
  return { linhas, vagas, ocupadas, pct }
}

// Faixa atual, próxima faixa e quantos alunos faltam para chegar nela.
export function situacaoDaMeta(meta, { vagas, ocupadas, pct }) {
  const atingidas = meta.faixas.filter(f => pct >= f.min)
  const atual = atingidas[atingidas.length - 1] || null
  const proxima = meta.faixas.find(f => pct < f.min) || null
  const alunosParaProxima = proxima ? Math.max(Math.ceil((proxima.min / 100) * vagas) - ocupadas, 0) : 0
  return { salarioAtual: atual ? atual.valor : meta.base, atual, proxima, alunosParaProxima }
}
