// Exportação em CSV/Excel — só escreve planilha a partir de dados nossos (nunca abre
// arquivo enviado por terceiro), então os CVEs conhecidos do pacote xlsx (que são todos
// sobre PARSEAR arquivo malicioso) não se aplicam aqui.
//
// import() dinâmico: a biblioteca só é baixada quando alguém de fato clica em "Excel" —
// ela sozinha adiciona ~100kb (gzip) ao bundle, peso que ninguém que só usa PDF/CSV deveria
// carregar no primeiro acesso ao app.

function baixarArquivo(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function celulaCSV(valor) {
  const texto = String(valor ?? '')
  if (texto.includes(';') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

// Ponto-e-vírgula como separador (não vírgula) porque o Excel em pt-BR usa vírgula como
// separador decimal — abrindo um .csv com vírgula separando campos, qualquer número quebra
// em duas colunas. BOM UTF-8 no início pra acentuação não vir corrompida ao abrir no Excel.
function gerarCSV(linhas) {
  const conteudo = linhas.map(linha => linha.map(celulaCSV).join(';')).join('\r\n')
  return new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
}

async function gerarExcel(linhas, nomeAba) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  const largura = linhas[0]?.map((_, i) => ({
    wch: Math.max(10, ...linhas.map(l => String(l[i] ?? '').length)) + 2,
  })) || []
  ws['!cols'] = largura
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0, 31))
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

// ──────────────────────────────────────────────────────────────────────
// Lista de alunos (presença/falta por aluno) — mesma base de dados do "Exportar Lista em
// PDF" (buscarListaAlunosAtivos), só que em planilha pra quem quer filtrar/somar no Excel.
// ──────────────────────────────────────────────────────────────────────

function linhasListaAlunos(linhas) {
  const cabecalho = ['Aluno', 'Turma', 'Nível', 'Dia da Semana', 'Horário', 'Total de Aulas', 'Presenças', 'Faltas', 'Falta Justificada', '% Frequência']
  const corpo = linhas.map(l => [
    l.nome, l.turma, l.nivel, l.diaSemana, l.horario,
    l.totalAulas, l.presentes, l.faltas, l.faltasJustificadas, `${l.pctFrequencia}%`,
  ])
  return [cabecalho, ...corpo]
}

export function exportarListaAlunosCSV(linhas, { empresa, periodo }) {
  const nomeArquivo = `lista-alunos-${empresa}-${periodo.inicio}-a-${periodo.fim}.csv`
  baixarArquivo(gerarCSV(linhasListaAlunos(linhas)), nomeArquivo)
}

export async function exportarListaAlunosExcel(linhas, { empresa, periodo }) {
  const nomeArquivo = `lista-alunos-${empresa}-${periodo.inicio}-a-${periodo.fim}.xlsx`
  const buffer = await gerarExcel(linhasListaAlunos(linhas), 'Lista de Alunos')
  baixarArquivo(new Blob([buffer], { type: 'application/octet-stream' }), nomeArquivo)
}

// ──────────────────────────────────────────────────────────────────────
// Turmas cadastradas (ativas e desativadas) com vagas preenchidas — pra quem quer ver o
// cadastro inteiro, não só as turmas com problema (diferente da lista de "turmas inativas"
// do relatório, que só mostra quem tem zero aluno ativo).
// ──────────────────────────────────────────────────────────────────────

function linhasTurmas(turmas) {
  const cabecalho = ['Turma', 'Modalidade', 'Dia da Semana', 'Horário', 'Quadra', 'Nível', 'Status', 'Capacidade', 'Alunos Ativos', 'Vagas Livres']
  const corpo = turmas.map(t => [
    t.turma, t.modalidade, t.diaSemana, t.horario, t.quadra, t.nivel,
    t.ativo ? 'Ativa' : 'Desativada', t.capacidade, t.ativos, t.vagasLivres,
  ])
  return [cabecalho, ...corpo]
}

export function exportarTurmasCSV(turmas, { empresa }) {
  const nomeArquivo = `turmas-cadastradas-${empresa}-${new Date().toISOString().slice(0, 10)}.csv`
  baixarArquivo(gerarCSV(linhasTurmas(turmas)), nomeArquivo)
}

export async function exportarTurmasExcel(turmas, { empresa }) {
  const nomeArquivo = `turmas-cadastradas-${empresa}-${new Date().toISOString().slice(0, 10)}.xlsx`
  const buffer = await gerarExcel(linhasTurmas(turmas), 'Turmas Cadastradas')
  baixarArquivo(new Blob([buffer], { type: 'application/octet-stream' }), nomeArquivo)
}
