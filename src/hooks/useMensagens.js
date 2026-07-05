import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { usePermissions } from './usePermissions'
import { criarAlerta } from './useAlertas'

// Diretório de pessoas pra iniciar conversa — todo mundo com perfil no ProCoach, exceto eu mesmo
export function useContatos() {
  const { user } = useAppStore()
  return useQuery({
    queryKey: ['mensagens_contatos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis_usuario')
        .select('user_id, nome, role')
        .neq('user_id', user.id)
        .order('nome')
      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })
}

// Lista de conversas — gestor (podeVerInboxGeral) vê todas, os demais só as próprias (RLS já garante isso)
export function useConversas() {
  const { user } = useAppStore()
  const { podeVerInboxGeral } = usePermissions()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['conversas', user?.id, podeVerInboxGeral],
    queryFn: async () => {
      const { data: conversas, error } = await supabase
        .from('conversas')
        .select('id, tipo, titulo, criado_em, conversas_participantes(user_id)')
        .order('criado_em', { ascending: false })
      if (error) throw error

      const conversaIds = (conversas || []).map(c => c.id)
      const [{ data: ultimasMsgs }, { data: perfis }] = await Promise.all([
        conversaIds.length
          ? supabase.from('mensagens').select('conversa_id, texto, autor_id, criado_em').in('conversa_id', conversaIds).order('criado_em', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('perfis_usuario').select('user_id, nome'),
      ])

      const nomePorUserId = Object.fromEntries((perfis || []).map(p => [p.user_id, p.nome]))
      const ultimaPorConversa = {}
      ;(ultimasMsgs || []).forEach(m => {
        if (!ultimaPorConversa[m.conversa_id]) ultimaPorConversa[m.conversa_id] = m
      })

      return (conversas || []).map(c => {
        const participantesIds = (c.conversas_participantes || []).map(p => p.user_id).filter(id => id !== user.id)
        const nomes = participantesIds.map(id => nomePorUserId[id] || 'Alguém')
        const ultima = ultimaPorConversa[c.id]
        return {
          id: c.id,
          titulo: c.titulo || nomes.join(', ') || 'Conversa',
          ultimaMensagem: ultima?.texto || null,
          ultimaData: ultima?.criado_em || c.criado_em,
        }
      }).sort((a, b) => (b.ultimaData || '').localeCompare(a.ultimaData || ''))
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  })

  useEffect(() => {
    const canal = supabase
      .channel('conversas_lista')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, () => {
        qc.invalidateQueries({ queryKey: ['conversas'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [qc])

  return query
}

// Mensagens de uma conversa, com tempo real
export function useMensagensDaConversa(conversaId) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['mensagens', conversaId],
    queryFn: async () => {
      const [{ data: mensagens, error }, { data: perfis }] = await Promise.all([
        supabase.from('mensagens').select('id, autor_id, texto, criado_em').eq('conversa_id', conversaId).order('criado_em', { ascending: true }),
        supabase.from('perfis_usuario').select('user_id, nome'),
      ])
      if (error) throw error
      const nomePorUserId = Object.fromEntries((perfis || []).map(p => [p.user_id, p.nome]))
      return (mensagens || []).map(m => ({ ...m, autorNome: nomePorUserId[m.autor_id] || 'Alguém' }))
    },
    enabled: !!conversaId,
  })

  useEffect(() => {
    if (!conversaId) return
    const canal = supabase
      .channel(`mensagens_${conversaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${conversaId}` }, () => {
        qc.invalidateQueries({ queryKey: ['mensagens', conversaId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [conversaId, qc])

  return query
}

export function useEnviarMensagem() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ conversaId, texto }) => {
      const { error } = await supabase.from('mensagens').insert({ conversa_id: conversaId, autor_id: user.id, texto })
      if (error) throw error

      const { data: participantes } = await supabase
        .from('conversas_participantes')
        .select('user_id')
        .eq('conversa_id', conversaId)
        .neq('user_id', user.id)
      for (const p of participantes || []) {
        await criarAlerta({
          usuarioId: p.user_id,
          tipo: 'mensagem_nova',
          referenciaId: conversaId,
          prioridade: 'baixa',
          mensagem: `Nova mensagem de ${user.user_metadata?.nome || 'alguém'}.`,
        })
      }
    },
    onSuccess: (_data, { conversaId }) => {
      qc.invalidateQueries({ queryKey: ['mensagens', conversaId] })
      qc.invalidateQueries({ queryKey: ['conversas'] })
    },
  })
}

// Acha (ou cria) a conversa direta vinculada a uma aula especifica — pro botao
// "Discutir esta aula" em qualquer tela que mostra o detalhe de uma aula.
export function useAbrirConversaDaAula() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, outroUserId }) => {
      const { data: existentes } = await supabase
        .from('conversas')
        .select('id, conversas_participantes(user_id)')
        .eq('aula_id', aulaId)

      for (const c of existentes || []) {
        const ids = (c.conversas_participantes || []).map(p => p.user_id)
        if (ids.includes(user.id) && ids.includes(outroUserId)) return c.id
      }

      const { data: nova, error } = await supabase.from('conversas').insert({ tipo: 'direta', aula_id: aulaId }).select().single()
      if (error) throw error
      await supabase.from('conversas_participantes').insert([
        { conversa_id: nova.id, user_id: user.id },
        { conversa_id: nova.id, user_id: outroUserId },
      ])
      return nova.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversas'] }),
  })
}

// Acha uma conversa direta já existente com essa pessoa, ou cria uma nova
export function useAbrirConversaDireta() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (outroUserId) => {
      const { data: minhasParticipacoes } = await supabase
        .from('conversas_participantes')
        .select('conversa_id, conversas!inner(tipo)')
        .eq('user_id', user.id)
        .eq('conversas.tipo', 'direta')

      for (const p of minhasParticipacoes || []) {
        const { data: outros } = await supabase
          .from('conversas_participantes')
          .select('user_id')
          .eq('conversa_id', p.conversa_id)
        const ids = (outros || []).map(o => o.user_id)
        if (ids.length === 2 && ids.includes(outroUserId)) return p.conversa_id
      }

      const { data: novaConversa, error } = await supabase.from('conversas').insert({ tipo: 'direta' }).select().single()
      if (error) throw error
      await supabase.from('conversas_participantes').insert([
        { conversa_id: novaConversa.id, user_id: user.id },
        { conversa_id: novaConversa.id, user_id: outroUserId },
      ])
      return novaConversa.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversas'] }),
  })
}
