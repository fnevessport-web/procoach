import { format } from 'date-fns'

const COR_CREME = [241, 239, 234]
const COR_TINTA = [26, 24, 24]
const COR_SALVIA = [163, 191, 174]
const COR_LARANJA = [193, 101, 47]
const COR_VINHO = [107, 27, 39]
const COR_MARINHO = [27, 41, 61]
const COR_TEXTO_SUAVE = [110, 106, 100]
const COR_BRANCO = [255, 255, 255]
const COR_VERDE = [34, 130, 82]
const COR_VERMELHO = [176, 54, 54]
const CORES_CHIP = [COR_SALVIA, COR_LARANJA, COR_VINHO, COR_MARINHO]

const NOME_EMPRESA = { procopio: 'Procópio Arena', beach_arena: 'Beach Arena' }
// Versões pretas das marcas, pensadas pra página clara do relatório (fundo creme) — o
// cabeçalho é um lockup minimalista: logo do clube (BEYOND) + linha fina + logo da unidade,
// lado a lado, sem selo/fundo.
const LOGO_BEYOND_PRETO = '/images/logobeyond_preto.png'
const LOGO_UNIDADE_PRETO = { procopio: '/images/logoprocopio_preto.png', beach_arena: '/images/logobeacharena_preto.png' }
// Capa (página 0) — arte pronta em PDF (A4), pré-renderizada em JPEG uma única vez (ver
// scripts de geração) porque jsPDF não consegue embutir um PDF externo como página, só imagem.
const CAPA_EMPRESA = { procopio: '/images/capa-relatorio-procopio.jpg', beach_arena: '/images/capa-relatorio-beach-arena.jpg' }
const ICONES_EMPRESA = {
  procopio: ['/images/tenis.png', '/images/padel.png', '/images/squash.png', '/images/pickleball.png'],
  beach_arena: ['/images/beachtennis.png', '/images/futevolei.png', '/images/voleidepraia.png'],
}
const ROTULO_DIA = { segunda: 'SEG', terca: 'TER', quarta: 'QUA', quinta: 'QUI', sexta: 'SEX', sabado: 'SAB', domingo: 'DOM' }

function rotuloTipo(tipo) {
  const rotulos = { mensalista: 'Mensalista', reposicao: 'Reposição', avulso: 'Avulso', cortesia: 'Cortesia' }
  return rotulos[tipo] || tipo
}

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Os PNGs de origem (logo, textura, capa) são de alta resolução — pra não gerar um PDF
// gigante, redimensiona no canvas antes de embutir (textura/capa viram JPEG, mais leve
// pra imagem fotográfica; logo/ícone continuam PNG pra preservar a transparência).
async function carregarImagemRedimensionada(url, maxLado, formato = 'image/png', qualidade = 0.85) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  try {
    const bitmap = await createImageBitmap(blob)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * escala))
    const h = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    if (canvas.convertToBlob) {
      const outBlob = await canvas.convertToBlob({ type: formato, quality: qualidade })
      return await blobParaDataUrl(outBlob)
    }
    return canvas.toDataURL(formato, qualidade)
  } catch {
    return await blobParaDataUrl(blob)
  }
}

async function carregarBitmap(url) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  return createImageBitmap(blob)
}

function interpolarCor(c1, c2, t) {
  return c1.map((v, i) => Math.round(v + (c2[i] - v) * t))
}

// As logos pretas (logobeyond_preto.png etc.) vêm num canvas quadrado com bastante margem
// transparente ao redor do desenho, e cada uma numa proporção bem diferente (BEYOND é um
// wordmark bem largo e baixo; Procópio e Beach Arena são ícone+texto empilhados, mais altos
// que largos). Em vez de um recorte fixo por fração, acha de verdade a caixa do que não é
// transparente (via getImageData) e recorta só nela — assim cada logo entra no lockup do
// cabeçalho do tamanho relativo certo, sem sobrar moldura vazia nem distorcer nada.
async function carregarLogoAutoCrop(url, maxLado) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)

  const amostra = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bitmap.width, bitmap.height) : document.createElement('canvas')
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
  const escala = Math.min(1, maxLado / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * escala))
  const h = Math.max(1, Math.round(sh * escala))
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, minX, minY, sw, sh, 0, 0, w, h)
  const dataUrl = canvas.convertToBlob
    ? await blobParaDataUrl(await canvas.convertToBlob({ type: 'image/png' }))
    : canvas.toDataURL('image/png')
  return { dataUrl, aspecto: sw / sh }
}

// Desenha o lockup BEYOND | logo da unidade a partir da margem esquerda, alinhado verticalmente
// no meio da altura reservada, e devolve o X onde o texto do título deve começar.
function desenharLockupLogos(doc, { logoBeyond, logoUnidade, x, yTopo, altura, corLinha }) {
  let cursorX = x
  if (logoBeyond) {
    const w = altura * logoBeyond.aspecto
    try { doc.addImage(logoBeyond.dataUrl, 'PNG', cursorX, yTopo, w, altura) } catch {}
    cursorX += w
  }
  if (logoBeyond && logoUnidade) {
    cursorX += 12
    doc.setDrawColor(...corLinha)
    doc.setLineWidth(0.6)
    doc.line(cursorX, yTopo - 2, cursorX, yTopo + altura + 2)
    cursorX += 12
  }
  if (logoUnidade) {
    const w = altura * logoUnidade.aspecto
    try { doc.addImage(logoUnidade.dataUrl, 'PNG', cursorX, yTopo, w, altura) } catch {}
    cursorX += w
  }
  return cursorX + 16
}

function rgb(cor) { return `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})` }

function slugificar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function corRisco(texto) {
  if (texto.includes('Risco alto')) return { color: rgb(COR_VERMELHO), fontWeight: '700' }
  if (texto.includes('Atenção')) return { color: rgb(COR_LARANJA) }
  return {}
}

// ============================================================================================
// PDF — relatório completo (capa + resumo executivo + mapa de calor de cada modalidade em
// escopo + presença por aluno), tudo num documento só por unidade.
// ============================================================================================
export async function exportarRelatorioCompletoPDF(dados, { empresa }) {
  const { resumo, heatmaps, presenca, periodo } = dados
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40

  let texturaBase64 = null
  let capaBase64 = null
  let logoBeyond = null
  let logoUnidade = null
  const iconesBase64 = []
  try { texturaBase64 = await carregarImagemRedimensionada('/images/bg-texture.png', 900, 'image/jpeg', 0.5) } catch {}
  try { capaBase64 = await carregarImagemRedimensionada(CAPA_EMPRESA[empresa], 1600, 'image/jpeg', 0.9) } catch {}
  try { logoBeyond = await carregarLogoAutoCrop(LOGO_BEYOND_PRETO, 260) } catch {}
  try { logoUnidade = await carregarLogoAutoCrop(LOGO_UNIDADE_PRETO[empresa], 260) } catch {}
  for (const src of ICONES_EMPRESA[empresa] || []) {
    try { iconesBase64.push(await carregarImagemRedimensionada(src, 64, 'image/png')) } catch {}
  }
  let temFonteDestaque = false
  try {
    const respFonte = await fetch('/fonts/Anton-Regular.ttf')
    const blobFonte = await respFonte.blob()
    const dataUrlFonte = await blobParaDataUrl(blobFonte)
    doc.addFileToVFS('Anton-Regular.ttf', dataUrlFonte.split(',')[1])
    doc.addFont('Anton-Regular.ttf', 'Anton', 'normal')
    temFonteDestaque = true
  } catch {}

  function fonteDestaque(tamanho) {
    doc.setFontSize(tamanho)
    if (temFonteDestaque) doc.setFont('Anton', 'normal')
    else doc.setFont('helvetica', 'bold')
  }
  function fontePadrao(estilo, tamanho) {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }

  const nomeEmpresa = NOME_EMPRESA[empresa] || empresa
  const periodoLabel = `${format(new Date(periodo.inicio + 'T12:00'), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim + 'T12:00'), 'dd/MM/yyyy')}`
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  const paginasComFundoClaro = new Set()
  function pintarFundo() {
    const n = doc.internal.getCurrentPageInfo().pageNumber
    if (paginasComFundoClaro.has(n)) return
    paginasComFundoClaro.add(n)
    doc.setFillColor(...COR_CREME)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    if (texturaBase64) {
      try {
        doc.saveGraphicsState()
        doc.setGState(new doc.GState({ opacity: 0.45 }))
        doc.addImage(texturaBase64, 'JPEG', 0, 0, pageWidth, pageHeight)
        doc.restoreGraphicsState()
      } catch {}
    }
  }

  // ---------- Página 0: capa (arte pronta) + data/hora do relatório, minimalista no rodapé ----------
  if (capaBase64) {
    try {
      doc.addImage(capaBase64, 'JPEG', 0, 0, pageWidth, pageHeight)
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.85 }))
      fontePadrao('normal', 8)
      doc.setTextColor(...COR_BRANCO)
      doc.text(`Relatório gerado em ${geradoEm}`, pageWidth - margem, pageHeight - 18, { align: 'right' })
      doc.restoreGraphicsState()
    } catch {}
    doc.addPage()
  }

  let cursorY = margem

  function cabecalho(titulo) {
    const alturaLogo = 22
    const yTopoLogo = 22
    const textoX = desenharLockupLogos(doc, { logoBeyond, logoUnidade, x: margem, yTopo: yTopoLogo, altura: alturaLogo, corLinha: COR_TEXTO_SUAVE })
    const cyTexto = yTopoLogo + alturaLogo / 2
    fontePadrao('bold', 15)
    doc.setTextColor(...COR_TINTA)
    doc.text(titulo, textoX, cyTexto - 3)
    fontePadrao('italic', 10)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(nomeEmpresa.toUpperCase(), textoX, cyTexto + 11)

    fontePadrao('normal', 7.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 26, { align: 'right' })
    doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 37, { align: 'right' })

    const iconeTam = 15
    let iconeX = pageWidth - margem - iconeTam
    iconesBase64.forEach(b64 => {
      try { doc.addImage(b64, 'PNG', iconeX, 46, iconeTam, iconeTam) } catch {}
      iconeX -= iconeTam + 6
    })

    const faixaY = 70
    const faixaW = (pageWidth - margem * 2) / 4
    CORES_CHIP.forEach((cor, i) => {
      doc.setFillColor(...cor)
      doc.rect(margem + i * faixaW, faixaY, faixaW - 3, 4, 'F')
    })
    return faixaY + 26
  }

  function novaPagina() {
    doc.addPage()
    pintarFundo()
    cursorY = cabecalho('RELATÓRIO EXECUTIVO')
  }

  function garantirEspaco(altura) {
    if (cursorY + altura > pageHeight - 50) novaPagina()
  }

  pintarFundo()
  cursorY = cabecalho('RELATÓRIO EXECUTIVO')

  function tituloSecao(texto) {
    garantirEspaco(30)
    fontePadrao('bold', 11)
    doc.setTextColor(...COR_TINTA)
    doc.text(texto.toUpperCase(), margem, cursorY)
    doc.setDrawColor(...COR_TEXTO_SUAVE)
    doc.setLineWidth(0.5)
    doc.line(margem, cursorY + 5, pageWidth - margem, cursorY + 5)
    cursorY += 24
  }

  function desenharChips(itens, porLinha) {
    const gap = 10
    const larguraTotal = pageWidth - margem * 2
    const larguraChip = (larguraTotal - gap * (porLinha - 1)) / porLinha
    const alturaChip = 64
    const linhas = Math.ceil(itens.length / porLinha)
    garantirEspaco(linhas * (alturaChip + gap))
    itens.forEach((item, i) => {
      const col = i % porLinha
      const row = Math.floor(i / porLinha)
      const x = margem + col * (larguraChip + gap)
      const y = cursorY + row * (alturaChip + gap)
      doc.setFillColor(...CORES_CHIP[i % CORES_CHIP.length])
      doc.roundedRect(x, y, larguraChip, alturaChip, 8, 8, 'F')
      fonteDestaque(23)
      doc.setTextColor(...COR_BRANCO)
      doc.text(String(item.valor), x + 12, y + 38)
      fontePadrao('normal', 8)
      doc.text(item.label.toUpperCase(), x + 12, y + 53, { maxWidth: larguraChip - 20 })
    })
    cursorY += linhas * (alturaChip + gap) + 12
  }

  function blocoDestaque(label, valor, cor) {
    const altura = 46
    garantirEspaco(altura + 10)
    doc.setFillColor(...COR_BRANCO)
    doc.roundedRect(margem, cursorY, pageWidth - margem * 2, altura, 8, 8, 'F')
    doc.setDrawColor(215, 210, 200)
    doc.roundedRect(margem, cursorY, pageWidth - margem * 2, altura, 8, 8, 'S')
    fontePadrao('normal', 10.5)
    doc.setTextColor(...COR_TINTA)
    doc.text(label, margem + 14, cursorY + altura / 2 + 3)
    fonteDestaque(22)
    doc.setTextColor(...cor)
    doc.text(String(valor), pageWidth - margem - 14, cursorY + altura / 2 + 6, { align: 'right' })
    cursorY += altura + 14
  }

  function barrasHorizontais(itens, corBarra) {
    const alturaBarra = 15
    const gap = 12
    garantirEspaco(itens.length * (alturaBarra + gap))
    const maxValor = Math.max(...itens.map(i => i.total), 1)
    const larguraMax = pageWidth - margem * 2 - 46
    itens.forEach((item, i) => {
      const y = cursorY + i * (alturaBarra + gap)
      fontePadrao('normal', 8.5)
      doc.setTextColor(...COR_TINTA)
      doc.text(item.nome, margem, y - 3)
      doc.setFillColor(230, 227, 220)
      doc.roundedRect(margem, y, larguraMax, alturaBarra, 3, 3, 'F')
      const largura = Math.max((item.total / maxValor) * larguraMax, 4)
      doc.setFillColor(...corBarra)
      doc.roundedRect(margem, y, largura, alturaBarra, 3, 3, 'F')
      fontePadrao('bold', 8.5)
      doc.setTextColor(...COR_TINTA)
      doc.text(String(item.total), margem + larguraMax + 8, y + 11)
    })
    cursorY += itens.length * (alturaBarra + gap) + 6
  }

  function tabelaEstilizada(head, body) {
    garantirEspaco(60)
    autoTable(doc, {
      startY: cursorY,
      head, body,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 6, valign: 'middle', textColor: COR_TINTA, lineColor: [215, 210, 200], lineWidth: 0.5 },
      headStyles: { fillColor: COR_MARINHO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 247, 243] },
      margin: { left: margem, right: margem },
      willDrawPage: pintarFundo,
    })
    cursorY = doc.lastAutoTable.finalY + 20
  }

  function linhaComparativo(label, atual, anterior, variacao) {
    const altura = 36
    garantirEspaco(altura + 8)
    doc.setFillColor(...COR_BRANCO)
    doc.roundedRect(margem, cursorY, pageWidth - margem * 2, altura, 6, 6, 'F')
    doc.setDrawColor(215, 210, 200)
    doc.roundedRect(margem, cursorY, pageWidth - margem * 2, altura, 6, 6, 'S')
    fontePadrao('bold', 9.5)
    doc.setTextColor(...COR_TINTA)
    doc.text(label, margem + 12, cursorY + 15)
    fontePadrao('normal', 8)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`${atual} vs ${anterior} no mês anterior`, margem + 12, cursorY + 27)
    if (variacao !== null) {
      const positivo = variacao >= 0
      const cor = positivo ? COR_VERDE : COR_VERMELHO
      const tx = pageWidth - margem - 58
      const ty = cursorY + altura / 2
      doc.setFillColor(...cor)
      if (positivo) doc.triangle(tx, ty + 4, tx + 8, ty + 4, tx + 4, ty - 5, 'F')
      else doc.triangle(tx, ty - 4, tx + 8, ty - 4, tx + 4, ty + 5, 'F')
      fontePadrao('bold', 11)
      doc.setTextColor(...cor)
      doc.text(`${variacao > 0 ? '+' : ''}${variacao}%`, tx + 14, ty + 4)
    }
    cursorY += altura + 8
  }

  function desenharHeatmap(heatmap, nomeModalidade) {
    if (!heatmap || heatmap.dias.length === 0 || heatmap.horas.length === 0) return
    tituloSecao(`Mapa de calor de demanda — ${nomeModalidade}`)
    fontePadrao('normal', 8)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text('Cor = % de ocupação das vagas do horário (grupo cheio + individual cheio pesa igual a duas turmas em grupo cheias). Número = média de inscritos.', margem, cursorY, { maxWidth: pageWidth - margem * 2 })
    cursorY += 20

    const larguraRotulo = 32
    const larguraTotal = pageWidth - margem * 2 - larguraRotulo
    const colW = larguraTotal / heatmap.dias.length
    const rowH = 34

    garantirEspaco(rowH + 16)
    fontePadrao('bold', 8)
    doc.setTextColor(...COR_TINTA)
    heatmap.dias.forEach((d, i) => {
      doc.text(ROTULO_DIA[d] || d, margem + larguraRotulo + i * colW + colW / 2, cursorY, { align: 'center' })
    })
    cursorY += 10

    heatmap.horas.forEach(hora => {
      garantirEspaco(rowH + 4)
      fontePadrao('bold', 8)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(`${hora}h`, margem, cursorY + rowH / 2 + 3)
      heatmap.dias.forEach((dia, i) => {
        const cel = heatmap.celulas[dia][hora]
        const x = margem + larguraRotulo + i * colW
        if (!cel) {
          doc.setFillColor(234, 231, 224)
          doc.roundedRect(x, cursorY, colW - 3, rowH - 3, 4, 4, 'F')
          return
        }
        // A cor reflete OCUPAÇÃO (inscritos / vagas do slot), não o número bruto —
        // assim um slot grupo+individual cheio pesa igual a dois grupos cheios.
        const cor = interpolarCor(COR_CREME, COR_VINHO, cel.ocupacao)
        doc.setFillColor(...cor)
        doc.roundedRect(x, cursorY, colW - 3, rowH - 3, 4, 4, 'F')
        const corTexto = cel.ocupacao > 0.55 ? COR_BRANCO : COR_TINTA
        fonteDestaque(12)
        doc.setTextColor(...corTexto)
        doc.text(cel.media.toFixed(1), x + (colW - 3) / 2, cursorY + rowH / 2 - 3, { align: 'center' })
        fontePadrao('normal', 5.5)
        doc.text(`G(${cel.mediaGrupo.toFixed(1)}) | I(${cel.mediaIndividual.toFixed(1)})`, x + (colW - 3) / 2, cursorY + rowH / 2 + 10, { align: 'center' })
      })
      cursorY += rowH
    })
    cursorY += 18
  }

  function tabelaPresenca(alunos) {
    garantirEspaco(60)
    autoTable(doc, {
      startY: cursorY,
      head: [['Aluno', 'Aulas', 'Presenças', 'Faltas', 'Falta Just.', 'Reposição', '% Presença', 'Observação']],
      body: alunos.map(a => [a.nome, String(a.aulasVinculadas), String(a.presentes), String(a.faltas), String(a.faltasJustificadas), String(a.reposicoes), `${a.pctPresenca}%`, a.risco || '—']),
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 6, valign: 'middle', textColor: COR_TINTA, lineColor: [215, 210, 200], lineWidth: 0.5 },
      headStyles: { fillColor: COR_MARINHO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 247, 243] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
      margin: { left: margem, right: margem },
      willDrawPage: pintarFundo,
      didParseCell(data) {
        if (data.section !== 'body' || data.column.index !== 7) return
        const texto = String(data.cell.raw || '')
        if (texto.includes('Risco alto')) { data.cell.styles.textColor = COR_VERMELHO; data.cell.styles.fontStyle = 'bold' }
        else if (texto.includes('Atenção')) data.cell.styles.textColor = COR_LARANJA
      },
    })
    cursorY = doc.lastAutoTable.finalY + 20
  }

  // ---------- Página 1+: resumo executivo ----------
  tituloSecao('Resumo executivo')
  desenharChips([
    { label: 'Aulas Programadas', valor: resumo.aulasProgramadas },
    { label: 'Aulas Dadas', valor: resumo.aulasDadas },
    { label: 'Canceladas', valor: resumo.aulasCanceladas },
    { label: 'Sem Aluno', valor: resumo.aulasSemAluno },
    { label: 'Taxa de Realização', valor: `${resumo.taxaRealizacao}%` },
    { label: 'Aulas em Feriado', valor: resumo.aulasEmFeriado },
  ], 3)

  tituloSecao('Participação dos associados')
  desenharChips([
    { label: 'Alunos Únicos', valor: resumo.alunosUnicos },
    { label: 'Presenças', valor: resumo.presentes },
    { label: 'Faltas', valor: resumo.faltas },
    { label: 'Falta Justificada*', valor: resumo.faltasJustificadas },
  ], 4)
  fontePadrao('italic', 7.5)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text('* Falta Justificada: chuva ou atestado médico.', margem, cursorY - 4)
  cursorY += 8
  blocoDestaque('Taxa de presença', `${resumo.taxaPresenca}%`, COR_VINHO)

  if (Object.keys(resumo.motivosCancelamento).length > 0) {
    tituloSecao('Cancelamentos por motivo')
    barrasHorizontais(
      Object.entries(resumo.motivosCancelamento).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
      COR_VINHO
    )
  }

  if (Object.keys(resumo.porTipoParticipacao).length > 0) {
    tituloSecao('Perfil de uso')
    barrasHorizontais(
      Object.entries(resumo.porTipoParticipacao).sort((a, b) => b[1] - a[1]).map(([tipo, total]) => ({ nome: rotuloTipo(tipo), total })),
      COR_SALVIA
    )
  }

  if (resumo.porModalidade.length > 0) {
    tituloSecao('Uso por modalidade')
    tabelaEstilizada(
      [['Modalidade', 'Aulas', 'Dadas', 'Presenças']],
      resumo.porModalidade.map(m => [m.nome, String(m.aulas), String(m.dadas), String(m.presencas)])
    )
  }

  tituloSecao('Comparação com o mês anterior')
  linhaComparativo('Aulas dadas', resumo.aulasDadas, resumo.comparativo.aulasDadasAnterior, resumo.comparativo.variacaoAulasDadas)
  linhaComparativo('Taxa de presença', `${resumo.taxaPresenca}%`, `${resumo.comparativo.taxaPresencaAnterior}%`, resumo.comparativo.variacaoTaxaPresenca)
  linhaComparativo('Alunos únicos', resumo.alunosUnicos, resumo.comparativo.alunosUnicosAnterior, resumo.comparativo.variacaoAlunosUnicos)

  if (resumo.rankingProfessores.length > 0) {
    tituloSecao('Aulas por professor')
    tabelaEstilizada(
      [['Professor', 'Aulas dadas']],
      resumo.rankingProfessores.map(p => [p.nome, String(p.total)])
    )
  }

  // ---------- Mapa de calor de cada modalidade em escopo — sempre em página nova ----------
  if (heatmaps.length > 0) {
    novaPagina()
    heatmaps.forEach(({ modalidade, heatmap }) => desenharHeatmap(heatmap, modalidade))
  }

  // ---------- Presença por aluno, separada por modalidade — sempre em página nova ----------
  novaPagina()
  if (presenca.porModalidade.length === 0) {
    tituloSecao('Presença por aluno')
    fontePadrao('normal', 10)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text('Nenhum aluno com presença registrada no período.', margem, cursorY)
  } else {
    presenca.porModalidade.forEach(grupo => {
      tituloSecao(`${grupo.modalidade} — ${grupo.alunos.length} aluno${grupo.alunos.length === 1 ? '' : 's'}`)
      tabelaPresenca(grupo.alunos)
    })
  }

  // Rodapé com data/hora em todas as páginas, exceto a capa (página 1)
  const totalPaginas = doc.internal.getNumberOfPages()
  const primeiraPaginaConteudo = capaBase64 ? 2 : 1
  for (let i = primeiraPaginaConteudo; i <= totalPaginas; i++) {
    doc.setPage(i)
    fontePadrao('normal', 7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`Gerado pelo ProCoach em ${geradoEm}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
  }

  doc.save(`relatorio-${empresa}-${periodo.inicio}-a-${periodo.fim}.pdf`)
}

// ============================================================================================
// PNG (via .zip quando sai mais de 1 imagem) — mesmo conteúdo do PDF, em páginas separadas:
// capa, resumo executivo, um mapa de calor por modalidade, presença por aluno.
// ============================================================================================

const LARGURA_PAGINA_PNG = 850
const LINHAS_POR_PAGINA_PNG = 32

function cabecalhoHtml({ titulo, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }) {
  const alturaLogo = 26
  const wBeyond = logoBeyond ? alturaLogo * logoBeyond.aspecto : 0
  const wUnidade = logoUnidade ? alturaLogo * logoUnidade.aspecto : 0
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="display:flex; align-items:center; gap:16px; height:${alturaLogo}px;">
          ${logoBeyond ? `<img src="${logoBeyond.dataUrl}" style="width:${wBeyond}px; height:${alturaLogo}px;" />` : ''}
          ${logoBeyond && logoUnidade ? `<div style="width:1px; height:${alturaLogo + 4}px; background:${rgb(COR_TEXTO_SUAVE)};"></div>` : ''}
          ${logoUnidade ? `<img src="${logoUnidade.dataUrl}" style="width:${wUnidade}px; height:${alturaLogo}px;" />` : ''}
        </div>
        <div>
          <div style="font-size:19px; font-weight:700;">${titulo}</div>
          <div style="font-size:13px; font-style:italic; color:${rgb(COR_TEXTO_SUAVE)};">${nomeEmpresa.toUpperCase()}</div>
        </div>
      </div>
      <div style="text-align:right; font-size:10px; color:${rgb(COR_TEXTO_SUAVE)};">
        <div>Período: ${periodoLabel}</div>
        <div>Gerado em ${geradoEm}</div>
      </div>
    </div>
    <div style="display:flex; gap:4px; margin-bottom:16px;">
      ${CORES_CHIP.map(c => `<div style="flex:1; height:4px; background:${rgb(c)};"></div>`).join('')}
    </div>
  `
}

function chipHtml({ valor, label }, cor) {
  return `
    <div style="flex:1; min-width:120px; background:${rgb(cor)}; border-radius:8px; padding:12px; box-sizing:border-box;">
      <div style="font-size:26px; font-weight:800; color:${rgb(COR_BRANCO)}; line-height:1;">${valor}</div>
      <div style="font-size:10px; color:${rgb(COR_BRANCO)}; text-transform:uppercase; margin-top:6px;">${label}</div>
    </div>
  `
}

function barraHtml(item, maxValor, corBarra) {
  const pct = maxValor > 0 ? Math.max((item.total / maxValor) * 100, 3) : 0
  return `
    <div style="margin-bottom:10px;">
      <div style="font-size:11px; color:${rgb(COR_TINTA)}; margin-bottom:3px;">${item.nome}</div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="flex:1; height:14px; background:rgba(0,0,0,0.06); border-radius:3px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:${rgb(corBarra)};"></div>
        </div>
        <div style="font-size:11px; font-weight:700; color:${rgb(COR_TINTA)}; min-width:20px;">${item.total}</div>
      </div>
    </div>
  `
}

function comparativoHtml(label, atual, anterior, variacao) {
  const positivo = variacao === null || variacao >= 0
  const cor = variacao === null ? COR_TEXTO_SUAVE : (positivo ? COR_VERDE : COR_VERMELHO)
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; background:${rgb(COR_BRANCO)}; border:1px solid rgba(0,0,0,0.08); border-radius:6px; padding:10px 12px; margin-bottom:8px;">
      <div>
        <div style="font-size:11px; font-weight:700; color:${rgb(COR_TINTA)};">${label}</div>
        <div style="font-size:10px; color:${rgb(COR_TEXTO_SUAVE)};">${atual} vs ${anterior} no mês anterior</div>
      </div>
      ${variacao !== null ? `<div style="font-size:13px; font-weight:700; color:${rgb(cor)};">${variacao > 0 ? '+' : ''}${variacao}%</div>` : ''}
    </div>
  `
}

// Página do resumo executivo em HTML — mesmas seções do PDF (chips, taxa de presença,
// cancelamentos, perfil de uso, uso por modalidade, comparação com o mês anterior, ranking de
// professores). Como o conteúdo não escala com o número de alunos (é sempre um punhado de
// blocos fixos), sai numa imagem só de altura natural — só a lista de presença por aluno usa a
// paginação de altura fixa, porque essa sim pode ter centenas de linhas.
function montarPaginaResumoHtml({ resumo, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }) {
  const container = document.createElement('div')
  container.style.cssText = `
    width: ${LARGURA_PAGINA_PNG}px; box-sizing: border-box; padding: 28px 32px;
    font-family: Helvetica, Arial, sans-serif; color: ${rgb(COR_TINTA)};
    display: flex; flex-direction: column; background: transparent;
  `

  const secoes = []

  secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:12px 0;">Resumo executivo</div>`)
  secoes.push(`<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
    ${chipHtml({ valor: resumo.aulasProgramadas, label: 'Aulas Programadas' }, COR_SALVIA)}
    ${chipHtml({ valor: resumo.aulasDadas, label: 'Aulas Dadas' }, COR_LARANJA)}
    ${chipHtml({ valor: resumo.aulasCanceladas, label: 'Canceladas' }, COR_VINHO)}
  </div>
  <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
    ${chipHtml({ valor: resumo.aulasSemAluno, label: 'Sem Aluno' }, COR_MARINHO)}
    ${chipHtml({ valor: `${resumo.taxaRealizacao}%`, label: 'Taxa de Realização' }, COR_SALVIA)}
    ${chipHtml({ valor: resumo.aulasEmFeriado, label: 'Aulas em Feriado' }, COR_LARANJA)}
  </div>`)

  secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:16px 0 12px;">Participação dos associados</div>`)
  secoes.push(`<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:4px;">
    ${chipHtml({ valor: resumo.alunosUnicos, label: 'Alunos Únicos' }, COR_SALVIA)}
    ${chipHtml({ valor: resumo.presentes, label: 'Presenças' }, COR_LARANJA)}
    ${chipHtml({ valor: resumo.faltas, label: 'Faltas' }, COR_VINHO)}
    ${chipHtml({ valor: resumo.faltasJustificadas, label: 'Falta Justificada*' }, COR_MARINHO)}
  </div>
  <div style="font-size:9px; font-style:italic; color:${rgb(COR_TEXTO_SUAVE)}; margin-bottom:12px;">* Falta Justificada: chuva ou atestado médico.</div>`)
  secoes.push(`<div style="background:${rgb(COR_BRANCO)}; border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
    <div style="font-size:12px;">Taxa de presença</div>
    <div style="font-size:20px; font-weight:800; color:${rgb(COR_VINHO)};">${resumo.taxaPresenca}%</div>
  </div>`)

  if (Object.keys(resumo.motivosCancelamento).length > 0) {
    const itens = Object.entries(resumo.motivosCancelamento).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total }))
    const maxValor = Math.max(...itens.map(i => i.total), 1)
    secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:4px 0 12px;">Cancelamentos por motivo</div>`)
    secoes.push(`<div style="margin-bottom:8px;">${itens.map(i => barraHtml(i, maxValor, COR_VINHO)).join('')}</div>`)
  }

  if (Object.keys(resumo.porTipoParticipacao).length > 0) {
    const itens = Object.entries(resumo.porTipoParticipacao).sort((a, b) => b[1] - a[1]).map(([tipo, total]) => ({ nome: rotuloTipo(tipo), total }))
    const maxValor = Math.max(...itens.map(i => i.total), 1)
    secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:4px 0 12px;">Perfil de uso</div>`)
    secoes.push(`<div style="margin-bottom:8px;">${itens.map(i => barraHtml(i, maxValor, COR_SALVIA)).join('')}</div>`)
  }

  if (resumo.porModalidade.length > 0) {
    secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:4px 0 12px;">Uso por modalidade</div>`)
    secoes.push(`
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:8px;">
        <thead><tr style="background:${rgb(COR_MARINHO)}; color:${rgb(COR_BRANCO)};">
          <th style="text-align:left; padding:6px 10px; font-size:10px;">Modalidade</th>
          <th style="padding:6px 4px; font-size:10px;">Aulas</th>
          <th style="padding:6px 4px; font-size:10px;">Dadas</th>
          <th style="padding:6px 4px; font-size:10px;">Presenças</th>
        </tr></thead>
        <tbody>
          ${resumo.porModalidade.map((m, i) => `
            <tr style="background:${i % 2 === 1 ? 'rgba(0,0,0,0.03)' : 'transparent'};">
              <td style="padding:6px 10px; border-bottom:1px solid rgba(0,0,0,0.08);">${m.nome}</td>
              <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${m.aulas}</td>
              <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${m.dadas}</td>
              <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${m.presencas}</td>
            </tr>`).join('')}
        </tbody>
      </table>`)
  }

  secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:4px 0 12px;">Comparação com o mês anterior</div>`)
  secoes.push(`<div style="margin-bottom:8px;">
    ${comparativoHtml('Aulas dadas', resumo.aulasDadas, resumo.comparativo.aulasDadasAnterior, resumo.comparativo.variacaoAulasDadas)}
    ${comparativoHtml('Taxa de presença', `${resumo.taxaPresenca}%`, `${resumo.comparativo.taxaPresencaAnterior}%`, resumo.comparativo.variacaoTaxaPresenca)}
    ${comparativoHtml('Alunos únicos', resumo.alunosUnicos, resumo.comparativo.alunosUnicosAnterior, resumo.comparativo.variacaoAlunosUnicos)}
  </div>`)

  if (resumo.rankingProfessores.length > 0) {
    secoes.push(`<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:4px 0 12px;">Aulas por professor</div>`)
    secoes.push(`<div>${resumo.rankingProfessores.map(p => `
      <div style="display:flex; justify-content:space-between; font-size:11px; padding:5px 0; border-bottom:1px solid rgba(0,0,0,0.06);">
        <span>${p.nome}</span><span style="color:${rgb(COR_TEXTO_SUAVE)};">${p.total} aulas</span>
      </div>`).join('')}</div>`)
  }

  container.innerHTML = cabecalhoHtml({ titulo: 'RELATÓRIO EXECUTIVO', nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm })
    + secoes.join('')
    + `<div style="margin-top:14px; text-align:center; font-size:9px; color:${rgb(COR_TEXTO_SUAVE)};">Gerado pelo ProCoach em ${geradoEm}</div>`
  return container
}

// Página do mapa de calor em HTML — mesma grade dia×hora do PDF, com a cor da célula pela
// ocupação (inscritos/vagas) e o número pela média de inscritos.
function montarPaginaHeatmapHtml({ heatmap, modalidade, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }) {
  const container = document.createElement('div')
  container.style.cssText = `
    width: ${LARGURA_PAGINA_PNG}px; box-sizing: border-box; padding: 28px 32px;
    font-family: Helvetica, Arial, sans-serif; color: ${rgb(COR_TINTA)};
    display: flex; flex-direction: column; background: transparent;
  `

  const colunas = `80px repeat(${heatmap.dias.length}, 1fr)`
  const celulasHtml = heatmap.horas.map(hora => {
    const rotuloHora = `<div style="display:flex; align-items:center; font-size:11px; font-weight:700; color:${rgb(COR_TEXTO_SUAVE)};">${hora}h</div>`
    const celulasDaHora = heatmap.dias.map(dia => {
      const cel = heatmap.celulas[dia][hora]
      if (!cel) return `<div style="background:rgba(0,0,0,0.05); border-radius:4px; min-height:44px;"></div>`
      const cor = interpolarCor(COR_CREME, COR_VINHO, cel.ocupacao)
      const corTexto = cel.ocupacao > 0.55 ? rgb(COR_BRANCO) : rgb(COR_TINTA)
      return `
        <div style="background:${rgb(cor)}; border-radius:4px; min-height:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:${corTexto};">
          <div style="font-size:14px; font-weight:800;">${cel.media.toFixed(1)}</div>
          <div style="font-size:7px;">G(${cel.mediaGrupo.toFixed(1)}) · I(${cel.mediaIndividual.toFixed(1)})</div>
        </div>`
    }).join('')
    return `<div style="display:grid; grid-template-columns:${colunas}; gap:4px; margin-bottom:4px;">${rotuloHora}${celulasDaHora}</div>`
  }).join('')

  const cabecalhoDias = heatmap.dias.map(d => `<div style="text-align:center; font-size:10px; font-weight:700; color:${rgb(COR_TINTA)};">${ROTULO_DIA[d] || d}</div>`).join('')

  container.innerHTML = cabecalhoHtml({ titulo: 'RELATÓRIO EXECUTIVO', nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm })
    + `<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin-bottom:8px;">Mapa de calor de demanda — ${modalidade}</div>`
    + `<div style="font-size:10px; color:${rgb(COR_TEXTO_SUAVE)}; margin-bottom:14px;">Cor = % de ocupação das vagas do horário. Número = média de inscritos.</div>`
    + `<div style="display:grid; grid-template-columns:${colunas}; gap:4px; margin-bottom:6px;"><div></div>${cabecalhoDias}</div>`
    + celulasHtml
    + `<div style="margin-top:14px; text-align:center; font-size:9px; color:${rgb(COR_TEXTO_SUAVE)};">Gerado pelo ProCoach em ${geradoEm}</div>`
  return container
}

// Cada "página" de imagem da lista de alunos sempre desenha o mesmo número de linhas
// (preenchendo com linhas vazias quando sobra menos gente no último bloco), pra todo PNG gerado
// sair com exatamente a mesma altura — importante pra colar lado a lado num relatório externo
// sem ficar com tamanhos desencontrados.
function montarPaginaPresencaHtml({ alunos, modalidade, parte, totalPartes, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }) {
  const container = document.createElement('div')
  container.style.cssText = `
    width: ${LARGURA_PAGINA_PNG}px; box-sizing: border-box; padding: 28px 32px;
    font-family: Helvetica, Arial, sans-serif; color: ${rgb(COR_TINTA)};
    display: flex; flex-direction: column; background: transparent;
  `

  container.innerHTML = cabecalhoHtml({ titulo: 'RELATÓRIO DE PRESENÇA', nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm })
    + `<div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin-bottom:12px;">
        ${modalidade} — ${alunos.length} aluno${alunos.length === 1 ? '' : 's'}${totalPartes > 1 ? ` (parte ${parte}/${totalPartes})` : ''}
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed;">
        <thead>
          <tr style="background:${rgb(COR_MARINHO)}; color:${rgb(COR_BRANCO)};">
            <th style="text-align:left; padding:8px 10px; font-size:10px; width:30%;">Aluno</th>
            <th style="padding:8px 4px; font-size:10px; width:8%;">Aulas</th>
            <th style="padding:8px 4px; font-size:10px; width:10%;">Presenças</th>
            <th style="padding:8px 4px; font-size:10px; width:8%;">Faltas</th>
            <th style="padding:8px 4px; font-size:10px; width:10%;">Falta Just.</th>
            <th style="padding:8px 4px; font-size:10px; width:10%;">Reposição</th>
            <th style="padding:8px 4px; font-size:10px; width:9%;">% Presença</th>
            <th style="text-align:left; padding:8px 10px; font-size:10px; width:15%;">Observação</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: LINHAS_POR_PAGINA_PNG }, (_, i) => {
            const a = alunos[i]
            if (!a) return `<tr style="height:28px;"><td colspan="8"></td></tr>`
            const risco = a.risco || '—'
            const estiloRisco = corRisco(risco)
            const bgLinha = i % 2 === 1 ? 'rgba(0,0,0,0.03)' : 'transparent'
            return `
              <tr style="background:${bgLinha}; height:28px;">
                <td style="padding:6px 10px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.nome}</td>
                <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.aulasVinculadas}</td>
                <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.presentes}</td>
                <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.faltas}</td>
                <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.faltasJustificadas}</td>
                <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.reposicoes}</td>
                <td style="text-align:center; padding:6px 4px; border-bottom:1px solid rgba(0,0,0,0.08);">${a.pctPresenca}%</td>
                <td style="padding:6px 10px; border-bottom:1px solid rgba(0,0,0,0.08); font-size:10px; color:${estiloRisco.color || rgb(COR_TINTA)}; font-weight:${estiloRisco.fontWeight || '400'};">${risco}</td>
              </tr>`
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top:14px; text-align:center; font-size:9px; color:${rgb(COR_TEXTO_SUAVE)};">Gerado pelo ProCoach em ${geradoEm}</div>`
  return container
}

// Capa em PNG: a arte pronta (foto) + data/hora do relatório, minimalista, no canto inferior —
// desenhada direto num <canvas> (sem html2canvas) pra manter nitidez de foto e texto sem
// depender de carregamento de fonte no DOM.
async function gerarCapaPngBlob(empresa, geradoEm) {
  const bitmap = await carregarBitmap(CAPA_EMPRESA[empresa])
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bitmap.width, bitmap.height) : document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0)
  ctx.font = `${Math.round(bitmap.width * 0.014)}px Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'right'
  ctx.fillText(`Relatório gerado em ${geradoEm}`, bitmap.width - bitmap.width * 0.045, bitmap.height - bitmap.height * 0.018)
  return canvas.convertToBlob
    ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    : await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

// Relatório completo em imagens — capa, resumo executivo, um mapa de calor por modalidade e a
// lista de presença por aluno (essa em partes, se não couber numa página só). Tudo empacotado
// num .zip quando sai mais de 1 imagem (navegador bloqueia downloads múltiplos em sequência).
export async function exportarRelatorioCompletoPNG(dados, { empresa }) {
  const { resumo, heatmaps, presenca, periodo } = dados
  const { default: html2canvas } = await import('html2canvas')

  let logoBeyond = null
  let logoUnidade = null
  try { logoBeyond = await carregarLogoAutoCrop(LOGO_BEYOND_PRETO, 260) } catch {}
  try { logoUnidade = await carregarLogoAutoCrop(LOGO_UNIDADE_PRETO[empresa], 260) } catch {}

  const nomeEmpresa = NOME_EMPRESA[empresa] || empresa
  const periodoLabel = `${format(new Date(periodo.inicio + 'T12:00'), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim + 'T12:00'), 'dd/MM/yyyy')}`
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  const arquivos = []
  const base = `${slugificar(empresa)}-${periodo.inicio}-a-${periodo.fim}`

  try {
    const capaBlob = await gerarCapaPngBlob(empresa, geradoEm)
    arquivos.push({ nomeArquivo: `00-capa-${base}.jpg`, blob: capaBlob })
  } catch {}

  const palco = document.createElement('div')
  palco.style.cssText = 'position: fixed; top: 0; left: -99999px; z-index: -1;'
  document.body.appendChild(palco)

  async function capturar(elemento, nomeArquivo) {
    palco.appendChild(elemento)
    const canvas = await html2canvas(elemento, { backgroundColor: null, scale: 3 })
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    palco.removeChild(elemento)
    arquivos.push({ nomeArquivo, blob })
  }

  try {
    await capturar(
      montarPaginaResumoHtml({ resumo, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }),
      `01-resumo-${base}.png`
    )

    for (const { modalidade, heatmap } of heatmaps) {
      await capturar(
        montarPaginaHeatmapHtml({ heatmap, modalidade, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }),
        `02-mapa-calor-${slugificar(modalidade)}-${base}.png`
      )
    }

    for (const grupo of presenca.porModalidade) {
      const totalPartes = Math.max(1, Math.ceil(grupo.alunos.length / LINHAS_POR_PAGINA_PNG))
      for (let parte = 1; parte <= totalPartes; parte++) {
        const inicio = (parte - 1) * LINHAS_POR_PAGINA_PNG
        const alunosPagina = grupo.alunos.slice(inicio, inicio + LINHAS_POR_PAGINA_PNG)
        const sufixoParte = totalPartes > 1 ? `-parte${parte}de${totalPartes}` : ''
        await capturar(
          montarPaginaPresencaHtml({ alunos: alunosPagina, modalidade: grupo.modalidade, parte, totalPartes, nomeEmpresa, logoBeyond, logoUnidade, periodoLabel, geradoEm }),
          `03-presenca-${slugificar(grupo.modalidade)}${sufixoParte}-${base}.png`
        )
      }
    }

    if (arquivos.length > 1) {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      arquivos.forEach(({ nomeArquivo, blob }) => zip.file(nomeArquivo, blob))
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      baixarBlob(zipBlob, `relatorio-${base}.zip`)
    } else if (arquivos.length === 1) {
      baixarBlob(arquivos[0].blob, arquivos[0].nomeArquivo)
    }
    return arquivos.length
  } finally {
    document.body.removeChild(palco)
  }
}
