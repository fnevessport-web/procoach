import { format } from 'date-fns'

// Relatório de Cruzamento com o Clube — uso interno. Mostra o que NÃO bateu entre o
// relatório de pagantes do clube e a presença de verdade no ProCoach, pra dar noção de
// quanto está sendo deixado de receber (ou, no mínimo, o que precisa de revisão manual —
// ver `motivo` de cada linha em useCruzamentoClube.js).

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function exportarCruzamentoClubePDF(dados, { periodo }) {
  const { totalClube, totalBateram, totalSemCorrespondencia, valorSemCorrespondencia, semCorrespondencia, porModalidade } = dados
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2
  const periodoLabel = `${format(new Date(periodo.inicio + 'T12:00'), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim + 'T12:00'), 'dd/MM/yyyy')}`
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  function rodape() {
    const total = doc.internal.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(`Uso interno - não distribuir  ·  Gerado pelo ProCoach em ${geradoEm}  ·  Página ${i}/${total}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COR_TINTA)
  doc.text('CRUZAMENTO COM RELATÓRIO DO CLUBE', margem, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 32, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 43, { align: 'right' })

  let cursorY = 66

  const pctBateram = totalClube > 0 ? Math.round((totalBateram / totalClube) * 100) : 0
  const cards = [
    { label: 'Linhas do clube', valor: String(totalClube), cor: COR_TINTA },
    { label: 'Bateram', valor: `${totalBateram} (${pctBateram}%)`, cor: [75, 139, 106] },
    { label: 'Sem correspondência', valor: String(totalSemCorrespondencia), cor: [180, 71, 47] },
    { label: 'Valor sem correspondência', valor: fmtBRL(valorSemCorrespondencia), cor: [180, 71, 47] },
  ]
  const cardW = (larguraUtil - 24) / 4
  cards.forEach((c, i) => {
    const x = margem + i * (cardW + 8)
    doc.setDrawColor(...COR_LINHA)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, cursorY, cardW, 46, 4, 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...c.cor)
    doc.text(c.valor, x + cardW / 2, cursorY + 22, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(c.label, x + cardW / 2, cursorY + 36, { align: 'center' })
  })
  cursorY += 60

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_TINTA)
  const aviso = doc.splitTextToSize(
    '"Sem correspondência" não é necessariamente prejuízo confirmado — parte é diferença de grafia de nome entre os dois sistemas que precisa de revisão manual (ver coluna "Motivo" na tabela). Cruzamento por nome (primeiro + último) + modalidade + horário — não por data exata, já que a coluna Data do clube é hora de processamento da cobrança, não da aula.',
    larguraUtil
  )
  doc.text(aviso, margem, cursorY)
  cursorY += aviso.length * 11 + 16

  // ---------- Por modalidade ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Por modalidade', margem, cursorY)
  cursorY += 8
  autoTable(doc, {
    startY: cursorY,
    head: [['Modalidade', 'Linhas no clube', 'Sem correspondência', '% sem correspondência']],
    body: porModalidade.map(m => [
      m.modalidade, String(m.total), String(m.semCorrespondencia),
      `${m.total > 0 ? Math.round((m.semCorrespondencia / m.total) * 100) : 0}%`,
    ]),
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    margin: { left: margem, right: margem },
  })
  cursorY = doc.lastAutoTable.finalY + 20

  // ---------- Detalhe: sem correspondência ----------
  if (cursorY > pageHeight - 140) { doc.addPage(); cursorY = margem }
  doc.setFillColor(...COR_SAIBRO)
  doc.roundedRect(margem, cursorY, larguraUtil, 20, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COR_BRANCO)
  doc.text('Linhas do clube sem correspondência confirmada no ProCoach', margem + 10, cursorY + 14)
  cursorY += 26

  autoTable(doc, {
    startY: cursorY,
    head: [['Nome (clube)', 'Modalidade', 'Turma', 'Valor', 'Motivo']],
    body: semCorrespondencia.map(l => [l.nome, l.modalidadeClube, l.turmaTexto, fmtBRL(l.valor), l.motivo]),
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
    headStyles: { fillColor: [240, 236, 228], textColor: COR_TINTA, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: { 3: { cellWidth: 55, halign: 'right' }, 4: { cellWidth: 130 } },
    margin: { left: margem, right: margem },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 4) {
        const motivo = semCorrespondencia[d.row.index]?.motivo
        if (motivo?.startsWith('Nome não')) d.cell.styles.textColor = [180, 71, 47]
        else d.cell.styles.textColor = [201, 138, 60]
      }
    },
  })

  rodape()
  doc.save(`cruzamento-clube-${periodo.inicio}-a-${periodo.fim}.pdf`)
}
