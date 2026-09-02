import { format } from 'date-fns'

// Relatório de Cruzamento com o Clube — uso interno. Mostra o que NÃO bateu entre o
// relatório de pagantes do clube e a presença de verdade no ProCoach, separado por unidade
// (Procópio / Beach Arena), nos dois sentidos:
//  - linhas do clube sem correspondência no ProCoach (aluno que o clube cobra, mas a gente
//    não confirma presença — pode ser erro de grafia de nome, precisa revisar);
//  - alunos nossos sem correspondência no clube (o sinal mais direto de receita perdida —
//    demos aula, o clube não cobrou por ela; valor é ESTIMADO pela média que o clube paga
//    naquela modalidade, não é o valor real dela).

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_MARINHO = [61, 107, 122]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]
const COR_SUCESSO = [75, 139, 106]
const COR_PERIGO = [180, 71, 47]
const COR_AVISO = [201, 138, 60]

const NOME_EMPRESA = { procopio: 'Procópio', beach_arena: 'Beach Arena' }

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function exportarCruzamentoClubePDF(dados, { periodo }) {
  const { totalClube, totalBateram, totalProvaveis, totalSemCorrespondencia, valorEstimadoPerdido, procopio, beachArena } = dados
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

  let cursorY = margem
  function garantirEspaco(altura) {
    if (cursorY + altura > pageHeight - 40) { doc.addPage(); cursorY = margem }
  }

  // ---------- Cabeçalho ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COR_TINTA)
  doc.text('CRUZAMENTO COM RELATÓRIO DO CLUBE', margem, cursorY + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Período: ${periodoLabel}`, pageWidth - margem, cursorY - 4, { align: 'right' })
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, cursorY + 7, { align: 'right' })
  cursorY += 30

  // ---------- Resumo geral (as duas unidades) ----------
  const pctBateram = totalClube > 0 ? Math.round((totalBateram / totalClube) * 100) : 0
  const cardsGerais = [
    { label: 'Linhas do clube (pagantes)', valor: String(totalClube), cor: COR_TINTA },
    { label: 'Bateram (nome idêntico)', valor: `${totalBateram} (${pctBateram}%)`, cor: COR_SUCESSO },
    { label: 'Pagam, nome c/ diferença', valor: String(totalProvaveis), cor: COR_AVISO },
    { label: 'Clube cobra, sem presença', valor: String(totalSemCorrespondencia), cor: COR_PERIGO },
  ]
  const cardW = (larguraUtil - 24) / 4
  cardsGerais.forEach((c, i) => {
    const x = margem + i * (cardW + 8)
    doc.setDrawColor(...COR_LINHA)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, cursorY, cardW, 44, 4, 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...c.cor)
    doc.text(c.valor, x + cardW / 2, cursorY + 21, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(c.label, x + cardW / 2, cursorY + 35, { align: 'center' })
  })
  cursorY += 56

  doc.setFillColor(...COR_PERIGO)
  doc.roundedRect(margem, cursorY, larguraUtil, 26, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COR_BRANCO)
  doc.text(`Estimativa de receita não capturada (as 2 unidades): ${fmtBRL(valorEstimadoPerdido)}`, pageWidth / 2, cursorY + 17, { align: 'center' })
  cursorY += 38

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  const aviso = doc.splitTextToSize(
    'Cruzamento por primeiro+último nome (ignora nome do meio) e, quando não bate exato, por semelhança de grafia (tolera pequeno erro de digitação) + modalidade + horário — não por data exata, já que a coluna Data do clube é hora de processamento da cobrança, não da aula. Todo aluno das categorias "bateram" e "pagam, nome com diferença" CONSTA na planilha de pagamento do clube — só "clube cobra, sem presença" e as tabelas de "alunos nossos" abaixo são quem fica de fora de um lado ou do outro. O valor estimado de receita não capturada usa a média que o clube paga naquela modalidade — é aproximação, não o valor real daquele aluno específico.',
    larguraUtil
  )
  doc.text(aviso, margem, cursorY)
  cursorY += aviso.length * 10 + 16

  function secaoEmpresa(dadosEmpresa) {
    const corEmpresa = dadosEmpresa.empresa === 'procopio' ? COR_SAIBRO : COR_MARINHO
    garantirEspaco(60)
    doc.setFillColor(...corEmpresa)
    doc.roundedRect(margem, cursorY, larguraUtil, 24, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...COR_BRANCO)
    doc.text(NOME_EMPRESA[dadosEmpresa.empresa].toUpperCase(), margem + 12, cursorY + 16)
    cursorY += 34

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...COR_TINTA)
    const pct = dadosEmpresa.totalLinhasClube > 0 ? Math.round((dadosEmpresa.totalBateram / dadosEmpresa.totalLinhasClube) * 100) : 0
    doc.text(
      `${dadosEmpresa.totalLinhasClube} linhas do clube  ·  ${dadosEmpresa.totalBateram} bateram (${pct}%)  ·  ${dadosEmpresa.totalProvaveis} prováveis  ·  ${dadosEmpresa.totalSemCorrespondencia} sem correspondência`,
      margem, cursorY
    )
    cursorY += 10
    doc.setTextColor(...COR_PERIGO)
    doc.setFont('helvetica', 'bold')
    doc.text(`Estimativa de receita não capturada aqui: ${fmtBRL(dadosEmpresa.valorEstimadoPerdido)}`, margem, cursorY + 10)
    cursorY += 24

    if (dadosEmpresa.porModalidade.length > 0) {
      garantirEspaco(30 + dadosEmpresa.porModalidade.length * 18)
      autoTable(doc, {
        startY: cursorY,
        head: [['Modalidade', 'Linhas no clube', 'Sem correspondência']],
        body: dadosEmpresa.porModalidade.map(m => [m.modalidade, String(m.total), String(m.semCorrespondencia)]),
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
        headStyles: { fillColor: COR_TINTA, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [249, 247, 243] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: margem, right: margem },
      })
      cursorY = doc.lastAutoTable.finalY + 16
    }

    if (dadosEmpresa.provaveis && dadosEmpresa.provaveis.length > 0) {
      garantirEspaco(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...COR_AVISO)
      const tituloProvaveis = doc.splitTextToSize(
        'ESTES ALUNOS CONSTAM NA PLANILHA DE PAGAMENTO DO CLUBE — nome grafado com pequena diferença entre as duas planilhas (confirme que é a mesma pessoa)',
        larguraUtil
      )
      doc.text(tituloProvaveis, margem, cursorY)
      cursorY += tituloProvaveis.length * 11
      autoTable(doc, {
        startY: cursorY,
        head: [['Nome (planilha do clube)', 'Nome (ProCoach)', 'Modalidade', 'Turma']],
        body: dadosEmpresa.provaveis.map(l => [l.nome, l.nomeProcoach, l.modalidadeClube, l.turmaTexto]),
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
        headStyles: { fillColor: COR_AVISO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [249, 247, 243] },
        margin: { left: margem, right: margem },
      })
      cursorY = doc.lastAutoTable.finalY + 16
    }

    if (dadosEmpresa.semCorrespondencia.length > 0) {
      garantirEspaco(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...COR_AVISO)
      const tituloSemCorr = doc.splitTextToSize(
        'ESTES ALUNOS CONSTAM NA PLANILHA DE PAGAMENTO DO CLUBE — mas não achamos presença correspondente no ProCoach (revisar)',
        larguraUtil
      )
      doc.text(tituloSemCorr, margem, cursorY)
      cursorY += tituloSemCorr.length * 11
      autoTable(doc, {
        startY: cursorY,
        head: [['Nome (clube)', 'Modalidade', 'Turma', 'Valor', 'Motivo']],
        body: dadosEmpresa.semCorrespondencia.map(l => [l.nome, l.modalidadeClube, l.turmaTexto, fmtBRL(l.valor), l.motivo]),
        theme: 'plain',
        styles: { fontSize: 6.5, cellPadding: 3.5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
        headStyles: { fillColor: [240, 236, 228], textColor: COR_TINTA, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [249, 247, 243] },
        columnStyles: { 3: { cellWidth: 50, halign: 'right' }, 4: { cellWidth: 120 } },
        margin: { left: margem, right: margem },
      })
      cursorY = doc.lastAutoTable.finalY + 16
    }

    const semSinalForte = dadosEmpresa.nossosSemCorrespondencia.filter(c => !c.apareceEmOutraTurmaDoClube)
    const semSinalRevisar = dadosEmpresa.nossosSemCorrespondencia.filter(c => c.apareceEmOutraTurmaDoClube)

    if (semSinalForte.length > 0) {
      garantirEspaco(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...COR_PERIGO)
      const tituloForte = doc.splitTextToSize(
        'ESTES ALUNOS NÃO CONSTAM NA PLANILHA DE PAGAMENTO DO CLUBE — demos aula, mas não há cobrança correspondente (receita não capturada)',
        larguraUtil
      )
      doc.text(tituloForte, margem, cursorY)
      cursorY += tituloForte.length * 11
      autoTable(doc, {
        startY: cursorY,
        head: [['Aluno (ProCoach)', 'Dia(s)', 'Modalidade', 'Horário', 'Presença', 'Falta', 'Valor estimado']],
        body: semSinalForte
          .sort((a, b) => b.valorEstimado - a.valorEstimado)
          .map(c => [c.nome, c.diasSemanaLabel, c.modalidade, c.horario, String(c.presencas), String(c.faltas), fmtBRL(c.valorEstimado)]),
        theme: 'plain',
        styles: { fontSize: 6.5, cellPadding: 3.5, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
        headStyles: { fillColor: COR_PERIGO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [249, 247, 243] },
        columnStyles: { 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'right' } },
        margin: { left: margem, right: margem },
      })
      cursorY = doc.lastAutoTable.finalY + 16
    }

    if (semSinalRevisar.length > 0) {
      garantirEspaco(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...COR_AVISO)
      const tituloRevisar = doc.splitTextToSize(
        'Nome aparece em outra turma do clube (revisar cadastro — provável turma/horário errado, não somado como receita perdida)',
        larguraUtil
      )
      doc.text(tituloRevisar, margem, cursorY)
      cursorY += tituloRevisar.length * 11
      autoTable(doc, {
        startY: cursorY,
        head: [['Aluno (ProCoach)', 'Dia(s)', 'Modalidade', 'Horário cadastrado']],
        body: semSinalRevisar.map(c => [c.nome, c.diasSemanaLabel, c.modalidade, c.horario]),
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 4, valign: 'middle', textColor: COR_TINTA, lineColor: COR_LINHA, lineWidth: 0.4 },
        headStyles: { fillColor: COR_AVISO, textColor: COR_BRANCO, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [249, 247, 243] },
        margin: { left: margem, right: margem },
      })
      cursorY = doc.lastAutoTable.finalY + 16
    }

    cursorY += 10
  }

  secaoEmpresa(procopio)
  doc.addPage()
  cursorY = margem
  secaoEmpresa(beachArena)

  rodape()
  doc.save(`cruzamento-clube-${periodo.inicio}-a-${periodo.fim}.pdf`)
}
