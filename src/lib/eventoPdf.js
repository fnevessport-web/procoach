// PDF simples com a lista de inscritos de um evento (Seletiva, Experimental) — nome da
// criança, idade, responsável e WhatsApp. Pensado pra imprimir/levar numa prancheta no dia
// do evento, por isso fica em fundo claro (diferente da Grade de Aulas em AulasCoordenador.jsx,
// que é dark porque é feita pra ver na tela).

function calcularIdade(dataNascimento, dataReferencia) {
  const nasc = new Date(dataNascimento + 'T12:00:00')
  const ref = new Date(dataReferencia + 'T12:00:00')
  let idade = ref.getFullYear() - nasc.getFullYear()
  const aindaNaoFezAniversario = (ref.getMonth() < nasc.getMonth()) ||
    (ref.getMonth() === nasc.getMonth() && ref.getDate() < nasc.getDate())
  if (aindaNaoFezAniversario) idade--
  return idade
}

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

async function carregarLogoBase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Não achou ${url}`)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function exportarInscricoesEventoPDF(evento, inscricoes) {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const geradoEm = new Date().toLocaleString('pt-BR')

  const COR_VERDE = [30, 43, 36]
  const COR_SAIBRO = [165, 76, 46]
  const COR_TEXTO_SUAVE = [110, 106, 100]
  const COR_LINHA_PAR = [247, 245, 240]

  try {
    const logoBase64 = await carregarLogoBase64('/images/logo-pc-green.png')
    doc.addImage(logoBase64, 'PNG', 40, 24, 70, 32)
  } catch {}

  doc.setFontSize(16)
  doc.setTextColor(...COR_VERDE)
  doc.text(evento.nome, pageWidth / 2, 42, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(
    `${formatarData(evento.data_evento)} · ${(evento.hora_inicio || '').slice(0, 5)}–${(evento.hora_fim || '').slice(0, 5)}`,
    pageWidth / 2, 58, { align: 'center' }
  )
  doc.setFontSize(8)
  doc.text(`Gerado em ${geradoEm}`, pageWidth - 40, 26, { align: 'right' })

  doc.setFillColor(...COR_SAIBRO)
  doc.rect(40, 70, pageWidth - 80, 2, 'F')

  const confirmados = inscricoes.filter(i => i.status === 'confirmado')
  const espera = inscricoes.filter(i => i.status === 'lista_espera')

  function linha(i) {
    const idade = calcularIdade(i.data_nascimento, evento.data_evento)
    const horario = i.evento_slots
      ? `${(i.evento_slots.horario || '').slice(0, 5)} · ${i.evento_slots.quadra}`
      : 'Sem horário fixo'
    return [i.nome_crianca, `${idade} anos`, i.nome_responsavel, i.whatsapp_responsavel || '', horario]
  }

  let cursorY = 92
  const SECOES = [
    { titulo: `CONFIRMADOS (${confirmados.length})`, lista: confirmados },
    { titulo: `LISTA DE ESPERA (${espera.length})`, lista: espera },
  ]

  for (const secao of SECOES) {
    if (secao.lista.length === 0) continue
    doc.setFontSize(12)
    doc.setTextColor(...COR_SAIBRO)
    doc.text(secao.titulo, 40, cursorY)
    cursorY += 10

    autoTable(doc, {
      startY: cursorY,
      head: [['Criança', 'Idade', 'Responsável', 'WhatsApp', 'Horário']],
      body: secao.lista.map(linha),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 6, textColor: [26, 26, 24] },
      headStyles: { fillColor: COR_VERDE, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COR_LINHA_PAR },
      margin: { left: 40, right: 40 },
    })
    cursorY = doc.lastAutoTable.finalY + 24
  }

  if (confirmados.length === 0 && espera.length === 0) {
    doc.setFontSize(12)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text('Nenhuma inscrição ainda.', pageWidth / 2, cursorY + 20, { align: 'center' })
  }

  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`Gerado pelo ProCoach em ${geradoEm}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
  }

  doc.save(`inscritos-${evento.slug || evento.id}.pdf`)
}
