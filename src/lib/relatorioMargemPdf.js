import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Relatório de Margem (Tênis/Procópio) — uso interno only. Nunca reaproveitar isso no
// relatorioPdf.js (aquele vai pra Beyond, ver decisão registrada na conversa que criou este
// arquivo) nem expor qualquer valor daqui pro professor. Sem a identidade Beyond/Procópio de
// propósito — é um documento de gestão interna, não um relatório de marca pro parceiro.

const COR_TINTA = [30, 43, 36]        // --color-brand-verde-court
const COR_SAIBRO = [165, 76, 46]      // --color-brand-saibro (accent)
const COR_SUCESSO = [75, 139, 106]    // --color-state-success
const COR_PERIGO = [180, 71, 47]      // --color-state-danger
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(dataStr) {
  return format(parseISO(dataStr + 'T12:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })
}
function fmtDataCurta(dataStr) {
  return format(parseISO(dataStr + 'T12:00:00'), 'dd/MM', { locale: ptBR })
}
function sinal(v) {
  return v >= 0 ? `+${fmtBRL(v)}` : `−${fmtBRL(Math.abs(v))}`
}

export async function exportarRelatorioMargemPDF(dados, { periodo }) {
  const { resumo, porDia, porTurma, porProfessor, detalheAulas } = dados
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40

  const periodoLabel = `${format(new Date(periodo.inicio + 'T12:00'), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim + 'T12:00'), 'dd/MM/yyyy')}`
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  function rodape() {
    const totalPaginas = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(`Uso interno — não distribuir  ·  Gerado pelo ProCoach em ${geradoEm}  ·  Página ${i}/${totalPaginas}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    }
  }

  // ---------- Cabeçalho + aviso de confidencialidade ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...COR_TINTA)
  doc.text('RELATÓRIO DE MARGEM — TÊNIS', margem, 44)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text('PROCÓPIO', margem, 60)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 32, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 43, { align: 'right' })

  doc.setFillColor(...COR_PERIGO)
  doc.roundedRect(margem, 74, pageWidth - margem * 2, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COR_BRANCO)
  doc.text('USO INTERNO — NÃO DISTRIBUIR (inclui rentabilidade por professor e por turma)', pageWidth / 2, 88, { align: 'center' })

  let cursorY = 116

  // ---------- Resumo executivo ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Resumo do período', margem, cursorY)
  cursorY += 10

  const cards = [
    { label: 'Aulas analisadas', valor: String(resumo.totalAulas), cor: COR_TINTA },
    { label: 'Com superávit', valor: String(resumo.aulasSuperavit), cor: COR_SUCESSO },
    { label: 'Com déficit', valor: String(resumo.aulasDeficit), cor: COR_PERIGO },
    { label: 'Margem total', valor: sinal(resumo.margemTotal), cor: resumo.margemTotal >= 0 ? COR_SUCESSO : COR_PERIGO },
  ]
  const cardW = (pageWidth - margem * 2 - 24) / 4
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
    doc.setFontSize(7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(c.label, x + cardW / 2, cursorY + 36, { align: 'center' })
  })
  cursorY += 60

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COR_TINTA)
  doc.text(`Receita estimada: ${fmtBRL(resumo.receitaTotal)}   ·   Custo pago a professores: ${fmtBRL(resumo.custoTotal)}   ·   Repasse ao clube (10%) já descontado da margem acima.`, margem, cursorY)
  cursorY += 18

  // ---------- Ranking de professores ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Ranking de professores por margem (mais rentável → menos rentável)', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Professor', 'Aulas', 'Receita', 'Custo', 'Margem', 'Margem/aula']],
    body: porProfessor.map(p => [
      p.nome, String(p.qtdAulas), fmtBRL(p.receita), fmtBRL(p.custo), sinal(p.margem), sinal(p.margemMedia),
    ]),
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.5 },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    margin: { left: margem, right: margem },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
        const bruto = porProfessor[data.row.index]?.[data.column.index === 4 ? 'margem' : 'margemMedia']
        if (bruto != null) data.cell.styles.textColor = bruto >= 0 ? COR_SUCESSO : COR_PERIGO
      }
    },
  })
  cursorY = doc.lastAutoTable.finalY + 20

  // ---------- Por turma ----------
  if (cursorY > pageHeight - 140) { doc.addPage(); cursorY = margem }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Por turma (pior margem primeiro)', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Turma', 'Horário/Quadra', 'Professor(es)', 'Aulas', 'Receita', 'Custo', 'Margem']],
    body: porTurma.map(t => [
      t.nome, t.detalhe, t.professores, String(t.qtdAulas), fmtBRL(t.receita), fmtBRL(t.custo), sinal(t.margem),
    ]),
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.5 },
    headStyles: { fillColor: COR_SAIBRO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    margin: { left: margem, right: margem },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const bruto = porTurma[data.row.index]?.margem
        if (bruto != null) data.cell.styles.textColor = bruto >= 0 ? COR_SUCESSO : COR_PERIGO
      }
    },
  })
  cursorY = doc.lastAutoTable.finalY + 20

  // ---------- Totais por dia ----------
  doc.addPage()
  cursorY = margem
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Totais por dia', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Data', 'Aulas', 'Receita', 'Custo', 'Margem']],
    body: porDia.map(d => [
      fmtData(d.data), String(d.qtdAulas), fmtBRL(d.receita), fmtBRL(d.custo), sinal(d.margem),
    ]),
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.5 },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: margem, right: margem },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const bruto = porDia[data.row.index]?.margem
        if (bruto != null) data.cell.styles.textColor = bruto >= 0 ? COR_SUCESSO : COR_PERIGO
      }
    },
  })

  // ---------- Detalhamento aula a aula (ficha completa, ordenada por data/turma) ----------
  doc.addPage()
  cursorY = margem
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Detalhamento — aula a aula', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Data', 'Turma', 'Professor', 'Alunos', 'Receita', 'Custo', 'Margem']],
    body: detalheAulas.map(l => [
      fmtDataCurta(l.data), `${l.turmaNome}${l.turmaDetalhe ? ` (${l.turmaDetalhe})` : ''}`, l.professorNome,
      String(l.qtdAlunos), fmtBRL(l.receita), fmtBRL(l.custoProfessor), sinal(l.margem),
    ]),
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    margin: { left: margem, right: margem },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const bruto = detalheAulas[data.row.index]?.margem
        if (bruto != null) data.cell.styles.textColor = bruto >= 0 ? COR_SUCESSO : COR_PERIGO
      }
    },
  })

  rodape()
  doc.save(`relatorio-margem-tenis-${periodo.inicio}-a-${periodo.fim}.pdf`)
}
