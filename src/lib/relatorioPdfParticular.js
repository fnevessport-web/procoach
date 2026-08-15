import { format } from 'date-fns'

// PDF de Evolução Técnica pro modo Particular — MESMO layout/conteúdo do relatório do clube
// (src/lib/relatorioPdf.js, que fica intocado por regra do projeto), só troca logo (ProCoach em
// vez de Beyond+unidade) e paleta de cor (tons do saibro ProCoach em vez da paleta Beyond).
// Helpers de desenho (radar, linha de evolução) são cópias das versões em relatorioPdf.js —
// esse arquivo não exporta essas funções, então não dá pra importar, só replicar.

const COR_CREME = [240, 234, 216] // --color-brand-areia
const COR_TINTA = [30, 43, 36] // --color-brand-verde-court
const COR_TEXTO_SUAVE = [110, 106, 100]
const COR_BRANCO = [255, 255, 255]
const COR_VERDE = [75, 139, 106] // --color-state-success
const COR_VERMELHO = [180, 71, 47] // --color-state-danger
const COR_SAIBRO = [165, 76, 46] // --color-action-primary — cor única de destaque (linhas/gráficos/radar)
// 4 tons do saibro (100%/75%/50%/25%) pra faixa decorativa do cabeçalho, no lugar da paleta de
// 4 cores do Beyond — mantém 1 cor só de marca, como pedido, em vez de introduzir tons novos.
const CORES_CHIP = [
  [165, 76, 46], [188, 122, 95], [210, 168, 145], [232, 213, 197],
]
// Mesmo card colorido do PC Score, só que numa progressão de saibro em vez da paleta por nível
// do Beyond (salvia/laranja/vinho/marinho).
const CARD_PC_SCORE_COR_POR_NIVEL = {
  iniciante: [210, 168, 145], basico: [210, 168, 145],
  intermediario: [188, 122, 95], avancado: [165, 76, 46], elite: [107, 46, 26],
}
const LOGO_PROCOACH = '/images/logo-pc-green.png'

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function carregarImagem(url, maxLado) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * escala))
  const h = Math.max(1, Math.round(bitmap.height * escala))
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const dataUrl = canvas.convertToBlob
    ? await blobParaDataUrl(await canvas.convertToBlob({ type: 'image/png' }))
    : canvas.toDataURL('image/png')
  return { dataUrl, aspecto: bitmap.width / bitmap.height }
}

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
  return canvas.convertToBlob
    ? await blobParaDataUrl(await canvas.convertToBlob({ type: 'image/png' }))
    : canvas.toDataURL('image/png')
}

// Cópia de desenharRadarPdf (relatorioPdf.js) — mesma lógica, não exportada de lá.
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

// Cópia de desenharLinhaEvolucaoPdf (relatorioPdf.js).
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

export async function exportarEvolucaoTecnicaPDFParticular(dados, { nomeProfissional }) {
  const {
    alunoNome, fotoUrl, modalidadeNome,
    totalPresencas, pcScoreAtual, variacaoPcScore, nivelLabel, nivelChave,
    dimensoes, evolucaoPcScore, evolucaoPorDominio, narrativaIA, conquistas,
    historicoMensal,
  } = dados

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2

  let logo = null
  let fotoBase64 = null
  try { logo = await carregarImagem(LOGO_PROCOACH, 260) } catch { /* segue sem logo se o asset falhar */ }
  if (fotoUrl) { try { fotoBase64 = await carregarImagemCircular(fotoUrl, 200) } catch { /* usa iniciais */ } }

  function fontePadrao(estilo, tamanho) {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }

  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  doc.setFillColor(...COR_CREME)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

  // ---------- Cabeçalho ----------
  const alturaLogo = 20
  const yTopoLogo = 22
  let textoX = margem
  if (logo) {
    const w = alturaLogo * logo.aspecto
    try { doc.addImage(logo.dataUrl, 'PNG', margem, yTopoLogo, w, alturaLogo) } catch { /* segue sem logo */ }
    textoX = margem + w + 12
  }
  fontePadrao('bold', 14)
  doc.setTextColor(...COR_TINTA)
  doc.text('EVOLUÇÃO TÉCNICA', textoX, yTopoLogo + alturaLogo / 2 - 3)
  fontePadrao('italic', 9)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`${(nomeProfissional || 'PROCOACH').toUpperCase()} · ${modalidadeNome.toUpperCase()}`, textoX, yTopoLogo + alturaLogo / 2 + 10)
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
    try { doc.addImage(fotoBase64, 'PNG', margem, cursorY, avatarTam, avatarTam, undefined, 'FAST') } catch { /* usa iniciais */ }
  } else {
    doc.setFillColor(...COR_SAIBRO)
    doc.circle(margem + avatarTam / 2, cursorY + avatarTam / 2, avatarTam / 2, 'F')
    const iniciais = (alunoNome || '').trim().split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
    fontePadrao('bold', 18)
    doc.setTextColor(...COR_BRANCO)
    doc.text(iniciais, margem + avatarTam / 2, cursorY + avatarTam / 2 + 6, { align: 'center' })
  }
  fontePadrao('bold', 16)
  doc.setTextColor(...COR_TINTA)
  doc.text(alunoNome || 'Aluno', margem + avatarTam + 14, cursorY + 20)
  fontePadrao('normal', 9)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`${totalPresencas} aula${totalPresencas === 1 ? '' : 's'} com presença`, margem + avatarTam + 14, cursorY + 36)

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
  desenharRadarPdf(doc, { cx: margem + colunaW / 2, cy: cursorY + alturaBlocoRadar / 2, raio: 48, dimensoes: dimensoes || [], cor: COR_SAIBRO })

  const tabelaX = margem + colunaW + 16
  let linhaY = cursorY
  const alturaLinha = alturaBlocoRadar / Math.max((dimensoes || []).length, 1)
  ;(dimensoes || []).forEach((d, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(249, 247, 243)
      doc.rect(tabelaX, linhaY, colunaW, alturaLinha, 'F')
    }
    fontePadrao('normal', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text(d.nome, tabelaX + 8, linhaY + alturaLinha / 2 + 3)
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_SAIBRO)
    doc.text(`${d.valor}/10`, tabelaX + colunaW - 8, linhaY + alturaLinha / 2 + 3, { align: 'right' })
    linhaY += alturaLinha
  })

  cursorY += alturaBlocoRadar + 12

  // ---------- Evolução — PC Score + os 5 domínios, grade 3 colunas ----------
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
        pontos: g.pontos, cor: COR_SAIBRO, valorFn: g.valorFn, min: g.min, max: g.max,
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
  if (conquistas?.length > 0) {
    fontePadrao('bold', 9)
    doc.setTextColor(...COR_TINTA)
    doc.text('CONQUISTAS', margem, cursorY)
    cursorY += 12
    fontePadrao('normal', 8)

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
  if (historicoMensal?.length > 0) {
    const larguraMinColuna = 46
    const porLinha = Math.max(1, Math.min(historicoMensal.length, Math.floor(larguraUtil / larguraMinColuna)))
    const numLinhas = Math.ceil(historicoMensal.length / porLinha)
    const alturaLinhaMes = 24
    const alturaEstimada = 16 + numLinhas * alturaLinhaMes
    if (cursorY + alturaEstimada > doc.internal.pageSize.getHeight() - 60) {
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

  // ---------- Rodapé ----------
  const pageHeight = doc.internal.pageSize.getHeight()
  fontePadrao('normal', 7)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Gerado pelo ProCoach em ${geradoEm} · procoachsport.com.br`, pageWidth / 2, pageHeight - 24, { align: 'center' })
  doc.text(`${(nomeProfissional || 'PROCOACH').toUpperCase()} · ${new Date().getFullYear()}`, pageWidth / 2, pageHeight - 14, { align: 'center' })

  return {
    blob: doc.output('blob'),
    filename: `evolucao-tecnica-${(alunoNome || 'aluno').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  }
}
