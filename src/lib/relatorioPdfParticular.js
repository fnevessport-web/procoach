import { format } from 'date-fns'

// PDF de Evolução Técnica pro modo Particular — marca ProCoach + nome do profissional, NUNCA
// Beyond/Procópio. Arquivo separado de src/lib/relatorioPdf.js de propósito: aquele fica
// intocado (regra do projeto, PDF do clube continua igual pra sempre) e suas funções
// auxiliares não são exportadas, então esse arquivo tem cópias pequenas próprias em vez de
// importar de lá. Layout mais simples que o do clube (sem gráfico de evolução/conquistas em
// v1) — cobre nome, PC Score, dimensões e narrativa; dá pra enriquecer depois.

const COR_CREME = [241, 239, 234]
const COR_TINTA = [26, 24, 24]
const COR_TEXTO_SUAVE = [110, 106, 100]
const COR_ACAO = [165, 76, 46] // var(--color-action-primary), o "saibro" da identidade ProCoach

const LOGO_PROCOACH = '/images/logo-pc-green.png'

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function carregarImagem(url, maxLado) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * escala))
  const h = Math.max(1, Math.round(bitmap.height * escala))
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const dataUrl = canvas.convertToBlob
    ? await blobParaDataUrl(await canvas.convertToBlob({ type: 'image/png' }))
    : canvas.toDataURL('image/png')
  return { dataUrl, aspecto: bitmap.width / bitmap.height }
}

export async function exportarEvolucaoTecnicaPDFParticular(dados, { nomeProfissional }) {
  const {
    alunoNome, modalidadeNome, totalPresencas, pcScoreAtual, variacaoPcScore,
    nivelLabel, dimensoes, narrativaIA,
  } = dados

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margem = 40
  const larguraUtil = pageWidth - margem * 2

  let logo = null
  try { logo = await carregarImagem(LOGO_PROCOACH, 120) } catch { /* segue sem logo se o asset falhar ao carregar */ }

  function fontePadrao(estilo, tamanho) {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }

  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  doc.setFillColor(...COR_CREME)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

  // ---------- Cabeçalho ----------
  const alturaLogo = 30
  const yTopoLogo = 26
  let textoX = margem
  if (logo) {
    const w = alturaLogo * logo.aspecto
    try { doc.addImage(logo.dataUrl, 'PNG', margem, yTopoLogo, w, alturaLogo) } catch { /* segue sem logo se addImage falhar */ }
    textoX = margem + w + 12
  }
  fontePadrao('bold', 14)
  doc.setTextColor(...COR_TINTA)
  doc.text('EVOLUÇÃO TÉCNICA', textoX, yTopoLogo + alturaLogo / 2 - 3)
  fontePadrao('italic', 9)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`${(nomeProfissional || 'ProCoach').toUpperCase()} · ${(modalidadeNome || '').toUpperCase()}`, textoX, yTopoLogo + alturaLogo / 2 + 10)
  fontePadrao('normal', 7.5)
  doc.text(`Gerado em ${geradoEm}`, pageWidth - margem, 26, { align: 'right' })

  let cursorY = yTopoLogo + alturaLogo + 24
  doc.setDrawColor(...COR_ACAO)
  doc.setLineWidth(1.5)
  doc.line(margem, cursorY, pageWidth - margem, cursorY)
  cursorY += 28

  // ---------- Nome do aluno ----------
  fontePadrao('bold', 18)
  doc.setTextColor(...COR_TINTA)
  doc.text(alunoNome || 'Aluno', margem, cursorY)
  cursorY += 26

  // ---------- PC Score + nível + presenças ----------
  const colW = larguraUtil / 3
  function statCard(x, label, valor) {
    fontePadrao('normal', 9)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    doc.text(label.toUpperCase(), x, cursorY)
    fontePadrao('bold', 20)
    doc.setTextColor(...COR_ACAO)
    doc.text(String(valor ?? '—'), x, cursorY + 24)
  }
  statCard(margem, 'PC Score', pcScoreAtual != null ? Math.round(pcScoreAtual) : null)
  statCard(margem + colW, 'Variação', variacaoPcScore != null ? `${variacaoPcScore > 0 ? '+' : ''}${Math.round(variacaoPcScore)}` : null)
  statCard(margem + colW * 2, 'Presenças', totalPresencas)
  cursorY += 44

  fontePadrao('normal', 10)
  doc.setTextColor(...COR_TEXTO_SUAVE)
  doc.text(`Nível: ${nivelLabel || '—'}`, margem, cursorY)
  cursorY += 30

  // ---------- Dimensões ----------
  if (dimensoes?.length > 0) {
    fontePadrao('bold', 11)
    doc.setTextColor(...COR_TINTA)
    doc.text('DIMENSÕES AVALIADAS', margem, cursorY)
    cursorY += 18
    dimensoes.forEach(dim => {
      fontePadrao('normal', 10)
      doc.setTextColor(...COR_TINTA)
      doc.text(dim.nome, margem, cursorY)
      const valorTexto = dim.valor != null ? dim.valor.toFixed(1).replace('.', ',') : '—'
      doc.text(valorTexto, pageWidth - margem, cursorY, { align: 'right' })
      const barW = larguraUtil
      const pct = Math.max(0, Math.min(1, (dim.valor || 0) / 10))
      doc.setFillColor(230, 225, 215)
      doc.rect(margem, cursorY + 5, barW, 4, 'F')
      doc.setFillColor(...COR_ACAO)
      doc.rect(margem, cursorY + 5, barW * pct, 4, 'F')
      cursorY += 22
    })
    cursorY += 12
  }

  // ---------- Narrativa ----------
  if (narrativaIA) {
    fontePadrao('bold', 11)
    doc.setTextColor(...COR_TINTA)
    doc.text('OBSERVAÇÕES', margem, cursorY)
    cursorY += 16
    fontePadrao('normal', 10)
    doc.setTextColor(...COR_TEXTO_SUAVE)
    const linhas = doc.splitTextToSize(narrativaIA, larguraUtil)
    doc.text(linhas, margem, cursorY)
  }

  // Mesmo contrato de retorno de exportarEvolucaoTecnicaPDF (relatorioPdf.js) — quem chama
  // (EvolucaoTecnicaTenis.jsx) espera exatamente { blob, filename }.
  return {
    blob: doc.output('blob'),
    filename: `evolucao-tecnica-${(alunoNome || 'aluno').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  }
}
