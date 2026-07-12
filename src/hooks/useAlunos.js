import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { format, subMonths } from 'date-fns'
import { getModalidadeDaAula } from '../constants/modalidades'
import { nivelPorPcScore, FAIXAS_ETARIAS } from '../lib/pcScore'
import { badgesTecnicosElegiveis } from '../constants/badges'

export function useAlunos(modalidadeId = null) {
  return useQuery({
    queryKey: ['alunos', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('alunos')
        .select('*, modalidades(nome, icone_emoji, cor_hex)')
        .eq('ativo', true)
        .order('nome')

      if (modalidadeId) q = q.eq('modalidade_id', modalidadeId)

      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useSalvarAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }) => {
      if (id) {
        const { data: anterior } = await supabase.from('alunos').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('alunos').update(dados).eq('id', id).select().single()
        if (error) throw error
        await logAudit('alunos', id, 'UPDATE', anterior, data)
        return data
      } else {
        const { data, error } = await supabase.from('alunos').insert(dados).select().single()
        if (error) throw error
        await logAudit('alunos', data.id, 'INSERT', null, data)
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alunos'] })
  })
}

export function useExcluirAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('alunos').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alunos'] })
  })
}

// Badges (Fase 3): confere as condições de cada selo e concede os que faltam. Chamado a
// cada carregamento do card do aluno — sem cron, "de graça" (mesmo padrão de
// confirmarAulasElegiveis/expirarReposicoesPendentesVencidas em useAulas.js). Idempotente
// via unique(aluno_id, tipo_badge) + upsert ignorando duplicata.
export async function verificarEConcederBadges(alunoId) {
  try {
    const { data: jaConcedidos } = await supabase
      .from('badges_aluno').select('tipo_badge').eq('aluno_id', alunoId)
    const concedidos = new Set((jaConcedidos || []).map(b => b.tipo_badge))
    const novos = []

    // primeira_aula / 10_aulas — presenças confirmadas em qualquer modalidade
    if (!concedidos.has('primeira_aula') || !concedidos.has('10_aulas')) {
      const { data: presencas } = await supabase
        .from('presencas').select('presente, status_presenca').eq('aluno_id', alunoId)
      const confirmadas = (presencas || []).filter(p => p.status_presenca === 'presente' || p.presente).length
      if (confirmadas >= 1 && !concedidos.has('primeira_aula')) novos.push('primeira_aula')
      if (confirmadas >= 10 && !concedidos.has('10_aulas')) novos.push('10_aulas')
    }

    // 3_meses_sem_falta — nenhuma falta (não justificada) nos últimos 90 dias
    if (!concedidos.has('3_meses_sem_falta')) {
      const tresMesesAtras = format(subMonths(new Date(), 3), 'yyyy-MM-dd')
      const { data: faltas } = await supabase
        .from('presencas')
        .select('id, aulas!inner(data_aula)')
        .eq('aluno_id', alunoId)
        .eq('status_presenca', 'falta')
        .gte('aulas.data_aula', tresMesesAtras)
      if (!faltas?.length) novos.push('3_meses_sem_falta')
    }

    // evoluiu_nivel é concedido diretamente por useAtualizarNivelModalidade (no momento da
    // troca), não recalculado aqui.

    if (novos.length > 0) {
      await supabase.from('badges_aluno').upsert(
        novos.map(tipo => ({ aluno_id: alunoId, tipo_badge: tipo })),
        { onConflict: 'aluno_id,tipo_badge', ignoreDuplicates: true }
      )
    }
  } catch {
    // não trava o card por causa disso
  }
}

// Aluno + vínculos familiares + modalidades matriculadas (com o nível ativo de cada
// uma, se já houver histórico registrado em aluno_modalidade_nivel) + badges conquistados.
export function useAlunoCompleto(alunoId) {
  return useQuery({
    queryKey: ['aluno_completo', alunoId],
    queryFn: async () => {
      await verificarEConcederBadges(alunoId)

      const [{ data: aluno, error: erroAluno }, { data: familia }, { data: modsAluno }, { data: niveisAtivos }, { data: badges }, { data: presencasAluno }] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', alunoId).single(),
        supabase.from('aluno_familia').select('*, vinculo:alunos!vinculo_aluno_id(id, nome)').eq('aluno_id', alunoId).order('created_at'),
        supabase.from('alunos_modalidades').select('created_at, modalidade_id, modalidades(id, nome, icone_emoji, cor_hex)').eq('aluno_id', alunoId),
        supabase.from('aluno_modalidade_nivel').select('*').eq('aluno_id', alunoId).eq('ativo', true),
        supabase.from('badges_aluno').select('*').eq('aluno_id', alunoId),
        // Só pra achar a data real de entrada em cada modalidade (primeira aula que o aluno
        // de fato teve) — alunos_modalidades.created_at não serve pra isso porque a linha pode
        // ter sido criada bem depois (ex.: backfill), sem relação com quando o aluno começou.
        supabase.from('presencas').select('aula_id, aulas(data_aula, turma_id, observacoes, turmas(modalidade_id))').eq('aluno_id', alunoId),
      ])
      if (erroAluno) throw erroAluno

      const nivelPorModalidade = {}
      niveisAtivos?.forEach(n => { nivelPorModalidade[n.modalidade_id] = n })

      // Enquanto o histórico por modalidade (aluno_modalidade_nivel) ainda não tem
      // registro pra essa modalidade, cai no nível genérico do aluno como estimativa —
      // impreciso pra quem joga mais de uma modalidade, mas evita o card nascer vazio
      // pra todo mundo só porque a tabela nova começa zerada.
      const nivelGenerico = aluno.nivel_avaliado_prof || aluno.nivel || null

      // Nome → id das modalidades do próprio aluno, pra resolver a modalidade de aulas avulsas
      // (que não têm turma_id, só a quadra na observação) sem precisar buscar todas as
      // modalidades do clube.
      const nomeParaModalidadeId = {}
      modsAluno?.forEach(m => { if (m.modalidades?.nome) nomeParaModalidadeId[m.modalidades.nome] = m.modalidade_id })

      const primeiraAulaPorModalidade = {}
      presencasAluno?.forEach(p => {
        if (!p.aulas?.data_aula) return
        const modId = p.aulas.turma_id
          ? p.aulas.turmas?.modalidade_id
          : nomeParaModalidadeId[getModalidadeDaAula(p.aulas)]
        if (!modId) return
        if (!primeiraAulaPorModalidade[modId] || p.aulas.data_aula < primeiraAulaPorModalidade[modId]) {
          primeiraAulaPorModalidade[modId] = p.aulas.data_aula
        }
      })

      const modalidadesDetalhe = (modsAluno || []).map(m => {
        const registroAtivo = nivelPorModalidade[m.modalidade_id]
        return {
          ...m.modalidades,
          dataEntrada: primeiraAulaPorModalidade[m.modalidade_id] || m.created_at,
          nivelAtual: registroAtivo?.nivel || nivelGenerico,
          nivelRegistrado: !!registroAtivo,
        }
      })

      return { ...aluno, familia: familia || [], modalidadesDetalhe, badges: badges || [] }
    },
    enabled: !!alunoId,
  })
}

// Histórico completo (todos os registros, não só o ativo) de nível numa modalidade —
// usado no modal de detalhe da modalidade, mais recente primeiro.
export function useHistoricoNivel(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['historico_nivel', alunoId, modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aluno_modalidade_nivel')
        .select('*')
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .order('data_inicio', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId && !!modalidadeId,
  })
}

export function useFamiliaAluno(alunoId) {
  return useQuery({
    queryKey: ['aluno_familia', alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aluno_familia')
        .select('*, vinculo:alunos!vinculo_aluno_id(id, nome)')
        .eq('aluno_id', alunoId)
        .order('created_at')
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId,
  })
}

export function useSalvarVinculoFamilia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, vinculoAlunoId, nomeVinculo, tipoVinculo }) => {
      const { error } = await supabase.from('aluno_familia').insert({
        aluno_id: alunoId,
        vinculo_aluno_id: vinculoAlunoId || null,
        nome_vinculo: nomeVinculo,
        tipo_vinculo: tipoVinculo,
      })
      if (error) throw error
    },
    onSuccess: (_, { alunoId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_familia', alunoId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

export function useExcluirVinculoFamilia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, alunoId }) => {
      const { error } = await supabase.from('aluno_familia').delete().eq('id', id)
      if (error) throw error
      return { alunoId }
    },
    onSuccess: ({ alunoId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_familia', alunoId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Dimensões técnicas cadastradas pra uma modalidade (Fase 3) — define o formulário
// dinâmico de avaliação e os eixos do gráfico radar.
export function useDimensoesModalidade(modalidadeId) {
  return useQuery({
    queryKey: ['modalidade_dimensoes', modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalidade_dimensoes')
        .select('*')
        .eq('modalidade_id', modalidadeId)
        .order('ordem')
      if (error) throw error
      return data || []
    },
    enabled: !!modalidadeId,
  })
}

// Todas as avaliações técnicas do aluno numa modalidade, mais antiga primeiro (pronto pro
// gráfico de evolução — a última posição do array é a mais recente).
export function useAvaliacoesModalidade(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['avaliacoes_modalidade', alunoId, modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_tecnicas')
        .select('*, professores(nome)')
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .order('data_avaliacao', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId && !!modalidadeId,
  })
}

// Dispara a narrativa da Edge Function em segundo plano — nunca trava o salvamento da
// avaliação por causa disso (1-2s de latência da Anthropic não deveria bloquear o
// professor seguindo pro próximo aluno). A própria function já cai num texto de
// fallback e grava sozinha em avaliacoes_tecnicas.narrativa_ia se algo falhar.
function dispararNarrativaIA({ avaliacaoId, alunoNome, modalidadeNome, faixaEtaria, dimensoes, pcScore, historico }) {
  const faixaLabel = FAIXAS_ETARIAS.find(f => f.chave === faixaEtaria)?.label || faixaEtaria
  const nivelLabel = nivelPorPcScore(pcScore)?.label || ''
  supabase.functions.invoke('narrativa-tecnica', {
    body: {
      avaliacaoId, alunoNome, modalidadeNome,
      faixaEtariaLabel: faixaLabel, dimensoes, pcScoreAtual: pcScore,
      nivelAtualLabel: nivelLabel, historico,
    },
  }).catch(() => {
    // Sem internet / function fora do ar — a avaliação já foi salva com as notas certas,
    // só a análise em texto que fica sem gerar dessa vez.
  })
}

// Concede badges técnicos elegíveis a partir do histórico atualizado (pós-insert) — usa a
// mesma regra pura de src/constants/badges.js, então ajustar uma regra lá já vale aqui
// sem precisar tocar neste arquivo.
async function concederBadgesTecnicos(alunoId, modalidadeId) {
  const { data: avaliacoes } = await supabase
    .from('avaliacoes_tecnicas')
    .select('data_avaliacao, pc_score, dimensoes')
    .eq('aluno_id', alunoId)
    .eq('modalidade_id', modalidadeId)
    .order('data_avaliacao', { ascending: true })
  const elegiveis = badgesTecnicosElegiveis(avaliacoes || [])
  if (elegiveis.length === 0) return
  await supabase.from('badges_aluno').upsert(
    elegiveis.map(tipo_badge => ({ aluno_id: alunoId, tipo_badge })),
    { onConflict: 'aluno_id,tipo_badge', ignoreDuplicates: true }
  )
}

export function useSalvarAvaliacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      alunoId, modalidadeId, professorId, alunoNome, modalidadeNome,
      dimensoes, notaGeral, notaGeralManual, comentario,
      dataAvaliacao, pcScore, faixaEtaria, historicoPcScore,
    }) => {
      const { data: nova, error } = await supabase.from('avaliacoes_tecnicas').insert({
        aluno_id: alunoId,
        modalidade_id: modalidadeId,
        professor_id: professorId,
        data_avaliacao: dataAvaliacao,
        dimensoes,
        nota_geral: notaGeral,
        nota_geral_manual: notaGeralManual,
        comentario: comentario || null,
        pc_score: pcScore ?? null,
        faixa_etaria: faixaEtaria ?? null,
      }).select().single()
      if (error) throw error

      if (pcScore != null) {
        dispararNarrativaIA({
          avaliacaoId: nova.id, alunoNome, modalidadeNome, faixaEtaria, dimensoes, pcScore,
          historico: historicoPcScore || [],
        })
        await concederBadgesTecnicos(alunoId, modalidadeId)
      }

      return nova
    },
    onSuccess: (_, { alunoId, modalidadeId }) => {
      qc.invalidateQueries({ queryKey: ['avaliacoes_modalidade', alunoId, modalidadeId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Faixa etária escolhida manualmente por professor/gestor (kids/infantil/adulto) — usada
// no cálculo do PC Score só enquanto o aluno não tem data_nascimento cadastrada (que, tendo,
// sempre tem prioridade — ver src/lib/pcScore.js). Propriedade do aluno, não da avaliação:
// escolhida uma vez, vale pra qualquer avaliação futura dele.
export function useAtualizarFaixaEtariaManual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, faixaEtariaManual }) => {
      const { error } = await supabase.from('alunos').update({ faixa_etaria_manual: faixaEtariaManual }).eq('id', alunoId)
      if (error) throw error
    },
    onSuccess: (_, { alunoId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Atualiza o nível do aluno numa modalidade (Fase 3, usado no formulário de avaliação) —
// nunca sobrescreve o registro anterior, sempre insere um novo e desativa o(s) antigo(s)
// (mesma regra de "histórico, nunca overwrite" definida na Fase 1). Concede o badge
// evoluiu_nivel diretamente aqui, no momento da troca.
export function useAtualizarNivelModalidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, modalidadeId, nivel }) => {
      await supabase
        .from('aluno_modalidade_nivel')
        .update({ ativo: false })
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .eq('ativo', true)

      const { error } = await supabase.from('aluno_modalidade_nivel').insert({
        aluno_id: alunoId,
        modalidade_id: modalidadeId,
        nivel,
        data_inicio: format(new Date(), 'yyyy-MM-dd'),
        ativo: true,
      })
      if (error) throw error

      await supabase.from('badges_aluno')
        .upsert({ aluno_id: alunoId, tipo_badge: 'evoluiu_nivel' }, { onConflict: 'aluno_id,tipo_badge', ignoreDuplicates: true })
    },
    onSuccess: (_, { alunoId, modalidadeId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
      qc.invalidateQueries({ queryKey: ['historico_nivel', alunoId, modalidadeId] })
    }
  })
}

// Histórico de presença do aluno numa modalidade específica (Fase 3) — turmas casam por
// modalidade_id direto; aulas avulsas usam a mesma inferência por quadra já usada em todo
// o resto do app (getModalidadeDaAula), já que não têm turma_id.
export function useHistoricoPresencaModalidade(alunoId, modalidadeId, modalidadeNome) {
  return useQuery({
    queryKey: ['historico_presenca_modalidade', alunoId, modalidadeId],
    queryFn: async () => {
      // PostgREST não ordena as linhas externas por uma coluna de relação many-to-one
      // (order com foreignTable só funciona pra listas aninhadas) — teve que ordenar no
      // cliente depois de buscar.
      const { data, error } = await supabase
        .from('presencas')
        .select(`
          id, status_presenca, presente, tipo_participacao,
          aulas(id, data_aula, turma_id, observacoes, turmas(modalidade_id, nome))
        `)
        .eq('aluno_id', alunoId)
      if (error) throw error
      const hoje = format(new Date(), 'yyyy-MM-dd')
      return (data || [])
        .filter(p => p.aulas)
        // Aulas futuras (turma recorrente já gerada pra semanas adiante) ainda não aconteceram —
        // a presença delas nasce com um valor "presente" só de placeholder, não é presença real.
        .filter(p => p.aulas.data_aula <= hoje)
        .filter(p => p.aulas.turma_id ? p.aulas.turmas?.modalidade_id === modalidadeId : getModalidadeDaAula(p.aulas) === modalidadeNome)
        .sort((a, b) => (b.aulas.data_aula || '').localeCompare(a.aulas.data_aula || ''))
        .slice(0, 100)
    },
    enabled: !!alunoId && !!modalidadeId,
  })
}
