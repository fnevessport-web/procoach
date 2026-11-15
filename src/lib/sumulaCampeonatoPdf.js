// Súmula de papel dos jogos do campeonato: 4 por folha A4 (retrato), separadas por linha
// tracejada para cortar com régua. Cada uma tem os logos Beyond e Procopio, o nome do torneio,
// o jogo (número, fase, quadra, horário), as duas duplas e os quadrados do placar: 1º e 2º sets
// (com o quadradinho do tie-break do 4 a 4 ao lado) e o 3º set, que já é o tie-break até 7.
// O vencedor traz a súmula preenchida e a gestão digita o placar no app.
//
// `montarSumulas` não depende do navegador (dá para rodar em Node com as imagens em base64);
// `baixarSumulasPDF` é o atalho da tela, que busca os logos em /images e baixa o arquivo.
import { nomeCurto, rotuloFase, origemDaVaga, ordenarJogos } from './campeonato.js'

const LOGO_BEYOND = '/images/logobeyond_recorte_escuro.png'
const LOGO_PROCOPIO = '/images/logoprocopio_horizontal_escuro.png'

// Paleta da marca (verde-court e areia) em RGB: o jsPDF precisa de cor literal.
const ESCURO = [30, 43, 36]
const SECUNDARIO = [74, 88, 80]
const APAGADO = [138, 133, 119]
const LINHA = [190, 182, 162]
const SAIBRO = [165, 76, 46]

function nomesDaDupla(d) {
  if (!d) return null
  return [nomeCurto(d.atleta1?.nome) || 'A definir', nomeCurto(d.atleta2?.nome) || 'A definir']
}

export function montarSumulas(doc, { campeonato, jogos, duplaPorId, logos }) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const POR_PAGINA = 4
  const alturaCartao = H / POR_PAGINA
  const lista = ordenarJogos(jogos.filter(j => j.status !== 'bye')).sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  // Antes do sorteio (sem jogos): 16 súmulas em branco para preencher à mão.
  const total = lista.length || 16

  const linhaCorte = y => {
    doc.setDrawColor(...LINHA)
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([4, 3], 0)
    doc.line(0, y, W, y)
    doc.setLineDashPattern([], 0)
  }

  for (let k = 0; k < total; k++) {
    const jogo = lista[k]
    const idx = k % POR_PAGINA
    if (k > 0 && idx === 0) doc.addPage()
    const y0 = idx * alturaCartao
    if (idx > 0) linhaCorte(y0)
    desenharCartao(doc, { x0: 30, y0: y0 + 20, largura: W - 60, jogo, jogos, duplaPorId, campeonato, logos })
  }
  return doc
}

function desenharCartao(doc, { x0, y0, largura, jogo, jogos, duplaPorId, campeonato, logos }) {
  const xFim = x0 + largura

  // ---- topo: logos à esquerda, nome do torneio à direita ----
  const hLogo = 13
  let xl = x0
  if (logos?.beyond) {
    const w = hLogo * (1305 / 320) * 0.82
    doc.addImage(logos.beyond, 'PNG', xl, y0 + 1, w, hLogo * 0.82)
    xl += w + 10
  }
  if (logos?.beyond && logos?.procopio) {
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.6)
    doc.line(xl, y0 - 1, xl, y0 + hLogo + 1)
    xl += 10
  }
  if (logos?.procopio) {
    const w = hLogo * (1248 / 320)
    doc.addImage(logos.procopio, 'PNG', xl, y0, w, hLogo)
  }
  doc.setTextColor(...ESCURO)
  doc.setFont('times', 'bold')
  doc.setFontSize(15)
  doc.text(campeonato?.nome || 'Torneio', xFim, y0 + 11, { align: 'right' })

  // ---- faixa do jogo ----
  const yJogo = y0 + 32
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...SAIBRO)
  const titulo = jogo ? `JOGO ${jogo.ordem ?? ''}` : 'JOGO ____'
  doc.text(titulo, x0, yJogo, { charSpace: 1.2 })
  const wTitulo = doc.getTextWidth(titulo) + 1.2 * titulo.length
  doc.setTextColor(...SECUNDARIO)
  doc.setFont('helvetica', 'normal')
  const info = jogo
    ? [rotuloFase(jogo.fase), jogo.quadra, jogo.horario ? `previsto ${jogo.horario}` : null].filter(Boolean).join('  ·  ').toUpperCase()
    : 'FASE ________   QUADRA ____'
  doc.text(info, x0 + wTitulo + 8, yJogo, { charSpace: 0.8 })
  doc.text('INÍCIO ____:____    FIM ____:____', xFim, yJogo, { align: 'right', charSpace: 0.4 })

  // ---- grade do placar ----
  // Colunas: dupla | 1º set + TB | 2º set + TB | 3º set (tie-break até 7)
  const caixa = 34
  const tb = 22
  const gapTb = 4
  const gapSet = 14
  const wSet = caixa + gapTb + tb
  const xSet3 = xFim - caixa - 12
  const xSet2 = xSet3 - gapSet - wSet
  const xSet1 = xSet2 - gapSet - wSet
  const yCab = yJogo + 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...APAGADO)
  doc.text('DUPLA', x0, yCab, { charSpace: 1 })
  const cab = (x, txt, w) => doc.text(txt, x + w / 2, yCab, { align: 'center', charSpace: 0.6 })
  cab(xSet1, '1º SET', caixa); cab(xSet1 + caixa + gapTb, 'TB', tb)
  cab(xSet2, '2º SET', caixa); cab(xSet2 + caixa + gapTb, 'TB', tb)
  cab(xSet3, '3º SET (TB)', caixa)

  const alturaLinha = 46
  const linhaDupla = (lado, y) => {
    const d = jogo ? duplaPorId.get(jogo[`dupla_${lado}_id`]) : null
    const nomes = nomesDaDupla(d)
    doc.setTextColor(...ESCURO)
    if (nomes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11.5)
      doc.text(nomes[0], x0, y + 17)
      doc.text(nomes[1], x0, y + 32)
    } else {
      // Vaga ainda sem dupla: linha para escrever à mão e de onde ela vem.
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.6)
      doc.line(x0, y + 18, xSet1 - 24, y + 18)
      doc.line(x0, y + 34, xSet1 - 24, y + 34)
      const origem = jogo ? origemDaVaga(jogo, lado, jogos) : null
      if (origem) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(...APAGADO)
        doc.text(origem, x0, y + 8)
      }
    }
    doc.setDrawColor(...ESCURO)
    doc.setLineWidth(1)
    const yCaixa = y + (alturaLinha - caixa) / 2
    const yTb = y + (alturaLinha - tb) / 2
    for (const x of [xSet1, xSet2]) {
      doc.roundedRect(x, yCaixa, caixa, caixa, 3, 3)
      doc.setLineWidth(0.6)
      doc.setDrawColor(...SECUNDARIO)
      doc.roundedRect(x + caixa + gapTb, yTb, tb, tb, 2, 2)
      doc.setLineWidth(1)
      doc.setDrawColor(...ESCURO)
    }
    doc.roundedRect(xSet3, yCaixa, caixa, caixa, 3, 3)
  }
  const yA = yCab + 6
  linhaDupla('a', yA)
  doc.setDrawColor(...LINHA); doc.setLineWidth(0.4)
  doc.line(x0, yA + alturaLinha + 1, xFim, yA + alturaLinha + 1)
  const yB = yA + alturaLinha + 2
  linhaDupla('b', yB)

  // ---- rodapé: regra curta e vencedor ----
  const yRod = yB + alturaLinha + 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...APAGADO)
  doc.text('Sets até 4 games. No 4 a 4, tie-break até 7 (anote os pontos no TB; o set fica 5 a 4). 1 set para cada: 3º set é tie-break até 7.', x0, yRod)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...SECUNDARIO)
  doc.text('VENCEDORES', x0, yRod + 17, { charSpace: 1 })
  doc.setDrawColor(...LINHA); doc.setLineWidth(0.6)
  doc.line(x0 + 62, yRod + 18, x0 + largura * 0.58, yRod + 18)
  doc.text('VISTO', x0 + largura * 0.62, yRod + 17, { charSpace: 1 })
  doc.line(x0 + largura * 0.62 + 34, yRod + 18, xFim, yRod + 18)
}

async function carregarBase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) return null
  const blob = await resp.blob()
  return new Promise(resolve => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => resolve(null)
    r.readAsDataURL(blob)
  })
}

export async function baixarSumulasPDF({ campeonato, jogos, duplaPorId }) {
  const { jsPDF } = await import('jspdf')
  const [beyond, procopio] = await Promise.all([carregarBase64(LOGO_BEYOND), carregarBase64(LOGO_PROCOPIO)])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  montarSumulas(doc, { campeonato, jogos, duplaPorId, logos: { beyond, procopio } })
  doc.save(`Sumulas_${(campeonato?.nome || 'torneio').replace(/[^\w]+/g, '_')}.pdf`)
}
