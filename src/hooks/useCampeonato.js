import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Carrega um campeonato inteiro (atletas, duplas, jogos) por slug (link público/TV) ou id (tela
// da gestão) e mantém tudo ao vivo: qualquer mudança nas tabelas do campeonato dispara um
// recarregamento (debounce curto). Também recarrega a cada 20s e ao voltar para a aba, para a TV
// não ficar parada se o tempo real cair.
export function useCampeonato({ slug, id }) {
  const [estado, setEstado] = useState({ carregando: true, erro: null, campeonato: null, atletas: [], duplas: [], jogos: [] })
  const campIdRef = useRef(null)

  const carregar = useCallback(async () => {
    try {
      let q = supabase.from('campeonatos').select('*')
      q = slug ? q.eq('slug', slug) : q.eq('id', id)
      const { data: camp, error } = await q.maybeSingle()
      if (error) throw error
      if (!camp) {
        setEstado(e => ({ ...e, carregando: false, erro: 'Campeonato não encontrado' }))
        return
      }
      campIdRef.current = camp.id
      const [at, du, jo] = await Promise.all([
        supabase.from('campeonato_atletas').select('*').eq('campeonato_id', camp.id).order('ordem').order('nome'),
        supabase.from('campeonato_duplas').select('*').eq('campeonato_id', camp.id).order('numero'),
        supabase.from('campeonato_jogos').select('*').eq('campeonato_id', camp.id).order('rodada').order('posicao'),
      ])
      for (const r of [at, du, jo]) if (r.error) throw r.error
      setEstado({ carregando: false, erro: null, campeonato: camp, atletas: at.data || [], duplas: du.data || [], jogos: jo.data || [] })
    } catch (e) {
      setEstado(s => ({ ...s, carregando: false, erro: e.message || 'Erro ao carregar' }))
    }
  }, [slug, id])

  useEffect(() => { carregar() }, [carregar])

  const campId = estado.campeonato?.id
  useEffect(() => {
    if (!campId) return
    let timer = null
    const agendar = () => {
      clearTimeout(timer)
      timer = setTimeout(carregar, 250)
    }
    const canal = supabase.channel(`campeonato-${campId}-${Math.random().toString(36).slice(2)}`)
    for (const tabela of ['campeonato_atletas', 'campeonato_duplas', 'campeonato_jogos']) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, filter: `campeonato_id=eq.${campId}` }, agendar)
      // Exclusão não respeita filtro no tempo real do Supabase (o registro apagado só traz o id),
      // então escuta qualquer DELETE da tabela e recarrega (é raro e barato).
      canal.on('postgres_changes', { event: 'DELETE', schema: 'public', table: tabela }, agendar)
    }
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'campeonatos', filter: `id=eq.${campId}` }, agendar)
    canal.subscribe()
    const intervalo = setInterval(carregar, 20000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearTimeout(timer)
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
      supabase.removeChannel(canal)
    }
  }, [campId, carregar])

  // Índices prontos para as telas.
  const derivados = useMemo(() => {
    const atletaPorId = new Map(estado.atletas.map(a => [a.id, a]))
    const duplaPorId = new Map(estado.duplas.map(d => [d.id, {
      ...d,
      atleta1: atletaPorId.get(d.atleta1_id) || null,
      atleta2: atletaPorId.get(d.atleta2_id) || null,
    }]))
    return { atletaPorId, duplaPorId }
  }, [estado.atletas, estado.duplas])

  return { ...estado, ...derivados, recarregar: carregar }
}

// Atualizar vários jogos de uma vez (avanço na chave, horários).
export async function aplicarPatchesJogos(mudancas) {
  for (const { id, patch } of mudancas) {
    const { error } = await supabase.from('campeonato_jogos').update(patch).eq('id', id)
    if (error) throw error
  }
}
