import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { calcularPontosResultado } from '../lib/pontuacaoBeyond'
import { recalcularPosicoesRanking } from './useRankingPosicoes'
import { cicloAtual } from '../constants/rankingCategorias'
import { verificarEAtualizarConquistas } from './useConquistas'

const HORAS_AUTO_APROVACAO = 48

function prazoAutoAprovacao() {
  return new Date(Date.now() + HORAS_AUTO_APROVACAO * 60 * 60 * 1000).toISOString()
}

// Cria o jogo (agendamento, sem placar ainda) + os participantes dos dois lados — simples é
// 1 aluno por lado, dupla é 2. Quem cria hoje é sempre alguém da equipe (não existe login de
// aluno ainda) — criado_por referencia auth.users(id) direto, mesmo padrão de alertas/
// mensagens, pronto pro dia em que o próprio aluno puder criar o jogo dele sem mudar schema.
export function useCriarJogo() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ modalidadeId, tipo, dataJogo, quadraId, participantesLado1, participantesLado2, origem, torneioId }) => {
      const tamanhoEsperado = tipo === 'dupla' ? 2 : 1
      if (participantesLado1?.length !== tamanhoEsperado || participantesLado2?.length !== tamanhoEsperado) {
        throw new Error(tipo === 'dupla' ? 'Dupla precisa de 2 alunos em cada lado.' : 'Simples precisa de 1 aluno em cada lado.')
      }

      const { data: jogo, error } = await supabase.from('ranking_jogos').insert({
        modalidade_id: modalidadeId,
        tipo,
        origem: origem || 'avulso',
        torneio_id: torneioId || null,
        data_jogo: dataJogo,
        quadra_id: quadraId || null,
        criado_por: user?.id || null,
      }).select().single()
      if (error) throw error

      const participantes = [
        ...participantesLado1.map(alunoId => ({ jogo_id: jogo.id, aluno_id: alunoId, lado: 1 })),
        ...participantesLado2.map(alunoId => ({ jogo_id: jogo.id, aluno_id: alunoId, lado: 2 })),
      ]
      const { error: erroParticipantes } = await supabase.from('ranking_jogo_participantes').insert(participantes)
      if (erroParticipantes) throw erroParticipantes

      return jogo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_jogos_em_aberto'] }),
  })
}

// Classificação de um ranking (Geral ou Categoria) já ordenada por posição — só entram
// alunos classificados (posicao preenchida, ou seja, com o mínimo de 5 jogos na janela, ver
// pontuacaoBeyond.js). Recalcula sozinha antes de ler (auto-aprovação de prazo vencido +
// posições), mesmo padrão "de graça" das outras telas do app — nunca deixa a tabela
// desatualizada só porque ninguém abriu o ranking há uns dias.
export function useClassificacaoRanking({ modalidadeId, tipoRanking, categoriaId, genero, ciclo }) {
  return useQuery({
    queryKey: ['ranking_classificacao', modalidadeId, tipoRanking, categoriaId, genero, ciclo],
    enabled: !!modalidadeId && !!tipoRanking && !!genero && !!ciclo,
    queryFn: async () => {
      await aprovarJogosVencendoPrazo()
      await recalcularPosicoesRanking({ modalidadeId })

      let q = supabase
        .from('ranking_posicoes')
        .select('*, alunos(nome, foto_url)')
        .eq('modalidade_id', modalidadeId)
        .eq('tipo_ranking', tipoRanking)
        .eq('genero', genero)
        .eq('ciclo', ciclo)
        .not('posicao', 'is', null)
        .order('posicao')
      q = categoriaId ? q.eq('categoria_id', categoriaId) : q.is('categoria_id', null)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })
}

// Jogos que ainda precisam de alguma ação: sem placar lançado, aguardando confirmação, ou
// contestado — é daqui que a tela de Ranking monta a seção "Jogos em aberto".
export function useJogosEmAberto({ modalidadeId }) {
  return useQuery({
    queryKey: ['ranking_jogos_em_aberto', modalidadeId],
    enabled: !!modalidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ranking_jogos')
        .select('*, ranking_jogo_participantes(id, aluno_id, lado, resultado, confirmado_em, alunos(nome))')
        .eq('modalidade_id', modalidadeId)
        .in('status', ['pendente', 'contestado'])
        .order('data_jogo', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

// Posição do aluno no ciclo vigente (Geral + Categoria) pro bloco "Pontuação Beyond" do Card
// do Aluno. Recalcula antes de ler (mesmo motivo de useClassificacaoRanking: card é aberto
// bem mais que a Aba Ranking, então não dá pra confiar só em quem visitou a aba recentemente
// pra manter os números frescos) — mesmo padrão "de graça" de verificarEConcederBadges, que já
// roda a cada abertura de useAlunoCompleto.
export function usePosicaoAluno(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['ranking_posicao_aluno', alunoId, modalidadeId],
    enabled: !!alunoId && !!modalidadeId,
    queryFn: async () => {
      const { data: aluno } = await supabase.from('alunos').select('genero').eq('id', alunoId).single()
      if (!aluno?.genero) return { semGenero: true, geral: null, categoria: null }

      await aprovarJogosVencendoPrazo()
      await recalcularPosicoesRanking({ modalidadeId })

      const ciclo = cicloAtual()
      const { data: linhas } = await supabase
        .from('ranking_posicoes')
        .select('*, ranking_categorias(nome)')
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .eq('ciclo', ciclo)

      return {
        semGenero: false,
        genero: aluno.genero,
        geral: (linhas || []).find(l => l.tipo_ranking === 'geral') || null,
        categoria: (linhas || []).find(l => l.tipo_ranking === 'categoria') || null,
      }
    },
  })
}

// Histórico de confrontos (H2H) — jogos aprovados do aluno na modalidade, mais recente
// primeiro, com o(s) nome(s) do(s) adversário(s) de cada jogo. Ordenação é feita no cliente
// porque o PostgREST não ordena de forma confiável por coluna de uma relação many-to-one
// (mesmo caso já documentado em useHistoricoPresencaModalidade, useAlunos.js).
export function useHistoricoConfrontos(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['ranking_h2h', alunoId, modalidadeId],
    enabled: !!alunoId && !!modalidadeId,
    queryFn: async () => {
      const { data: participacoes } = await supabase
        .from('ranking_jogo_participantes')
        .select('resultado, pontos_calculados, ranking_jogos!inner(id, data_jogo, modalidade_id, status, placar)')
        .eq('aluno_id', alunoId)
        .eq('ranking_jogos.modalidade_id', modalidadeId)
        .eq('ranking_jogos.status', 'aprovado')
      if (!participacoes?.length) return []

      const jogoIds = participacoes.map(p => p.ranking_jogos.id)
      const { data: todosParticipantes } = await supabase
        .from('ranking_jogo_participantes')
        .select('jogo_id, aluno_id, alunos(nome)')
        .in('jogo_id', jogoIds)
        .neq('aluno_id', alunoId)

      const adversariosPorJogo = {}
      ;(todosParticipantes || []).forEach(p => {
        (adversariosPorJogo[p.jogo_id] ||= []).push(p.alunos?.nome)
      })

      return participacoes
        .map(p => ({
          jogoId: p.ranking_jogos.id,
          data: p.ranking_jogos.data_jogo,
          placar: p.ranking_jogos.placar,
          resultado: p.resultado,
          pontos: p.pontos_calculados,
          adversarios: (adversariosPorJogo[p.ranking_jogos.id] || []).filter(Boolean).join(' / ') || 'Adversário',
        }))
        .sort((a, b) => b.data.localeCompare(a.data))
    },
  })
}

// Lança o placar depois da partida — qualquer participante (hoje, na prática, a equipe em
// nome dele) pode fazer isso. Resolve o resultado ('vitoria'/'derrota'/'wo_vitoria'/
// 'wo_derrota') por participante a partir do lado vencedor, calcula os pontos já usando a
// mesma tabela de src/lib/pontuacaoBeyond.js (busca a origem do jogo no banco, nunca confia
// no que o cliente mandou) e abre a janela de 48h pra aprovação/contestação.
export function useLancarPlacar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ jogoId, placar, ladoVencedor, wo = false }) => {
      const { data: jogo, error: erroJogo } = await supabase
        .from('ranking_jogos').select('id, origem').eq('id', jogoId).single()
      if (erroJogo) throw erroJogo

      const { data: participantes, error: erroParticipantes } = await supabase
        .from('ranking_jogo_participantes').select('id, lado').eq('jogo_id', jogoId)
      if (erroParticipantes) throw erroParticipantes
      if (!participantes?.length) throw new Error('Jogo sem participantes cadastrados.')

      for (const p of participantes) {
        const venceu = p.lado === ladoVencedor
        const resultado = wo ? (venceu ? 'wo_vitoria' : 'wo_derrota') : (venceu ? 'vitoria' : 'derrota')
        const pontos = calcularPontosResultado({ resultado, origem: jogo.origem })
        const { error } = await supabase
          .from('ranking_jogo_participantes')
          .update({ resultado, pontos_calculados: pontos, confirmado_em: null, confirmado_por: null })
          .eq('id', p.id)
        if (error) throw error
      }

      const { error: erroUpdateJogo } = await supabase
        .from('ranking_jogos')
        .update({ placar, status: 'pendente', data_limite_auto_aprovacao: prazoAutoAprovacao() })
        .eq('id', jogoId)
      if (erroUpdateJogo) throw erroUpdateJogo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_jogos_em_aberto'] }),
  })
}

// Confirmação do placar — basta UM participante confirmar (de qualquer lado) pra aprovar o
// jogo de vez; se ninguém confirmar nem contestar, aprovarJogosVencendoPrazo() cuida disso
// sozinho depois de 48h. Marca a confirmação em quem confirmou (rastreável, útil já hoje
// pra saber qual membro da equipe confirmou em nome de quem) e sobe o jogo pra 'aprovado'.
export function useConfirmarPlacar() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ participanteId, jogoId }) => {
      const { error: erroConfirma } = await supabase
        .from('ranking_jogo_participantes')
        .update({ confirmado_em: new Date().toISOString(), confirmado_por: user?.id || null })
        .eq('id', participanteId)
      if (erroConfirma) throw erroConfirma

      const { error: erroAprova } = await supabase
        .from('ranking_jogos').update({ status: 'aprovado' }).eq('id', jogoId).eq('status', 'pendente')
      if (erroAprova) throw erroAprova

      // Conquistas de jogo (primeira vitória, torneio, zebra, rei da quadra...) só contam
      // com o jogo já aprovado — verifica pros dois lados agora, sem esperar o próximo
      // recálculo preguiçoso de quando o Card do Aluno for aberto de novo.
      const { data: participantesDoJogo } = await supabase
        .from('ranking_jogo_participantes').select('aluno_id').eq('jogo_id', jogoId)
      for (const p of participantesDoJogo || []) {
        await verificarEAtualizarConquistas(p.aluno_id)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ranking_jogos_em_aberto'] })
      qc.invalidateQueries({ queryKey: ['ranking_classificacao'] })
    },
  })
}

// Contesta o placar lançado — trava em 'contestado' até a equipe resolver manualmente
// (lançar o placar de novo com useLancarPlacar reabre uma janela nova de 48h a partir daí).
export function useContestarPlacar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ jogoId }) => {
      const { error } = await supabase.from('ranking_jogos').update({ status: 'contestado' }).eq('id', jogoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_jogos_em_aberto'] }),
  })
}

// Jogo cancelado/não realizado vale 0 pontos e nunca entra na média (só jogos 'aprovado'
// contam, ver item 4) — zera pontos_calculados só por clareza no histórico do jogador.
export function useCancelarJogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ jogoId }) => {
      const { error } = await supabase.from('ranking_jogos').update({ status: 'cancelado' }).eq('id', jogoId)
      if (error) throw error
      await supabase.from('ranking_jogo_participantes').update({ resultado: null, pontos_calculados: 0 }).eq('jogo_id', jogoId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_jogos_em_aberto'] }),
  })
}

// Auto-aprovação por prazo vencido — sem cron, mesmo padrão "de graça" já usado em
// confirmarAulasElegiveis/expirarReposicoesPendentesVencidas (useAulas.js): chamado no início
// de qualquer query que liste jogos/ranking, nunca trava a tela se falhar.
export async function aprovarJogosVencendoPrazo() {
  try {
    await supabase
      .from('ranking_jogos')
      .update({ status: 'aprovado' })
      .eq('status', 'pendente')
      .not('placar', 'is', null)
      .lt('data_limite_auto_aprovacao', new Date().toISOString())
  } catch {
    // não trava nenhuma tela por causa disso
  }
}
