import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { criarAlerta } from './useAlertas'

// Dispara os alertas de matrícula (turma ativada / aluno incluído / aluno removido)
// comparando quem estava ativo antes do save com quem fica ativo depois.
async function notificarMudancasDeMatricula({ turmaId, professorTitularId, nomeTurma, idsAntes, idsDepois }) {
  if (!professorTitularId) return
  const novos = idsDepois.filter(id => !idsAntes.includes(id))
  const removidos = idsAntes.filter(id => !idsDepois.includes(id))
  if (novos.length === 0 && removidos.length === 0) return

  const { data: perfilProfessor } = await supabase
    .from('perfis_usuario')
    .select('user_id')
    .eq('professor_id', professorTitularId)
    .maybeSingle()
  if (!perfilProfessor?.user_id) return
  const usuarioId = perfilProfessor.user_id

  if (idsAntes.length === 0 && novos.length > 0) {
    await criarAlerta({
      usuarioId, tipo: 'turma_ativada', referenciaId: turmaId, prioridade: 'alta',
      mensagem: `Você tem uma nova turma ativada: ${nomeTurma || 'turma'}.`,
    })
    return
  }

  if (novos.length > 0) {
    const { data: alunosNovos } = await supabase.from('alunos').select('id, nome').in('id', novos)
    for (const a of alunosNovos || []) {
      await criarAlerta({
        usuarioId, tipo: 'aluno_incluido', referenciaId: turmaId, prioridade: 'media',
        mensagem: `${a.nome} foi incluído na sua turma de ${nomeTurma || 'turma'}.`,
      })
    }
  }

  if (removidos.length > 0) {
    const { data: alunosRemovidos } = await supabase.from('alunos').select('id, nome').in('id', removidos)
    for (const a of alunosRemovidos || []) {
      await criarAlerta({
        usuarioId, tipo: 'aluno_removido', referenciaId: turmaId, prioridade: 'baixa',
        mensagem: `${a.nome} saiu da turma de ${nomeTurma || 'turma'}.`,
      })
    }
  }
}

// empresaId: escopo do tenant (null = turmas do clube, comportamento de hoje — todo chamador
// existente continua igual sem precisar passar nada; um empresa_id de tenant Particular só
// aparece se for explicitamente pedido, nunca por acidente).
export function useTurmas(modalidadeId = null, empresaId = null) {
  return useQuery({
    queryKey: ['turmas', modalidadeId, empresaId],
    queryFn: async () => {
      let q = supabase
        .from('turmas')
        .select(`
          *,
          modalidades(nome, icone_emoji, cor_hex),
          professores!professor_titular_id(nome),
          niveis!nivel_id(nome),
          quadras!quadra_id(nome),
          turmas_alunos(aluno_id, ativo, alunos(nome))
        `)
        .eq('ativo', true)
        .order('nome')

      if (modalidadeId) q = q.eq('modalidade_id', modalidadeId)
      q = empresaId ? q.eq('empresa_id', empresaId) : q.is('empresa_id', null)

      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useTurma(id) {
  return useQuery({
    queryKey: ['turma', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select(`
          *,
          modalidades(nome, icone_emoji, cor_hex),
          professores!professor_titular_id(id, nome),
          niveis!nivel_id(id, nome),
          quadras!quadra_id(id, nome),
          turmas_alunos(id, aluno_id, ativo, alunos(id, nome))
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })
}

export function useSalvarTurma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, alunos_ids = [], ...dadosBrutos }) => {
      // professor_titular_id é opcional (turma pode existir sem professor definido ainda) —
      // o formulário manda '' quando não selecionado, e '' não é um uuid válido pro Postgres
      // (dava erro genérico em vez de simplesmente salvar sem professor).
      const dados = { ...dadosBrutos, professor_titular_id: dadosBrutos.professor_titular_id || null }
      let turmaId = id
      if (id) {
        const { data: anterior } = await supabase.from('turmas').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('turmas').update(dados).eq('id', id).select().single()
        if (error) throw error
        await logAudit('turmas', id, 'UPDATE', anterior, data)
      } else {
        const { data, error } = await supabase.from('turmas').insert(dados).select().single()
        if (error) throw error
        turmaId = data.id
        await logAudit('turmas', turmaId, 'INSERT', null, data)
      }

      const { data: ativosAntes } = await supabase
        .from('turmas_alunos')
        .select('aluno_id')
        .eq('turma_id', turmaId)
        .eq('ativo', true)
      const idsAntes = (ativosAntes || []).map(a => a.aluno_id)

      // Sync alunos
      await supabase.from('turmas_alunos').update({ ativo: false }).eq('turma_id', turmaId)
      if (alunos_ids.length > 0) {
        const rows = alunos_ids.map(aluno_id => ({ turma_id: turmaId, aluno_id, ativo: true }))
        await supabase.from('turmas_alunos').upsert(rows, { onConflict: 'turma_id,aluno_id' })
      }

      await notificarMudancasDeMatricula({
        turmaId,
        professorTitularId: dados.professor_titular_id,
        nomeTurma: dados.nome,
        idsAntes,
        idsDepois: alunos_ids,
      })

      return turmaId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turmas'] })
      qc.invalidateQueries({ queryKey: ['turma'] })
    }
  })
}
