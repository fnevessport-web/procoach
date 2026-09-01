import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Link fixo do professor (token) — 1 por pessoa, criado automaticamente na primeira vez
// que o gestor abre a aba. O mesmo link pode ser respondido várias vezes (nunca trava,
// nunca mostra "já respondida") — cada envio vira uma linha em pesquisa_respostas (ver
// useRespostasPesquisa), sem sobrescrever os anteriores. RLS de pesquisas_satisfacao só
// libera pra role 'admin' (ver 028/029_pesquisa_*.sql) — qualquer outro role recebe lista
// vazia, nunca erro, então nem precisa checar role aqui antes de chamar (a segurança de
// verdade é no banco; a checagem de role no componente é só pra nem mostrar a aba).
export function usePesquisaSatisfacao(professorId, opcoes = {}) {
  return useQuery({
    queryKey: ['pesquisa_satisfacao', professorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisas_satisfacao')
        .select('*')
        .eq('professor_id', professorId)
        .maybeSingle()
      if (error) throw error
      // Professor cadastrado antes da migration rodar, ou depois dela sem backfill —
      // cria a linha (com token) na hora que o gestor abrir a aba pela primeira vez.
      if (!data) {
        const { data: criada, error: e2 } = await supabase
          .from('pesquisas_satisfacao')
          .insert({ professor_id: professorId })
          .select()
          .single()
        if (e2) throw e2
        return criada
      }
      return data
    },
    enabled: !!professorId && (opcoes.enabled ?? true),
  })
}

// Todas as respostas já enviadas por esse link, mais recente primeiro — o professor pode
// responder quantas vezes quiser, cada envio fica registrado à parte (nenhum some).
export function useRespostasPesquisa(pesquisaId, opcoes = {}) {
  return useQuery({
    queryKey: ['pesquisa_respostas', pesquisaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisa_respostas')
        .select('*')
        .eq('pesquisa_id', pesquisaId)
        .order('respondido_em', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!pesquisaId && (opcoes.enabled ?? true),
  })
}
