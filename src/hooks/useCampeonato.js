import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Carrega um campeonato inteiro (atletas, duplas, jogos) por slug (link público/TV) ou id (tela
// da gestão) e mantém tudo ao vivo. Para não pesar no 4G dos celulares, recarrega SÓ a tabela que
// mudou: um game marcado busca só os jogos; as fotos (atletas, a parte pesada) só voltam a ser
// baixadas quando um atleta muda. Recarga de segurança: jogos/duplas a cada 20s, atletas a cada
// 2 min, e tudo ao voltar para a aba.
const TODAS = ['camp', 'atletas', 'duplas', 'jogos']

export function useCampeonato({ slug, id }) {
  const [estado, setEstado] = useState({ carregando: true, erro: null, campeonato: null, atletas: [], duplas: [], jogos: [] })
  const campIdRef = useRef(null)

  const carregar = useCallback(async (tabelas = TODAS) => {
    try {
      const quer = new Set(Array.isArray(tabelas) ? tabelas : TODAS)
      let camp = null
      if (quer.has('camp') || !campIdRef.current) {
        let q = supabase.from('campeonatos').select('*')
        q = slug ? q.eq('slug', slug) : q.eq('id', id)
        const { data, error } = await q.maybeSingle()
        if (error) throw error
        if (!data) {
          setEstado(e => ({ ...e, carregando: false, erro: 'Campeonato não encontrado' }))
          return
        }
        camp = data
        if (campIdRef.current !== data.id) TODAS.forEach(t => quer.add(t))
        campIdRef.current = data.id
      }
      const cid = campIdRef.current
      const [at, du, jo] = await Promise.all([
        quer.has('atletas') ? supabase.from('campeonato_atletas').select('*').eq('campeonato_id', cid).order('ordem').order('nome') : null,
        quer.has('duplas') ? supabase.from('campeonato_duplas').select('*').eq('campeonato_id', cid).order('numero') : null,
        quer.has('jogos') ? supabase.from('campeonato_jogos').select('*').eq('campeonato_id', cid).order('rodada').order('posicao') : null,
      ])
      for (const r of [at, du, jo]) if (r?.error) throw r.error
      setEstado(e => ({
        carregando: false, erro: null,
        campeonato: camp || e.campeonato,
        atletas: at ? at.data || [] : e.atletas,
        duplas: du ? du.data || [] : e.duplas,
        jogos: jo ? jo.data || [] : e.jogos,
      }))
    } catch (e) {
      setEstado(s => ({ ...s, carregando: false, erro: e.message || 'Erro ao carregar' }))
    }
  }, [slug, id])

  useEffect(() => { carregar() }, [carregar])

  const campId = estado.campeonato?.id
  useEffect(() => {
    if (!campId) return
    let timer = null
    const pendentes = new Set()
    const agendar = tabela => () => {
      pendentes.add(tabela)
      clearTimeout(timer)
      timer = setTimeout(() => { const t = [...pendentes]; pendentes.clear(); carregar(t) }, 250)
    }
    const canal = supabase.channel(`campeonato-${campId}-${Math.random().toString(36).slice(2)}`)
    for (const [tabela, chave] of [['campeonato_atletas', 'atletas'], ['campeonato_duplas', 'duplas'], ['campeonato_jogos', 'jogos']]) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, filter: `campeonato_id=eq.${campId}` }, agendar(chave))
      // Exclusão não respeita filtro no tempo real do Supabase (o registro apagado só traz o id),
      // então escuta qualquer DELETE da tabela e recarrega (é raro e barato).
      canal.on('postgres_changes', { event: 'DELETE', schema: 'public', table: tabela }, agendar(chave))
    }
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'campeonatos', filter: `id=eq.${campId}` }, agendar('camp'))
    canal.subscribe()
    const intervalo = setInterval(() => carregar(['camp', 'duplas', 'jogos']), 20000)
    const intervaloAtletas = setInterval(() => carregar(['atletas']), 120000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearTimeout(timer)
      clearInterval(intervalo)
      clearInterval(intervaloAtletas)
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
