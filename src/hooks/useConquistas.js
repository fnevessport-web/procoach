import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { avaliarConquista } from '../lib/conquistas'
import { nomeCategoriaPorNivel, cicloAtual } from '../constants/rankingCategorias'

// Catálogo completo das 40 conquistas (id, nome, descricao, familia, tipo, icone, ordem...) —
// muda raramente, então fica com staleTime bem folgado. Usado tanto pelas mini-cards do Card
// do Aluno (item A.5) quanto pelo catálogo completo (A.6) e pelo modal de detalhe (A.7).
export function useCatalogoConquistas() {
  return useQuery({
    queryKey: ['conquistas_catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conquistas').select('*').eq('ativo', true).order('ordem')
      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 30,
  })
}

// Progresso do aluno em cada conquista (uma linha por conquista que já foi avaliada alguma
// vez — desbloqueada ou só com progresso registrado). Quem não tem linha nenhuma aqui ainda
// está "zerado" nessa conquista — a tela trata isso como bloqueada sem progresso.
export function useConquistasDoAluno(alunoId) {
  return useQuery({
    queryKey: ['conquistas_aluno', alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('conquistas_alunos').select('*').eq('aluno_id', alunoId)
      if (error) throw error
      return data || []
    },
  })
}

// Verifica e atualiza as conquistas de um aluno (item A.4) — busca tudo que os 38 critérios
// automáticos precisam (2 dos 40, campeao_torneio e indicou_amigo, não têm avaliador, ver
// conquistas.js), avalia cada um contra o catálogo e grava em conquistas_alunos. Nunca lança
// erro pra fora (mesmo padrão de verificarEConcederBadges/aprovarJogosVencendoPrazo) — uma
// falha aqui não pode travar a tela de quem chamou.
//
// Chamado nos momentos certos (A.4): depois de salvar avaliação técnica, depois de confirmar
// avaliação pendente, depois de aprovar/confirmar um jogo do ranking, e de forma preguiçosa
// sempre que o Card do Aluno é aberto (useAlunoCompleto) — mesmo esquema "de graça" já usado
// pros badges técnicos.
export async function verificarEAtualizarConquistas(alunoId) {
  try {
    const [{ data: catalogo }, { data: existentes }, contexto] = await Promise.all([
      supabase.from('conquistas').select('*').eq('ativo', true),
      supabase.from('conquistas_alunos').select('*').eq('aluno_id', alunoId),
      montarContexto(alunoId),
    ])
    if (!catalogo?.length || !contexto) return

    const porId = Object.fromEntries((existentes || []).map(e => [e.conquista_id, e]))
    const catalogoPorId = Object.fromEntries(catalogo.map(c => [c.id, c]))
    const agora = new Date().toISOString()
    const paraUpsert = []

    function linha(conquistaId, { ativa, desbloqueadaEm, progressoAtual = null, progressoAlvo = null }) {
      paraUpsert.push({
        aluno_id: alunoId,
        conquista_id: conquistaId,
        ativa,
        desbloqueada_em: desbloqueadaEm,
        progresso_atual: progressoAtual,
        progresso_alvo: progressoAlvo,
        atualizado_em: agora,
      })
    }

    for (const c of catalogo) {
      if (c.tipo === 'historico') continue // só desbloqueia via par dinâmico, abaixo
      const resultado = avaliarConquista(c, contexto)
      if (!resultado) continue // sem avaliador automático (campeao_torneio, indicou_amigo)

      const existente = porId[c.id]

      if (c.tipo === 'marco') {
        if (resultado.ok) {
          // Cobre 3 casos: nunca teve linha (desbloqueou direto), tinha só progresso parcial
          // registrado (ex: 15 de 30 aulas) e agora bateu o alvo, ou já estava desbloqueado
          // antes (não mexe — marco nunca perde nem precisa reescrever).
          if (!existente || !existente.ativa) {
            linha(c.id, { ativa: true, desbloqueadaEm: existente?.desbloqueada_em || agora, progressoAtual: resultado.progressoAtual, progressoAlvo: resultado.progressoAlvo })
          }
        } else if (resultado.progressoAlvo != null && (!existente || existente.progresso_atual !== resultado.progressoAtual)) {
          // ainda não desbloqueou, mas tem barra de progresso (ex: "47 de 100 aulas")
          linha(c.id, { ativa: false, desbloqueadaEm: null, progressoAtual: resultado.progressoAtual, progressoAlvo: resultado.progressoAlvo })
        }
      } else if (c.tipo === 'dinamico') {
        const eraAtiva = existente?.ativa ?? false
        if (resultado.ok !== eraAtiva) {
          linha(c.id, { ativa: resultado.ok, desbloqueadaEm: existente?.desbloqueada_em || (resultado.ok ? agora : null) })
        }
        // 1ª vez que esse dinâmico vale: desbloqueia o par histórico pra sempre também
        if (resultado.ok && !existente && c.historico_par && catalogoPorId[c.historico_par] && !porId[c.historico_par]) {
          linha(c.historico_par, { ativa: true, desbloqueadaEm: agora })
        }
      }
    }

    if (!paraUpsert.length) return
    await supabase.from('conquistas_alunos').upsert(paraUpsert, { onConflict: 'aluno_id,conquista_id' })
  } catch {
    // não trava nenhuma tela por causa disso
  }
}

async function montarContexto(alunoId) {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const mesAtualStr = format(new Date(), 'yyyy-MM')

  const { data: aluno } = await supabase
    .from('alunos').select('foto_url, data_nascimento, genero, telefone, ativo, nivel, nivel_avaliado_prof')
    .eq('id', alunoId).single()
  if (!aluno) return null

  const { data: modalidadeTenis } = await supabase.from('modalidades').select('id').eq('nome', 'Tênis').single()

  const [
    { data: presencasRaw },
    { data: avaliacoesConfirmadas },
    dadosRanking,
  ] = await Promise.all([
    supabase.from('presencas').select('status_presenca, presente, tipo_participacao, aulas(data_aula)').eq('aluno_id', alunoId),
    supabase.from('avaliacoes_tecnicas').select('data_avaliacao, pc_score, dimensoes').eq('aluno_id', alunoId).eq('status', 'confirmada').order('data_avaliacao', { ascending: true }),
    modalidadeTenis ? montarContextoRanking(alunoId, modalidadeTenis.id, aluno) : Promise.resolve(contextoRankingVazio()),
  ])

  const presencas = (presencasRaw || []).filter(p => p.aulas?.data_aula && p.aulas.data_aula <= hoje)
  const confirmadas = p => p.status_presenca === 'presente' || p.presente
  const presencasConfirmadas = presencas.filter(confirmadas).length
  const presencasReposicaoConfirmadas = presencas.filter(p => confirmadas(p) && p.tipo_participacao === 'reposicao').length

  const datas = presencas.map(p => p.aulas.data_aula).sort()
  const primeiraAulaData = datas.length ? datas[0] : null

  const datasFaltaNaoJustificada = presencas.filter(p => p.status_presenca === 'falta').map(p => p.aulas.data_aula).sort()
  const ultimaFaltaNaoJustificadaData = datasFaltaNaoJustificada.length ? datasFaltaNaoJustificada[datasFaltaNaoJustificada.length - 1] : null

  // "Mês perfeito": algum mês calendário já FECHADO (antes do mês atual) com pelo menos 1
  // aula e zero faltas de qualquer tipo (justificada ou não) — mais rígido que as conquistas
  // "sem faltar", que só olham pra falta não justificada.
  const presencasPorMes = {}
  presencas.forEach(p => {
    const mes = p.aulas.data_aula.slice(0, 7)
    if (mes >= mesAtualStr) return // só meses já fechados
    ;(presencasPorMes[mes] ||= []).push(p)
  })
  const teveMesPerfeitoAlgumaVez = Object.values(presencasPorMes).some(doMes =>
    doMes.length > 0 && doMes.every(p => p.status_presenca === 'presente' || (p.presente && p.status_presenca == null))
  )

  return {
    hoje,
    aluno,
    presencasConfirmadas,
    presencasReposicaoConfirmadas,
    primeiraAulaData,
    ultimaFaltaNaoJustificadaData,
    teveMesPerfeitoAlgumaVez,
    avaliacoesConfirmadas: avaliacoesConfirmadas || [],
    ...dadosRanking,
  }
}

function contextoRankingVazio() {
  return {
    jaTevePosicaoRanking: false,
    vitoriasRanking: 0,
    jogosTorneio: 0,
    venceuCategoriaSuperior: false,
    adversariosDistintos: 0,
    posicaoAtual: { geral: null, categoria: null },
    nivelAssiduidadeAtual: null,
  }
}

// Tudo que os critérios de Ranking & Competição / Assiduidade precisam — só existe de
// verdade em Tênis por enquanto (mesmo escopo do módulo Ranking).
async function montarContextoRanking(alunoId, modalidadeId, aluno) {
  const [
    { data: jaTeveLinha },
    { data: participacoes },
    { data: categorias },
    { data: nivelAtivo },
  ] = await Promise.all([
    supabase.from('ranking_posicoes').select('id').eq('aluno_id', alunoId).eq('modalidade_id', modalidadeId).not('posicao', 'is', null).limit(1),
    supabase.from('ranking_jogo_participantes').select('jogo_id, resultado, ranking_jogos!inner(id, modalidade_id, origem, status)').eq('aluno_id', alunoId).eq('ranking_jogos.modalidade_id', modalidadeId).eq('ranking_jogos.status', 'aprovado'),
    supabase.from('ranking_categorias').select('nome, ordem').eq('modalidade_id', modalidadeId),
    supabase.from('aluno_modalidade_nivel').select('nivel').eq('aluno_id', alunoId).eq('modalidade_id', modalidadeId).eq('ativo', true).maybeSingle(),
  ])

  const vitoriasRanking = (participacoes || []).filter(p => p.resultado === 'vitoria' || p.resultado === 'wo_vitoria').length
  const jogosTorneio = (participacoes || []).filter(p => p.ranking_jogos?.origem === 'torneio').length
  const jogoIds = (participacoes || []).map(p => p.jogo_id)

  let adversariosDistintos = 0
  if (jogoIds.length) {
    const { data: todosParticipantes } = await supabase
      .from('ranking_jogo_participantes').select('aluno_id').in('jogo_id', jogoIds).neq('aluno_id', alunoId)
    adversariosDistintos = new Set((todosParticipantes || []).map(p => p.aluno_id)).size
  }

  const ordemPorCategoria = Object.fromEntries((categorias || []).map(c => [c.nome, c.ordem]))
  const meuNivel = nivelAtivo?.nivel || aluno.nivel_avaliado_prof || aluno.nivel
  const minhaCategoriaOrdem = ordemPorCategoria[nomeCategoriaPorNivel(meuNivel, 'Tênis')] ?? null

  let venceuCategoriaSuperior = false
  const jogoIdsVencidos = (participacoes || []).filter(p => p.resultado === 'vitoria' || p.resultado === 'wo_vitoria').map(p => p.jogo_id)
  if (jogoIdsVencidos.length && minhaCategoriaOrdem != null) {
    const { data: oponentes } = await supabase
      .from('ranking_jogo_participantes')
      .select('aluno_id, alunos(nivel_avaliado_prof, nivel)')
      .in('jogo_id', jogoIdsVencidos)
      .neq('aluno_id', alunoId)
    venceuCategoriaSuperior = (oponentes || []).some(o => {
      const nivelOponente = o.alunos?.nivel_avaliado_prof || o.alunos?.nivel
      const ordemOponente = ordemPorCategoria[nomeCategoriaPorNivel(nivelOponente, 'Tênis')]
      return ordemOponente != null && ordemOponente > minhaCategoriaOrdem
    })
  }

  const ciclo = cicloAtual()
  const { data: posicoesAtuais } = await supabase
    .from('ranking_posicoes').select('tipo_ranking, posicao, nivel')
    .eq('aluno_id', alunoId).eq('modalidade_id', modalidadeId).eq('ciclo', ciclo)
  const posicaoGeral = (posicoesAtuais || []).find(p => p.tipo_ranking === 'geral')
  const posicaoCategoria = (posicoesAtuais || []).find(p => p.tipo_ranking === 'categoria')

  return {
    jaTevePosicaoRanking: !!jaTeveLinha?.length,
    vitoriasRanking,
    jogosTorneio,
    venceuCategoriaSuperior,
    adversariosDistintos,
    posicaoAtual: { geral: posicaoGeral?.posicao ?? null, categoria: posicaoCategoria?.posicao ?? null },
    nivelAssiduidadeAtual: posicaoGeral?.nivel ?? null,
  }
}
