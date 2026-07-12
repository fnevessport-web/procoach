// Módulo de Conquistas — avaliação pura dos critérios (item A.4). Cada função recebe um
// "contexto" já resolvido (números/arrays simples, sem tocar banco) e devolve se aquele
// critério está satisfeito agora — quem monta o contexto a partir do Supabase e grava o
// resultado em conquistas_alunos é src/hooks/useConquistas.js. Separar assim deixa a regra
// de negócio testável com script descartável, sem precisar de banco (mesmo padrão de
// pcScore.js e badgesTecnicosElegiveis em constants/badges.js).
//
// 2 critérios do catálogo (campeao_torneio, indicou_amigo) não têm avaliador aqui de
// propósito — ver a observação de cada um em conquistas_config.json / migration 013.

import { nivelPorPcScore, NIVEIS_PC_SCORE } from './pcScore'
import { badgesTecnicosElegiveis } from '../constants/badges'

// Contexto esperado (tudo já resolvido pelo chamador, ver useConquistas.js):
// {
//   hoje: 'yyyy-MM-dd',
//   aluno: { foto_url, data_nascimento, genero, telefone, ativo },
//   presencasConfirmadas: number,
//   presencasReposicaoConfirmadas: number,
//   primeiraAulaData: 'yyyy-MM-dd' | null,
//   ultimaFaltaNaoJustificadaData: 'yyyy-MM-dd' | null,
//   teveMesPerfeitoAlgumaVez: boolean,
//   avaliacoesConfirmadas: [{ data_avaliacao, pc_score, dimensoes }] (mais antiga primeiro),
//   jaTevePosicaoRanking: boolean,
//   vitoriasRanking: number,
//   jogosTorneio: number,
//   venceuCategoriaSuperior: boolean,
//   adversariosDistintos: number,
//   posicaoAtual: { geral: number|null, categoria: number|null },
//   nivelAssiduidadeAtual: 'Bronze'|'Prata'|'Ouro'|null,
// }

function diasEntre(dataA, dataB) {
  const ms = new Date(`${dataB}T12:00:00`) - new Date(`${dataA}T12:00:00`)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

// { desbloqueada, ativa, progressoAtual, progressoAlvo } — pra tipo 'marco'/'historico',
// ativa é sempre igual a desbloqueada (nunca "perde"); pra 'dinamico', ativa reflete o status
// AGORA e desbloqueada só marca se algum dia já foi true (quem decide o "algum dia" e o
// desbloqueada_em é o orquestrador, que tem o estado anterior salvo no banco).
const AVALIADORES = {
  presencas_confirmadas_minima: (criterio, ctx) => {
    const atual = ctx.presencasConfirmadas
    return { ok: atual >= criterio.quantidade, progressoAtual: atual, progressoAlvo: criterio.quantidade }
  },

  atingiu_minimo_jogos_classificacao: (_criterio, ctx) => ({
    ok: ctx.jaTevePosicaoRanking, progressoAtual: null, progressoAlvo: null,
  }),

  vitorias_ranking_minima: (criterio, ctx) => ({
    ok: ctx.vitoriasRanking >= criterio.quantidade, progressoAtual: ctx.vitoriasRanking, progressoAlvo: criterio.quantidade,
  }),

  jogos_torneio_minima: (criterio, ctx) => ({
    ok: ctx.jogosTorneio >= criterio.quantidade, progressoAtual: ctx.jogosTorneio, progressoAlvo: criterio.quantidade,
  }),

  venceu_categoria_superior: (_criterio, ctx) => ({
    ok: !!ctx.venceuCategoriaSuperior, progressoAtual: null, progressoAlvo: null,
  }),

  adversarios_distintos_minimo: (criterio, ctx) => ({
    ok: ctx.adversariosDistintos >= criterio.quantidade, progressoAtual: ctx.adversariosDistintos, progressoAlvo: criterio.quantidade,
  }),

  posicao_ranking_maxima: (criterio, ctx) => {
    const posicao = criterio.tipo_ranking === 'geral' ? ctx.posicaoAtual.geral : ctx.posicaoAtual.categoria
    return { ok: posicao != null && posicao <= criterio.posicao_maxima, progressoAtual: null, progressoAlvo: null }
  },

  posicao_ranking_atual: (criterio, ctx) => {
    const posicao = criterio.tipo_ranking === 'geral' ? ctx.posicaoAtual.geral : ctx.posicaoAtual.categoria
    return { ok: posicao === criterio.posicao, progressoAtual: null, progressoAlvo: null }
  },

  nivel_assiduidade_atual: (criterio, ctx) => ({
    ok: ctx.nivelAssiduidadeAtual === criterio.nivel, progressoAtual: null, progressoAlvo: null,
  }),

  dias_seguidos_sem_falta_nao_justificada: (criterio, ctx) => {
    if (!ctx.primeiraAulaData) return { ok: false, progressoAtual: 0, progressoAlvo: criterio.dias }
    const desde = ctx.ultimaFaltaNaoJustificadaData || ctx.primeiraAulaData
    const dias = diasEntre(desde, ctx.hoje)
    return { ok: dias >= criterio.dias, progressoAtual: Math.min(dias, criterio.dias), progressoAlvo: criterio.dias }
  },

  mes_calendario_sem_nenhuma_falta: (_criterio, ctx) => ({
    ok: !!ctx.teveMesPerfeitoAlgumaVez, progressoAtual: null, progressoAlvo: null,
  }),

  presenca_reposicao_minima: (criterio, ctx) => ({
    ok: ctx.presencasReposicaoConfirmadas >= criterio.quantidade, progressoAtual: ctx.presencasReposicaoConfirmadas, progressoAlvo: criterio.quantidade,
  }),

  dias_desde_primeira_aula_ainda_ativo: (criterio, ctx) => {
    if (!ctx.primeiraAulaData || !ctx.aluno.ativo) return { ok: false, progressoAtual: 0, progressoAlvo: criterio.dias }
    const dias = diasEntre(ctx.primeiraAulaData, ctx.hoje)
    return { ok: dias >= criterio.dias, progressoAtual: Math.min(dias, criterio.dias), progressoAlvo: criterio.dias }
  },

  avaliacoes_tecnicas_confirmadas_minima: (criterio, ctx) => {
    const atual = ctx.avaliacoesConfirmadas.length
    return { ok: atual >= criterio.quantidade, progressoAtual: atual, progressoAlvo: criterio.quantidade }
  },

  reaproveita_badge_evoluiu_pc_score_nivel: (_criterio, ctx) => ({
    ok: badgesTecnicosElegiveis(ctx.avaliacoesConfirmadas).includes('evoluiu_pc_score_nivel'), progressoAtual: null, progressoAlvo: null,
  }),

  reaproveita_badge_avaliacoes_em_dia_3x: (_criterio, ctx) => ({
    ok: badgesTecnicosElegiveis(ctx.avaliacoesConfirmadas).includes('avaliacoes_em_dia_3x'), progressoAtual: null, progressoAlvo: null,
  }),

  saltos_nivel_pc_score_em_uma_avaliacao: (criterio, ctx) => {
    const avals = ctx.avaliacoesConfirmadas
    if (avals.length < 2) return { ok: false, progressoAtual: null, progressoAlvo: null }
    const ultima = avals[avals.length - 1]
    const anterior = avals[avals.length - 2]
    if (ultima.pc_score == null || anterior.pc_score == null) return { ok: false, progressoAtual: null, progressoAlvo: null }
    const nivelAtual = nivelPorPcScore(ultima.pc_score)
    const nivelAnterior = nivelPorPcScore(anterior.pc_score)
    if (!nivelAtual || !nivelAnterior) return { ok: false, progressoAtual: null, progressoAlvo: null }
    const idxAtual = NIVEIS_PC_SCORE.findIndex(n => n.chave === nivelAtual.chave)
    const idxAnterior = NIVEIS_PC_SCORE.findIndex(n => n.chave === nivelAnterior.chave)
    return { ok: (idxAtual - idxAnterior) >= criterio.saltos, progressoAtual: null, progressoAlvo: null }
  },

  todas_dimensoes_melhoraram_vs_anterior: (_criterio, ctx) => {
    const avals = ctx.avaliacoesConfirmadas
    if (avals.length < 2) return { ok: false, progressoAtual: null, progressoAlvo: null }
    const ultima = avals[avals.length - 1].dimensoes || {}
    const anterior = avals[avals.length - 2].dimensoes || {}
    const chaves = Object.keys(anterior)
    if (!chaves.length) return { ok: false, progressoAtual: null, progressoAlvo: null }
    const todasMelhoraram = chaves.every(k => ultima[k] != null && ultima[k] > anterior[k])
    return { ok: todasMelhoraram, progressoAtual: null, progressoAlvo: null }
  },

  dimensao_com_nota_maxima: (criterio, ctx) => {
    const avals = ctx.avaliacoesConfirmadas
    if (!avals.length) return { ok: false, progressoAtual: null, progressoAlvo: null }
    const ultima = avals[avals.length - 1].dimensoes || {}
    return { ok: Object.values(ultima).some(nota => nota === criterio.nota), progressoAtual: null, progressoAlvo: null }
  },

  campos_cadastro_preenchidos: (criterio, ctx) => {
    const preenchidos = criterio.campos.filter(campo => !!ctx.aluno[campo]).length
    return { ok: preenchidos === criterio.campos.length, progressoAtual: preenchidos, progressoAlvo: criterio.campos.length }
  },
}

// Critérios sem avaliador automático (ver observação de cada um no catálogo) — o
// orquestrador simplesmente pula essas conquistas, nunca tenta desbloquear nem travar.
const REGRAS_SEM_AVALIACAO_AUTOMATICA = new Set(['aguardando_modulo_torneios', 'MANUAL_sem_campo_no_cadastro', 'desbloqueado_junto_com'])

// Avalia uma conquista do tipo 'marco' ou 'dinamico' contra o contexto. Conquistas do tipo
// 'historico' nunca são avaliadas diretamente aqui — elas só desbloqueiam como efeito
// colateral do par 'dinamico' correspondente (ver useConquistas.js).
export function avaliarConquista(conquista, contexto) {
  const regra = conquista.criterio?.regra
  if (!regra || REGRAS_SEM_AVALIACAO_AUTOMATICA.has(regra) || conquista.tipo === 'historico') return null
  const avaliador = AVALIADORES[regra]
  if (!avaliador) return null
  return avaliador(conquista.criterio, contexto)
}
