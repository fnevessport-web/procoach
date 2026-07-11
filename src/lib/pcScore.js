// PC Score — índice interno de evolução técnica (menor = melhor, mesmo conceito de
// organização usado por sistemas de rating de tênis conhecidos no mercado, mas é um índice
// próprio do ProCoach, não afiliado a nenhuma marca). Função pura, sem I/O — recebe tudo já
// carregado (notas, data de nascimento, faixa manual) e devolve o resultado calculado, pra
// dar pra testar sem precisar de banco nem de mock de rede.
//
// Arquitetura modular por modalidade: os pesos por dimensão/faixa etária ficam num objeto de
// config (PESOS_POR_MODALIDADE) chaveado pelo NOME da modalidade — igual ao formato que
// `dimensoes` já usa no banco (jsonb chaveado por nome de dimensão, não colunas fixas). Uma
// modalidade nova (Padel, Beach Tennis...) só precisa de uma entrada nova aqui; nenhuma
// modalidade sem entrada quebra — cai no padrão de peso 1.0 pra todas as dimensões.

// Faixas etárias reconhecidas — as mesmas em toda a régua (cálculo automático por idade e
// seleção manual do professor usam exatamente essas três chaves).
export const FAIXAS_ETARIAS = [
  { chave: 'kids', label: 'Kids', faixaIdade: '6 a 9 anos', min: 6, max: 9 },
  { chave: 'infantil', label: 'Infantil', faixaIdade: '10 a 13 anos', min: 10, max: 13 },
  { chave: 'adulto', label: 'Adulto/Juvenil', faixaIdade: '14 anos ou mais', min: 14, max: Infinity },
]

// Pesos por dimensão que fogem do padrão 1.0 — só precisa listar as exceções. Chaves de
// dimensão têm que bater com o nome salvo em `dimensoes` (mesmo nome_dimensao de
// modalidade_dimensoes, ex.: "Saque", "Condicionamento").
const PESOS_POR_MODALIDADE = {
  'Tênis': {
    kids: { Condicionamento: 1.3, Posicionamento: 1.3 },
    infantil: {},
    adulto: { Saque: 1.3, Voleio: 1.3 },
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

// Cálculo central. `dimensoes` é um objeto { nomeDimensao: nota(1-5) } — mesmo formato salvo
// em avaliacoes_tecnicas.dimensoes, então o resultado dessa função pode ser gravado direto.
//
// Retorna pcScore/mediaPonderada/nivel como null (em vez de estimar um valor) quando a faixa
// etária não pôde ser determinada — nunca gera um score "advinhando" a idade do aluno.
export function calcularPcScore({ dimensoes, modalidadeNome, dataNascimento, faixaManual, dataAvaliacao = new Date() }) {
  const faixaEtaria = resolverFaixaEtaria({ dataNascimento, faixaManual, dataAvaliacao })
  if (!faixaEtaria) {
    return { pcScore: null, mediaPonderada: null, faixaEtaria: null, nivel: null }
  }

  const entradas = Object.entries(dimensoes || {}).filter(([, nota]) => typeof nota === 'number' && !Number.isNaN(nota))
  if (entradas.length === 0) {
    return { pcScore: null, mediaPonderada: null, faixaEtaria, nivel: null }
  }

  const pesosDaFaixa = PESOS_POR_MODALIDADE[modalidadeNome]?.[faixaEtaria] || {}
  let somaPonderada = 0
  let somaPesos = 0
  entradas.forEach(([nomeDimensao, nota]) => {
    const peso = pesosDaFaixa[nomeDimensao] ?? 1
    somaPonderada += nota * peso
    somaPesos += peso
  })

  const mediaPonderada = somaPonderada / somaPesos
  const pcScore = Math.max(1, Math.round(100 - mediaPonderada * 19.8))

  return {
    pcScore,
    mediaPonderada: Math.round(mediaPonderada * 100) / 100,
    faixaEtaria,
    nivel: nivelPorPcScore(pcScore),
  }
}

// true quando já passou o prazo (ou nunca houve avaliação — nesse caso também "precisa").
export function precisaReavaliar(dataUltimaAvaliacao, hoje = new Date()) {
  if (!dataUltimaAvaliacao) return true
  const diffMs = paraData(hoje) - paraData(dataUltimaAvaliacao)
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias >= REAVALIACAO_PRAZO_DIAS
}
