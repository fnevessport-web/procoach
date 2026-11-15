// Regras puras da aba Campeonatos: sorteio das duplas, montagem da chave (eliminatória simples
// com bye e disputa de 3º lugar), avanço automático do vencedor, placar de sets curtos e ordem
// de jogos ("não antes de"). Nada aqui fala com o banco — as telas chamam essas funções e gravam
// só o que mudou.

export const FASES = {
  final: 'Final',
  semi: 'Semifinal',
  quartas: 'Quartas de final',
  oitavas: 'Oitavas de final',
  '16avos': '16 avos de final',
  '32avos': '32 avos de final',
  terceiro: 'Disputa de 3º lugar',
}

export const FASES_CURTAS = {
  final: 'Final',
  semi: 'Semi',
  quartas: 'Quartas',
  oitavas: 'Oitavas',
  '16avos': '16 avos',
  '32avos': '32 avos',
  terceiro: '3º lugar',
}

export const rotuloFase = (f) => FASES[f] || f
export const rotuloFaseCurto = (f) => FASES_CURTAS[f] || f

// Formato do torneio de 08/11: 1º e 2º sets até 4 games (diferença de 2, no 4 a 4 tie-break,
// que fecha o set em 5 a 4); 3º set é direto no tie-break até 7 com diferença de 2.
export const FORMATO_PADRAO = { games: 4, tiebreakFinal: 7 }

export const STATUS_ENCERRADOS = ['finalizado', 'wo', 'bye']

function faseDaRodada(rodada, totalRodadas) {
  const restante = totalRodadas - rodada
  return ['final', 'semi', 'quartas', 'oitavas', '16avos', '32avos'][restante] || `rodada${rodada}`
}

function aleatorio(max) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

export function embaralhar(lista) {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function proximaPotencia(n) {
  let s = 2
  while (s < n) s *= 2
  return s
}

// Ordem "bit invertido" (0,4,2,6,1,5,3,7 para 8): espalha os byes pelas duas metades da chave.
function ordemEspalhada(m) {
  if (m <= 1) return [0]
  const bits = Math.log2(m)
  return Array.from({ length: m }, (_, i) =>
    parseInt(i.toString(2).padStart(bits, '0').split('').reverse().join(''), 2))
}

// Sorteio: embaralha homens e mulheres separadamente e casa um com um. Quem sobra (gênero com
// mais gente) vira dupla com parceiro(a) "A definir", sorteada por último. A organização convida
// alguém (ex.: uma eliminada) e completa a dupla pelo painel antes do jogo.
export function sortearDuplas(homens, mulheres) {
  const h = embaralhar(homens)
  const m = embaralhar(mulheres)
  const qtd = Math.min(h.length, m.length)
  const duplas = Array.from({ length: qtd }, (_, i) => ({
    id: crypto.randomUUID(),
    numero: i + 1,
    atleta1_id: h[i].id,
    atleta2_id: m[i].id,
  }))
  const resto = [
    ...h.slice(qtd).map(a => ({ atleta1_id: a.id, atleta2_id: null })),
    ...m.slice(qtd).map(a => ({ atleta1_id: null, atleta2_id: a.id })),
  ]
  resto.forEach((r, i) => duplas.push({ id: crypto.randomUUID(), numero: qtd + i + 1, ...r }))
  return { duplas, incompletas: resto.length }
}

export function duplaIncompleta(d) {
  return !!d && (!d.atleta1_id || !d.atleta2_id)
}

// Trava de segurança antes de gravar um sorteio: ninguém pode aparecer em duas duplas e o número
// de duplas tem que bater com o de atletas. (Em 08/11 um toque duplo gravou 32 duplas repetidas.)
export function validarDuplas(duplas, esperado) {
  const vistos = new Set()
  for (const d of duplas) {
    for (const id of [d.atleta1_id, d.atleta2_id].filter(Boolean)) {
      if (vistos.has(id)) throw new Error('Sorteio inválido: um atleta saiu em duas duplas. Nada foi gravado.')
      vistos.add(id)
    }
  }
  if (esperado != null && duplas.length !== esperado) throw new Error(`Sorteio inválido: ${duplas.length} duplas para ${esperado} esperadas. Nada foi gravado.`)
}

// Chave completa a partir das duplas na ordem do sorteio. Duplas 1..m ficam no lado A dos jogos
// da 1ª rodada; o resto entra no lado B em ordem espalhada; lado B vazio = bye.
export function montarChave(duplas, { terceiro = true } = {}) {
  const n = duplas.length
  const s = proximaPotencia(Math.max(n, 2))
  const m = s / 2
  const totalRodadas = Math.log2(s)
  const jogos = []
  for (let r = 1; r <= totalRodadas; r++) {
    const qtd = s / 2 ** r
    for (let p = 0; p < qtd; p++) {
      jogos.push(novoJogo(r, p, faseDaRodada(r, totalRodadas)))
    }
  }
  if (terceiro && totalRodadas >= 2) jogos.push(novoJogo(totalRodadas, 1, 'terceiro'))

  const primeira = jogos.filter(j => j.rodada === 1)
  duplas.slice(0, m).forEach((d, i) => { primeira[i].dupla_a_id = d.id })
  const ordem = ordemEspalhada(m)
  duplas.slice(m).forEach((d, i) => { primeira[ordem[i]].dupla_b_id = d.id })
  return jogos
}

function novoJogo(rodada, posicao, fase) {
  return {
    id: crypto.randomUUID(), rodada, posicao, fase,
    dupla_a_id: null, dupla_b_id: null, quadra: null, horario: null, ordem: 0,
    status: 'agendado', sets: [], vencedor_id: null, iniciado_em: null, finalizado_em: null,
  }
}

export function vencedorDoJogo(j) {
  return j && STATUS_ENCERRADOS.includes(j.status) ? j.vencedor_id : null
}

export function perdedorDoJogo(j) {
  if (!j || !['finalizado', 'wo'].includes(j.status) || !j.vencedor_id) return null
  return j.vencedor_id === j.dupla_a_id ? j.dupla_b_id : j.dupla_a_id
}

export function totalRodadas(jogos) {
  return jogos.reduce((mx, j) => Math.max(mx, j.rodada), 0)
}

const CAMPOS_DERIVADOS = ['dupla_a_id', 'dupla_b_id', 'status', 'vencedor_id', 'sets', 'iniciado_em', 'finalizado_em']

// Recalcula, do zero, quem ocupa cada vaga das rodadas seguintes (vencedores) e do 3º lugar
// (perdedores das semis), além dos byes da 1ª rodada. Se um jogo já iniciado/encerrado mudar de
// participantes (resultado anterior corrigido), ele volta para "agendado" sem placar.
// Devolve [{ id, patch }] só com o que mudou.
export function propagar(jogos) {
  const atual = jogos.map(j => ({ ...j, sets: j.sets || [] }))
  const R = totalRodadas(atual)
  const get = (r, p) => atual.find(j => j.rodada === r && j.posicao === p && j.fase !== 'terceiro')

  const definirVagas = (j, a, b) => {
    if (j.dupla_a_id === a && j.dupla_b_id === b) return
    j.dupla_a_id = a
    j.dupla_b_id = b
    if (j.status !== 'agendado') {
      j.status = 'agendado'; j.sets = []; j.vencedor_id = null; j.iniciado_em = null; j.finalizado_em = null
    }
  }

  for (const j of atual.filter(x => x.rodada === 1)) {
    const temA = !!j.dupla_a_id
    const temB = !!j.dupla_b_id
    if (temA !== temB || (!temA && !temB)) {
      j.status = 'bye'; j.vencedor_id = j.dupla_a_id || j.dupla_b_id || null; j.sets = []
    } else if (j.status === 'bye') {
      j.status = 'agendado'; j.vencedor_id = null
    }
  }
  for (let r = 2; r <= R; r++) {
    for (const j of atual.filter(x => x.rodada === r && x.fase !== 'terceiro').sort((a, b) => a.posicao - b.posicao)) {
      definirVagas(j, vencedorDoJogo(get(r - 1, 2 * j.posicao)), vencedorDoJogo(get(r - 1, 2 * j.posicao + 1)))
    }
  }
  const terceiro = atual.find(j => j.fase === 'terceiro')
  if (terceiro && R >= 2) {
    definirVagas(terceiro, perdedorDoJogo(get(R - 1, 0)), perdedorDoJogo(get(R - 1, 1)))
  }

  const mudancas = []
  atual.forEach((j, i) => {
    const original = jogos[i]
    const patch = {}
    for (const c of CAMPOS_DERIVADOS) {
      const antes = c === 'sets' ? JSON.stringify(original.sets || []) : original[c] ?? null
      const depois = c === 'sets' ? JSON.stringify(j.sets || []) : j[c] ?? null
      if (antes !== depois) patch[c] = j[c] ?? null
    }
    if (Object.keys(patch).length) mudancas.push({ id: j.id, patch })
  })
  return mudancas
}

// ---------- placar ----------

export function vencedorDoSet(set, indice, formato = FORMATO_PADRAO) {
  if (!set) return null
  const a = Number(set.a) || 0
  const b = Number(set.b) || 0
  const max = Math.max(a, b)
  const min = Math.min(a, b)
  if (a === b) return null
  if (indice < 2) {
    const g = formato.games
    if ((max >= g && max - min >= 2) || (max === g + 1 && min === g)) return a > b ? 'a' : 'b'
    return null
  }
  if (max >= formato.tiebreakFinal && max - min >= 2) return a > b ? 'a' : 'b'
  return null
}

export function resumoPlacar(sets = [], formato = FORMATO_PADRAO) {
  let a = 0
  let b = 0
  sets.forEach((s, i) => {
    const v = vencedorDoSet(s, i, formato)
    if (v === 'a') a++
    if (v === 'b') b++
  })
  return { a, b, vencedor: a >= 2 ? 'a' : b >= 2 ? 'b' : null }
}

export function indiceSetAtual(sets = [], formato = FORMATO_PADRAO) {
  for (let i = 0; i < 3; i++) {
    if (!sets[i] || !vencedorDoSet(sets[i], i, formato)) return i
  }
  return 2
}

// +1 game (ou ponto, no tie-break do 3º set) para um lado, no set em disputa.
export function somarPonto(sets = [], lado, formato = FORMATO_PADRAO) {
  if (resumoPlacar(sets, formato).vencedor) return sets
  const novo = sets.map(s => ({ ...s }))
  const i = indiceSetAtual(novo, formato)
  if (!novo[i]) novo[i] = { a: 0, b: 0 }
  novo[i][lado] = (Number(novo[i][lado]) || 0) + 1
  return novo
}

// -1 no último set mexido; set que zera some da lista.
export function tirarPonto(sets = [], lado) {
  const novo = sets.map(s => ({ ...s }))
  for (let i = novo.length - 1; i >= 0; i--) {
    if ((Number(novo[i][lado]) || 0) > 0) {
      novo[i][lado] = novo[i][lado] - 1
      while (novo.length && !Number(novo[novo.length - 1].a) && !Number(novo[novo.length - 1].b)) novo.pop()
      return novo
    }
    if (Number(novo[i].a) || Number(novo[i].b)) return novo
  }
  return novo
}

export function textoPlacar(sets = []) {
  return sets.map(s => `${s.a ?? 0}-${s.b ?? 0}`).join('  ')
}

// ---------- ordem de jogos ----------

function somarMinutos(hhmm, minutos) {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function ordenarJogos(jogos) {
  return [...jogos].sort((x, y) =>
    x.rodada - y.rodada
    || (x.fase === 'terceiro' ? -1 : 0) - (y.fase === 'terceiro' ? -1 : 0)
    || x.posicao - y.posicao)
}

// Alterna os dois lados da chave (lado esquerdo = 1ª metade das posições, direito = 2ª metade),
// pegando `bloco` jogos de cada lado por vez. Numeração pedida em 14/11 (chave de 16):
//   1ª rodada, de 2 em 2: J1-J2 topo esquerdo, J3-J4 topo direito, J5-J6 esquerdo de baixo, J7-J8 direito de baixo
//   quartas, de 1 em 1:   J9 esq. sup., J10 dir. sup., J11 esq. inf., J12 dir. inf.
//   semis: J13 esquerda, J14 direita; depois J15 3º lugar e J16 final.
// Assim a quadra que libera chama sempre o outro lado e as quartas já podem começar cedo.
function intercalarLados(lista, bloco = 1) {
  const meio = Math.ceil(lista.length / 2)
  const esquerda = lista.slice(0, meio)
  const direita = lista.slice(meio)
  const out = []
  for (let i = 0; i < meio; i += bloco) {
    out.push(...esquerda.slice(i, i + bloco), ...direita.slice(i, i + bloco))
  }
  return out
}

// Distribui os jogos (sem bye) em sequência pelas quadras: cada "rodada de quadras" começa
// duracaoMin depois da anterior. O horário é "não antes de". Já sai a programação do torneio
// inteiro (rodadas seguintes também), com os dois lados da chave intercalados.
// Jogos da 1ª rodada com dupla incompleta ("A definir") vão para o fim da rodada, para dar tempo
// de a organização convidar o(a) parceiro(a).
export function agendar(jogos, quadras, horaInicio, duracaoMin, incompletas = new Set()) {
  const todos = ordenarJogos(jogos).filter(j => j.status !== 'bye')
  const temIncompleta = j => j.rodada === 1 && (incompletas.has(j.dupla_a_id) || incompletas.has(j.dupla_b_id))
  const R = totalRodadas(todos)
  const lista = []
  for (let r = 1; r <= R; r++) {
    const daRodada = todos.filter(j => j.rodada === r)
    const terceiro = daRodada.filter(j => j.fase === 'terceiro')
    const normais = intercalarLados(daRodada.filter(j => j.fase !== 'terceiro').sort((a, b) => a.posicao - b.posicao), r === 1 ? 2 : 1)
    if (r === 1) lista.push(...normais.filter(j => !temIncompleta(j)), ...normais.filter(temIncompleta))
    else lista.push(...terceiro, ...normais)
  }
  return distribuir(lista, quadras, horaInicio, duracaoMin, true)
}

function distribuir(lista, quadras, horaInicio, duracaoMin, comOrdem) {
  const qs = quadras?.length ? quadras : ['Quadra 1']
  return lista.map((j, i) => ({
    id: j.id,
    patch: {
      ...(comOrdem ? { ordem: i + 1 } : {}),
      quadra: qs[i % qs.length],
      horario: somarMinutos(horaInicio, Math.floor(i / qs.length) * duracaoMin),
    },
  }))
}

// Recalcula quadra e horário seguindo a ORDEM atual (a que a gestão arrumou com as setas).
// Só devolve mudanças de jogos ainda agendados; os que já foram jogados não mudam.
export function reagendarPelaOrdem(jogos, quadras, horaInicio, duracaoMin) {
  const lista = jogos.filter(j => j.status !== 'bye').sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  return distribuir(lista, quadras, horaInicio, duracaoMin, false)
    .filter(m => jogos.find(j => j.id === m.id)?.status === 'agendado')
}

// De onde vem a dupla de uma vaga ainda vazia: "Vencedor do jogo 3" / "Perdedor do jogo 14".
// Serve para mostrar a programação completa antes de as duplas estarem definidas.
export function origemDaVaga(jogo, lado, jogos) {
  if (!jogo || jogo.rodada <= 1) return null
  if (jogo.fase === 'terceiro') {
    const R = totalRodadas(jogos)
    const semi = jogos.find(j => j.rodada === R - 1 && j.fase !== 'terceiro' && j.posicao === (lado === 'a' ? 0 : 1))
    return semi?.ordem ? `Perdedor do jogo ${semi.ordem}` : null
  }
  const anterior = jogos.find(j => j.rodada === jogo.rodada - 1 && j.fase !== 'terceiro' && j.posicao === 2 * jogo.posicao + (lado === 'a' ? 0 : 1))
  if (!anterior) return null
  if (anterior.status === 'bye') return null
  return anterior.ordem ? `Vencedor do jogo ${anterior.ordem}` : null
}

// ---------- tempo de jogo e atraso ----------

// Minutos de atraso de um jogo agendado em relação ao horário previsto ("não antes de"), só no
// dia do torneio. 0 quando ainda está no horário.
export function msAtraso(jogo, dataTorneio, agora = Date.now()) {
  if (!jogo?.horario || !dataTorneio || jogo.status !== 'agendado') return 0
  const previsto = new Date(`${dataTorneio}T${jogo.horario}:00`).getTime()
  return Number.isFinite(previsto) && agora > previsto ? agora - previsto : 0
}

export function msEmJogo(jogo, agora = Date.now()) {
  if (jogo?.status !== 'ao_vivo' || !jogo.iniciado_em) return 0
  return Math.max(0, agora - new Date(jogo.iniciado_em).getTime())
}

// 00:42 / 1:04:52
export function formatarDuracao(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`
}

// ---------- nomes ----------

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'junior', 'júnior', 'filho', 'neto'])

// Nomes que quase sempre vêm compostos: "Ana Flávia", "Ana Paula", "Luiz Gustavo", "João Vitor".
// Quando o nome começa com um destes e tem mais de duas palavras, a 2ª palavra faz parte do
// primeiro nome (no telão aparece "Ana Flávia Barbosa", não "Ana Barbosa").
const PRIMEIROS_COMPOSTOS = new Set(['ana', 'anna', 'maria', 'joao', 'jose', 'luiz', 'luis'])

function partesNome(nome) {
  return String(nome || '').trim().split(/\s+/).filter(Boolean)
}

function temComposto(partes) {
  return partes.length >= 3
    && PRIMEIROS_COMPOSTOS.has(normalizar(partes[0]))
    && !PARTICULAS.has(partes[1].toLowerCase())
}

// "Ana Flávia Pizzo Barbosa" -> "Ana Flávia"; "Luiza Pizzo Barbosa" -> "Luiza".
export function primeiroNome(nome = '') {
  const partes = partesNome(nome)
  if (!partes.length) return ''
  return temComposto(partes) ? `${partes[0]} ${partes[1]}` : partes[0]
}

// "Ana Flávia Pizzo Barbosa" -> "Ana Flávia Barbosa"; "Gisele Záccaro de Oliveira Manchon" -> "Gisele Manchon".
export function nomeCurto(nome = '') {
  if (!nome || !String(nome).trim()) return 'A definir'
  const partes = partesNome(nome)
  if (partes.length <= 1) return partes[0] || ''
  const inicio = temComposto(partes) ? 2 : 1
  let ultimo = null
  for (let i = partes.length - 1; i >= inicio; i--) {
    if (!PARTICULAS.has(partes[i].toLowerCase())) {
      // mantém o "da/de/do" colado no sobrenome: "Tatiana da Ponte"
      const antes = partes[i - 1]?.toLowerCase()
      ultimo = i - 1 >= inicio && ['de', 'da', 'do', 'dos', 'das'].includes(antes) ? `${partes[i - 1]} ${partes[i]}` : partes[i]
      break
    }
  }
  const primeiro = partes.slice(0, inicio).join(' ')
  return ultimo ? `${primeiro} ${ultimo}` : primeiro
}

export function iniciais(nome = '') {
  const p = nomeCurto(nome).split(' ')
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export function normalizar(txt = '') {
  return txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Foto: recorta quadrada no centro e reduz para caber no banco (data URL ~15-30 KB).
export function comprimirFoto(arquivo, lado = 320, qualidade = 0.78) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler a foto'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Formato de foto não suportado'))
      img.onload = () => {
        const menor = Math.min(img.width, img.height)
        const sx = (img.width - menor) / 2
        const sy = (img.height - menor) / 2
        const canvas = document.createElement('canvas')
        canvas.width = lado
        canvas.height = lado
        canvas.getContext('2d').drawImage(img, sx, sy, menor, menor, 0, 0, lado, lado)
        resolve(canvas.toDataURL('image/jpeg', qualidade))
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}

// ---------- editor de foto (ajuste do rosto pelo próprio atleta) ----------

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Formato de foto não suportado'))
    img.src = src
  })
}

function reduzirNoCanvas(fonte, larguraOrig, alturaOrig, maximo) {
  const fator = Math.min(1, maximo / Math.max(larguraOrig, alturaOrig))
  const w = Math.max(1, Math.round(larguraOrig * fator))
  const h = Math.max(1, Math.round(alturaOrig * fator))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(fonte, 0, 0, w, h)
  const src = canvas.toDataURL('image/jpeg', 0.9)
  canvas.width = 0
  canvas.height = 0
  return { src, w, h }
}

// Lê a foto escolhida, já reduz e corrige a orientação do aparelho.
// Foto tirada na hora pela câmera costuma ser enorme (12 a 50 MP): decodificar inteira no <img>
// estoura a memória de muitos celulares e a foto "não entra". Por isso o caminho principal é o
// createImageBitmap, que já decodifica reduzido; o <img> fica de reserva para navegadores antigos.
export async function prepararImagem(arquivo, maximo = 1400) {
  if (!arquivo || (arquivo.size !== undefined && arquivo.size === 0)) throw new Error('A foto veio vazia. Tente de novo.')
  if (typeof createImageBitmap === 'function') {
    try {
      // Só a largura: a altura acompanha a proporção. O canvas abaixo ainda limita o lado maior.
      const reduzido = await createImageBitmap(arquivo, { imageOrientation: 'from-image', resizeWidth: maximo, resizeQuality: 'high' })
      const r = reduzirNoCanvas(reduzido, reduzido.width, reduzido.height, maximo)
      reduzido.close?.()
      return r
    } catch {
      // segue para o caminho antigo
    }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await carregarImagem(url)
    return reduzirNoCanvas(img, img.naturalWidth, img.naturalHeight, maximo)
  } catch {
    throw new Error('Não consegui abrir essa foto. Tente de novo ou escolha uma da galeria.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function girarImagem({ src, w, h }) {
  const img = await carregarImagem(src)
  const canvas = document.createElement('canvas')
  canvas.width = h
  canvas.height = w
  const ctx = canvas.getContext('2d')
  ctx.translate(h, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(img, 0, 0, w, h)
  return { src: canvas.toDataURL('image/jpeg', 0.9), w: h, h: w }
}

// Recorta o quadrado que está dentro do círculo do editor (janela de `janela` px, com zoom e
// deslocamento em px de tela) e devolve a foto final pequena para o banco.
export async function recortarFoto({ src, w, h }, janela, zoom, pos, lado = 360, qualidade = 0.82) {
  const img = await carregarImagem(src)
  const escala = (janela / Math.min(w, h)) * zoom
  const tamanho = janela / escala
  const cx = w / 2 - pos.x / escala
  const cy = h / 2 - pos.y / escala
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  canvas.getContext('2d').drawImage(img, cx - tamanho / 2, cy - tamanho / 2, tamanho, tamanho, 0, 0, lado, lado)
  return canvas.toDataURL('image/jpeg', qualidade)
}
