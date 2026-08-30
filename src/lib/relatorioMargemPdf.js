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
// jsPDF com fonte padrão (Helvetica) não tem o glifo do sinal de menos tipográfico "−"
// (U+2212) — vira um "*"/caractere quebrado no PDF exportado. Hífen comum "-" (U+002D)
// existe na tabela WinAnsi que as fontes padrão usam, por isso é esse que vai aqui.
function sinal(v) {
  return v >= 0 ? `+${fmtBRL(v)}` : `-${fmtBRL(Math.abs(v))}`
}

// Análise automática (baseada em regra, não em IA de verdade) — mesmo espírito do
// gerarInsights() de useRelatorioMensal.js: transforma os números que já estão no
// relatório em frases prontas, pra não precisar garimpar tabela pra entender o que
// aconteceu no período.
function gerarInsightsMargem(dados) {
  const { resumo, porTurma, porProfessor } = dados
  const insights = []
  if (resumo.totalAulas === 0) return insights

  const pctDeficit = Math.round((resumo.aulasDeficit / resumo.totalAulas) * 100)
  const pctSuperavit = Math.round((resumo.aulasSuperavit / resumo.totalAulas) * 100)

  insights.push(
    resumo.margemTotal >= 0
      ? `O período fechou positivo: margem líquida de ${fmtBRL(resumo.margemTotal)} depois de descontar o repasse de 10% ao clube e o custo pago aos professores.`
      : `O período fechou NEGATIVO: prejuízo líquido de ${fmtBRL(Math.abs(resumo.margemTotal))} mesmo depois de somar as aulas lucrativas.`
  )

  if (resumo.aulasDeficit > 0) {
    insights.push(
      `${resumo.aulasDeficit} de ${resumo.totalAulas} aulas (${pctDeficit}%) pagaram ao professor mais do que a mensalidade rendeu — juntas, essas aulas geraram ${fmtBRL(Math.abs(resumo.margemNegativa))} de prejuízo direto, coberto pelo restante das aulas.`
    )
  } else {
    insights.push('Nenhuma aula individual ficou no prejuízo neste período.')
  }

  if (porProfessor.length > 1) {
    const melhor = porProfessor[0]
    const pior = porProfessor[porProfessor.length - 1]
    insights.push(`${melhor.nome} foi quem mais rendeu margem no período: ${fmtBRL(melhor.margem)} em ${melhor.qtdAulas} aulas (${fmtBRL(melhor.margemMedia)}/aula).`)
    insights.push(
      pior.margem >= 0
        ? `${pior.nome} foi quem menos rendeu: ${fmtBRL(pior.margem)} em ${pior.qtdAulas} aulas (${fmtBRL(pior.margemMedia)}/aula) — ainda positivo, mas bem abaixo da média do grupo.`
        : `${pior.nome} fechou no prejuízo: ${fmtBRL(pior.margem)} em ${pior.qtdAulas} aulas — vale olhar de perto as turmas dele na tabela "Por turma".`
    )
  }

  const turmasDeficitarias = porTurma.filter(t => t.margem < -0.005)
  if (turmasDeficitarias.length > 0) {
    const piorTurma = turmasDeficitarias[0]
    const somaTop3 = turmasDeficitarias.slice(0, 3).reduce((s, t) => s + t.margem, 0)
    const totalDeficitTurmas = turmasDeficitarias.reduce((s, t) => s + t.margem, 0)
    const pctConcentracao = totalDeficitTurmas !== 0 ? Math.round((somaTop3 / totalDeficitTurmas) * 100) : 0
    insights.push(
      `A turma com pior resultado foi "${piorTurma.nome}" (${piorTurma.detalhe}, com ${piorTurma.professores}): ${fmtBRL(piorTurma.margem)} em ${piorTurma.qtdAulas} aulas.`
    )
    if (turmasDeficitarias.length >= 3) {
      insights.push(`As 3 turmas com pior margem concentram ${pctConcentracao}% de todo o prejuízo de turma do período (${turmasDeficitarias.length} turmas no total ficaram deficitárias).`)
    }
  }

  return insights
}

export async function exportarRelatorioMargemPDF(dados, { periodo }) {
  const { resumo, porDia, porTurma, porProfessor, detalheAulas } = dados
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
    const totalPaginas = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(`Uso interno - não distribuir  ·  Gerado pelo ProCoach em ${geradoEm}  ·  Página ${i}/${totalPaginas}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    }
  }

  // ---------- Cabeçalho + aviso de confidencialidade ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...COR_TINTA)
  doc.text('RELATÓRIO DE MARGEM - TÊNIS', margem, 44)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text('PROCÓPIO', margem, 60)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, 32, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 43, { align: 'right' })

  doc.setFillColor(...COR_PERIGO)
  doc.roundedRect(margem, 74, larguraUtil, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COR_BRANCO)
  doc.text('USO INTERNO - NÃO DISTRIBUIR (inclui rentabilidade por professor e por turma)', pageWidth / 2, 88, { align: 'center' })

  let cursorY = 112

  // ---------- O que é essa margem (metodologia, em linguagem direta) ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...COR_TINTA)
  doc.text('O que é essa margem', margem, cursorY)
  cursorY += 14

  const textoMetodologia = [
    'Cada aluno mensalista paga um valor FIXO por mês (ex.: R$683 pra 2x/semana), não por aula. Pra saber quanto',
    'aquela aula específica "rendeu", dividimos o plano mensal pela quantidade de aulas que a turma teve no mês',
    '(ex.: turma de segunda+quarta com 9 aulas no mês = R$683 ÷ 9 por aluno). Aluno avulso soma valor cheio por',
    'aula (R$320 individual / R$150 grupo). Dessa receita, tiramos 10% de repasse ao clube e o valor pago ao',
    'professor daquela aula — o que sobra é a margem. Reposição e cortesia não entram como receita nova.',
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  textoMetodologia.forEach((linha, i) => doc.text(linha, margem, cursorY + i * 11))
  cursorY += textoMetodologia.length * 11 + 14

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
  const cardW = (larguraUtil - 24) / 4
  cards.forEach((c, i) => {
    const x = margem + i * (cardW + 8)
    doc.setDrawColor(...COR_LINHA)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, cursorY, cardW, 46, 4, 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
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
  const linhaResumo = doc.splitTextToSize(
    `Receita estimada: ${fmtBRL(resumo.receitaTotal)}   ·   Custo pago a professores: ${fmtBRL(resumo.custoTotal)}   ·   Repasse ao clube (10%) já descontado da margem acima.`,
    larguraUtil
  )
  doc.text(linhaResumo, margem, cursorY)
  cursorY += linhaResumo.length * 11 + 12

  // ---------- Análise do período ----------
  const insights = gerarInsightsMargem(dados)
  if (insights.length > 0) {
    if (cursorY > pageHeight - 160) { doc.addPage(); cursorY = margem }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COR_TINTA)
    doc.text('Análise do período', margem, cursorY)
    cursorY += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    insights.forEach(texto => {
      const linhas = doc.splitTextToSize(texto, larguraUtil - 12)
      if (cursorY + linhas.length * 11 > pageHeight - 40) { doc.addPage(); cursorY = margem }
      doc.setTextColor(...COR_SAIBRO)
      doc.text('•', margem, cursorY)
      doc.setTextColor(...COR_TINTA)
      doc.text(linhas, margem + 12, cursorY)
      cursorY += linhas.length * 11 + 6
    })
    cursorY += 10
  }

  // ---------- Ranking de professores ----------
  if (cursorY > pageHeight - 160) { doc.addPage(); cursorY = margem }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_TINTA)
  doc.text('Ranking de professores por margem (mais rentável -> menos rentável)', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Professor', 'Aulas', 'Receita', 'Custo', 'Margem', 'Margem/aula']],
    body: porProfessor.map(p => [
      p.nome, String(p.qtdAulas), fmtBRL(p.receita), fmtBRL(p.custo), sinal(p.margem), sinal(p.margemMedia),
    ]),
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.5, overflow: 'linebreak' },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 34, halign: 'center' },
      2: { cellWidth: 68, halign: 'right' },
      3: { cellWidth: 62, halign: 'right' },
      4: { cellWidth: 68, halign: 'right' },
      5: { cellWidth: 68, halign: 'right' },
    },
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
    styles: { fontSize: 7, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.5, overflow: 'linebreak' },
    headStyles: { fillColor: COR_SAIBRO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 80 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 58, halign: 'right' },
      5: { cellWidth: 54, halign: 'right' },
      6: { cellWidth: 62, halign: 'right' },
    },
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
    styles: { fontSize: 8, cellPadding: 5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.5, overflow: 'linebreak' },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 80, halign: 'right' },
      3: { cellWidth: 80, halign: 'right' },
      4: { cellWidth: 80, halign: 'right' },
    },
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
  doc.text('Detalhamento - aula a aula', margem, cursorY)
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [['Data', 'Turma', 'Professor', 'Alunos', 'Receita', 'Custo', 'Margem']],
    body: detalheAulas.map(l => [
      fmtDataCurta(l.data), `${l.turmaNome}${l.turmaDetalhe ? ` (${l.turmaDetalhe})` : ''}`, l.professorNome,
      String(l.qtdAlunos), fmtBRL(l.receita), fmtBRL(l.custoProfessor), sinal(l.margem),
    ]),
    theme: 'plain',
    styles: { fontSize: 6.5, cellPadding: 3.5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4, overflow: 'linebreak' },
    headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [249, 247, 243] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 90 },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 55, halign: 'right' },
      5: { cellWidth: 50, halign: 'right' },
      6: { cellWidth: 58, halign: 'right' },
    },
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
