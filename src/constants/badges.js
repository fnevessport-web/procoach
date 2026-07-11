// Badges de conquista do aluno. Os 4 tipos originais (assiduidade/matrícula) continuam
// concedidos por useAlunos.js (verificarEConcederBadges) e useAtualizarNivelModalidade —
// não mexidos aqui. Os tipos TÉCNICOS (evolução de PC Score, dimensão em nível avançado,
// assiduidade na reavaliação) são calculados por regra a partir do histórico de avaliações,
// numa função pura e testável — quem chama (a tela de avaliação, na próxima entrega) é quem
// faz o INSERT de verdade em badges_aluno, esse arquivo só decide QUAIS badges já foram
// conquistados dado um histórico. Ajustar/adicionar uma regra nova é só mexer aqui — a trava
// fixa de tipo_badge no banco já foi solta (migração 009) exatamente pra isso não precisar
// de migração nova a cada badge.
import { nivelPorPcScore, NIVEIS_PC_SCORE, REAVALIACAO_PRAZO_DIAS } from '../lib/pcScore'

export const BADGES = {
  // Assiduidade/matrícula (concedidos por useAlunos.js — não mexer aqui)
  primeira_aula: { emoji: '🎉', label: 'Primeira aula' },
  '10_aulas': { emoji: '🔟', label: '10 aulas' },
  evoluiu_nivel: { emoji: '📈', label: 'Evoluiu de nível' },
  '3_meses_sem_falta': { emoji: '🏆', label: '3 meses sem falta' },

  // Técnicos — Evolução Técnica (Tênis). Concedidos por avaliarBadgesTecnicos, abaixo.
  evoluiu_pc_score_nivel: { emoji: '⬆️', label: 'Subiu de faixa no PC Score' },
  dimensao_saque_avancado: { emoji: '🎾', label: 'Saque Preciso' },
  dimensao_direita_avancado: { emoji: '💪', label: 'Direita Consistente' },
  dimensao_esquerda_avancado: { emoji: '💪', label: 'Esquerda Consistente' },
  dimensao_voleio_avancado: { emoji: '⚡', label: 'Voleio Afiado' },
  dimensao_posicionamento_avancado: { emoji: '🧭', label: 'Leitura de Jogo' },
  dimensao_condicionamento_avancado: { emoji: '🔥', label: 'Condicionamento Top' },
  avaliacoes_em_dia_3x: { emoji: '📅', label: 'Sempre em dia' },
}

// Nota mínima (escala 1-5) pra uma dimensão render badge de "nível avançado".
const NOTA_MINIMA_DIMENSAO_AVANCADA = 4

// Quantas avaliações seguidas, cada uma dentro do prazo de reavaliação da anterior
// (+ folga), pra ganhar o badge de assiduidade.
const QTD_AVALIACOES_EM_DIA = 3
const FOLGA_DIAS_AVALIACAO_EM_DIA = 15

// Vira um tipo_badge estável mesmo pra dimensões de outras modalidades com espaço/acento/
// barra no nome (ex.: futura entrada "Bandeja/Smash" do Padel) — Tênis não precisa disso
// hoje (nenhuma das 6 dimensões tem caractere especial), mas evita quebrar quando outra
// modalidade ganhar sua config de pesos.
function nomeDimensaoParaTipoBadge(nomeDimensao) {
  const chave = nomeDimensao
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
  return `dimensao_${chave}_avancado`
}

function diasEntre(dataA, dataB) {
  const ms = new Date(`${dataB}T12:00:00`) - new Date(`${dataA}T12:00:00`)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

// Recebe o histórico de avaliações de um aluno numa modalidade (mesmo formato de
// useAvaliacoesModalidade — mais antiga primeiro, a última é a recém-salva) e devolve os
// tipos de badge técnico que esse histórico já qualifica, incluindo os que o aluno talvez
// já tenha (quem chama faz o upsert com ignoreDuplicates, então repetir aqui não duplica).
export function badgesTecnicosElegiveis(avaliacoes) {
  const elegiveis = []
  if (!avaliacoes?.length) return elegiveis

  const ultima = avaliacoes[avaliacoes.length - 1]
  const anterior = avaliacoes.length >= 2 ? avaliacoes[avaliacoes.length - 2] : null

  // Regra 1: subiu de faixa no PC Score em relação à avaliação anterior.
  if (ultima.pc_score != null && anterior?.pc_score != null) {
    const nivelAtual = nivelPorPcScore(ultima.pc_score)
    const nivelAnterior = nivelPorPcScore(anterior.pc_score)
    if (nivelAtual && nivelAnterior && nivelAtual.chave !== nivelAnterior.chave) {
      const idxAtual = NIVEIS_PC_SCORE.findIndex(n => n.chave === nivelAtual.chave)
      const idxAnterior = NIVEIS_PC_SCORE.findIndex(n => n.chave === nivelAnterior.chave)
      // Índice maior = faixa melhor (Elite é a última do array) — ver pcScore.js.
      if (idxAtual > idxAnterior) elegiveis.push('evoluiu_pc_score_nivel')
    }
  }

  // Regra 2: alguma dimensão bateu nota 4+ na avaliação mais recente.
  Object.entries(ultima.dimensoes || {}).forEach(([nomeDimensao, nota]) => {
    if (nota >= NOTA_MINIMA_DIMENSAO_AVANCADA) {
      elegiveis.push(nomeDimensaoParaTipoBadge(nomeDimensao))
    }
  })

  // Regra 3: últimas N avaliações, cada uma reavaliada dentro do prazo (+folga) da anterior.
  if (avaliacoes.length >= QTD_AVALIACOES_EM_DIA) {
    const ultimasN = avaliacoes.slice(-QTD_AVALIACOES_EM_DIA)
    const todasEmDia = ultimasN.every((av, i) => {
      if (i === 0) return true
      const gap = diasEntre(ultimasN[i - 1].data_avaliacao, av.data_avaliacao)
      return gap <= REAVALIACAO_PRAZO_DIAS + FOLGA_DIAS_AVALIACAO_EM_DIA
    })
    if (todasEmDia) elegiveis.push('avaliacoes_em_dia_3x')
  }

  return elegiveis
}
