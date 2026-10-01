import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Organizar Grade (/organizar-grade): rascunho de redistribuição de professores na grade de
// Tênis. Lê a grade oficial (turmas) só como ponto de partida — o cenário mora à parte em
// cenarios_grade_professores (scripts/2026-09-30_cenario_grade_professores.sql) e nunca grava
// em turmas.

const CHAVE_CENARIO = 'principal'
const CHAVE_LOCAL = 'procoach-cenario-grade'

// base 'vazia' = toda turma começa sem professor (padrão, pedido em 30/09); 'oficial' = parte do professor
// titular de hoje e só guarda as trocas.
export const CENARIO_VAZIO = { base: 'vazia', atribuicoes: {}, novos: [], desligados: [], niveis: {} }

// Grade de Tênis do clube (sem tenant Particular), com nível, quadra e quantos alunos ativos.
export function useTurmasTenisGrade(tenisId) {
  return useQuery({
    queryKey: ['organizar-grade-turmas', tenisId],
    enabled: !!tenisId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select('id, nome, horario_dia_semana, horario_inicio, professor_titular_id, professores!professor_titular_id(nome, apelido), niveis!nivel_id(nome), quadras!quadra_id(nome), turmas_alunos(ativo, alunos(nome))')
        .eq('modalidade_id', tenisId)
        .eq('ativo', true)
        .is('empresa_id', null)
      if (error) throw error
      return data || []
    },
  })
}

// Todo professor ativo (funcao = professor) — a tela separa os de Tênis dos demais.
export function useProfessoresOrganizacao() {
  return useQuery({
    queryKey: ['organizar-grade-professores'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('id, nome, apelido, foto_url, modalidade_id, modalidades_ids, funcao')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data || []).filter(p => !p.funcao || p.funcao === 'professor')
    },
  })
}

// Tabela ainda não criada (SQL não rodado): cai no navegador, pra tela funcionar mesmo assim.
const tabelaInexistente = e => ['42P01', 'PGRST205', 'PGRST204'].includes(e?.code) || /cenarios_grade_professores/.test(e?.message || '')

function lerLocal() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || null } catch { return null }
}

export function useCenarioGrade() {
  return useQuery({
    queryKey: ['organizar-grade-cenario'],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('cenarios_grade_professores').select('dados, atualizado_em').eq('chave', CHAVE_CENARIO).maybeSingle()
      if (error) {
        if (tabelaInexistente(error)) return { dados: { ...CENARIO_VAZIO, ...lerLocal() }, local: true }
        throw error
      }
      return { dados: { ...CENARIO_VAZIO, ...(data?.dados || {}) }, atualizadoEm: data?.atualizado_em || null, local: false }
    },
  })
}

export function useSalvarCenarioGrade() {
  return useMutation({
    mutationFn: async ({ dados, local }) => {
      if (local) {
        try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(dados)) } catch { /* sem storage: fica só na tela */ }
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('cenarios_grade_professores')
        .upsert({ chave: CHAVE_CENARIO, dados, atualizado_em: new Date().toISOString(), atualizado_por: user?.id || null }, { onConflict: 'chave' })
      if (error) throw error
    },
  })
}

// Alunos de cada turma numa semana de referência (seg a sáb), pela lista de presença das aulas
// geradas — é isso que diz se a turma existe na prática. `turmas.ativo` sozinho não serve: sobra
// turma ativa sem aula nem aluno (ex.: sexta 7h tinha 8 ativas e só 3 com aula de verdade).
// Devolve { [turma_id]: { data_aula, alunos: [nome] } }.
export function useAlunosDaSemana(inicio, fim) {
  return useQuery({
    queryKey: ['organizar-grade-semana', inicio, fim],
    enabled: !!inicio && !!fim,
    refetchInterval: 60000, // a coordenação vai atualizando a agenda da semana enquanto planeja
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select('turma_id, data_aula, presencas(status_inclusao_professor, alunos(nome))')
        .not('turma_id', 'is', null)
        .gte('data_aula', inicio).lte('data_aula', fim)
      if (error) throw error
      const mapa = {}
      for (const a of data || []) {
        const alunos = (a.presencas || []).filter(p => p.status_inclusao_professor !== 'rejeitado').map(p => p.alunos?.nome).filter(Boolean)
        const atual = mapa[a.turma_id]
        if (!atual || alunos.length > atual.alunos.length) mapa[a.turma_id] = { data_aula: a.data_aula, alunos }
      }
      return mapa
    },
  })
}
