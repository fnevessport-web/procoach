import { format } from 'date-fns'
import { gerarInsights } from '../hooks/useRelatorioMensal'
import { classificarPct } from '../constants/semaforo'
import { PONTOS_POR_RESULTADO, NIVEIS_ASSIDUIDADE, JANELA_DIAS, MINIMO_JOGOS_CLASSIFICACAO, PESO_CATEGORIA, pontuacaoComPesoCategoria } from './pontuacaoBeyond'

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
const COR_AZUL_INFO = [59, 130, 246]
const CORES_CHIP = [COR_SALVIA, COR_LARANJA, COR_VINHO, COR_MARINHO]
const CORES_SEVERIDADE = { bom: COR_VERDE, atencao: COR_LARANJA, critico: COR_VERMELHO, info: COR_AZUL_INFO }
// Card do PC Score (exportarEvolucaoTecnicaPDF) — mesma paleta das 4 tarjas do cabeçalho
// (CORES_CHIP), mapeada pro nível do aluno. Só 4 cores pra 5 níveis: Básico compartilha com
// Iniciante (os dois ainda "em construção"), Intermediário/Avançado/Elite ficam com uma cor
// só cada, como pedido.
const CARD_PC_SCORE_COR_POR_NIVEL = {
  iniciante: COR_SALVIA,
  basico: COR_SALVIA,
  intermediario: COR_LARANJA,
  avancado: COR_VINHO,
  elite: COR_MARINHO,
}

const NOME_EMPRESA = { procopio: 'Procopio', beach_arena: 'Beach Arena' }
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

// Recorta a foto num círculo (canvas + clip), com "cover" — preenche o círculo inteiro sem
// distorcer, cortando o excesso do lado mais comprido. Devolve PNG com fundo transparente
// fora do círculo (addImage compõe a transparência direto em cima do fundo creme da página).
async function carregarImagemCircular(url, diametro) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)

  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(diametro, diametro) : document.createElement('canvas')
  canvas.width = diametro
  canvas.height = diametro
  const ctx = canvas.getContext('2d')

  const ladoMenor = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - ladoMenor) / 2
  const sy = (bitmap.height - ladoMenor) / 2

  ctx.beginPath()
  ctx.arc(diametro / 2, diametro / 2, diametro / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(bitmap, sx, sy, ladoMenor, ladoMenor, 0, 0, diametro, diametro)

  if (canvas.convertToBlob) {
    const outBlob = await canvas.convertToBlob({ type: 'image/png' })
    return await blobParaDataUrl(outBlob)
  }
  return canvas.toDataURL('image/png')
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

  // ---------- Página 0: capa (arte pronta) + data/hora do relatório, minimalista no canto
  // superior esquerdo, na mesma altura do lockup BEYOND | unidade que já vem impresso na capa
  // (medido na própria arte: a faixa da logo fica a ~7,6% do topo da página) ----------
  if (capaBase64) {
    try {
      doc.addImage(capaBase64, 'JPEG', 0, 0, pageWidth, pageHeight)
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.85 }))
      fontePadrao('normal', 8)
      doc.setTextColor(...COR_BRANCO)
      doc.text(`Relatório gerado em ${geradoEm}`, margem, pageHeight * 0.076)
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
      doc.setFillColor(...(item.cor || CORES_CHIP[i % CORES_CHIP.length]))
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

  function linhaComparativo(label, atual, anterior, variacao, semHistorico) {
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
    doc.text(semHistorico ? `${atual} este período — sem dados do mês anterior` : `${atual} vs ${anterior} no mês anterior`, margem + 12, cursorY + 27)
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

  function blocoInsights(insights) {
    const larguraTexto = pageWidth - margem * 2 - 40
    const alturaPad = 14
    let alturaTotal = alturaPad
    const linhasPorItem = insights.map(ins => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const linhas = doc.splitTextToSize(ins.texto, larguraTexto)
      alturaTotal += linhas.length * 13 + 6
      return linhas
    })
    garantirEspaco(alturaTotal + 10)
    const yInicio = cursorY
    doc.setFillColor(...COR_BRANCO)
    doc.roundedRect(margem, yInicio, pageWidth - margem * 2, alturaTotal, 8, 8, 'F')
    doc.setDrawColor(215, 210, 200)
    doc.roundedRect(margem, yInicio, pageWidth - margem * 2, alturaTotal, 8, 8, 'S')

    let y = yInicio + alturaPad
    insights.forEach((ins, i) => {
      const linhas = linhasPorItem[i]
      doc.setFillColor(...CORES_SEVERIDADE[ins.severidade])
      doc.circle(margem + 14, y - 3, 2.4, 'F')
      fontePadrao('normal', 9)
      doc.setTextColor(...COR_TINTA)
      doc.text(linhas, margem + 24, y)
      y += linhas.length * 13 + 6
    })
    cursorY += alturaTotal + 14
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
    { label: 'Taxa de Realização', valor: `${resumo.taxaRealizacao}%`, cor: CORES_SEVERIDADE[classificarPct(resumo.taxaRealizacao, { bom: 85, atencao: 65 })] },
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
  blocoDestaque('Taxa de presença', `${resumo.taxaPresenca}%`, CORES_SEVERIDADE[classificarPct(resumo.taxaPresenca)])

  const insights = gerarInsights(resumo)
  if (insights.length > 0) {
    tituloSecao('Insights executivos')
    blocoInsights(insights)
  }

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
  linhaComparativo('Aulas dadas', resumo.aulasDadas, resumo.comparativo.aulasDadasAnterior, resumo.comparativo.variacaoAulasDadas, resumo.comparativo.semHistoricoAnterior)
  linhaComparativo('Taxa de presença', `${resumo.taxaPresenca}%`, `${resumo.comparativo.taxaPresencaAnterior}%`, resumo.comparativo.variacaoTaxaPresenca, resumo.comparativo.semHistoricoAnterior)
  linhaComparativo('Alunos únicos', resumo.alunosUnicos, resumo.comparativo.alunosUnicosAnterior, resumo.comparativo.variacaoAlunosUnicos, resumo.comparativo.semHistoricoAnterior)

  if (resumo.rankingProfessores.length > 0) {
    tituloSecao('Aulas por professor')
    tabelaEstilizada(
      [['Professor', 'Aulas dadas']],
      resumo.rankingProfessores.map(p => [p.nome, String(p.total)])
    )
  }

  // ---------- Mapa de calor de cada modalidade em escopo — cada um sempre em página nova ----------
  // Importante ser por modalidade, não só antes da seção inteira: o mapa do Tênis (16 linhas de
  // horário) quase sempre enche a página sozinho, e se o do Padel entrasse em seguida sem sua
  // própria quebra, o título "Mapa de calor — Padel" ficava sobrando no rodapé dessa página e a
  // grade em si só começava na página seguinte, já sem o título junto.
  heatmaps.forEach(({ modalidade, heatmap }) => {
    novaPagina()
    desenharHeatmap(heatmap, modalidade)
  })

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

function comparativoHtml(label, atual, anterior, variacao, semHistorico) {
  const positivo = variacao === null || variacao >= 0
  const cor = variacao === null ? COR_TEXTO_SUAVE : (positivo ? COR_VERDE : COR_VERMELHO)
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; background:${rgb(COR_BRANCO)}; border:1px solid rgba(0,0,0,0.08); border-radius:6px; padding:10px 12px; margin-bottom:8px;">
      <div>
        <div style="font-size:11px; font-weight:700; color:${rgb(COR_TINTA)};">${label}</div>
        <div style="font-size:10px; color:${rgb(COR_TEXTO_SUAVE)};">${semHistorico ? `${atual} este período — sem dados do mês anterior` : `${atual} vs ${anterior} no mês anterior`}</div>
      </div>
      ${variacao !== null ? `<div style="font-size:13px; font-weight:700; color:${rgb(cor)};">${variacao > 0 ? '+' : ''}${variacao}%</div>` : ''}
    </div>
  `
}

function insightsHtml(insights) {
  if (insights.length === 0) return ''
  return `
    <div style="font-size:13px; font-weight:700; text-transform:uppercase; border-bottom:1px solid ${rgb(COR_TEXTO_SUAVE)}; padding-bottom:6px; margin:16px 0 12px;">🧠 Insights executivos</div>
    <div style="background:${rgb(COR_BRANCO)}; border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:14px 16px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
      ${insights.map(ins => `
        <div style="display:flex; align-items:flex-start; gap:8px;">
          <span style="width:7px; height:7px; border-radius:50%; margin-top:5px; flex-shrink:0; background:${rgb(CORES_SEVERIDADE[ins.severidade])};"></span>
          <span style="font-size:11px; color:${rgb(COR_TINTA)}; line-height:1.5;">${ins.texto}</span>
        </div>
      `).join('')}
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
    ${chipHtml({ valor: `${resumo.taxaRealizacao}%`, label: 'Taxa de Realização' }, CORES_SEVERIDADE[classificarPct(resumo.taxaRealizacao, { bom: 85, atencao: 65 })])}
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
    <div style="font-size:20px; font-weight:800; color:${rgb(CORES_SEVERIDADE[classificarPct(resumo.taxaPresenca)])};">${resumo.taxaPresenca}%</div>
  </div>`)

  secoes.push(insightsHtml(gerarInsights(resumo)))

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
    ${comparativoHtml('Aulas dadas', resumo.aulasDadas, resumo.comparativo.aulasDadasAnterior, resumo.comparativo.variacaoAulasDadas, resumo.comparativo.semHistoricoAnterior)}
    ${comparativoHtml('Taxa de presença', `${resumo.taxaPresenca}%`, `${resumo.comparativo.taxaPresencaAnterior}%`, resumo.comparativo.variacaoTaxaPresenca, resumo.comparativo.semHistoricoAnterior)}
    ${comparativoHtml('Alunos únicos', resumo.alunosUnicos, resumo.comparativo.alunosUnicosAnterior, resumo.comparativo.variacaoAlunosUnicos, resumo.comparativo.semHistoricoAnterior)}
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

// Capa em PNG: a arte pronta (foto) + data/hora do relatório, minimalista, no canto superior
// esquerdo (mesma altura do lockup BEYOND | unidade já impresso na arte, ~7,6% do topo) —
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
  ctx.textAlign = 'left'
  ctx.fillText(`Relatório gerado em ${geradoEm}`, bitmap.width * 0.045, bitmap.height * 0.076)
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

// ============================================================================================
// PDF — Evolução Técnica (Módulo PC Score, Tênis) — documento de 1 página A4, mesmo layout
// Beyond dos relatórios executivos (header preto + logos + faixa de 4 cores + rodapé), com
// dois blocos de desenho que os relatórios existentes não precisavam: radar e linha de
// evolução — jsPDF não tem chart nativo, então são desenhados com as primitivas de vetor
// (linha/triângulo/círculo) direto, sem depender de nenhuma lib de gráfico.
// ============================================================================================

// Radar de N dimensões (genérico — não fixo em 6, já que outras modalidades vão ter outra
// quantidade de dimensões no futuro). Escala igual à do app (Recharts domain [0,10] — domínios
// de Tênis são médias na escala original 1-10, não 1-5).
function desenharRadarPdf(doc, { cx, cy, raio, dimensoes, cor }) {
  const n = dimensoes.length
  if (n < 3) return
  const angulo = i => -Math.PI / 2 + i * (2 * Math.PI / n)
  const pontoNaFracao = (i, fracao) => [cx + raio * fracao * Math.cos(angulo(i)), cy + raio * fracao * Math.sin(angulo(i))]
  const pontoDado = i => pontoNaFracao(i, Math.max(0, Math.min(1, dimensoes[i].valor / 10)))

  doc.setDrawColor(215, 210, 200)
  doc.setLineWidth(0.4)
  ;[0.5, 1].forEach(fracao => {
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pontoNaFracao(i, fracao)
      const [x2, y2] = pontoNaFracao((i + 1) % n, fracao)
      doc.line(x1, y1, x2, y2)
    }
  })
  for (let i = 0; i < n; i++) {
    const [x, y] = pontoNaFracao(i, 1)
    doc.line(cx, cy, x, y)
  }

  doc.setFillColor(...cor)
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.35 }))
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pontoDado(i)
    const [x2, y2] = pontoDado((i + 1) % n)
    doc.triangle(cx, cy, x1, y1, x2, y2, 'F')
  }
  doc.restoreGraphicsState()

  doc.setDrawColor(...cor)
  doc.setLineWidth(1.3)
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pontoDado(i)
    const [x2, y2] = pontoDado((i + 1) % n)
    doc.line(x1, y1, x2, y2)
  }

  // Nomes com mais de uma palavra quebram em duas linhas (ex. "Condicionamento Físico" →
  // "CONDICIONAMENTO" / "FÍSICO") — uma linha só nesse tamanho de fonte atravessava o gráfico.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COR_TINTA)
  for (let i = 0; i < n; i++) {
    const [x, y] = pontoNaFracao(i, 1.3)
    const palavras = dimensoes[i].nome.split(' ')
    if (palavras.length > 1) {
      const meio = Math.ceil(palavras.length / 2)
      doc.text(palavras.slice(0, meio).join(' '), x, y - 3, { align: 'center' })
      doc.text(palavras.slice(meio).join(' '), x, y + 5, { align: 'center' })
    } else {
      doc.text(dimensoes[i].nome, x, y, { align: 'center' })
    }
  }
}

// Linha de evolução genérica — usada tanto pro PC Score (eixo invertido, score baixo = melhor
// = fica mais alto no desenho, mesma leitura do gráfico em tela) quanto pra evolução de cada
// domínio técnico (eixo normal, nota alta = melhor, escala 0-10).
function desenharLinhaEvolucaoPdf(doc, { x, y, largura, altura, pontos, cor, valorFn = p => p.pcScore, min = 1, max = 100, inverterEixo = true, fonteValor = 8, casasDecimais = 0 }) {
  if (pontos.length < 2) return
  const passoX = largura / (pontos.length - 1)
  const posY = valor => inverterEixo
    ? y + ((valor - min) / (max - min)) * altura
    : y + altura - ((valor - min) / (max - min)) * altura

  doc.setDrawColor(215, 210, 200)
  doc.setLineWidth(0.5)
  doc.line(x, y, x, y + altura)
  doc.line(x, y + altura, x + largura, y + altura)

  doc.setDrawColor(...cor)
  doc.setLineWidth(1.5)
  for (let i = 0; i < pontos.length - 1; i++) {
    doc.line(x + i * passoX, posY(valorFn(pontos[i])), x + (i + 1) * passoX, posY(valorFn(pontos[i + 1])))
  }

  pontos.forEach((p, i) => {
    const px = x + i * passoX
    const valor = valorFn(p)
    const py = posY(valor)
    doc.setFillColor(...cor)
    doc.circle(px, py, 2.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fonteValor)
    doc.setTextColor(...cor)
    doc.text(valor.toFixed(casasDecimais), px, py - 7, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(p.data, px, y + altura + 12, { align: 'center' })
  })
}

// `dados` já vem com tudo pré-calculado pelo componente de tela (EvolucaoTecnicaTenis) —
// essa função só desenha, não recalcula PC Score nem busca dado novo.
export async function exportarEvolucaoTecnicaPDF(dados, { empresa }) {
  const {
    alunoNome, fotoUrl, modalidadeNome,
    totalPresencas, pcScoreAtual, variacaoPcScore, nivelLabel, nivelChave,
    dimensoes, evolucaoPcScore, evolucaoPorDominio, narrativaIA, conquistas,
    historicoMensal,
    niveisPcScore,
  } = dados

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2

  let logoBeyond = null
  let logoUnidade = null
  let fotoBase64 = null
  try { logoBeyond = await carregarLogoAutoCrop(LOGO_BEYOND_PRETO, 260) } catch {}
  try { logoUnidade = await carregarLogoAutoCrop(LOGO_UNIDADE_PRETO[empresa], 260) } catch {}
  if (fotoUrl) { try { fotoBase64 = await carregarImagemCircular(fotoUrl, 200) } catch {} }

  function fontePadrao(estilo, tamanho) {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }

  const nomeEmpresa = NOME_EMPRESA[empresa] || empresa
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  doc.setFillColor(...COR_CREME)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

  // ---------- Cabeçalho ----------
  const alturaLogo = 20
  const yTopoLogo = 22
  const textoX = desenharLockupLogos(doc, { logoBeyond, logoUnidade, x: margem, yTopo: yTopoLogo, altura: alturaLogo, corLinha: COR_TEXTO_SUAVE })
  fontePadrao('bold', 14)
  doc.setTextColor(...COR_TINTA)
  doc.text('EVOLUÇÃO TÉCNICA', textoX, yTopoLogo + alturaLogo / 2 - 3)
  fontePadrao('italic', 9)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`${nomeEmpresa.toUpperCase()} · ${modalidadeNome.toUpperCase()}`, textoX, yTopoLogo + alturaLogo / 2 + 10)
  fontePadrao('normal', 7.5)
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 26, { align: 'right' })

  const faixaY = 56
  const faixaW = larguraUtil / 4
  CORES_CHIP.forEach((cor, i) => {
    doc.setFillColor(...cor)
    doc.rect(margem + i * faixaW, faixaY, faixaW - 3, 4, 'F')
  })

  let cursorY = faixaY + 30

  // ---------- Foto + nome + PC Score em destaque ----------
  const avatarTam = 52
  if (fotoBase64) {
    try { doc.addImage(fotoBase64, 'PNG', margem, cursorY, avatarTam, avatarTam, undefined, 'FAST') } catch {}
  } else {
    doc.setFillColor(...COR_VINHO)
    doc.circle(margem + avatarTam / 2, cursorY + avatarTam / 2, avatarTam / 2, 'F')
    const iniciais = alunoNome.trim().split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
    fontePadrao('bold', 18)
    doc.setTextColor(...COR_BRANCO)
    doc.text(iniciais, margem + avatarTam / 2, cursorY + avatarTam / 2 + 6, { align: 'center' })
  }
  fontePadrao('bold', 16)
  doc.setTextColor(...COR_TINTA)
  doc.text(alunoNome, margem + avatarTam + 14, cursorY + 20)
  fontePadrao('normal', 9)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`${totalPresencas} aula${totalPresencas === 1 ? '' : 's'} com presença`, margem + avatarTam + 14, cursorY + 36)

  // Card cheio da cor do nível — número grande preenchendo o quadro, "PC SCORE" deitado ao
  // lado dele (não empilhado em cima pequeno) e o nível FORA da área colorida, em texto preto.
  const corCardPcScore = CARD_PC_SCORE_COR_POR_NIVEL[nivelChave] || [136, 136, 136]
  const boxPcScoreW = 130
  const boxPcScoreH = avatarTam
  const boxPcScoreX = pageWidth - margem - boxPcScoreW
  doc.setFillColor(...corCardPcScore)
  doc.roundedRect(boxPcScoreX, cursorY, boxPcScoreW, boxPcScoreH, 8, 8, 'F')
  fontePadrao('bold', 34)
  doc.setTextColor(...COR_BRANCO)
  doc.text(pcScoreAtual != null ? String(pcScoreAtual) : '—', boxPcScoreX + 12, cursorY + boxPcScoreH / 2 + 12)
  const larguraNumero = doc.getTextWidth(pcScoreAtual != null ? String(pcScoreAtual) : '—')
  fontePadrao('bold', 9)
  doc.text('PC', boxPcScoreX + 20 + larguraNumero, cursorY + boxPcScoreH / 2 - 3)
  doc.text('SCORE', boxPcScoreX + 20 + larguraNumero, cursorY + boxPcScoreH / 2 + 9)
  if (variacaoPcScore != null && variacaoPcScore !== 0) {
    // Setinha desenhada como triângulo de verdade — o caractere unicode ▼/▲ não existe na
    // fonte padrão do jsPDF (helvetica) e virava um símbolo errado ("%¼") no PDF gerado.
    const melhorou = variacaoPcScore < 0
    const numeroDelta = String(Math.abs(variacaoPcScore))
    const larguraDelta = doc.getTextWidth(numeroDelta)
    const setaX = boxPcScoreX + boxPcScoreW - 10 - larguraDelta - 9
    const setaY = cursorY + 11
    doc.setFillColor(...COR_BRANCO)
    if (melhorou) {
      doc.triangle(setaX, setaY - 3, setaX + 6, setaY - 3, setaX + 3, setaY + 3, 'F')
    } else {
      doc.triangle(setaX, setaY + 3, setaX + 6, setaY + 3, setaX + 3, setaY - 3, 'F')
    }
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_BRANCO)
    doc.text(numeroDelta, boxPcScoreX + boxPcScoreW - 10, cursorY + 14, { align: 'right' })
  }
  fontePadrao('bold', 10)
  doc.setTextColor(...COR_TINTA)
  doc.text(nivelLabel || '', boxPcScoreX + boxPcScoreW / 2, cursorY + boxPcScoreH + 14, { align: 'center' })

  cursorY += avatarTam + 22

  // ---------- Radar + tabela de dimensões, lado a lado ----------
  const colunaW = (larguraUtil - 16) / 2
  fontePadrao('bold', 9)
  doc.setTextColor(...COR_TINTA)
  doc.text('PERFIL TÉCNICO', margem, cursorY)
  doc.text('DIMENSÕES', margem + colunaW + 16, cursorY)
  cursorY += 14

  const alturaBlocoRadar = 140
  doc.setFillColor(...COR_BRANCO)
  doc.roundedRect(margem, cursorY, colunaW, alturaBlocoRadar, 8, 8, 'F')
  doc.setDrawColor(215, 210, 200)
  doc.roundedRect(margem, cursorY, colunaW, alturaBlocoRadar, 8, 8, 'S')
  desenharRadarPdf(doc, { cx: margem + colunaW / 2, cy: cursorY + alturaBlocoRadar / 2, raio: 48, dimensoes, cor: COR_MARINHO })

  const tabelaX = margem + colunaW + 16
  let linhaY = cursorY
  const alturaLinha = alturaBlocoRadar / Math.max(dimensoes.length, 1)
  dimensoes.forEach((d, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(249, 247, 243)
      doc.rect(tabelaX, linhaY, colunaW, alturaLinha, 'F')
    }
    fontePadrao('normal', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text(d.nome, tabelaX + 8, linhaY + alturaLinha / 2 + 3)
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_VINHO)
    doc.text(`${d.valor}/10`, tabelaX + colunaW - 8, linhaY + alturaLinha / 2 + 3, { align: 'right' })
    linhaY += alturaLinha
  })

  cursorY += alturaBlocoRadar + 12

  // ---------- Evolução — grade uniforme: PC Score + os 5 domínios, todos do mesmo tamanho ----------
  // Antes o gráfico do PC Score era um card enorme sozinho e os domínios ficavam espremidos
  // numa fileira embaixo; agora os 6 entram juntos numa mesma grade (3 colunas), todos com a
  // mesma "moldura" — resolve tanto o tamanho desproporcional quanto o excesso de altura que
  // jogava o relatório pra uma segunda página.
  const graficosEvolucao = []
  if (evolucaoPcScore?.length > 1) {
    graficosEvolucao.push({ nome: 'PC Score', pontos: evolucaoPcScore, valorFn: p => p.pcScore, min: 1, max: 100, inverterEixo: true, casasDecimais: 0 })
  }
  ;(evolucaoPorDominio || []).forEach(dom => {
    if (dom.pontos.length > 1) graficosEvolucao.push({ nome: dom.nome, pontos: dom.pontos, valorFn: p => p.valor, min: 0, max: 10, inverterEixo: false, casasDecimais: 1 })
  })

  if (graficosEvolucao.length > 0) {
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text('EVOLUÇÃO DO PC SCORE', margem, cursorY)
    cursorY += 12

    const colunas = 3
    const gap = 10
    const larguraCard = (larguraUtil - gap * (colunas - 1)) / colunas
    const alturaCard = 68
    const alturaTitulo = 19
    const linhas = Math.ceil(graficosEvolucao.length / colunas)
    const gridY = cursorY

    graficosEvolucao.forEach((g, i) => {
      const col = i % colunas
      const linha = Math.floor(i / colunas)
      const cardX = margem + col * (larguraCard + gap)
      const cardY = gridY + linha * (alturaCard + gap)

      doc.setFillColor(...COR_BRANCO)
      doc.roundedRect(cardX, cardY, larguraCard, alturaCard, 6, 6, 'F')
      doc.setDrawColor(215, 210, 200)
      doc.roundedRect(cardX, cardY, larguraCard, alturaCard, 6, 6, 'S')

      fontePadrao('bold', 6.5)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      const palavras = g.nome.toUpperCase().split(' ')
      if (palavras.length > 1) {
        const meio = Math.ceil(palavras.length / 2)
        doc.text(palavras.slice(0, meio).join(' '), cardX + larguraCard / 2, cardY + 11, { align: 'center' })
        doc.text(palavras.slice(meio).join(' '), cardX + larguraCard / 2, cardY + 19, { align: 'center' })
      } else {
        doc.text(palavras.join(' '), cardX + larguraCard / 2, cardY + 15, { align: 'center' })
      }

      desenharLinhaEvolucaoPdf(doc, {
        x: cardX + 8, y: cardY + alturaTitulo, largura: larguraCard - 16, altura: alturaCard - alturaTitulo - 14,
        pontos: g.pontos, cor: COR_LARANJA, valorFn: g.valorFn, min: g.min, max: g.max,
        inverterEixo: g.inverterEixo, fonteValor: 6, casasDecimais: g.casasDecimais,
      })
    })

    cursorY = gridY + linhas * alturaCard + (linhas - 1) * gap + 16
  }

  // ---------- Análise inteligente ----------
  if (narrativaIA) {
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text('ANÁLISE INTELIGENTE', margem, cursorY)
    cursorY += 12
    fontePadrao('normal', 8.5)
    doc.setTextColor(80, 76, 70)
    const linhas = doc.splitTextToSize(narrativaIA, larguraUtil - 20)
    const alturaTexto = linhas.length * 11 + 16
    doc.setFillColor(...COR_BRANCO)
    doc.roundedRect(margem, cursorY, larguraUtil, alturaTexto, 8, 8, 'F')
    doc.text(linhas, margem + 10, cursorY + 14)
    cursorY += alturaTexto + 10
  }

  // ---------- Conquistas ----------
  // Sem ícone (pedido explícito) — só as pílulas de texto, centralizadas na largura útil.
  if (conquistas?.length > 0) {
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text('CONQUISTAS', margem, cursorY)
    cursorY += 12
    fontePadrao('normal', 8)

    // Monta as linhas primeiro (sem desenhar) pra poder centralizar cada uma depois de saber
    // a largura total — jsPDF não tem flexbox, então o centro tem que ser calculado na mão.
    const linhas = []
    let linhaAtual = []
    let larguraLinhaAtual = 0
    conquistas.forEach(c => {
      const larguraPilula = doc.getTextWidth(c.nome) + 20
      if (larguraLinhaAtual + larguraPilula > larguraUtil && linhaAtual.length) {
        linhas.push({ itens: linhaAtual, largura: larguraLinhaAtual - 6 })
        linhaAtual = []
        larguraLinhaAtual = 0
      }
      linhaAtual.push({ nome: c.nome, largura: larguraPilula })
      larguraLinhaAtual += larguraPilula + 6
    })
    if (linhaAtual.length) linhas.push({ itens: linhaAtual, largura: larguraLinhaAtual - 6 })

    let by = cursorY
    linhas.forEach(linha => {
      let bx = margem + (larguraUtil - linha.largura) / 2
      linha.itens.forEach(item => {
        doc.setFillColor(...COR_BRANCO)
        doc.roundedRect(bx, by, item.largura, 20, 10, 10, 'F')
        doc.setTextColor(...COR_TINTA)
        doc.text(item.nome, bx + item.largura / 2, by + 13, { align: 'center' })
        bx += item.largura + 6
      })
      by += 26
    })
    cursorY = by + 6
  }

  // ---------- Presença mês a mês ----------
  // Uma fileira compacta (não uma linha por mês) — MÊS + "X · Y" (X presenças, incluindo
  // reposição, já que ela entra em status_presenca='presente'; Y faltas não justificadas),
  // quebrando em mais de uma fileira só se não couber tudo numa linha só.
  if (historicoMensal?.length > 0) {
    const larguraMinColuna = 46
    const porLinha = Math.max(1, Math.min(historicoMensal.length, Math.floor(larguraUtil / larguraMinColuna)))
    const numLinhas = Math.ceil(historicoMensal.length / porLinha)
    const alturaLinhaMes = 24
    const alturaEstimada = 16 + numLinhas * alturaLinhaMes
    if (cursorY + alturaEstimada > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage()
      doc.setFillColor(...COR_CREME)
      doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')
      cursorY = margem
    }

    fontePadrao('bold', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text('PRESENÇA', margem, cursorY)
    fontePadrao('normal', 7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(String(new Date().getFullYear()), pageWidth - margem, cursorY, { align: 'right' })
    cursorY += 16

    const colW = larguraUtil / porLinha
    historicoMensal.forEach((m, i) => {
      const col = i % porLinha
      const linha = Math.floor(i / porLinha)
      const x = margem + col * colW + colW / 2
      const y = cursorY + linha * alturaLinhaMes
      fontePadrao('bold', 7.5)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(m.mes, x, y, { align: 'center' })
      fontePadrao('bold', 8.5)
      doc.setTextColor(...COR_VERDE)
      doc.text(String(m.presentes), x - 7, y + 11, { align: 'center' })
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text('·', x, y + 11, { align: 'center' })
      doc.setTextColor(...COR_VERMELHO)
      doc.text(String(m.faltas), x + 7, y + 11, { align: 'center' })
    })
    cursorY += numLinhas * alturaLinhaMes + 8
  }

  // ---------- Legenda dos 5 níveis do PC Score (rodapé didático) ----------
  if (niveisPcScore?.length) {
    const legendaY = doc.internal.pageSize.getHeight() - 60
    doc.setDrawColor(215, 210, 200)
    doc.setLineWidth(0.5)
    doc.line(margem, legendaY - 8, pageWidth - margem, legendaY - 8)
    fontePadrao('normal', 6.5)
    const colW = larguraUtil / niveisPcScore.length
    niveisPcScore.forEach((n, i) => {
      const x = margem + i * colW
      doc.setFillColor(...n.cor)
      doc.circle(x + 4, legendaY, 3, 'F')
      doc.setTextColor(...COR_TINTA)
      doc.text(`${n.label} (${n.min}-${n.max})`, x + 10, legendaY + 2.5)
    })
  }

  // ---------- Rodapé ----------
  const pageHeight = doc.internal.pageSize.getHeight()
  fontePadrao('normal', 7)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Gerado pelo ProCoach em ${geradoEm} · procoachsport.com.br`, pageWidth / 2, pageHeight - 24, { align: 'center' })
  doc.text(`BEYOND · ${nomeEmpresa.toUpperCase()} · ${new Date().getFullYear()}`, pageWidth / 2, pageHeight - 14, { align: 'center' })

  // Devolve o blob em vez de chamar doc.save() direto — quem chama decide se baixa
  // (URL.createObjectURL + <a download>, mais confiável entre navegadores que o fallback do
  // jsPDF) ou encaminha via Web Share API (navigator.share com o arquivo de verdade anexado).
  return {
    blob: doc.output('blob'),
    filename: `evolucao-tecnica-${slugificar(alunoNome)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  }
}

// ============================================================================================
// PDF — Regras do Ranking "Pontuação Beyond" (módulo Ranking) — documento didático, mesmo
// layout Beyond dos relatórios executivos, pode virar 2 páginas dependendo do conteúdo. Todos
// os números vêm de src/lib/pontuacaoBeyond.js (nunca duplicados aqui), igual já é feito na
// página /pontuacao pro PC Score.
// ============================================================================================

function hexParaRgbPdf(hex) {
  const limpo = hex.replace('#', '')
  const bigint = parseInt(limpo, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

// Mesmo exemplo do "líder" (Rafael, 24 jogos, Ouro) e da tabela de ciclo (10 atletas fictícios)
// usados na página /regras-ranking (ComoFuncionaORankingPage.jsx) — mantidos idênticos aqui
// pra o PDF bater com a tela, exatamente como o documento oficial de regras.
const LIDER_EXEMPLO = { nome: 'Rafael', jogos: 24, nivel: 'Ouro', media: 97.9 }
const EXEMPLO_CICLO_PDF = [
  { pos: 1, nome: 'Rafael', jogos: 24, nivel: 'Ouro', media: 97.9, peso: 1.5, pontuacao: 146.9, movimento: 'sobe' },
  { pos: 2, nome: 'Bruno', jogos: 22, nivel: 'Ouro', media: 85.9, peso: 1.5, pontuacao: 128.9, movimento: 'sobe' },
  { pos: 3, nome: 'Diego', jogos: 13, nivel: 'Prata', media: 90.0, peso: 1.2, pontuacao: 108.0, movimento: null },
  { pos: 4, nome: 'Gustavo', jogos: 9, nivel: 'Bronze', media: 87.8, peso: 1.0, pontuacao: 87.8, movimento: null },
  { pos: 5, nome: 'Paulo', jogos: 11, nivel: 'Prata', media: 70.9, peso: 1.2, pontuacao: 85.1, movimento: null },
  { pos: 6, nome: 'Thiago', jogos: 16, nivel: 'Prata', media: 68.8, peso: 1.2, pontuacao: 82.5, movimento: null },
  { pos: 7, nome: 'Enrico', jogos: 8, nivel: 'Bronze', media: 76.2, peso: 1.0, pontuacao: 76.2, movimento: null },
  { pos: 8, nome: 'Leonardo', jogos: 6, nivel: 'Bronze', media: 75.0, peso: 1.0, pontuacao: 75.0, movimento: null },
  { pos: 9, nome: 'Marcelo', jogos: 18, nivel: 'Prata', media: 54.4, peso: 1.2, pontuacao: 65.3, movimento: 'desce' },
  { pos: 10, nome: 'Fernando', jogos: 5, nivel: 'Bronze', media: 30.0, peso: 1.0, pontuacao: 30.0, movimento: 'desce' },
]

// Ordem de exibição do peso de categoria (Ranking Geral) — mesma ordem da tela /regras-ranking.
const ORDEM_PESO_CATEGORIA = ['Iniciante', 'Intermediário', 'Avançado']
const LIDER_CATEGORIA_EXEMPLO = 'Avançado'

export async function exportarRegrasRankingPDF({ empresa } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2

  let logoBeyond = null
  let logoUnidade = null
  try { logoBeyond = await carregarLogoAutoCrop(LOGO_BEYOND_PRETO, 260) } catch {}
  try { logoUnidade = await carregarLogoAutoCrop(LOGO_UNIDADE_PRETO[empresa], 260) } catch {}

  function fontePadrao(estilo, tamanho) {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }

  const nomeEmpresa = NOME_EMPRESA[empresa] || empresa || ''
  let cursorY = 0
  let primeiraPagina = true

  function desenharCabecalho() {
    doc.setFillColor(...COR_CREME)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    const alturaLogo = 20
    const yTopoLogo = 22
    desenharLockupLogos(doc, { logoBeyond, logoUnidade, x: margem, yTopo: yTopoLogo, altura: alturaLogo, corLinha: COR_TEXTO_SUAVE })
    fontePadrao('bold', 10)
    doc.setTextColor(...COR_VINHO)
    doc.text('REGRAS DO RANKING', pageWidth - margem, yTopoLogo + alturaLogo / 2 + 2, { align: 'right' })

    const faixaY = 56
    const faixaW = larguraUtil / 4
    CORES_CHIP.forEach((cor, i) => {
      doc.setFillColor(...cor)
      doc.rect(margem + i * faixaW, faixaY, faixaW - 3, 4, 'F')
    })
    cursorY = faixaY + 30

    if (primeiraPagina) {
      fontePadrao('bold', 17)
      doc.setTextColor(...COR_TINTA)
      doc.text('Pontuação Beyond — Como Funciona o Ranking', margem, cursorY)
      cursorY += 16
      fontePadrao('normal', 9)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(`Regras oficiais para associados · Ranking Interno de Tênis · ${nomeEmpresa}`, margem, cursorY)
      cursorY += 22
      primeiraPagina = false
    }
  }

  function desenharRodape() {
    fontePadrao('normal', 7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text('Regras do Ranking · Pontuação Beyond · gerado pelo ProCoach · procoachsport.com.br', margem, pageHeight - 20)
    doc.text(`BEYOND · ${nomeEmpresa.toUpperCase()} · ${new Date().getFullYear()}`, pageWidth - margem, pageHeight - 20, { align: 'right' })
  }

  function precisaNovaPagina(alturaNecessaria) {
    if (cursorY + alturaNecessaria <= pageHeight - 40) return
    desenharRodape()
    doc.addPage()
    desenharCabecalho()
  }

  function numeroCirculo(n, x, y) {
    doc.setFillColor(...COR_VINHO)
    doc.circle(x + 7, y - 5, 8, 'F')
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_BRANCO)
    doc.text(String(n), x + 7, y - 2, { align: 'center' })
  }

  function tituloSecao(n, texto) {
    precisaNovaPagina(30)
    numeroCirculo(n, margem, cursorY)
    fontePadrao('bold', 11.5)
    doc.setTextColor(...COR_TINTA)
    doc.text(texto, margem + 20, cursorY - 2)
    cursorY += 18
  }

  function paragrafo(texto, tamanho = 9) {
    fontePadrao('normal', tamanho)
    const linhas = doc.splitTextToSize(texto, larguraUtil)
    precisaNovaPagina(linhas.length * 12 + 10)
    doc.setTextColor(60, 56, 50)
    doc.text(linhas, margem, cursorY)
    cursorY += linhas.length * 12 + 10
  }

  // Caixa de destaque (aviso/callout), com barra colorida à esquerda — reaproveitada pra
  // "por que assiduidade" (seção 2) e "os dois se completam" (seção 6).
  function caixaDestaque(texto, corBarra) {
    fontePadrao('normal', 9)
    const linhas = doc.splitTextToSize(texto, larguraUtil - 20)
    const altura = linhas.length * 12 + 14
    precisaNovaPagina(altura + 8)
    doc.setFillColor(250, 245, 230)
    doc.roundedRect(margem, cursorY, larguraUtil, altura, 6, 6, 'F')
    doc.setFillColor(...corBarra)
    doc.rect(margem, cursorY, 3, altura, 'F')
    doc.setTextColor(70, 64, 50)
    doc.text(linhas, margem + 14, cursorY + 16)
    cursorY += altura + 10
  }

  desenharCabecalho()

  // ---------- 1. Os pontos de cada jogo ----------
  tituloSecao(1, 'Os pontos de cada jogo')
  precisaNovaPagina(56)
  const pontos4 = [
    { valor: PONTOS_POR_RESULTADO.avulso.vitoria, label: 'Vitória', cor: COR_SALVIA },
    { valor: PONTOS_POR_RESULTADO.avulso.derrota, label: 'Derrota', cor: COR_LARANJA },
    { valor: PONTOS_POR_RESULTADO.torneio.vitoria, label: 'Vitória Torneio', cor: COR_MARINHO },
    { valor: PONTOS_POR_RESULTADO.torneio.derrota, label: 'Derrota Torneio', cor: COR_VINHO },
  ]
  const wCaixaPonto = (larguraUtil - 3 * 8) / 4
  pontos4.forEach((p, i) => {
    const x = margem + i * (wCaixaPonto + 8)
    doc.setFillColor(...p.cor)
    doc.roundedRect(x, cursorY, wCaixaPonto, 46, 6, 6, 'F')
    fontePadrao('bold', 17)
    doc.setTextColor(...COR_BRANCO)
    doc.text(String(p.valor), x + wCaixaPonto / 2, cursorY + 24, { align: 'center' })
    fontePadrao('bold', 6.5)
    doc.text(p.label.toUpperCase(), x + wCaixaPonto / 2, cursorY + 36, { align: 'center' })
  })
  cursorY += 60
  paragrafo('Todo jogo dá pontos aos dois jogadores — ganhar vale mais, mas perder também pontua. Nos torneios internos os pontos valem o dobro, para estimular a participação.')

  // ---------- 2. A fórmula ----------
  tituloSecao(2, 'Sua Pontuação Beyond = média × nível de assiduidade')
  paragrafo('Primeiro o sistema calcula a média dos seus pontos (soma dividida pelo número de jogos). Depois multiplica pelo seu nível de assiduidade — quanto mais você joga, maior o seu nível:')

  precisaNovaPagina(50)
  const wCaixaNivel = (larguraUtil - 2 * 8) / 3
  NIVEIS_ASSIDUIDADE.forEach((n, i) => {
    const x = margem + i * (wCaixaNivel + 8)
    const corRgb = hexParaRgbPdf(n.cor)
    doc.setFillColor(...corRgb)
    doc.roundedRect(x, cursorY, wCaixaNivel, 42, 6, 6, 'F')
    fontePadrao('bold', 10)
    doc.setTextColor(...(n.chave === 'Prata' ? [70, 70, 70] : COR_TINTA))
    doc.text(n.chave.toUpperCase(), x + wCaixaNivel / 2, cursorY + 15, { align: 'center' })
    fontePadrao('normal', 7)
    const faixa = n.max === Infinity ? `${n.min}+ jogos` : `${n.min} a ${n.max} jogos`
    doc.text(faixa, x + wCaixaNivel / 2, cursorY + 26, { align: 'center' })
    fontePadrao('bold', 12)
    doc.text(`×${n.multiplicador}`, x + wCaixaNivel / 2, cursorY + 38, { align: 'center' })
  })
  cursorY += 56

  caixaDestaque(
    'Por que o nível de assiduidade? Para valorizar quem frequenta e joga com constância. Dois atletas com a mesma média: quem joga mais tem nível maior e sobe no ranking. Aparecer e jogar compensa!',
    COR_LARANJA
  )

  // ---------- 3. Exemplo real — como o líder pontuou ----------
  tituloSecao(3, 'Exemplo real — como o líder pontuou')
  const nivelLider = NIVEIS_ASSIDUIDADE.find(n => n.chave === LIDER_EXEMPLO.nivel)
  const pontuacaoLider = Math.round(LIDER_EXEMPLO.media * nivelLider.multiplicador * 10) / 10
  precisaNovaPagina(70)
  doc.setFillColor(0, 0, 0)
  doc.roundedRect(margem, cursorY, larguraUtil, 62, 8, 8, 'F')
  fontePadrao('bold', 9)
  doc.setTextColor(...hexParaRgbPdf(nivelLider.cor))
  doc.text(`${LIDER_EXEMPLO.nome.toUpperCase()} — ${LIDER_EXEMPLO.jogos} JOGOS (NÍVEL ${LIDER_EXEMPLO.nivel.toUpperCase()})`, margem + 14, cursorY + 18)
  fontePadrao('normal', 9)
  doc.setTextColor(215, 210, 205)
  doc.text(`Média dos ${LIDER_EXEMPLO.jogos} jogos = ${LIDER_EXEMPLO.media} pontos`, margem + 14, cursorY + 33)
  doc.text(`Nível ${LIDER_EXEMPLO.nivel} (${nivelLider.min}+ jogos) = ×${nivelLider.multiplicador}`, margem + 14, cursorY + 45)
  fontePadrao('bold', 9)
  doc.setTextColor(...COR_BRANCO)
  doc.text(`Pontuação Beyond = ${LIDER_EXEMPLO.media} × ${nivelLider.multiplicador} = `, margem + 14, cursorY + 57)
  const larguraFrase = doc.getTextWidth(`Pontuação Beyond = ${LIDER_EXEMPLO.media} × ${nivelLider.multiplicador} = `)
  doc.setTextColor(...hexParaRgbPdf(nivelLider.cor))
  doc.text(String(pontuacaoLider), margem + 14 + larguraFrase, cursorY + 57)
  cursorY += 78

  // ---------- 4. Tabela do ciclo — exemplo com 10 atletas ----------
  tituloSecao(4, 'Tabela do ciclo — exemplo com 10 atletas')
  const colTab = [
    { titulo: '', w: 24 },
    { titulo: 'ATLETA', w: 118 },
    { titulo: 'JOGOS', w: 45 },
    { titulo: 'NÍVEL', w: 52 },
    { titulo: 'MÉDIA', w: 48 },
    { titulo: 'PESO', w: 38 },
    { titulo: 'PONTUAÇÃO BEYOND', w: larguraUtil - (24 + 118 + 45 + 52 + 48 + 38) },
  ]
  precisaNovaPagina(24 + EXEMPLO_CICLO_PDF.length * 22)
  doc.setFillColor(0, 0, 0)
  doc.rect(margem, cursorY - 12, larguraUtil, 20, 'F')
  fontePadrao('bold', 7)
  doc.setTextColor(...COR_BRANCO)
  let xTab = margem
  colTab.forEach(c => { if (c.titulo) doc.text(c.titulo, xTab + (c.w === colTab[0].w ? 0 : 6), cursorY - 4); xTab += c.w })
  cursorY += 14
  EXEMPLO_CICLO_PDF.forEach((a, i) => {
    precisaNovaPagina(22)
    if (i % 2 === 1) {
      doc.setFillColor(249, 247, 243)
      doc.rect(margem, cursorY - 12, larguraUtil, 20, 'F')
    }
    let x = margem
    const corBadge = hexParaRgbPdf(NIVEIS_ASSIDUIDADE.find(n => n.chave === a.nivel)?.cor || '#888888')
    doc.setFillColor(...corBadge)
    doc.circle(x + 9, cursorY - 4, 8, 'F')
    fontePadrao('bold', 8)
    doc.setTextColor(...(a.nivel === 'Prata' ? [70, 70, 70] : COR_TINTA))
    doc.text(String(a.pos), x + 9, cursorY - 1, { align: 'center' })
    x += colTab[0].w

    fontePadrao('bold', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text(a.nome, x + 6, cursorY)
    x += colTab[1].w

    fontePadrao('normal', 8.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(String(a.jogos), x, cursorY)
    x += colTab[2].w

    fontePadrao('bold', 7.5)
    doc.setTextColor(...corBadge)
    doc.text(a.nivel.toUpperCase(), x, cursorY)
    x += colTab[3].w

    fontePadrao('normal', 8.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(String(a.media), x, cursorY)
    x += colTab[4].w

    doc.text(`×${a.peso}`, x, cursorY)
    x += colTab[5].w

    fontePadrao('bold', 10)
    doc.setTextColor(...COR_VINHO)
    doc.text(String(a.pontuacao), x, cursorY)
    if (a.movimento) {
      const larguraNum = doc.getTextWidth(String(a.pontuacao))
      fontePadrao('bold', 7.5)
      doc.setTextColor(...(a.movimento === 'sobe' ? COR_VERDE : COR_VERMELHO))
      doc.text(a.movimento === 'sobe' ? ' ↑ sobe' : ' ↓ desce', x + larguraNum, cursorY)
    }
    cursorY += 20
  })
  cursorY += 8
  paragrafo('Repare: o Diego (13 jogos, Prata) tem média melhor que o Bruno, mas o Bruno lidera com o nível Ouro e muitos jogos. Já o Gustavo (Bronze, 9 jogos) fica à frente de vários Pratas graças à sua média alta. Cada um sobe do seu jeito: jogando bem, jogando muito, ou os dois.')

  // ---------- 5. Ranking Geral: peso extra por categoria ----------
  tituloSecao(5, 'Ranking Geral: peso extra por categoria')
  paragrafo('Você aparece em dois rankings: o da sua Categoria (Iniciante, Intermediário ou Avançado) e o Geral, que junta todo mundo numa lista só. No Geral, vencer em categorias mais avançadas vale mais pontos, porque o nível de dificuldade é maior.')

  precisaNovaPagina(50)
  const wCaixaPeso = (larguraUtil - 2 * 8) / 3
  ORDEM_PESO_CATEGORIA.forEach((nome, i) => {
    const x = margem + i * (wCaixaPeso + 8)
    doc.setFillColor(...COR_VINHO)
    doc.roundedRect(x, cursorY, wCaixaPeso, 38, 6, 6, 'F')
    fontePadrao('bold', 9.5)
    doc.setTextColor(...COR_BRANCO)
    doc.text(nome.toUpperCase(), x + wCaixaPeso / 2, cursorY + 16, { align: 'center' })
    fontePadrao('bold', 13)
    doc.text(`×${PESO_CATEGORIA[nome]}`, x + wCaixaPeso / 2, cursorY + 31, { align: 'center' })
  })
  cursorY += 52

  const pontuacaoLiderGeral = pontuacaoComPesoCategoria(pontuacaoLider, LIDER_CATEGORIA_EXEMPLO)
  precisaNovaPagina(70)
  doc.setFillColor(0, 0, 0)
  doc.roundedRect(margem, cursorY, larguraUtil, 62, 8, 8, 'F')
  fontePadrao('bold', 9)
  doc.setTextColor(...COR_LARANJA)
  doc.text(`${LIDER_EXEMPLO.nome.toUpperCase()} NA CATEGORIA ${LIDER_CATEGORIA_EXEMPLO.toUpperCase()}`, margem + 14, cursorY + 18)
  fontePadrao('normal', 9)
  doc.setTextColor(215, 210, 205)
  doc.text(`Pontuação Beyond (Categoria) = ${pontuacaoLider}`, margem + 14, cursorY + 33)
  doc.text(`Peso da categoria ${LIDER_CATEGORIA_EXEMPLO} = ×${PESO_CATEGORIA[LIDER_CATEGORIA_EXEMPLO]}`, margem + 14, cursorY + 45)
  fontePadrao('bold', 9)
  doc.setTextColor(...COR_BRANCO)
  doc.text(`Pontuação Beyond (Geral) = ${pontuacaoLider} × ${PESO_CATEGORIA[LIDER_CATEGORIA_EXEMPLO]} = `, margem + 14, cursorY + 57)
  const larguraFraseGeral = doc.getTextWidth(`Pontuação Beyond (Geral) = ${pontuacaoLider} × ${PESO_CATEGORIA[LIDER_CATEGORIA_EXEMPLO]} = `)
  doc.setTextColor(...COR_LARANJA)
  doc.text(String(pontuacaoLiderGeral), margem + 14 + larguraFraseGeral, cursorY + 57)
  cursorY += 78

  caixaDestaque(
    'Isso garante que um atleta Avançado fique corretamente à frente no Geral, mas sem travar a mobilidade: um Iniciante excepcional ainda pode superar um Avançado de baixo desempenho. Na sua Categoria, esse peso não entra — lá todo mundo já está competindo no mesmo nível.',
    COR_VINHO
  )

  // ---------- 6. As 4 regras ----------
  tituloSecao(6, 'As 4 regras que você precisa saber')
  const regras = [
    `Mínimo de ${MINIMO_JOGOS_CLASSIFICACAO} jogos. Antes disso seus pontos são registrados, mas você ainda não aparece na classificação (fica "em qualificação"). No ${MINIMO_JOGOS_CLASSIFICACAO}º jogo, você entra.`,
    `Seus jogos valem por ${JANELA_DIAS} dias. Cada partida conta pelos últimos ${JANELA_DIAS} dias; depois expira. Quem para de jogar vai caindo no ranking naturalmente, aos poucos — nunca zera de uma vez.`,
    'Perder também conta. A derrota entra na sua média e pode puxá-la para baixo. Se você entrar em má fase, seu ranking reflete isso — mantendo tudo justo e atual.',
    'Cortes a cada 3 meses. Na mesma época das avaliações técnicas, os melhores de cada categoria sobem de nível e os últimos descem, mantendo todos jogando contra adversários do seu nível.',
  ]
  regras.forEach((r, i) => {
    fontePadrao('normal', 9)
    const linhas = doc.splitTextToSize(`${i + 1}. ${r}`, larguraUtil - 20)
    const altura = linhas.length * 12 + 12
    precisaNovaPagina(altura + 6)
    doc.setFillColor(250, 245, 230)
    doc.roundedRect(margem, cursorY, larguraUtil, altura, 6, 6, 'F')
    doc.setTextColor(70, 64, 50)
    doc.text(linhas, margem + 10, cursorY + 15)
    cursorY += altura + 8
  })
  cursorY += 4

  // ---------- 6. Dois números no seu perfil ----------
  tituloSecao(7, 'Dois números no seu perfil')
  paragrafo('No seu card dentro do app você verá dois indicadores diferentes, que medem coisas distintas:')

  precisaNovaPagina(56)
  const wCard = (larguraUtil - 10) / 2
  doc.setFillColor(...COR_BRANCO)
  doc.roundedRect(margem, cursorY, wCard, 50, 6, 6, 'F')
  doc.roundedRect(margem + wCard + 10, cursorY, wCard, 50, 6, 6, 'F')
  fontePadrao('bold', 9.5)
  doc.setTextColor(...COR_LARANJA)
  doc.text('Pontuação Beyond', margem + 10, cursorY + 16)
  doc.setTextColor(...COR_VINHO)
  doc.text('PC Score (técnico)', margem + wCard + 20, cursorY + 16)
  fontePadrao('normal', 7.5)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(doc.splitTextToSize('Seu desempenho nas partidas. Quanto maior, melhor.', wCard - 20), margem + 10, cursorY + 28)
  doc.text(doc.splitTextToSize('Sua evolução técnica avaliada pelo professor. Quanto menor, melhor.', wCard - 20), margem + wCard + 20, cursorY + 28)
  cursorY += 62

  caixaDestaque(
    'Os dois se completam: quanto melhor sua técnica (PC Score baixo), mais partidas você tende a vencer (Pontuação Beyond alta).',
    COR_VINHO
  )

  paragrafo(`Dúvidas? Fale com a recepção ou a coordenação do ${nomeEmpresa}.`)

  desenharRodape()
  doc.save(`regras-ranking-beyond-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

// ============================================================================================
// PDF — Tabela de classificação do Ranking "Pontuação Beyond" (item 9). Mesmas colunas da
// visão do associado na Aba Ranking — sem média/multiplicador, que ficam só no detalhe da
// tela (ver item 11 do módulo). Pagina automaticamente se a lista passar de 1 página.
// ============================================================================================

const CORES_TOP3_PDF = { 1: [180, 140, 30], 2: [140, 140, 140], 3: [150, 110, 60] }

export async function exportarClassificacaoRankingPDF(dados, { empresa } = {}) {
  const { modalidadeNome, tipoRankingLabel, generoLabel, ciclo, posicoes } = dados
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2

  let logoBeyond = null
  let logoUnidade = null
  try { logoBeyond = await carregarLogoAutoCrop(LOGO_BEYOND_PRETO, 260) } catch {}
  try { logoUnidade = await carregarLogoAutoCrop(LOGO_UNIDADE_PRETO[empresa], 260) } catch {}

  function fontePadrao(estilo, tamanho) {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }

  const nomeEmpresa = NOME_EMPRESA[empresa] || empresa || ''
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")
  let cursorY = 0

  const colunas = [
    { titulo: '#', w: larguraUtil * 0.08 },
    { titulo: 'Nome', w: larguraUtil * 0.42 },
    { titulo: 'Jogos', w: larguraUtil * 0.14 },
    { titulo: 'Nível', w: larguraUtil * 0.16 },
    { titulo: 'Pontuação', w: larguraUtil * 0.20 },
  ]

  function desenharCabecalho() {
    doc.setFillColor(...COR_CREME)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    const alturaLogo = 20
    const yTopoLogo = 22
    const textoX = desenharLockupLogos(doc, { logoBeyond, logoUnidade, x: margem, yTopo: yTopoLogo, altura: alturaLogo, corLinha: COR_TEXTO_SUAVE })
    fontePadrao('bold', 14)
    doc.setTextColor(...COR_TINTA)
    doc.text('RANKING · PONTUAÇÃO BEYOND', textoX, yTopoLogo + alturaLogo / 2 - 3)
    fontePadrao('italic', 8.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(
      `${nomeEmpresa.toUpperCase()} · ${modalidadeNome.toUpperCase()} · ${tipoRankingLabel.toUpperCase()} · ${generoLabel.toUpperCase()} · CICLO ${ciclo}`,
      textoX, yTopoLogo + alturaLogo / 2 + 10
    )
    fontePadrao('normal', 7.5)
    doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 26, { align: 'right' })

    const faixaY = 56
    const faixaW = larguraUtil / 4
    CORES_CHIP.forEach((cor, i) => {
      doc.setFillColor(...cor)
      doc.rect(margem + i * faixaW, faixaY, faixaW - 3, 4, 'F')
    })
    cursorY = faixaY + 30
  }

  function desenharCabecalhoTabela() {
    fontePadrao('bold', 8.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    let x = margem
    colunas.forEach(c => { doc.text(c.titulo, x, cursorY); x += c.w })
    cursorY += 6
    doc.setDrawColor(215, 210, 200)
    doc.line(margem, cursorY, margem + larguraUtil, cursorY)
    cursorY += 16
  }

  function desenharRodape() {
    fontePadrao('normal', 7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`Gerado pelo ProCoach em ${geradoEm} · procoachsport.com.br`, pageWidth / 2, pageHeight - 24, { align: 'center' })
    doc.text(`BEYOND · ${nomeEmpresa.toUpperCase()} · ${new Date().getFullYear()}`, pageWidth / 2, pageHeight - 14, { align: 'center' })
  }

  function precisaNovaPagina(alturaNecessaria) {
    if (cursorY + alturaNecessaria <= pageHeight - 50) return
    desenharRodape()
    doc.addPage()
    desenharCabecalho()
    desenharCabecalhoTabela()
  }

  desenharCabecalho()
  desenharCabecalhoTabela()

  if (!posicoes?.length) {
    fontePadrao('normal', 10)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text('Ninguém classificado ainda nesse recorte.', margem, cursorY)
    cursorY += 20
  }

  ;(posicoes || []).forEach((p, i) => {
    precisaNovaPagina(22)
    if (i % 2 === 1) {
      doc.setFillColor(249, 247, 243)
      doc.rect(margem, cursorY - 12, larguraUtil, 20, 'F')
    }
    let x = margem
    fontePadrao('bold', 9.5)
    doc.setTextColor(...(CORES_TOP3_PDF[p.posicao] || COR_TINTA))
    doc.text(String(p.posicao), x, cursorY)
    x += colunas[0].w

    fontePadrao('normal', 9.5)
    doc.setTextColor(...COR_TINTA)
    doc.text(p.nome || '', x, cursorY)
    x += colunas[1].w

    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(String(p.numJogos ?? ''), x, cursorY)
    x += colunas[2].w

    doc.setTextColor(...COR_VINHO)
    doc.text(p.nivel || '—', x, cursorY)
    x += colunas[3].w

    fontePadrao('bold', 10)
    doc.setTextColor(...COR_TINTA)
    doc.text(String(p.pontuacaoBeyond ?? ''), x, cursorY)

    cursorY += 20
  })

  desenharRodape()
  doc.save(`ranking-${slugificar(modalidadeNome)}-${ciclo}.pdf`)
}
