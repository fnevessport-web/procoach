import { supabase } from '../../lib/supabase'

// Volta um torneio para o começo, mantendo os inscritos (nomes, gênero, situação e os telefones
// da planilha). Usado pelo "Resetar torneio" do menu ⋮ na lista de Campeonatos.
//   sempre:     duplas, jogos, placares e o status volta para "Inscrições / check-in"
//   checkins:   desmarca todos os check-ins
//   fotos:      apaga as fotos (e libera para cada atleta mandar de novo de qualquer celular)
//   telefones:  apaga os WhatsApps que os atletas informaram pelo celular (os da planilha ficam)
export async function resetarCampeonato(id, { checkins = true, fotos = true, telefones = true } = {}) {
  const ok = r => { if (r.error) throw r.error; return r.data }
  ok(await supabase.from('campeonato_jogos').delete().eq('campeonato_id', id))
  ok(await supabase.from('campeonato_duplas').delete().eq('campeonato_id', id))
  ok(await supabase.from('campeonatos').update({ status: 'inscricoes', sorteio_revelados: 0, sorteio_em: null }).eq('id', id))

  const atletas = ok(await supabase.from('campeonato_atletas').select('id').eq('campeonato_id', id)) || []
  const ids = atletas.map(a => a.id)
  const patch = { ...(checkins ? { presente: false } : {}), ...(fotos ? { foto: null } : {}) }
  if (Object.keys(patch).length) ok(await supabase.from('campeonato_atletas').update(patch).eq('campeonato_id', id))

  let telefonesApagados = 0
  let semPermissao = false
  if (telefones && ids.length) {
    const r = await supabase.from('campeonato_telefone_tokens').select('atleta_id').in('atleta_id', ids)
    if (r.error) semPermissao = true
    const donos = (r.data || []).map(t => t.atleta_id)
    if (donos.length) {
      ok(await supabase.from('campeonato_contatos').delete().in('atleta_id', donos))
      ok(await supabase.from('campeonato_telefone_tokens').delete().in('atleta_id', donos))
      telefonesApagados = donos.length
    }
  }
  return { telefonesApagados, semPermissao }
}
