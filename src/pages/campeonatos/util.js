import { useEffect, useState } from 'react'

// Utilitários da aba Campeonatos usados pelas telas (fora dos .jsx por causa do fast refresh).

export const COR_DESTAQUE = 'var(--color-brand-lima)'

export function urlPublica(slug) {
  return `${window.location.origin}/campeonato/${slug}`
}
export function urlTV(slug) {
  return `${window.location.origin}/campeonato/${slug}/tv`
}

export function duplaTemSeguido(dupla, seguindo) {
  if (!dupla || !seguindo?.size) return false
  return seguindo.has(dupla.atleta1_id) || seguindo.has(dupla.atleta2_id)
}

export function jogoTemSeguido(jogo, duplaPorId, seguindo) {
  return duplaTemSeguido(duplaPorId.get(jogo.dupla_a_id), seguindo)
    || duplaTemSeguido(duplaPorId.get(jogo.dupla_b_id), seguindo)
}

// Durante o sorteio ao vivo, duplas ainda não reveladas não aparecem em lugar nenhum.
export function duplasOcultas(campeonato, duplas) {
  if (campeonato?.status !== 'sorteio') return new Set()
  return new Set(duplas.filter(d => d.numero > (campeonato.sorteio_revelados || 0)).map(d => d.id))
}

const STATUS = {
  inscricoes: ['Inscrições / check-in', 'var(--color-state-info)'],
  sorteio: ['Sorteio ao vivo', 'var(--color-accent-live)'],
  em_andamento: ['Em andamento', 'var(--color-state-success)'],
  encerrado: ['Encerrado', 'var(--color-text-dark-muted)'],
}

export function rotuloStatusCampeonato(s) { return STATUS[s] || [s, 'var(--color-text-dark-muted)'] }


// Para cada quadra livre (sem jogo ao vivo), o próximo jogo pronto (as duas duplas definidas) na
// ordem de jogos: primeiro um marcado para aquela quadra, senão o próximo da fila.
// Devolve Map(jogoId -> quadra), usado para destacar em verde na chave.
export function proximosPorQuadra(campeonato, jogos) {
  const ordenados = [...jogos].sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const ocupadas = new Set(jogos.filter(j => j.status === 'ao_vivo').map(j => j.quadra))
  const prontos = ordenados.filter(j => j.status === 'agendado' && j.dupla_a_id && j.dupla_b_id)
  const mapa = new Map()
  for (const q of campeonato?.quadras || []) {
    if (ocupadas.has(q)) continue
    const j = prontos.find(x => !mapa.has(x.id) && x.quadra === q) || prontos.find(x => !mapa.has(x.id))
    if (j) mapa.set(j.id, q)
  }
  return mapa
}

// Duplas já eliminadas (perderam e não têm mais jogo pela frente). Quem está nelas pode ser
// convidado para completar uma dupla "A definir" ou substituir alguém.
export function duplasEliminadas(jogos) {
  const perdedoras = new Set()
  for (const j of jogos) {
    if (!['finalizado', 'wo'].includes(j.status) || !j.vencedor_id) continue
    const p = j.vencedor_id === j.dupla_a_id ? j.dupla_b_id : j.dupla_a_id
    if (p) perdedoras.add(p)
  }
  for (const j of jogos) {
    if (['agendado', 'ao_vivo'].includes(j.status)) { perdedoras.delete(j.dupla_a_id); perdedoras.delete(j.dupla_b_id) }
  }
  return perdedoras
}

// Relógio que atualiza sozinho (cronômetro de jogo, atraso). Cada componente que usa tem o
// próprio intervalo, então só ele re-renderiza a cada segundo, não a página toda.
export function useAgora(intervaloMs = 1000) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}
