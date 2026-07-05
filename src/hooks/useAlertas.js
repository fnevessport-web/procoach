import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'

// Cria um alerta pra outro usuário (ex: professor confirma aula -> alerta pro coordenador).
// Falha silenciosa se a tabela ainda não existir (SQL não rodado ainda) — não deve travar o fluxo principal.
export async function criarAlerta({ usuarioId, tipo, referenciaId, mensagem, prioridade = 'media' }) {
  try {
    await supabase.from('alertas').insert({ usuario_id: usuarioId, tipo, referencia_id: referenciaId, mensagem, prioridade })
  } catch {
    // sem tabela ainda / sem permissão — segue o app normalmente
  }
}

export function useAlertas() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  // useAlertas() é usado em mais de um componente ao mesmo tempo (sino + modal de turma
  // ativada) — cada instância precisa do seu próprio canal, senão a segunda tentativa de
  // dar .subscribe() num canal com o mesmo nome derruba o app inteiro (sem error boundary).
  const idInstancia = useRef(Math.random().toString(36).slice(2)).current

  const query = useQuery({
    queryKey: ['alertas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas')
        .select('*')
        .eq('usuario_id', user.id)
        .order('criado_em', { ascending: false })
        .limit(30)
      if (error) return []
      return data || []
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (!user?.id) return
    const canal = supabase
      .channel(`alertas_${user.id}_${idInstancia}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas', filter: `usuario_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['alertas', user.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [user?.id, qc, idInstancia])

  return query
}

export function useMarcarAlertaLido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (alertaId) => {
      await supabase.from('alertas').update({ lido: true }).eq('id', alertaId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })
}

export function useMarcarTodosAlertasLidos() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await supabase.from('alertas').update({ lido: true }).eq('usuario_id', user.id).eq('lido', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })
}
