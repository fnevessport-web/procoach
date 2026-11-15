import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Play, ClipboardEdit, Check, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCampeonato } from '../../hooks/useCampeonato'
import { propagar, resumoPlacar, rotuloFaseCurto, duplaIncompleta, ordenarJogos, nomeCurto } from '../../lib/campeonato'
import { Marcas, AvataresDupla } from './componentes'
import { proximosPorQuadra } from './util'
import { Botao, Painel, QuadraLivre, PlacarAoVivo } from './CampeonatoAdminPage'
import './campeonato.css'

// LINK DO OPERADOR: /campeonato/:slug/operador/:token. Para quem trabalha em quadra, sem login.
// Só dá para iniciar jogo, marcar os games (o jogo encerra sozinho ao fechar 2 sets), lançar o
// resultado de um jogo e W.O. Atletas, sorteio, ordem e configuração ficam só na tela da gestão.
// Tudo é gravado pela função campeonato_operador_salvar, que confere o código do link.

function nomesDupla(d) {
  if (!d) return 'A definir'
  return `${nomeCurto(d.atleta1?.nome)} / ${nomeCurto(d.atleta2?.nome)}`
}

const chaveQuadra = slug => `campeonato:${slug}:operador:quadra`

export function CampeonatoOperadorPage() {
  const { slug, token } = useParams()
  const dados = useCampeonato({ slug })
  const { campeonato, jogos, duplas, duplaPorId, carregando, erro, recarregar } = dados
  const [valido, setValido] = useState(null)
  const [filtro, setFiltro] = useState(() => {
    try { return localStorage.getItem(chaveQuadra(slug)) || 'todas' } catch { return 'todas' }
  })

  useEffect(() => {
    let vivo = true
    supabase.rpc('campeonato_operador_valido', { p_slug: slug, p_token: token }).then(({ data, error }) => {
      if (vivo) setValido(!error && data === true)
    })
    return () => { vivo = false }
  }, [slug, token])

  const escolherQuadra = q => {
    setFiltro(q)
    try { localStorage.setItem(chaveQuadra(slug), q) } catch { /* sem armazenamento */ }
  }

  // Mesmo cálculo da tela da gestão: grava o jogo e o avanço na chave (vencedor sobe, perdedor da
  // semi vai para o 3º lugar), tudo numa chamada só.
  const salvarJogo = async (jogoId, patch, { silencioso = false } = {}) => {
    const novos = jogos.map(j => (j.id === jogoId ? { ...j, ...patch } : j))
    const mudancas = propagar(novos)
    const resetados = mudancas.filter(m => m.patch.status === 'agendado' && m.id !== jogoId && ['ao_vivo', 'finalizado', 'wo'].includes(jogos.find(j => j.id === m.id)?.status))
    if (resetados.length && !window.confirm(`Isso muda quem joga em ${resetados.length} jogo(s) seguinte(s) que já tinham começado ou terminado. Eles voltam para "agendado" sem placar. Continuar?`)) return false
    const juntos = new Map([[jogoId, { ...patch }]])
    for (const m of mudancas) juntos.set(m.id, { ...(juntos.get(m.id) || {}), ...m.patch })
    const { error } = await supabase.rpc('campeonato_operador_salvar', {
      p_slug: slug, p_token: token, p_mudancas: [...juntos].map(([id, p]) => ({ id, patch: p })),
    })
    if (error) { toast.error(error.message); return false }
    await recarregar(['jogos'])
    if (!silencioso) toast.success('Salvo')
    return true
  }

  const iniciar = (jogo, quadra) => {
    const faltando = [jogo.dupla_a_id, jogo.dupla_b_id].map(id => duplas.find(d => d.id === id)).find(duplaIncompleta)
    if (faltando) return toast.error(`A dupla nº ${faltando.numero} ainda está sem parceiro(a). Peça para a organização completar.`)
    return salvarJogo(jogo.id, { status: 'ao_vivo', quadra, iniciado_em: new Date().toISOString() })
  }

  const ordenados = useMemo(() => ordenarJogos(jogos.filter(j => j.status !== 'bye')).sort((a, b) => (a.ordem || 999) - (b.ordem || 999)), [jogos])

  if (carregando || valido === null) return <Tela><div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Marcas altura={30} /></div></Tela>
  if (erro || !campeonato) return <Tela><Aviso texto={erro || 'Campeonato não encontrado'} /></Tela>
  if (!valido) {
    return (
      <Tela>
        <Aviso icone={Lock} texto="Este link de operador não vale mais. Peça o link novo para a organização do torneio." />
      </Tela>
    )
  }

  const aoVivo = ordenados.filter(j => j.status === 'ao_vivo')
  const prontos = ordenados.filter(j => j.status === 'agendado' && j.dupla_a_id && j.dupla_b_id)
  const quadrasTodas = [...new Set([...(campeonato.quadras || []), ...aoVivo.map(j => j.quadra).filter(Boolean)])]
  const quadras = filtro === 'todas' ? quadrasTodas : quadrasTodas.filter(q => q === filtro)
  const proximosMapa = proximosPorQuadra(campeonato, jogos)
  const revelados = campeonato.sorteio_revelados || 0
  const semJogos = campeonato.status === 'inscricoes' || !jogos.length || (campeonato.status === 'sorteio' && revelados < duplas.length)
  const encerrados = ordenados.filter(j => ['finalizado', 'wo'].includes(j.status)).sort((a, b) => String(b.finalizado_em).localeCompare(String(a.finalizado_em)))

  return (
    <Tela>
      <header style={{ textAlign: 'center', padding: '4px 0 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Marcas altura={22} /></div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '3px', color: 'var(--color-brand-lima)' }}>MODO OPERADOR · PLACAR</div>
        <div className="cp-display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>{campeonato.nome}</div>
      </header>

      {semJogos ? (
        <Aviso texto={campeonato.status === 'encerrado' ? 'Torneio encerrado. Obrigado!' : 'Os jogos aparecem aqui assim que o sorteio terminar. Deixe esta tela aberta.'} />
      ) : (
        <>
          <div className="cp-sem-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14 }}>
            {['todas', ...quadrasTodas].map(q => {
              const ativa = filtro === q
              return (
                <button key={q} onClick={() => escolherQuadra(q)} style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 999, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: `1px solid ${ativa ? 'var(--color-brand-lima)' : 'var(--color-border-dark)'}`, backgroundColor: ativa ? 'color-mix(in srgb, var(--color-brand-lima) 14%, transparent)' : 'transparent', color: ativa ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)' }}>
                  {q === 'todas' ? 'Todas as quadras' : `Só a ${q}`}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
            {quadras.map(q => {
              const jogo = aoVivo.find(j => j.quadra === q)
              return (
                <div key={q} style={{ padding: 14, borderRadius: 18, backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${jogo ? 'var(--color-accent-live)' : 'var(--color-border-dark-subtle)'}` }}>
                  {jogo
                    ? <PlacarAoVivo jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} />
                    : <QuadraLivre quadra={q} prontos={prontos} duplaPorId={duplaPorId} onIniciar={iniciar} />}
                </div>
              )
            })}
          </div>

          <Painel titulo={`Próximos jogos · ${prontos.length}`}>
            {!prontos.length && <div style={{ fontSize: 14, color: 'var(--color-text-dark-muted)' }}>Nenhum jogo com as duas duplas definidas esperando quadra.</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              {prontos.slice(0, 8).map(j => (
                <div key={j.id} style={{ padding: '10px 12px', borderRadius: 12, backgroundColor: 'var(--color-surface-dark-overlay)', border: `1px solid ${proximosMapa.get(j.id) ? 'var(--color-state-success)' : 'transparent'}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-dark-secondary)' }}>
                    Jogo {j.ordem} · {rotuloFaseCurto(j.fase)} · {j.quadra} · previsto {j.horario}
                    {proximosMapa.get(j.id) && <span style={{ color: 'var(--color-state-success)', filter: 'brightness(1.4)' }}> · PRÓXIMO NA {proximosMapa.get(j.id).toUpperCase()}</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0 8px' }}>{nomesDupla(duplaPorId.get(j.dupla_a_id))} <span style={{ color: 'var(--color-text-dark-muted)' }}>x</span> {nomesDupla(duplaPorId.get(j.dupla_b_id))}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {quadrasTodas.map(q => {
                      const ocupada = aoVivo.some(x => x.quadra === q)
                      return <Botao key={q} tamanho="sm" variante={ocupada ? 'secundario' : 'primario'} disabled={ocupada} onClick={() => iniciar(j, q)}><Play size={13} />Iniciar na {q}</Botao>
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Painel>

          <LancarResultado jogos={ordenados} duplaPorId={duplaPorId} salvarJogo={salvarJogo} />

          {encerrados.length > 0 && (
            <Painel titulo={`Resultados · ${encerrados.length}`}>
              <div style={{ display: 'grid', gap: 6 }}>
                {encerrados.map(j => (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 8px', borderRadius: 10, backgroundColor: 'var(--color-surface-dark-overlay)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-text-dark-muted)', minWidth: 52 }}>Jogo {j.ordem}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ color: 'var(--color-brand-lima)' }}>{nomesDupla(duplaPorId.get(j.vencedor_id))}</b>
                      <span style={{ color: 'var(--color-text-dark-muted)' }}> venceu </span>
                      {j.status === 'wo' ? 'por W.O.' : (j.sets || []).map(s => (j.vencedor_id === j.dupla_a_id ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join('  ')}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginTop: 8 }}>Errou um resultado já encerrado? Avise a organização para corrigir.</div>
            </Painel>
          )}
        </>
      )}
    </Tela>
  )
}

// Para jogo que não foi marcado ponto a ponto: escolhe o jogo e digita o placar de cada set.
// Só grava se o placar fechar (2 sets para alguém), e aí a dupla vencedora avança na chave.
function LancarResultado({ jogos, duplaPorId, salvarJogo }) {
  const [jogoId, setJogoId] = useState('')
  const [sets, setSets] = useState([{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }])
  const candidatos = jogos.filter(j => ['agendado', 'ao_vivo'].includes(j.status) && j.dupla_a_id && j.dupla_b_id)
  const jogo = candidatos.find(j => j.id === jogoId)
  const limpos = sets.filter(s => s.a !== '' || s.b !== '').map(s => ({ a: Number(s.a) || 0, b: Number(s.b) || 0 }))
  const resumo = resumoPlacar(limpos)
  const a = jogo ? duplaPorId.get(jogo.dupla_a_id) : null
  const b = jogo ? duplaPorId.get(jogo.dupla_b_id) : null

  const salvar = async () => {
    if (!resumo.vencedor) return toast.error('O placar não fecha: uma dupla precisa vencer 2 sets.')
    const venc = resumo.vencedor === 'a' ? jogo.dupla_a_id : jogo.dupla_b_id
    if (!window.confirm(`Confirmar vitória de ${nomesDupla(duplaPorId.get(venc))}?`)) return
    const ok = await salvarJogo(jogo.id, { sets: limpos, status: 'finalizado', vencedor_id: venc, iniciado_em: jogo.iniciado_em || new Date().toISOString(), finalizado_em: new Date().toISOString() })
    if (ok) { setJogoId(''); setSets([{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]) }
  }
  const campo = { boxSizing: 'border-box', width: 52, padding: '10px 4px', borderRadius: 10, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 18, fontWeight: 800, textAlign: 'center', outline: 'none' }
  // Nome da dupla numa linha e os 3 sets embaixo (cabe na largura do celular).
  const linha = (lado, d) => (
    <div style={{ padding: '8px 10px', borderRadius: 12, backgroundColor: 'var(--color-surface-dark-overlay)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AvataresDupla dupla={d} tamanho={26} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomesDupla(d)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <label key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-text-dark-muted)', textAlign: 'center', marginBottom: 3 }}>{i === 2 ? '3º (TIE-BREAK)' : `${i + 1}º SET`}</div>
            <input value={sets[i][lado]} inputMode="numeric"
              onChange={e => setSets(s => s.map((x, k) => (k === i ? { ...x, [lado]: e.target.value.replace(/\D/g, '').slice(0, 2) } : x)))} style={{ ...campo, width: '100%' }} />
          </label>
        ))}
      </div>
    </div>
  )

  return (
    <Painel titulo="Lançar resultado de um jogo">
      <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginBottom: 10, lineHeight: 1.5 }}>Para um jogo que não foi marcado ponto a ponto. Sets até 4 games (no 4 a 4, tie-break: escreva 5 a 4). 3º set é o tie-break até 7.</div>
      <select value={jogoId} onChange={e => setJogoId(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 15, marginBottom: 12 }}>
        <option value="">Escolha o jogo</option>
        {candidatos.map(j => <option key={j.id} value={j.id}>Jogo {j.ordem} · {rotuloFaseCurto(j.fase)} · {nomesDupla(duplaPorId.get(j.dupla_a_id))} x {nomesDupla(duplaPorId.get(j.dupla_b_id))}</option>)}
      </select>
      {jogo && (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {linha('a', a)}
            {linha('b', b)}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Botao variante="primario" disabled={!resumo.vencedor} onClick={salvar}><Check size={15} />Salvar resultado</Botao>
            <span style={{ fontSize: 13, color: resumo.vencedor ? 'var(--color-brand-lima)' : 'var(--color-text-dark-muted)' }}>
              {resumo.vencedor ? `Vitória de ${nomesDupla(resumo.vencedor === 'a' ? a : b)}` : 'Digite os sets'}
            </span>
          </div>
        </>
      )}
      {!candidatos.length && <div style={{ fontSize: 14, color: 'var(--color-text-dark-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardEdit size={15} />Nenhum jogo pendente com as duas duplas definidas.</div>}
    </Painel>
  )
}

function Tela({ children }) {
  return (
    <div className="cp-fundo cp-rolagem">
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'calc(18px + env(safe-area-inset-top)) 14px 60px' }}>{children}</div>
    </div>
  )
}

function Aviso({ texto, icone: Icone }) {
  return (
    <div style={{ marginTop: 30, padding: 20, borderRadius: 16, textAlign: 'center', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)', color: 'var(--color-text-dark-secondary)', fontSize: 15, lineHeight: 1.5 }}>
      {Icone && <div style={{ marginBottom: 8 }}><Icone size={26} /></div>}
      {texto}
    </div>
  )
}
