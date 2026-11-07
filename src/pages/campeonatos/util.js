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
