import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PERGUNTAS_PESQUISA_SATISFACAO } from '../constants/pesquisaSatisfacao'

// PDF da pesquisa de satisfação de UM professor — uso interno, só o gestor consegue gerar
// (o botão só existe dentro da aba "Pesquisa", já travada por role). Sem identidade
// Beyond/Procópio de propósito, mesmo raciocínio de relatorioMargemPdf.js: é documento de
// RH interno, não material de marca pro parceiro.

const COR_TINTA = [30, 43, 36]
const COR_SAIBRO = [165, 76, 46]
const COR_TEXTO_SUAVE = [120, 120, 115]
const COR_BRANCO = [255, 255, 255]
const COR_LINHA = [225, 220, 210]

function slugificar(nome) {
  return (nome || 'professor')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function exportarPesquisaSatisfacaoPDF(professorNome, respostas) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  let cursorY = margem

  function garantirEspaco(altura) {
    if (cursorY + altura > pageHeight - 40) {
      doc.addPage()
      cursorY = margem
    }
  }

  // Cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COR_TINTA)
  doc.text('PESQUISA DE SATISFACAO', margem, cursorY + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, cursorY + 4, { align: 'right' })
  cursorY += 26

  doc.setFillColor(...COR_SAIBRO)
  doc.roundedRect(margem, cursorY, larguraUtil, 26, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COR_BRANCO)
  doc.text(professorNome, margem + 12, cursorY + 17)
  cursorY += 40

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  const aviso = doc.splitTextToSize('Documento interno - não distribuir. Contém respostas confidenciais.', larguraUtil)
  doc.text(aviso, margem, cursorY)
  cursorY += aviso.length * 11 + 16

  respostas.forEach((r, i) => {
    garantirEspaco(40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COR_TINTA)
    const rotulo = i === 0 ? 'Resposta mais recente' : `Resposta ${respostas.length - i}`
    doc.text(`${rotulo} — ${format(parseISO(r.respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margem, cursorY)
    cursorY += 16

    PERGUNTAS_PESQUISA_SATISFACAO.forEach(p => {
      const resposta = r.respostas?.[p.id]
      const textoResposta = p.tipo === 'estrelas' ? `${Number(resposta) || 0}/5` : (resposta || 'Sem resposta')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      const linhasPergunta = doc.splitTextToSize(p.texto, larguraUtil)
      garantirEspaco(linhasPergunta.length * 11 + 20)
      doc.text(linhasPergunta, margem, cursorY)
      cursorY += linhasPergunta.length * 11 + 4

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(...COR_TINTA)
      const linhasResposta = doc.splitTextToSize(String(textoResposta), larguraUtil)
      doc.text(linhasResposta, margem, cursorY)
      cursorY += linhasResposta.length * 13 + 12
    })

    if (i < respostas.length - 1) {
      garantirEspaco(20)
      doc.setDrawColor(...COR_LINHA)
      doc.line(margem, cursorY, pageWidth - margem, cursorY)
      cursorY += 20
    }
  })

  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(`Uso interno - não distribuir  ·  Página ${i}/${totalPaginas}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
  }

  doc.save(`pesquisa-satisfacao-${slugificar(professorNome)}.pdf`)
}
