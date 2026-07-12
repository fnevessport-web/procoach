// Pontuação Beyond — ranking interno de jogos (ver módulo Ranking). Ao contrário do PC Score
// (avaliação técnica do professor, menor = melhor), aqui MAIOR é melhor: mede resultado em
// partidas, não evolução técnica — os dois indicadores coexistem no card do aluno, mas nunca
// se misturam.
//
// Função pura, sem I/O — recebe o histórico de jogos já resolvido (pontos por PARTICIPANTE,
// não por jogo: um W.O., por exemplo, vale pontos diferentes pra cada lado) e devolve a
// pontuação do ciclo vigente, sempre recalculada sobre a janela deslizante de 90 dias, nunca
// sobre o total histórico.

// Torneio interno vale o dobro em vitória/derrota "normal", pra estimular participação. W.O.
// não dobra — o documento oficial só lista o dobro pra vitória (200) e derrota (60); um W.O.
// já é um valor fixo de participação/penalidade, não uma pontuação de partida disputada.
export const PONTOS_POR_RESULTADO = {
  avulso: { vitoria: 100, derrota: 30, wo_vitoria: 100, wo_derrota: -50 },
  torneio: { vitoria: 200, derrota: 60, wo_vitoria: 100, wo_derrota: -50 },
}

export function calcularPontosResultado({ resultado, origem }) {
  if (!resultado) return 0
  const tabela = PONTOS_POR_RESULTADO[origem] || PONTOS_POR_RESULTADO.avulso
  return tabela[resultado] ?? 0
}

export const JANELA_DIAS = 90
export const MINIMO_JOGOS_CLASSIFICACAO = 5

// Nível de assiduidade — multiplicador aplicado sobre a média de pontos da janela. `max`
// usa Infinity pra não precisar de um caso especial no nível mais alto (Ouro).
export const NIVEIS_ASSIDUIDADE = [
  { chave: 'Bronze', min: 5, max: 10, multiplicador: 1.0, cor: '#cd7f32' },
  { chave: 'Prata', min: 11, max: 20, multiplicador: 1.2, cor: '#9ca3af' },
  { chave: 'Ouro', min: 21, max: Infinity, multiplicador: 1.5, cor: '#fcc825' },
]

export function nivelPorNumJogos(numJogos) {
  return NIVEIS_ASSIDUIDADE.find(n => numJogos >= n.min && numJogos <= n.max) || null
}

export function faltamParaClassificar(numJogos) {
  return Math.max(0, MINIMO_JOGOS_CLASSIFICACAO - numJogos)
}

function arredondar(valor) {
  return valor == null ? null : Math.round(valor * 10) / 10
}

// jogos: [{ dataJogo: 'yyyy-MM-dd', pontos: number }] — já filtrados pra "válidos" (aprovados,
// não cancelados) antes de chegar aqui; a filtragem por JANELA_DIAS é feita dentro da função,
// nunca fora, pra garantir que todo lugar que chama isso recalcula sobre a janela vigente.
// dataReferencia (opcional, 'yyyy-MM-dd') é o "hoje" usado pra abrir a janela — só existe pra
// permitir teste determinístico; em produção fica de fora e usa a data real.
export function calcularPontuacaoBeyond({ jogos, dataReferencia } = {}) {
  const hoje = dataReferencia ? new Date(dataReferencia + 'T12:00') : new Date()
  const limite = new Date(hoje)
  limite.setDate(limite.getDate() - JANELA_DIAS)
  const limiteStr = limite.toISOString().slice(0, 10)

  const jogosNaJanela = (jogos || []).filter(j => j.dataJogo >= limiteStr)
  const numJogos = jogosNaJanela.length
  const somaPontos = jogosNaJanela.reduce((acc, j) => acc + (j.pontos || 0), 0)
  const mediaBruta = numJogos > 0 ? somaPontos / numJogos : null

  const nivelInfo = nivelPorNumJogos(numJogos)
  const classificavel = numJogos >= MINIMO_JOGOS_CLASSIFICACAO && !!nivelInfo

  return {
    pontuacao_beyond: classificavel ? arredondar(mediaBruta * nivelInfo.multiplicador) : null,
    media: arredondar(mediaBruta),
    num_jogos: numJogos,
    nivel: classificavel ? nivelInfo.chave : null,
    multiplicador: classificavel ? nivelInfo.multiplicador : null,
  }
}
