import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

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

// Aluno + vínculos familiares + modalidades matriculadas (com o nível ativo de cada
// uma, se já houver histórico registrado em aluno_modalidade_nivel).
export function useAlunoCompleto(alunoId) {
  return useQuery({
    queryKey: ['aluno_completo', alunoId],
    queryFn: async () => {
      const [{ data: aluno, error: erroAluno }, { data: familia }, { data: modsAluno }, { data: niveisAtivos }] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', alunoId).single(),
        supabase.from('aluno_familia').select('*, vinculo:alunos!vinculo_aluno_id(id, nome)').eq('aluno_id', alunoId).order('created_at'),
        supabase.from('alunos_modalidades').select('created_at, modalidade_id, modalidades(id, nome, icone_emoji, cor_hex)').eq('aluno_id', alunoId),
        supabase.from('aluno_modalidade_nivel').select('*').eq('aluno_id', alunoId).eq('ativo', true),
      ])
      if (erroAluno) throw erroAluno

      const nivelPorModalidade = {}
      niveisAtivos?.forEach(n => { nivelPorModalidade[n.modalidade_id] = n })

      // Enquanto o histórico por modalidade (aluno_modalidade_nivel) ainda não tem
      // registro pra essa modalidade, cai no nível genérico do aluno como estimativa —
      // impreciso pra quem joga mais de uma modalidade, mas evita o card nascer vazio
      // pra todo mundo só porque a tabela nova começa zerada.
      const nivelGenerico = aluno.nivel_avaliado_prof || aluno.nivel || null

      const modalidadesDetalhe = (modsAluno || []).map(m => {
        const registroAtivo = nivelPorModalidade[m.modalidade_id]
        return {
          ...m.modalidades,
          dataEntrada: m.created_at,
          nivelAtual: registroAtivo?.nivel || nivelGenerico,
          nivelRegistrado: !!registroAtivo,
        }
      })

      return { ...aluno, familia: familia || [], modalidadesDetalhe }
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
