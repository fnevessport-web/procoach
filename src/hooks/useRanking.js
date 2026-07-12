import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { calcularPontosResultado } from '../lib/pontuacaoBeyond'

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_jogos'] }),
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
    onSuccess: (_, { jogoId }) => {
      qc.invalidateQueries({ queryKey: ['ranking_jogos'] })
      qc.invalidateQueries({ queryKey: ['ranking_jogo', jogoId] })
    },
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
    },
    onSuccess: (_, { jogoId }) => {
      qc.invalidateQueries({ queryKey: ['ranking_jogos'] })
      qc.invalidateQueries({ queryKey: ['ranking_jogo', jogoId] })
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
    onSuccess: (_, { jogoId }) => {
      qc.invalidateQueries({ queryKey: ['ranking_jogos'] })
      qc.invalidateQueries({ queryKey: ['ranking_jogo', jogoId] })
    },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_jogos'] }),
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
