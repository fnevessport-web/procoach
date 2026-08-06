// Exportação em CSV/Excel — só escreve planilha a partir de dados nossos (nunca abre
// arquivo enviado por terceiro), então os CVEs conhecidos de bibliotecas de planilha (que
// são todos sobre PARSEAR arquivo malicioso) não se aplicam aqui.
//
// import() dinâmico: a biblioteca (exceljs, ~250kb) só é baixada quando alguém de fato clica
// em "Excel" — peso que ninguém que só usa PDF/CSV deveria carregar no primeiro acesso ao app.

const NOME_EMPRESA = { procopio: 'Procopio', beach_arena: 'Beach Arena' }
const LOGO_BEYOND_PRETO = '/images/logobeyond_preto.png'
const LOGO_UNIDADE_PRETO = { procopio: '/images/logoprocopio_preto.png', beach_arena: '/images/logobeacharena_preto.png' }

// Mesma paleta do PDF (relatorioPdf.js) — identidade Beyond/Procópio do relatório exportado,
// intocada pelo redesign "quadra de saibro" por regra do projeto.
const COR_MARINHO = 'FF1B293D'
const COR_SAIBRO = 'FFA54C2E'
const COR_TINTA = 'FF1A1818'
const COR_TEXTO_SUAVE = 'FF6E6A64'
const COR_LINHA_PAR = 'FFF7F5F0'
const COR_BRANCO = 'FFFFFFFF'

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

// Os arquivos de logo são um canvas quadrado 500x500 com a marca centralizada e uma
// margem grande transparente ao redor (mesmo arquivo usado no PDF, que já recorta essa
// margem via carregarLogoAutoCrop em relatorioPdf.js) — sem recortar aqui também, a logo
// no Excel saía minúscula e perdida dentro de um quadrado quase todo vazio. Acha a caixa
// delimitadora do que não é transparente, recorta só isso e desenha já no tamanho final
// (altura fixa, largura pela proporção real da marca — nunca espichada).
async function carregarLogoRecortada(url, alturaAlvo) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Não achou ${url}`)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)

  const amostra = document.createElement('canvas')
  amostra.width = bitmap.width
  amostra.height = bitmap.height
  const actx = amostra.getContext('2d')
  actx.drawImage(bitmap, 0, 0)
  const { data } = actx.getImageData(0, 0, bitmap.width, bitmap.height)

  let minX = bitmap.width, minY = bitmap.height, maxX = 0, maxY = 0
  for (let y = 0; y < bitmap.height; y += 2) {
    for (let x = 0; x < bitmap.width; x += 2) {
      if (data[(y * bitmap.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const sw = Math.max(1, maxX - minX)
  const sh = Math.max(1, maxY - minY)
  const width = (sw / sh) * alturaAlvo

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width)
  canvas.height = Math.round(alturaAlvo)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, minX, minY, sw, sh, 0, 0, canvas.width, canvas.height)
  const buffer = await new Promise((resolve, reject) => {
    canvas.toBlob(async b => {
      if (!b) return reject(new Error('Falha ao gerar PNG da logo'))
      resolve(await b.arrayBuffer())
    }, 'image/png')
  })

  return { buffer, width: canvas.width, height: canvas.height }
}

// Excel usa "unidades de coluna" (≈ nº de caracteres da fonte padrão que cabem), não pixel
// direto — 1 unidade ≈ 7px é a conversão padrão do próprio Excel pra Calibri 11.
function pxParaLarguraColuna(px) {
  return px / 7
}

// Monta uma planilha com a mesma cara do relatório em PDF: lockup Beyond + logo da unidade
// no topo (troca sozinho pra Beach Arena via LOGO_UNIDADE_PRETO), título, período, cabeçalho
// da tabela em azul-marinho com texto branco, linhas zebradas (branco/creme claro) e filtro
// automático habilitado na tabela inteira.
async function montarPlanilhaEstilizada({ titulo, empresa, subtitulo, colunas, linhas, nomeAba }) {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ProCoach'
  const ws = wb.addWorksheet(nomeAba.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 6 }],
  })

  const totalColunas = colunas.length
  ws.mergeCells(1, 1, 3, 2)
  ws.mergeCells(1, 3, 1, totalColunas)
  ws.mergeCells(2, 3, 2, totalColunas)
  ws.mergeCells(3, 3, 3, totalColunas)

  const nomeEmpresa = NOME_EMPRESA[empresa] || empresa
  ws.getCell(1, 3).value = titulo.toUpperCase()
  ws.getCell(1, 3).font = { name: 'Calibri', size: 15, bold: true, color: { argb: COR_SAIBRO } }
  ws.getCell(2, 3).value = nomeEmpresa.toUpperCase()
  ws.getCell(2, 3).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COR_TEXTO_SUAVE } }
  ws.getCell(3, 3).value = subtitulo
  ws.getCell(3, 3).font = { name: 'Calibri', size: 9, color: { argb: COR_TEXTO_SUAVE } }

  ws.getRow(1).height = 20
  ws.getRow(2).height = 16
  ws.getRow(3).height = 16

  // Larguras primeiro, logo depois: as colunas 1 e 2 (onde as duas logos ficam ancoradas)
  // têm largura variável — dependem do maior valor de cada coluna de dado (nome de aluno,
  // modalidade etc.). Ancorar a segunda logo em "coluna 1, início" só fica sem sobrepor a
  // primeira se essa largura já estiver decidida ANTES de posicionar as imagens; fazer na
  // ordem inversa (como antes) deixava as duas logos se encavalando sempre que a coluna 1
  // saía estreita.
  colunas.forEach((nomeCol, i) => {
    const maiorConteudo = Math.max(
      nomeCol.length,
      ...linhas.map(l => String(l[i] ?? '').length),
    )
    ws.getColumn(i + 1).width = Math.min(Math.max(maiorConteudo + 3, 12), 45)
  })

  // Logos — Beyond sempre à esquerda, unidade (Procópio ou Beach Arena, troca sozinho pelo
  // parâmetro `empresa`) logo ao lado, cada uma na proporção real do arquivo (sem espichar).
  // Se algum arquivo não carregar, a planilha sai sem a imagem mas com o resto do layout
  // intacto — nunca quebra a exportação por causa de logo.
  const ALTURA_LOGO_PX = 34
  try {
    const beyond = await carregarLogoRecortada(LOGO_BEYOND_PRETO, ALTURA_LOGO_PX)
    const idBeyond = wb.addImage({ buffer: beyond.buffer, extension: 'png' })
    // Garante que a coluna 1 seja larga o bastante pra logo inteira caber sem estourar
    // pra coluna 2 (onde a segunda logo começa exatamente no início).
    const larguraMinima = pxParaLarguraColuna(beyond.width) + 2
    if (ws.getColumn(1).width < larguraMinima) ws.getColumn(1).width = larguraMinima
    ws.addImage(idBeyond, { tl: { col: 0.1, row: 0.2 }, ext: { width: beyond.width, height: beyond.height } })
  } catch {}
  try {
    const unidade = await carregarLogoRecortada(LOGO_UNIDADE_PRETO[empresa], ALTURA_LOGO_PX)
    const idUnidade = wb.addImage({ buffer: unidade.buffer, extension: 'png' })
    ws.addImage(idUnidade, { tl: { col: 1.05, row: 0.2 }, ext: { width: unidade.width, height: unidade.height } })
  } catch {}

  // Barra colorida (mesma faixa de 4 cores do cabeçalho do PDF), linha 4
  const coresFaixa = ['FFA3BFAE', 'FFC1652F', 'FF6B1B27', COR_MARINHO]
  coresFaixa.forEach((cor, i) => {
    const col = 1 + Math.floor((i * totalColunas) / 4)
    const colFim = 1 + Math.floor(((i + 1) * totalColunas) / 4) - 1
    for (let c = col; c <= colFim; c++) {
      ws.getCell(4, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } }
    }
  })
  ws.getRow(4).height = 4

  // Linha 5 fica em branco (respiro), linha 6 é o cabeçalho de verdade da tabela
  const linhaCabecalho = 6
  const headerRow = ws.getRow(linhaCabecalho)
  colunas.forEach((titulo, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = titulo
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COR_BRANCO } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_MARINHO } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  headerRow.height = 20

  linhas.forEach((linha, i) => {
    const row = ws.getRow(linhaCabecalho + 1 + i)
    linha.forEach((valor, c) => {
      const cell = row.getCell(c + 1)
      cell.value = valor
      cell.font = { name: 'Calibri', size: 10, color: { argb: COR_TINTA } }
      cell.alignment = { vertical: 'middle' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? COR_LINHA_PAR : COR_BRANCO } }
    })
  })

  ws.autoFilter = {
    from: { row: linhaCabecalho, column: 1 },
    to: { row: linhaCabecalho + linhas.length, column: totalColunas },
  }

  return wb.xlsx.writeBuffer()
}

// ──────────────────────────────────────────────────────────────────────
// Lista de alunos (presença/falta por aluno) — mesma base de dados do "Exportar Lista em
// PDF" (buscarListaAlunosAtivos), só que em planilha pra quem quer filtrar/somar no Excel.
// ──────────────────────────────────────────────────────────────────────

const COLUNAS_LISTA_ALUNOS = ['Aluno', 'Turma', 'Nível', 'Dia da Semana', 'Horário', 'Total de Aulas', 'Presenças', 'Faltas', 'Falta Justificada', '% Frequência']

function linhasListaAlunos(linhas) {
  return linhas.map(l => [
    l.nome, l.turma, l.nivel, l.diaSemana, l.horario,
    l.totalAulas, l.presentes, l.faltas, l.faltasJustificadas, `${l.pctFrequencia}%`,
  ])
}

export function exportarListaAlunosCSV(linhas, { empresa, periodo }) {
  const nomeArquivo = `lista-alunos-${empresa}-${periodo.inicio}-a-${periodo.fim}.csv`
  baixarArquivo(gerarCSV([COLUNAS_LISTA_ALUNOS, ...linhasListaAlunos(linhas)]), nomeArquivo)
}

export async function exportarListaAlunosExcel(linhas, { empresa, periodo }) {
  const nomeArquivo = `lista-alunos-${empresa}-${periodo.inicio}-a-${periodo.fim}.xlsx`
  const periodoLabel = `${periodo.inicio.split('-').reverse().join('/')} a ${periodo.fim.split('-').reverse().join('/')}`
  const buffer = await montarPlanilhaEstilizada({
    titulo: 'Lista de Alunos',
    empresa,
    subtitulo: `Período: ${periodoLabel}  ·  ${linhas.length} aluno${linhas.length === 1 ? '' : 's'}`,
    colunas: COLUNAS_LISTA_ALUNOS,
    linhas: linhasListaAlunos(linhas),
    nomeAba: 'Lista de Alunos',
  })
  baixarArquivo(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo)
}

// ──────────────────────────────────────────────────────────────────────
// Turmas cadastradas (ativas e desativadas) com vagas preenchidas — pra quem quer ver o
// cadastro inteiro, não só as turmas com problema (diferente da lista de "turmas inativas"
// do relatório, que só mostra quem tem zero aluno ativo).
// ──────────────────────────────────────────────────────────────────────

// Sem coluna "Turma" (nome bruto tipo "Quarta-feira · 06:00 · Quadra 4 · Avançado") — é só
// a concatenação das colunas abaixo, redundante e atrapalha filtrar por um campo só (ex.:
// filtrar só Dia da Semana = Quarta não isola nada se a informação também está espalhada
// dentro do texto de "Turma"). Modalidade/Dia/Horário/Quadra/Nível já identificam a turma
// sozinhos, cada um filtrável na própria coluna.
const COLUNAS_TURMAS = ['Modalidade', 'Dia da Semana', 'Horário', 'Quadra', 'Nível', 'Status', 'Capacidade', 'Alunos Ativos', 'Vagas Livres']

function linhasTurmas(turmas) {
  return turmas.map(t => [
    t.modalidade, t.diaSemana, t.horario, t.quadra, t.nivel,
    t.ativo ? 'Ativa' : 'Desativada', t.capacidade, t.ativos, t.vagasLivres,
  ])
}

export function exportarTurmasCSV(turmas, { empresa }) {
  const nomeArquivo = `turmas-cadastradas-${empresa}-${new Date().toISOString().slice(0, 10)}.csv`
  baixarArquivo(gerarCSV([COLUNAS_TURMAS, ...linhasTurmas(turmas)]), nomeArquivo)
}

export async function exportarTurmasExcel(turmas, { empresa }) {
  const nomeArquivo = `turmas-cadastradas-${empresa}-${new Date().toISOString().slice(0, 10)}.xlsx`
  const ativas = turmas.filter(t => t.ativo).length
  const buffer = await montarPlanilhaEstilizada({
    titulo: 'Turmas Cadastradas',
    empresa,
    subtitulo: `${turmas.length} turmas  ·  ${ativas} ativas  ·  ${turmas.length - ativas} desativadas  ·  Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    colunas: COLUNAS_TURMAS,
    linhas: linhasTurmas(turmas),
    nomeAba: 'Turmas Cadastradas',
  })
  baixarArquivo(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo)
}
