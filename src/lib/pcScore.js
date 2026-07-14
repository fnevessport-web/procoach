// PC Score — índice interno de evolução técnica (menor = melhor, mesmo conceito de
// organização usado por sistemas de rating de tênis conhecidos no mercado, mas é um índice
// próprio do ProCoach, não afiliado a nenhuma marca). Função pura, sem I/O — recebe tudo já
// carregado (notas, definições de dimensão/domínio, data de nascimento, faixa manual) e
// devolve o resultado calculado, pra dar pra testar sem precisar de banco nem de mock de rede.
//
// Arquitetura modular por modalidade: os pesos por unidade/faixa etária ficam num objeto de
// config (PESOS_POR_MODALIDADE) chaveado pelo NOME da modalidade. Uma modalidade nova (Padel,
// Beach Tennis...) só precisa de uma entrada nova aqui; nenhuma modalidade sem entrada quebra
// — cai no padrão de peso 1.0 pra todas as unidades.
//
// Duas formas de "unidade de pontuação" convivem no mesmo código (ver calcularMediasDominios):
// modalidades com subitens agrupados por domínio (Tênis: 19 subitens em 5 domínios, nota
// 1-10) e modalidades com dimensões soltas, sem agrupamento (as demais, nota 1-5 — modelo
// original). Cada subitem/dimensão é reduzido pra uma escala 1-5 equivalente antes de entrar
// na fórmula, então o mesmo cálculo final e as mesmas faixas de corte (NIVEIS_PC_SCORE)
// valem pras duas formas sem precisar de nenhum caso especial por modalidade.

// Faixas etárias reconhecidas — as mesmas em toda a régua (cálculo automático por idade e
// seleção manual do professor usam exatamente essas três chaves).
export const FAIXAS_ETARIAS = [
  { chave: 'kids', label: 'Kids', faixaIdade: '6 a 9 anos', min: 6, max: 9 },
  { chave: 'infantil', label: 'Infantil', faixaIdade: '10 a 13 anos', min: 10, max: 13 },
  { chave: 'adulto', label: 'Adulto/Juvenil', faixaIdade: '14 anos ou mais', min: 14, max: Infinity },
]

// Pesos por unidade de pontuação que fogem do padrão 1.0 — só precisa listar as exceções.
// "Unidade" é um DOMÍNIO nas modalidades com subitens agrupados (Tênis: Saque, Jogo de
// Fundo, Jogo de Rede, Tática, Condicionamento Físico — ver modalidade_dimensoes.dominio),
// ou a própria dimensão solta nas modalidades que ainda não migraram pra esse modelo (a
// chave então é o nome_dimensao de sempre, ex. "Saque", "Condicionamento").
//
// Tênis: "Condicionamento" e "Posicionamento" (pesos antigos, kids) viraram respectivamente
// o domínio "Condicionamento Físico" e um subitem dentro de "Jogo de Fundo" — como
// Posicionamento não é mais um domínio inteiro (só 1 de 5 subitens ali), o peso extra dele
// não tem pra onde migrar sem distorcer o resto de Jogo de Fundo, e foi deixado de fora;
// "Saque" e "Voleio" (pesos antigos, adulto) mapeiam direto pra "Saque" e "Jogo de Rede".
const PESOS_POR_MODALIDADE = {
  'Tênis': {
    kids: { 'Condicionamento Físico': 1.3 },
    infantil: {},
    adulto: { Saque: 1.3, 'Jogo de Rede': 1.3 },
  },
}

// Os 5 níveis do PC Score — do pior (Iniciante, score alto) ao melhor (Elite, score baixo).
export const NIVEIS_PC_SCORE = [
  { chave: 'iniciante', min: 80, max: 100, label: 'Iniciante', cor: '#3b82f6' },
  { chave: 'basico', min: 60, max: 79, label: 'Básico', cor: '#22c55e' },
  { chave: 'intermediario', min: 40, max: 59, label: 'Intermediário', cor: '#fcc825' },
  { chave: 'avancado', min: 20, max: 39, label: 'Avançado', cor: '#f97316' },
  { chave: 'elite', min: 1, max: 19, label: 'Elite', cor: '#cf1b9b' },
]

// Prazo de reavaliação — usado tanto pro badge "Reavaliação pendente" quanto pra qualquer
// outra tela que precise saber se uma avaliação está velha.
export const REAVALIACAO_PRAZO_DIAS = 90

function paraData(valor) {
  if (valor instanceof Date) return valor
  // 'yyyy-MM-dd' puro vira meia-noite UTC e pode cair no dia anterior dependendo do fuso —
  // fixa meio-dia local, mesmo padrão usado em todo o resto do app pra data sem hora.
  return new Date(`${valor}T12:00:00`)
}

// Idade em anos completos numa data de referência (não só a diferença de ano — considera
// se o aniversário do período já passou).
export function calcularIdade(dataNascimento, dataReferencia = new Date()) {
  if (!dataNascimento) return null
  const nasc = paraData(dataNascimento)
  const ref = paraData(dataReferencia)
  let idade = ref.getFullYear() - nasc.getFullYear()
  const aniversarioAindaNaoChegou =
    ref.getMonth() < nasc.getMonth() ||
    (ref.getMonth() === nasc.getMonth() && ref.getDate() < nasc.getDate())
  if (aniversarioAindaNaoChegou) idade--
  return idade
}

// Resolve qual faixa etária usar: data de nascimento sempre tem prioridade quando existe
// (mais precisa, e o aluno "sobe" de faixa sozinho conforme faz aniversário); na ausência
// dela, usa a faixa que o professor escolheu manualmente no cadastro do aluno
// (alunos.faixa_etaria_manual — enquanto o clube não repassa a data de nascimento real).
// Devolve null quando não dá pra determinar — quem chama decide o que fazer (ex.: bloquear
// o formulário de avaliação até alguém escolher uma faixa).
export function resolverFaixaEtaria({ dataNascimento, faixaManual, dataAvaliacao = new Date() } = {}) {
  if (dataNascimento) {
    const idade = calcularIdade(dataNascimento, dataAvaliacao)
    const faixa = FAIXAS_ETARIAS.find(f => idade >= f.min && idade <= f.max)
    if (faixa) return faixa.chave
  }
  if (faixaManual && FAIXAS_ETARIAS.some(f => f.chave === faixaManual)) return faixaManual
  return null
}

export function nivelPorPcScore(pcScore) {
  if (pcScore == null) return null
  return NIVEIS_PC_SCORE.find(n => pcScore >= n.min && pcScore <= n.max) || NIVEIS_PC_SCORE[NIVEIS_PC_SCORE.length - 1]
}

// Reduz a nota de um subitem (numa escala qualquer, ex. 1-10) pra escala equivalente 1-5 —
// é nessa escala que o resto da fórmula do PC Score sempre trabalhou. Manter a conversão só
// aqui, num único lugar, é o que deixa a fórmula final (e as faixas de corte do PC Score,
// NIVEIS_PC_SCORE) livres pra nunca precisar mudar, não importa a escala de entrada de cada
// modalidade — o "recalibrar" que a escala 1-10 do Tênis pede acontece na entrada, não na
// régua de saída.
function paraEscala5(nota, escalaMax) {
  return (nota / (escalaMax || 5)) * 5
}

// Agrupa as notas de `dimensoes` ({ chave: nota }) pelas definições de
// modalidade_dimensoes (`definicoesDimensoes`, mesmo formato de useDimensoesModalidade).
// Cada subitem com `dominio` preenchido (modelo novo, ex. Tênis) entra na média do domínio
// dele; sem `dominio` (modelo antigo, ainda usado por Padel/Beach Tennis/Futevôlei/Vôlei de
// Praia), cada dimensão é sua própria "unidade" — exatamente o comportamento de sempre.
//
// Devolve uma lista de unidades: { nome, media (1 casa decimal, escala original do
// domínio/dimensão), notaEm5 (escala equivalente 1-5, uso interno do PC Score), subitens }.
export function calcularMediasDominios(dimensoes, definicoesDimensoes) {
  if (!definicoesDimensoes?.length) return []

  const porDominio = {}
  const soltas = []

  definicoesDimensoes.forEach(d => {
    const nota = dimensoes?.[d.chave]
    if (typeof nota !== 'number' || Number.isNaN(nota)) return
    const escalaMax = d.escala_max || 5
    const subitem = { nome: d.nome_dimensao, chave: d.chave, nota, escalaMax }

    if (d.dominio) {
      if (!porDominio[d.dominio]) porDominio[d.dominio] = { nome: d.dominio, subitens: [] }
      porDominio[d.dominio].subitens.push(subitem)
    } else {
      soltas.push(subitem)
    }
  })

  const unidadesDominio = Object.values(porDominio).map(dom => {
    const somaOriginal = dom.subitens.reduce((s, sub) => s + sub.nota, 0)
    const somaEm5 = dom.subitens.reduce((s, sub) => s + paraEscala5(sub.nota, sub.escalaMax), 0)
    return {
      nome: dom.nome,
      media: Math.round((somaOriginal / dom.subitens.length) * 10) / 10,
      notaEm5: somaEm5 / dom.subitens.length,
      subitens: dom.subitens,
    }
  })

  const unidadesSoltas = soltas.map(sub => ({
    nome: sub.nome,
    media: sub.nota,
    notaEm5: paraEscala5(sub.nota, sub.escalaMax),
    subitens: [sub],
  }))

  return [...unidadesDominio, ...unidadesSoltas]
}

// Cálculo central. `dimensoes` é um objeto { chave: nota } — mesmo formato salvo em
// avaliacoes_tecnicas.dimensoes, então o resultado dessa função pode ser gravado direto.
// `definicoesDimensoes` são as linhas de modalidade_dimensoes da modalidade em questão (o
// retorno de useDimensoesModalidade) — é o que diz quais subitens pertencem a qual domínio
// e em que escala cada um foi avaliado.
//
// Retorna pcScore/mediaPonderada/nivel como null (em vez de estimar um valor) quando a faixa
// etária não pôde ser determinada — nunca gera um score "advinhando" a idade do aluno.
export function calcularPcScore({ dimensoes, definicoesDimensoes, modalidadeNome, dataNascimento, faixaManual, dataAvaliacao = new Date() }) {
  const faixaEtaria = resolverFaixaEtaria({ dataNascimento, faixaManual, dataAvaliacao })
  if (!faixaEtaria) {
    return { pcScore: null, mediaPonderada: null, faixaEtaria: null, nivel: null, dominios: [] }
  }

  const unidades = calcularMediasDominios(dimensoes, definicoesDimensoes)
  if (unidades.length === 0) {
    return { pcScore: null, mediaPonderada: null, faixaEtaria, nivel: null, dominios: [] }
  }

  const pesosDaFaixa = PESOS_POR_MODALIDADE[modalidadeNome]?.[faixaEtaria] || {}
  let somaPonderada = 0
  let somaPesos = 0
  unidades.forEach(({ nome, notaEm5 }) => {
    const peso = pesosDaFaixa[nome] ?? 1
    somaPonderada += notaEm5 * peso
    somaPesos += peso
  })

  const mediaPonderada = somaPonderada / somaPesos
  const pcScore = Math.max(1, Math.round(100 - mediaPonderada * 19.8))

  return {
    pcScore,
    mediaPonderada: Math.round(mediaPonderada * 100) / 100,
    faixaEtaria,
    nivel: nivelPorPcScore(pcScore),
    dominios: unidades,
  }
}

// true quando já passou o prazo (ou nunca houve avaliação — nesse caso também "precisa").
export function precisaReavaliar(dataUltimaAvaliacao, hoje = new Date()) {
  if (!dataUltimaAvaliacao) return true
  const diffMs = paraData(hoje) - paraData(dataUltimaAvaliacao)
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias >= REAVALIACAO_PRAZO_DIAS
}
