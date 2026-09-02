import { format } from 'date-fns'

// Lista curada (o coordenador seleciona manualmente na tela antes de exportar, tirando
// cortesia não marcada como tal e nome que sabe estar errado) de alunos com aula dada no
// período que não aparecem na planilha de pagamento que o clube manda. Duas versões do
// mesmo dado, pra dois destinos diferentes:
//  - exportarAlunosSemClubeParaClubePDF: vai PRO CLUBE — sem valor (é estimativa nossa, não
//    dado que o clube pediu, não faz sentido colocar isso num documento que sai da empresa).
//  - exportarAlunosSemClubeParaDonoPDF: uso interno, pro dono da empresa — com nível/turma
//    (individual ou grupo, já que é isso que define o valor da mensalidade, ver
//    estimarMensalidadeTenis em constants/modalidades.js) e o valor estimado de 1
//    mensalidade por aluno. Cálculo interno nosso, não confirmado com o clube, por isso
//    sempre rotulado como estimativa. Só Tênis tem valor de mensalidade confirmado; outras
//    modalidades saem com "—" na coluna de valor.

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]
const COR_SUCESSO = [75, 139, 106]

const NOME_EMPRESA = { procopio: 'Procópio', beach_arena: 'Beach Arena' }

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function construirPDF(selecionados, { periodo, comValor }) {
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
      const prefixo = comValor ? 'Uso interno - não distribuir  ·  ' : ''
      doc.text(`${prefixo}Gerado pelo ProCoach em ${geradoEm}  ·  Página ${i}/${total}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...COR_TINTA)
  doc.text(comValor ? 'ALUNOS SEM COBRANÇA — ESTIMATIVA DE VALORES' : 'ALUNOS SEM COBRANÇA CORRESPONDENTE', margem, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 32, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 43, { align: 'right' })

  let cursorY = 60
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COR_TINTA)
  const textoResumo = comValor
    ? `Estes ${selecionados.length} aluno${selecionados.length === 1 ? '' : 's'} tiveram aula(s) confirmada(s) no período abaixo, mas não constam na planilha de pagamento que o clube enviou pra esse ciclo — com estimativa de quanto isso pode representar em mensalidades.`
    : `Estes ${selecionados.length} aluno${selecionados.length === 1 ? '' : 's'} tiveram aula(s) confirmada(s) no período abaixo, mas não constam na planilha de pagamento que o clube enviou pra esse ciclo. Pedimos a gentileza de verificar a cobrança correspondente.`
  const resumo = doc.splitTextToSize(textoResumo, larguraUtil)
  doc.text(resumo, margem, cursorY)
  cursorY += resumo.length * 11 + 8

  if (comValor) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    const avisoValor = doc.splitTextToSize(
      'Valor = estimativa de 1 mensalidade por aluno, calculada pela tabela de mensalidade do ProCoach (individual, grupo 2x/semana ou grupo 1x/semana) — não é valor confirmado com o clube. Só Tênis tem valor de mensalidade definido; outras modalidades aparecem sem valor.',
      larguraUtil
    )
    doc.text(avisoValor, margem, cursorY)
    cursorY += avisoValor.length * 9 + 14

    const totalGeral = selecionados.reduce((s, i) => s + (i.valorEstimadoMensalidade || 0), 0)
    if (totalGeral > 0) {
      doc.setFillColor(...COR_SUCESSO)
      doc.roundedRect(margem, cursorY, larguraUtil, 24, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COR_BRANCO)
      doc.text(`Estimativa total (as unidades selecionadas): ${fmtBRL(totalGeral)}`, pageWidth / 2, cursorY + 16, { align: 'center' })
      cursorY += 36
    }
  } else {
    cursorY += 8
  }

  const empresas = [...new Set(selecionados.map(s => s.empresa))]
  empresas.forEach(empresa => {
    const itens = selecionados.filter(s => s.empresa === empresa).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    if (itens.length === 0) return

    if (cursorY > pageHeight - 120) { doc.addPage(); cursorY = margem }
    const totalEmpresa = comValor ? itens.reduce((s, i) => s + (i.valorEstimadoMensalidade || 0), 0) : 0
    doc.setFillColor(...COR_SAIBRO)
    doc.roundedRect(margem, cursorY, larguraUtil, 22, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...COR_BRANCO)
    doc.text(`${(NOME_EMPRESA[empresa] || empresa).toUpperCase()} — ${itens.length} aluno${itens.length === 1 ? '' : 's'}`, margem + 10, cursorY + 15)
    if (totalEmpresa > 0) doc.text(fmtBRL(totalEmpresa), pageWidth - margem - 10, cursorY + 15, { align: 'right' })
    cursorY += 30

    const head = comValor
      ? ['Aluno', 'Modalidade', 'Turma', 'Dia(s)', 'Horário', 'Valor estimado']
      : ['Aluno', 'Modalidade', 'Turma', 'Dia(s)', 'Horário']
    const body = itens.map(i => {
      const linha = [i.nome, i.modalidade, i.nivel || '—', i.diasSemanaLabel, i.horario]
      if (comValor) linha.push(i.valorEstimadoMensalidade != null ? fmtBRL(i.valorEstimadoMensalidade) : '—')
      return linha
    })

    autoTable(doc, {
      startY: cursorY,
      head: [head],
      body,
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 4.5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
      headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 247, 243] },
      columnStyles: comValor ? { 5: { halign: 'right' } } : {},
      margin: { left: margem, right: margem },
    })
    cursorY = doc.lastAutoTable.finalY + 20
  })

  rodape()
  const sufixo = comValor ? 'estimativa-interna' : 'clube'
  doc.save(`alunos-sem-cobranca-${sufixo}-${periodo.inicio}-a-${periodo.fim}.pdf`)
}

export async function exportarAlunosSemClubeParaClubePDF(selecionados, { periodo }) {
  return construirPDF(selecionados, { periodo, comValor: false })
}

export async function exportarAlunosSemClubeParaDonoPDF(selecionados, { periodo }) {
  return construirPDF(selecionados, { periodo, comValor: true })
}
