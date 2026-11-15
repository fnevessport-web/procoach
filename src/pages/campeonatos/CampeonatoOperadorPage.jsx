import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Play, ClipboardEdit, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCampeonato } from '../../hooks/useCampeonato'
import { propagar, rotuloFaseCurto, duplaIncompleta, ordenarJogos, nomeCurto, textoSet, inicioAposAquecimento } from '../../lib/campeonato'
import { Marcas } from './componentes'
import { proximosPorQuadra } from './util'
import { Botao, Painel, QuadraLivre, PlacarAoVivo, PlacarManual } from './CampeonatoAdminPage'
import './campeonato.css'

// LINK DO OPERADOR: /campeonato/:slug/operador/:token. Para quem trabalha em quadra, sem login.
// Só dá para iniciar jogo, digitar o placar da súmula e finalizar (a dupla vencedora avança),
// lançar o resultado de um jogo não iniciado e W.O. Atletas, sorteio, ordem e configuração ficam só na tela da gestão.
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
    return salvarJogo(jogo.id, { status: 'ao_vivo', quadra, iniciado_em: inicioAposAquecimento() })
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
                    ? <PlacarAoVivo jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} quadras={quadrasTodas} aoVivo={aoVivo} />
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
                      {j.status === 'wo' ? 'por W.O.' : (j.sets || []).map(s => textoSet(s, j.vencedor_id === j.dupla_a_id ? 'a' : 'b')).join('  ')}
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

// Para jogo que nem chegou a ser iniciado no app: escolhe o jogo e digita o placar da súmula nos
// mesmos quadrados do jogo em quadra. "Finalizar jogo" grava e a dupla vencedora avança na chave.
function LancarResultado({ jogos, duplaPorId, salvarJogo }) {
  const [jogoId, setJogoId] = useState('')
  const candidatos = jogos.filter(j => j.status === 'agendado' && j.dupla_a_id && j.dupla_b_id)
  const jogo = candidatos.find(j => j.id === jogoId)
  return (
    <Painel titulo="Lançar resultado de outro jogo">
      <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginBottom: 10, lineHeight: 1.5 }}>Para um jogo que não foi iniciado aqui. Sets até 4 games (no 3 a 3, tie-break direto até 7: o set fica 4 a 3 e os pontos vão no quadrado do tie-break). 3º set é o tie-break até 7.</div>
      <select value={jogoId} onChange={e => setJogoId(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 15, marginBottom: 12 }}>
        <option value="">Escolha o jogo</option>
        {candidatos.map(j => <option key={j.id} value={j.id}>Jogo {j.ordem} · {rotuloFaseCurto(j.fase)} · {nomesDupla(duplaPorId.get(j.dupla_a_id))} x {nomesDupla(duplaPorId.get(j.dupla_b_id))}</option>)}
      </select>
      {jogo && <PlacarManual key={jogo.id} jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} aoFinalizar={() => setJogoId('')} />}
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
