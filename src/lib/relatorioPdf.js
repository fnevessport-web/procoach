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
const LOGO_EMPRESA = { procopio: '/images/logoprocopio.png', beach_arena: '/images/logobeacharena.png' }
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

// Os PNGs de origem (logo, textura) são de alta resolução — pra não gerar um PDF
// gigante, redimensiona no canvas antes de embutir (textura vira JPEG, mais leve
// pra imagem ruidosa; logo/ícone continuam PNG pra preservar a transparência).
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

function interpolarCor(c1, c2, t) {
  return c1.map((v, i) => Math.round(v + (c2[i] - v) * t))
}

export async function exportarRelatorioPDF(rel, periodo, { empresa }) {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40

  // Carrega assets uma única vez (textura, logo da unidade, ícones de modalidade, fonte de destaque)
  let texturaBase64 = null
  let logoBase64 = null
  const iconesBase64 = []
  try { texturaBase64 = await carregarImagemRedimensionada('/images/bg-texture.png', 900, 'image/jpeg', 0.5) } catch {}
  try { logoBase64 = await carregarImagemRedimensionada(LOGO_EMPRESA[empresa], 160, 'image/png') } catch {}
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

  const paginasPintadas = new Set()
  function pintarFundo() {
    const n = doc.internal.getCurrentPageInfo().pageNumber
    if (paginasPintadas.has(n)) return
    paginasPintadas.add(n)
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

  let cursorY = margem

  function cabecalho() {
    const cx = margem + 18
    const cy = 40
    const raio = 18
    doc.setFillColor(...COR_TINTA)
    doc.circle(cx, cy, raio, 'F')
    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', cx - 13, cy - 13, 26, 26) } catch {}
    }
    fontePadrao('bold', 15)
    doc.setTextColor(...COR_TINTA)
    doc.text('RELATÓRIO EXECUTIVO', cx + raio + 12, cy - 3)
    fontePadrao('italic', 10)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(nomeEmpresa.toUpperCase(), cx + raio + 12, cy + 11)

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
    cursorY = cabecalho()
  }

  function garantirEspaco(altura) {
    if (cursorY + altura > pageHeight - 50) novaPagina()
  }

  pintarFundo()
  cursorY = cabecalho()

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

  function desenharHeatmap(heatmap) {
    if (!heatmap || heatmap.dias.length === 0 || heatmap.horas.length === 0) return
    tituloSecao('Mapa de calor de demanda — Tênis')
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

  // ---------- Conteúdo ----------

  tituloSecao('Resumo executivo')
  desenharChips([
    { label: 'Aulas Programadas', valor: rel.aulasProgramadas },
    { label: 'Aulas Dadas', valor: rel.aulasDadas },
    { label: 'Canceladas', valor: rel.aulasCanceladas },
    { label: 'Sem Aluno', valor: rel.aulasSemAluno },
    { label: 'Taxa de Realização', valor: `${rel.taxaRealizacao}%` },
    { label: 'Aulas em Feriado', valor: rel.aulasEmFeriado },
  ], 3)

  tituloSecao('Participação dos associados')
  desenharChips([
    { label: 'Alunos Únicos', valor: rel.alunosUnicos },
    { label: 'Presenças', valor: rel.presentes },
    { label: 'Faltas', valor: rel.faltas },
    { label: 'Falta Justificada', valor: rel.faltasJustificadas },
  ], 4)
  blocoDestaque('Taxa de presença', `${rel.taxaPresenca}%`, COR_VINHO)

  if (Object.keys(rel.motivosCancelamento).length > 0) {
    tituloSecao('Cancelamentos por motivo')
    barrasHorizontais(
      Object.entries(rel.motivosCancelamento).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
      COR_VINHO
    )
  }

  if (Object.keys(rel.porTipoParticipacao).length > 0) {
    tituloSecao('Perfil de uso')
    barrasHorizontais(
      Object.entries(rel.porTipoParticipacao).sort((a, b) => b[1] - a[1]).map(([tipo, total]) => ({ nome: rotuloTipo(tipo), total })),
      COR_SALVIA
    )
  }

  if (rel.porModalidade.length > 0) {
    tituloSecao('Uso por modalidade')
    tabelaEstilizada(
      [['Modalidade', 'Aulas', 'Dadas', 'Presenças']],
      rel.porModalidade.map(m => [m.nome, String(m.aulas), String(m.dadas), String(m.presencas)])
    )
  }

  tituloSecao('Comparação com o mês anterior')
  linhaComparativo('Aulas dadas', rel.aulasDadas, rel.comparativo.aulasDadasAnterior, rel.comparativo.variacaoAulasDadas)
  linhaComparativo('Taxa de presença', `${rel.taxaPresenca}%`, `${rel.comparativo.taxaPresencaAnterior}%`, rel.comparativo.variacaoTaxaPresenca)
  linhaComparativo('Alunos únicos', rel.alunosUnicos, rel.comparativo.alunosUnicosAnterior, rel.comparativo.variacaoAlunosUnicos)

  if (rel.rankingProfessores.length > 0) {
    tituloSecao('Aulas por professor')
    tabelaEstilizada(
      [['Professor', 'Aulas dadas']],
      rel.rankingProfessores.map(p => [p.nome, String(p.total)])
    )
  }

  if (empresa === 'procopio') {
    desenharHeatmap(rel.heatmapTenis)
  }

  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    fontePadrao('normal', 7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`Gerado pelo ProCoach em ${geradoEm}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
  }

  doc.save(`relatorio-${empresa}-${periodo.inicio}-a-${periodo.fim}.pdf`)
}
