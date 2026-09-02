import { format } from 'date-fns'

// PDF pra ENVIAR AO CLUBE — lista curada (o coordenador seleciona manualmente na tela antes
// de exportar, tirando cortesia não marcada como tal e nome que sabe estar errado) de alunos
// com aula dada no período que não aparecem na planilha de pagamento que o clube manda.
// Diferente de relatorioCruzamentoClubePdf.js (uso interno, "não distribuir"): este documento
// é feito pra sair do ProCoach, por isso não carrega valor estimado (é estimativa nossa, não
// dado que o clube pediu) nem o aviso de uso interno.

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]

const NOME_EMPRESA = { procopio: 'Procópio', beach_arena: 'Beach Arena' }

export async function exportarAlunosSemClubePDF(selecionados, { periodo }) {
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
      doc.text(`Gerado pelo ProCoach em ${geradoEm}  ·  Página ${i}/${total}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...COR_TINTA)
  doc.text('ALUNOS SEM COBRANÇA CORRESPONDENTE', margem, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 32, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 43, { align: 'right' })

  let cursorY = 60
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COR_TINTA)
  const resumo = doc.splitTextToSize(
    `Estes ${selecionados.length} aluno${selecionados.length === 1 ? '' : 's'} tiveram aula(s) confirmada(s) no período abaixo, mas não constam na planilha de pagamento que o clube enviou pra esse ciclo. Pedimos a gentileza de verificar a cobrança correspondente.`,
    larguraUtil
  )
  doc.text(resumo, margem, cursorY)
  cursorY += resumo.length * 11 + 16

  const empresas = [...new Set(selecionados.map(s => s.empresa))]
  empresas.forEach(empresa => {
    const itens = selecionados.filter(s => s.empresa === empresa).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    if (itens.length === 0) return

    if (cursorY > pageHeight - 120) { doc.addPage(); cursorY = margem }
    doc.setFillColor(...COR_SAIBRO)
    doc.roundedRect(margem, cursorY, larguraUtil, 22, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...COR_BRANCO)
    doc.text(`${(NOME_EMPRESA[empresa] || empresa).toUpperCase()} — ${itens.length} aluno${itens.length === 1 ? '' : 's'}`, margem + 10, cursorY + 15)
    cursorY += 30

    autoTable(doc, {
      startY: cursorY,
      head: [['Aluno', 'Modalidade', 'Dia(s)', 'Horário']],
      body: itens.map(i => [i.nome, i.modalidade, i.diasSemanaLabel, i.horario]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
      headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 247, 243] },
      margin: { left: margem, right: margem },
    })
    cursorY = doc.lastAutoTable.finalY + 20
  })

  rodape()
  doc.save(`alunos-sem-cobranca-clube-${periodo.inicio}-a-${periodo.fim}.pdf`)
}
