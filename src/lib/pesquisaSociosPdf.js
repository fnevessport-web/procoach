import { format } from 'date-fns'
import { PERGUNTAS_POR_PROFESSOR } from '../constants/pesquisaSocios'

// Relatório de Pesquisa de Satisfação de Sócios (Beyond the Club) — uso interno, mesmo
// estilo dos outros relatórios internos (relatorioMargemPdf.js, relatorioCruzamentoClubePdf.js):
// jsPDF + autoTable, cards de KPI desenhados com doc.roundedRect, sem logo Beyond/Procópio e
// sem tentar capturar os gráficos da tela (recharts) como imagem — os mesmos números viram
// tabela aqui.

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_SUCESSO = [75, 139, 106]
const COR_PERIGO = [180, 71, 47]
const COR_AVISO = [201, 138, 60]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]

function corPorMedia(media) {
  if (media >= 4.5) return COR_SUCESSO
  if (media >= 3.5) return COR_AVISO
  return COR_PERIGO
}

// Agrega as respostas brutas (jsonb) em números prontos pra tabela/card — mesmo raciocínio
// de agregação client-side já usado em outros relatórios deste projeto (ex.:
// useCampanhasPesquisaSocios), em vez de depender de agregação no banco.
function calcularAgregados(respostas, professores) {
  const total = respostas.length
  const distribuicaoNps = Array(11).fill(0)
  let somaNps = 0, qtdComNps = 0
  let promotores = 0, neutros = 0, detratores = 0

  respostas.forEach(r => {
    const nps = r.respostas?.nps
    if (typeof nps === 'number' && nps >= 0 && nps <= 10) {
      distribuicaoNps[nps]++
      somaNps += nps
      qtdComNps++
      if (nps >= 9) promotores++
      else if (nps >= 7) neutros++
      else detratores++
    }
  })
  const notaMedia = qtdComNps > 0 ? somaNps / qtdComNps : 0
  const npsScore = qtdComNps > 0 ? Math.round(((promotores - detratores) / qtdComNps) * 100) : 0

  const porProfessorMap = {}
  respostas.forEach(r => {
    Object.entries(r.respostas?.avaliacoes || {}).forEach(([profId, notas]) => {
      if (!porProfessorMap[profId]) porProfessorMap[profId] = { somas: {}, qtd: 0 }
      porProfessorMap[profId].qtd++
      PERGUNTAS_POR_PROFESSOR.forEach(p => {
        porProfessorMap[profId].somas[p.chave] = (porProfessorMap[profId].somas[p.chave] || 0) + (Number(notas[p.chave]) || 0)
      })
    })
  })
  const porProfessor = Object.entries(porProfessorMap).map(([profId, entry]) => {
    const prof = professores.find(p => p.id === profId)
    const medias = {}
    PERGUNTAS_POR_PROFESSOR.forEach(p => { medias[p.chave] = entry.somas[p.chave] / entry.qtd })
    const mediaGeral = PERGUNTAS_POR_PROFESSOR.reduce((s, p) => s + medias[p.chave], 0) / PERGUNTAS_POR_PROFESSOR.length
    return { profId, nome: prof?.nome || 'Professor removido', qtd: entry.qtd, medias, mediaGeral }
  }).sort((a, b) => b.mediaGeral - a.mediaGeral)

  const comentariosNps = respostas.map(r => r.respostas?.motivo_nota).filter(Boolean)
  const comentariosFinais = respostas.map(r => r.respostas?.comentario_final).filter(Boolean)
  const comentariosPorProfessor = {}
  respostas.forEach(r => {
    Object.entries(r.respostas?.avaliacoes || {}).forEach(([profId, notas]) => {
      if (notas.comentario) {
        if (!comentariosPorProfessor[profId]) comentariosPorProfessor[profId] = []
        comentariosPorProfessor[profId].push(notas.comentario)
      }
    })
  })

  return { total, distribuicaoNps, notaMedia, npsScore, promotores, neutros, detratores, porProfessor, comentariosNps, comentariosFinais, comentariosPorProfessor }
}

export async function exportarPesquisaSociosPDF(campanha, respostas, professores) {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  const dados = calcularAgregados(respostas, professores)

  function rodape() {
    const totalPaginas = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(`Uso interno - não distribuir  ·  Gerado pelo ProCoach em ${geradoEm}  ·  Página ${i}/${totalPaginas}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    }
  }
  function garantirEspaco(cursorY, altura) {
    if (cursorY + altura > pageHeight - 40) { doc.addPage(); return margem }
    return cursorY
  }

  // ---------- Cabeçalho ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COR_TINTA)
  doc.text('PESQUISA DE SATISFAÇÃO — SÓCIOS BEYOND THE CLUB', margem, 40)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(campanha.nome, margem, 56)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 32, { align: 'right' })

  doc.setFillColor(...COR_PERIGO)
  doc.roundedRect(margem, 68, larguraUtil, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COR_BRANCO)
  doc.text('USO INTERNO - NÃO DISTRIBUIR', pageWidth / 2, 82, { align: 'center' })

  let cursorY = 108

  // ---------- KPIs ----------
  const cards = [
    { label: 'Respostas', valor: String(dados.total), cor: COR_TINTA },
    { label: 'Nota média NPS', valor: dados.notaMedia.toFixed(1), cor: COR_TINTA },
    { label: 'NPS Score', valor: `${dados.npsScore}`, cor: dados.npsScore >= 0 ? COR_SUCESSO : COR_PERIGO },
    { label: 'Promot./Neutr./Detrat.', valor: `${dados.promotores}/${dados.neutros}/${dados.detratores}`, cor: COR_TINTA },
  ]
  const cardW = (larguraUtil - 24) / 4
  cards.forEach((c, i) => {
    const x = margem + i * (cardW + 8)
    doc.setDrawColor(...COR_LINHA)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, cursorY, cardW, 46, 4, 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...c.cor)
    doc.text(c.valor, x + cardW / 2, cursorY + 22, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(c.label, x + cardW / 2, cursorY + 36, { align: 'center' })
  })
  cursorY += 66

  // ---------- Distribuição de notas ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Distribuição de notas (NPS 0–10)', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Nota', 'Qtd', '%']],
    body: dados.distribuicaoNps.map((qtd, nota) => [String(nota), String(qtd), dados.total > 0 ? `${Math.round((qtd / dados.total) * 100)}%` : '0%']),
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4, halign: 'center' },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    margin: { left: margem, right: margem },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const nota = data.row.index
        data.cell.styles.textColor = nota >= 9 ? COR_SUCESSO : nota >= 7 ? COR_AVISO : COR_PERIGO
      }
    },
  })
  cursorY = doc.lastAutoTable.finalY + 20

  // ---------- Desempenho por professor ----------
  if (dados.porProfessor.length > 0) {
    cursorY = garantirEspaco(cursorY, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COR_TINTA)
    doc.text('Desempenho por professor (média geral, maior primeiro)', margem, cursorY)
    cursorY += 8

    autoTable(doc, {
      startY: cursorY,
      head: [['Professor', 'Aval.', 'Técnica', 'Didática', 'Pontualid.', 'Respeito', 'Evolução', 'Média']],
      body: dados.porProfessor.map(p => [
        p.nome, String(p.qtd),
        p.medias.nota_tecnica.toFixed(1), p.medias.nota_didatica.toFixed(1), p.medias.nota_pontualidade.toFixed(1),
        p.medias.nota_respeito.toFixed(1), p.medias.nota_evolucao.toFixed(1), p.mediaGeral.toFixed(1),
      ]),
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4, halign: 'center' },
      headStyles: { fillColor: COR_SAIBRO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [249, 247, 243] },
      columnStyles: { 0: { halign: 'left', cellWidth: 100 } },
      margin: { left: margem, right: margem },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          data.cell.styles.textColor = corPorMedia(dados.porProfessor[data.row.index].mediaGeral)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    cursorY = doc.lastAutoTable.finalY + 20
  }

  // ---------- Comentários ----------
  function secaoComentarios(titulo, textos) {
    if (textos.length === 0) return
    cursorY = garantirEspaco(cursorY, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...COR_TINTA)
    doc.text(titulo, margem, cursorY)
    cursorY += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    textos.forEach(texto => {
      const linhas = doc.splitTextToSize(texto, larguraUtil - 12)
      cursorY = garantirEspaco(cursorY, linhas.length * 11 + 6)
      doc.setTextColor(...COR_SAIBRO)
      doc.text('•', margem, cursorY)
      doc.setTextColor(...COR_TINTA)
      doc.text(linhas, margem + 12, cursorY)
      cursorY += linhas.length * 11 + 6
    })
    cursorY += 8
  }

  if (dados.comentariosNps.length || dados.comentariosFinais.length || Object.keys(dados.comentariosPorProfessor).length) {
    cursorY = garantirEspaco(cursorY, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...COR_TINTA)
    doc.text('Comentários', margem, cursorY)
    cursorY += 16

    secaoComentarios('Motivos das notas (NPS)', dados.comentariosNps)
    dados.porProfessor.forEach(p => {
      secaoComentarios(`Sobre ${p.nome}`, dados.comentariosPorProfessor[p.profId] || [])
    })
    secaoComentarios('Comentários finais (livres)', dados.comentariosFinais)
  }

  rodape()
  const slug = campanha.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  doc.save(`pesquisa-socios-${slug || campanha.id}.pdf`)
}
