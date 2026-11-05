import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'

// Recados da equipe para os professores (tabela `recados`, script
// scripts/2026-11-05_recados_professores.sql). Um envio para N professores = N linhas com o
// mesmo grupo_id (cada professor tem o próprio "lido").

const hojeStr = () => format(new Date(), 'yyyy-MM-dd')

// Fica no painel enquanto não foi lido OU enquanto a aula marcada ainda não passou.
export function recadoNoPainel(r, hoje = hojeStr()) {
  return !r.lido_em || (!!r.valido_ate && r.valido_ate >= hoje)
}

export function useRecadosDoProfessor(professorId) {
  return useQuery({
    queryKey: ['recados_prof', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase.from('recados').select('*')
        .eq('professor_id', professorId).order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
    refetchInterval: 60000,
  })
}

// Enviados: o autor vê os dele; gestão vê todos. Agrupa por grupo_id (um envio).
export function useRecadosEnviados({ todos = false } = {}) {
  const { user } = useAppStore()
  return useQuery({
    queryKey: ['recados_enviados', user?.id, todos],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from('recados')
        .select('*, professores(id, nome, apelido, foto_url)')
        .order('criado_em', { ascending: false }).limit(300)
      if (!todos) q = q.eq('autor_id', user.id)
      const { data, error } = await q
      if (error) throw error
      const grupos = {}
      ;(data || []).forEach(r => {
        const g = grupos[r.grupo_id] || (grupos[r.grupo_id] = { ...r, destinatarios: [] })
        g.destinatarios.push({ id: r.id, professor: r.professores, lido_em: r.lido_em })
      })
      return Object.values(grupos).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    },
  })
}

export function useEnviarRecado() {
  const qc = useQueryClient()
  const { user, perfil } = useAppStore()
  return useMutation({
    mutationFn: async ({ professorIds, texto, aulas = [] }) => {
      if (!professorIds?.length) throw new Error('Escolha pelo menos um professor')
      if (!texto?.trim()) throw new Error('Escreva o recado')
      const grupo_id = crypto.randomUUID()
      const datas = aulas.map(a => a.data_aula).filter(Boolean).sort()
      const linhas = professorIds.map(professor_id => ({
        grupo_id, professor_id, autor_id: user.id, autor_nome: perfil?.nome || user.email,
        tipo: aulas.length ? 'turma' : 'avulso', texto: texto.trim(),
        aula_ids: aulas.map(a => a.id), valido_ate: datas.length ? datas[datas.length - 1] : null,
      }))
      const { error } = await supabase.from('recados').insert(linhas)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recados_enviados'] })
      qc.invalidateQueries({ queryKey: ['recados_prof'] })
    },
  })
}

export function useMarcarRecado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, lido }) => {
      const { error } = await supabase.from('recados').update({ lido_em: lido ? new Date().toISOString() : null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recados_prof'] })
      qc.invalidateQueries({ queryKey: ['recados_enviados'] })
    },
  })
}

export function useApagarRecado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (grupoId) => {
      const { error } = await supabase.from('recados').delete().eq('grupo_id', grupoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recados_enviados'] })
      qc.invalidateQueries({ queryKey: ['recados_prof'] })
    },
  })
}

const CAMPOS_AULA_GRADE = `
  id, data_aula, turma_id, observacoes, status_aula, professor_executou_id,
  turmas(nome, horario_inicio, professor_titular_id, quadras(nome), niveis(nome), modalidades(nome)),
  professores!professor_executou_id(id, nome, apelido),
  presencas(id)
`

// Aulas de um dia (grade com os quadradinhos do recado).
export function useAulasDoDiaParaRecado(data) {
  return useQuery({
    queryKey: ['recado_grade_dia', data],
    enabled: !!data,
    queryFn: async () => {
      const { data: aulas, error } = await supabase.from('aulas').select(CAMPOS_AULA_GRADE)
        .eq('data_aula', data).is('empresa_id', null).not('turma_id', 'is', null)
      if (error) throw error
      return aulas || []
    },
    staleTime: 30000,
  })
}

// Aulas marcadas num recado (pelo id).
export function useAulasDoRecado(ids) {
  const chave = (ids || []).slice().sort().join(',')
  return useQuery({
    queryKey: ['recado_aulas', chave],
    enabled: !!chave,
    queryFn: async () => {
      const { data, error } = await supabase.from('aulas').select(CAMPOS_AULA_GRADE).in('id', ids)
      if (error) throw error
      return (data || []).sort((a, b) => (a.data_aula + (a.turmas?.horario_inicio || '')).localeCompare(b.data_aula + (b.turmas?.horario_inicio || '')))
    },
  })
}
