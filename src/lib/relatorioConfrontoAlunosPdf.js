import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Relatório de Confronto — Alunos em Aula (Tênis/Procópio), uso interno. Serve pra bater
// contra a lista de pagantes que o clube manda: todo aluno marcado numa aula no período,
// dia a dia, mesmo quem faltou (o clube cobra pela matrícula, não pela presença de fato).
// Só cortesia fica de fora. Mesma linha de "uso interno" de relatorioMargemPdf.js — sem
// identidade Beyond/Procópio de marca, documento de conferência, não de apresentação.

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]

function fmtDataLonga(dataStr) {
  return format(parseISO(dataStr + 'T12:00:00'), "dd/MM/yyyy (EEEE)", { locale: ptBR })
}

export async function exportarConfrontoAlunosPDF(dados, { periodo }) {
  const { porDia, nomesUnicos, totalRegistros, totalAlunosUnicos, totalDias } = dados
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
  doc.text('CONFRONTO DE ALUNOS EM AULA', margem, 40)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text('TÊNIS · PROCÓPIO', margem, 56)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 32, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 43, { align: 'right' })

  let cursorY = 76
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COR_TINTA)
  const resumo = doc.splitTextToSize(
    `${totalRegistros} registro${totalRegistros === 1 ? '' : 's'} de aluno em aula, em ${totalDias} dia${totalDias === 1 ? '' : 's'} — ${totalAlunosUnicos} aluno${totalAlunosUnicos === 1 ? '' : 's'} distinto${totalAlunosUnicos === 1 ? '' : 's'} no período. Cortesia não entra nessa lista; falta conta igual presença (o clube cobra pela matrícula, não pela presença do dia).`,
    larguraUtil
  )
  doc.text(resumo, margem, cursorY)
  cursorY += resumo.length * 11 + 16

  // ---------- Lista única (pra confronto rápido linha a linha) ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Lista única de alunos no período', margem, cursorY)
  cursorY += 8

  const metade = Math.ceil(nomesUnicos.length / 2)
  autoTable(doc, {
    startY: cursorY,
    head: [['Aluno', 'Aluno']],
    body: Array.from({ length: metade }, (_, i) => [nomesUnicos[i] || '', nomesUnicos[i + metade] || '']),
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    margin: { left: margem, right: margem },
  })
  cursorY = doc.lastAutoTable.finalY + 24

  // ---------- Dia a dia ----------
  doc.addPage()
  cursorY = margem

  porDia.forEach(({ data, itens }) => {
    if (cursorY > pageHeight - 100) { doc.addPage(); cursorY = margem }
    doc.setFillColor(...COR_SAIBRO)
    doc.roundedRect(margem, cursorY, larguraUtil, 20, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COR_BRANCO)
    doc.text(`${fmtDataLonga(data)} — ${itens.length} aluno${itens.length === 1 ? '' : 's'}`, margem + 10, cursorY + 14)
    cursorY += 26

    autoTable(doc, {
      startY: cursorY,
      head: [['Turma', 'Horário/Quadra', 'Aluno', 'Tipo', 'Presença']],
      body: itens.map(l => [l.turmaNome, l.turmaDetalhe, l.aluno, l.tipo, l.status]),
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
      headStyles: { fillColor: [240, 236, 228], textColor: COR_TINTA, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 247, 243] },
      columnStyles: { 3: { cellWidth: 60 }, 4: { cellWidth: 70 } },
      margin: { left: margem, right: margem },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 4) {
          const status = itens[d.row.index]?.status
          if (status === 'Presente') d.cell.styles.textColor = [75, 139, 106]
          else if (status?.startsWith('Falta')) d.cell.styles.textColor = [180, 71, 47]
        }
      },
    })
    cursorY = doc.lastAutoTable.finalY + 18
  })

  rodape()
  doc.save(`confronto-alunos-tenis-${periodo.inicio}-a-${periodo.fim}.pdf`)
}
