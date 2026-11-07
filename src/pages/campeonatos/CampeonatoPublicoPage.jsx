import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, Camera, X, Plus, Star, Radio, GitBranch, Users, UserRound, Check, CalendarClock, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCampeonato } from '../../hooks/useCampeonato'
import { nomeCurto, normalizar, comprimirFoto, ordenarJogos } from '../../lib/campeonato'
import { Marcas, Avatar, CartaoJogo, Chave, SorteioAoVivo } from './componentes'
import { COR_DESTAQUE, jogoTemSeguido, duplasOcultas } from './util'

// Link público do campeonato (QR code no telão). Sem login. O associado escolhe o próprio nome
// (autocomplete com os inscritos), manda uma foto e pode seguir quantos nomes quiser (ex.: a
// esposa). Os jogos de quem ele segue aparecem em destaque. Tudo ao vivo.

function chaveLocal(slug) { return `campeonato:${slug}` }

function lerPreferencias(slug) {
  try { return JSON.parse(localStorage.getItem(chaveLocal(slug))) || null } catch { return null }
}

function tokenDoAparelho() {
  let t = localStorage.getItem('campeonato:token')
  if (!t) {
    t = crypto.randomUUID() + crypto.randomUUID()
    localStorage.setItem('campeonato:token', t)
  }
  return t
}

const ABAS = [
  { id: 'jogos', label: 'Jogos', icon: Radio },
  { id: 'chave', label: 'Chave', icon: GitBranch },
  { id: 'duplas', label: 'Duplas', icon: Users },
  { id: 'eu', label: 'Meus atletas', icon: Star },
]

export function CampeonatoPublicoPage() {
  const { slug } = useParams()
  const dados = useCampeonato({ slug })
  const { campeonato, atletas, duplas, jogos, duplaPorId, atletaPorId, carregando, erro } = dados

  const [prefs, setPrefs] = useState(() => lerPreferencias(slug))
  const [aba, setAba] = useState('jogos')

  const salvarPrefs = (p) => {
    setPrefs(p)
    localStorage.setItem(chaveLocal(slug), JSON.stringify(p))
  }

  const seguindo = useMemo(() => new Set([...(prefs?.seguindo || []), ...(prefs?.eu ? [prefs.eu] : [])]), [prefs])

  if (carregando) return <div className="cp-fundo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Marcas altura={34} /></div>
  if (erro || !campeonato) return <div className="cp-fundo" style={{ padding: 40, textAlign: 'center' }}>{erro || 'Campeonato não encontrado'}</div>

  const emSorteio = campeonato.status === 'sorteio'

  return (
    <div className="cp-fundo" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <Cabecalho campeonato={campeonato} seguindo={seguindo} atletaPorId={atletaPorId} onEditar={() => setAba('eu')} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '0 14px' }}>
        {emSorteio && aba !== 'duplas' && (
          <button onClick={() => setAba('duplas')} style={{ width: '100%', marginBottom: 14, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--color-accent-live)', backgroundColor: 'color-mix(in srgb, var(--color-accent-live) 18%, transparent)', color: 'var(--color-text-dark-primary)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            <span className="cp-pulso" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />
            Sorteio das duplas acontecendo agora. Toque para assistir
            <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
          </button>
        )}

        {aba === 'jogos' && <AbaJogos dados={dados} seguindo={seguindo} />}
        {aba === 'chave' && (
          <Secao titulo="Chaveamento">
            <Chave campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={seguindo} larguraColuna={180} />
          </Secao>
        )}
        {aba === 'duplas' && (
          duplas.length
            ? <SorteioAoVivo campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} seguindo={seguindo} colunas={1} escala={0.95} />
            : <ListaInscritos atletas={atletas} seguindo={seguindo} />
        )}
        {aba === 'eu' && (
          <AbaMeusAtletas campeonato={campeonato} atletas={atletas} atletaPorId={atletaPorId} prefs={prefs} salvarPrefs={salvarPrefs} />
        )}
      </main>

      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, display: 'flex', justifyContent: 'center', padding: '8px 10px calc(8px + env(safe-area-inset-bottom))', backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-base) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-border-dark-subtle)' }}>
        <div style={{ display: 'flex', gap: 4, width: '100%', maxWidth: 520 }}>
          {ABAS.map(({ id, label, icon: Icone }) => {
            const ativa = aba === id
            return (
              <button key={id} onClick={() => { setAba(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', border: 'none', borderRadius: 12, cursor: 'pointer', backgroundColor: ativa ? 'var(--color-surface-dark-overlay)' : 'transparent', color: ativa ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-muted)', fontSize: 11, fontWeight: 700, position: 'relative' }}>
                <Icone size={19} color={ativa ? 'var(--color-brand-lima)' : undefined} />
                {label}
                {id === 'duplas' && emSorteio && <span className="cp-pulso" style={{ position: 'absolute', top: 4, right: '30%', width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />}
              </button>
            )
          })}
        </div>
      </nav>

      {!prefs && (
        <Onboarding campeonato={campeonato} atletas={atletas} atletaPorId={atletaPorId}
          onConcluir={salvarPrefs} />
      )}
    </div>
  )
}

function Cabecalho({ campeonato, seguindo, atletaPorId, onEditar }) {
  const dataFmt = campeonato.data ? new Date(campeonato.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''
  return (
    <header style={{ padding: 'calc(18px + env(safe-area-inset-top)) 16px 14px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Marcas altura={26} /></div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '3px', color: 'var(--color-brand-lima)' }}>TORNEIO DE DUPLAS MISTAS</div>
      <h1 className="cp-display" style={{ fontSize: 30, fontWeight: 700, margin: '4px 0 2px', lineHeight: 1.1 }}>{campeonato.nome}</h1>
      <div style={{ fontSize: 12, color: 'var(--color-text-dark-secondary)', textTransform: 'capitalize' }}>{dataFmt}{campeonato.local ? ` · ${campeonato.local}` : ''}</div>
      {seguindo.size > 0 && (
        <button onClick={onEditar} className="cp-sem-scroll" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', overflowX: 'auto', padding: '5px 8px 5px 5px', borderRadius: 999, border: `1px solid ${COR_DESTAQUE}`, background: 'color-mix(in srgb, var(--color-brand-lima) 10%, transparent)', color: COR_DESTAQUE, cursor: 'pointer' }}>
          {[...seguindo].slice(0, 4).map(id => <Avatar key={id} atleta={atletaPorId.get(id)} tamanho={22} destaque />)}
          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Seguindo {[...seguindo].map(id => nomeCurto(atletaPorId.get(id)?.nome).split(' ')[0]).filter(Boolean).slice(0, 3).join(', ')}{seguindo.size > 3 ? ` +${seguindo.size - 3}` : ''}
          </span>
        </button>
      )}
    </header>
  )
}

function Secao({ titulo, icone: Icone, children, extra }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 10px' }}>
        {Icone && <Icone size={15} color="var(--color-brand-saibro)" style={{ filter: 'brightness(1.4)' }} />}
        <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-dark-secondary)', margin: 0 }}>{titulo}</h2>
        {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
      </div>
      {children}
    </section>
  )
}

function AbaJogos({ dados, seguindo }) {
  const { campeonato, jogos, duplas, duplaPorId } = dados
  const ocultas = duplasOcultas(campeonato, duplas)
  const visiveis = jogos.filter(j => j.status !== 'bye' && !ocultas.has(j.dupla_a_id) && !ocultas.has(j.dupla_b_id))
  const ordenados = ordenarJogos(visiveis).sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const aoVivo = ordenados.filter(j => j.status === 'ao_vivo')
  const proximos = ordenados.filter(j => j.status === 'agendado' && (j.dupla_a_id || j.dupla_b_id))
  const resultados = ordenados.filter(j => ['finalizado', 'wo'].includes(j.status)).sort((a, b) => String(b.finalizado_em).localeCompare(String(a.finalizado_em)))
  const meus = ordenados.filter(j => jogoTemSeguido(j, duplaPorId, seguindo))
  const cartao = j => <CartaoJogo key={j.id} jogo={j} duplaPorId={duplaPorId} seguindo={seguindo} numero={j.ordem || null} />

  if (!jogos.length) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--color-text-dark-secondary)' }}>
        <CalendarClock size={34} color="var(--color-brand-lima)" />
        <div className="cp-display" style={{ fontSize: 22, color: 'var(--color-text-dark-primary)', margin: '10px 0 6px' }}>Os jogos aparecem depois do sorteio</div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>As duplas mistas são sorteadas na hora, entre os presentes. Fique com esta página aberta para ver o sorteio ao vivo.</div>
        {campeonato.regras && <Regras texto={campeonato.regras} />}
      </div>
    )
  }

  return (
    <>
      {meus.length > 0 && (
        <Secao titulo="Jogos de quem você segue" icone={Star}>
          <div style={{ display: 'grid', gap: 10 }}>{meus.filter(j => j.status !== 'finalizado' && j.status !== 'wo').map(cartao)}</div>
          {meus.every(j => ['finalizado', 'wo'].includes(j.status)) && <div style={{ fontSize: 13, color: 'var(--color-text-dark-muted)', padding: '4px 2px' }}>Sem jogos pendentes. Veja os resultados abaixo.</div>}
        </Secao>
      )}
      <Secao titulo="Ao vivo agora" icone={Radio}>
        {aoVivo.length ? <div style={{ display: 'grid', gap: 10 }}>{aoVivo.map(cartao)}</div> : <Vazio texto="Nenhum jogo em quadra neste momento." />}
      </Secao>
      <Secao titulo="Próximos jogos" icone={CalendarClock}>
        {proximos.length ? <div style={{ display: 'grid', gap: 10 }}>{proximos.slice(0, 10).map(cartao)}</div> : <Vazio texto="Nenhum jogo na fila." />}
      </Secao>
      {resultados.length > 0 && (
        <Secao titulo="Resultados" icone={Check}>
          <div style={{ display: 'grid', gap: 10 }}>{resultados.map(cartao)}</div>
        </Secao>
      )}
      {campeonato.regras && <Regras texto={campeonato.regras} />}
    </>
  )
}

function Regras({ texto }) {
  return (
    <details style={{ marginTop: 10, padding: '12px 14px', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)', textAlign: 'left' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--color-text-dark-primary)' }}>Formato e regulamento</summary>
      <div style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-dark-secondary)', marginTop: 8 }}>{texto}</div>
    </details>
  )
}

function Vazio({ texto }) {
  return <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px dashed var(--color-border-dark)', fontSize: 13, color: 'var(--color-text-dark-muted)' }}>{texto}</div>
}

function ListaInscritos({ atletas, seguindo }) {
  const grupos = [['F', 'Mulheres'], ['M', 'Homens']]
  return (
    <>
      {grupos.map(([g, titulo]) => {
        const lista = atletas.filter(a => a.genero === g && a.situacao === 'inscrito')
        return (
          <Secao key={g} titulo={`${titulo} · ${lista.length}`} icone={UserRound}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
              {lista.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${seguindo.has(a.id) ? COR_DESTAQUE : 'var(--color-border-dark-subtle)'}` }}>
                  <Avatar atleta={a} tamanho={32} destaque={seguindo.has(a.id)} />
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: seguindo.has(a.id) ? COR_DESTAQUE : 'inherit' }}>{nomeCurto(a.nome)}</span>
                </div>
              ))}
            </div>
          </Secao>
        )
      })}
      <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', textAlign: 'center' }}>As duplas são sorteadas na hora, entre os presentes.</div>
    </>
  )
}

// ---------- busca com autocomplete ----------

function BuscaAtleta({ atletas, excluir = [], onEscolher, placeholder = 'Digite seu nome', autoFocus }) {
  const [txt, setTxt] = useState('')
  const termo = normalizar(txt)
  const resultados = termo.length < 2 ? [] : atletas
    .filter(a => a.situacao !== 'desistiu' && !excluir.includes(a.id))
    .filter(a => normalizar(a.nome).split(/\s+/).some(p => p.startsWith(termo)) || normalizar(a.nome).includes(termo))
    .slice(0, 8)
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dark-muted)' }} />
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 42px', borderRadius: 14, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 16, outline: 'none' }} />
      </div>
      {resultados.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {resultados.map(a => (
            <button key={a.id} onClick={() => { onEscolher(a); setTxt('') }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--color-border-dark-subtle)', backgroundColor: 'var(--color-surface-dark-raised)', color: 'var(--color-text-dark-primary)', cursor: 'pointer', textAlign: 'left' }}>
              <Avatar atleta={a} tamanho={34} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{a.nome}</span>
              <Plus size={18} color="var(--color-brand-lima)" />
            </button>
          ))}
        </div>
      )}
      {termo.length >= 2 && !resultados.length && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-dark-muted)' }}>Nenhum inscrito com esse nome.</div>
      )}
    </div>
  )
}

// ---------- foto ----------

function BotaoFoto({ atleta, onEnviada, rotulo = 'Enviar minha foto' }) {
  const ref = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const escolher = async (e) => {
    const arq = e.target.files?.[0]
    e.target.value = ''
    if (!arq) return
    setEnviando(true)
    try {
      const foto = await comprimirFoto(arq)
      const { error } = await supabase.rpc('campeonato_salvar_foto', { p_atleta_id: atleta.id, p_foto: foto, p_token: tokenDoAparelho() })
      if (error) throw error
      toast.success('Foto enviada!')
      onEnviada?.()
    } catch (err) {
      toast.error(err.message || 'Não foi possível enviar a foto')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" onChange={escolher} style={{ display: 'none' }} />
      <button onClick={() => ref.current?.click()} disabled={enviando} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 12, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
        <Camera size={18} />{enviando ? 'Enviando...' : rotulo}
      </button>
    </>
  )
}

// ---------- primeiro acesso ----------

function Onboarding({ campeonato, atletas, atletaPorId, onConcluir }) {
  const [passo, setPasso] = useState('quem')
  const [eu, setEu] = useState(null)
  const [seguindo, setSeguindo] = useState([])
  const euAtual = eu ? atletaPorId.get(eu) : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, overflowY: 'auto', background: 'color-mix(in srgb, var(--color-surface-dark-base) 96%, transparent)', backdropFilter: 'blur(6px)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'calc(28px + env(safe-area-inset-top)) 20px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Marcas altura={24} /></div>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '3px', color: 'var(--color-brand-lima)' }}>BEM-VINDO AO</div>
          <div className="cp-display" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>{campeonato.nome}</div>
        </div>

        {passo === 'quem' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Quem é você?</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)', marginBottom: 14 }}>Digite seu nome e toque nele. Seus jogos vão aparecer em destaque.</div>
            <BuscaAtleta atletas={atletas} autoFocus onEscolher={a => { setEu(a.id); setPasso('foto') }} />
            <button onClick={() => setPasso('mais')} style={botaoTexto}>Não estou jogando, só vou acompanhar</button>
          </>
        )}

        {passo === 'foto' && euAtual && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Avatar atleta={euAtual} tamanho={110} destaque /></div>
            <div className="cp-display" style={{ fontSize: 22, fontWeight: 700 }}>Olá, {euAtual.nome.split(' ')[0]}!</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)', margin: '6px 0 18px', lineHeight: 1.5 }}>Coloque uma foto sua. Ela aparece na chave, no telão e no sorteio das duplas.</div>
            <BotaoFoto atleta={euAtual} rotulo={euAtual.foto ? 'Trocar foto' : 'Tirar ou escolher foto'} onEnviada={() => setPasso('mais')} />
            <div><button onClick={() => setPasso('mais')} style={botaoTexto}>{euAtual.foto ? 'Continuar' : 'Agora não'}</button></div>
          </div>
        )}

        {passo === 'mais' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Quer acompanhar mais alguém?</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)', marginBottom: 14 }}>Marido, esposa, amigos... adicione quantos nomes quiser. Os jogos deles também ficam em destaque.</div>
            {seguindo.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {seguindo.map(id => (
                  <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 4px', borderRadius: 999, border: `1px solid ${COR_DESTAQUE}`, color: COR_DESTAQUE, fontSize: 13, fontWeight: 600 }}>
                    <Avatar atleta={atletaPorId.get(id)} tamanho={22} destaque />{nomeCurto(atletaPorId.get(id)?.nome)}
                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => setSeguindo(s => s.filter(x => x !== id))} />
                  </span>
                ))}
              </div>
            )}
            <BuscaAtleta atletas={atletas} excluir={[eu, ...seguindo].filter(Boolean)} placeholder="Buscar outro nome" onEscolher={a => setSeguindo(s => [...s, a.id])} />
            <button onClick={() => onConcluir({ eu, seguindo })} style={{ ...botaoPrincipal, marginTop: 20 }}>
              Ver o torneio
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const botaoTexto = { marginTop: 16, background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', fontSize: 14, textDecoration: 'underline', cursor: 'pointer', width: '100%' }
const botaoPrincipal = { width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }

// ---------- aba "Meus atletas" ----------

function AbaMeusAtletas({ atletas, atletaPorId, prefs, salvarPrefs }) {
  const p = prefs || { eu: null, seguindo: [] }
  const eu = p.eu ? atletaPorId.get(p.eu) : null
  const remover = id => salvarPrefs({ ...p, seguindo: p.seguindo.filter(x => x !== id) })
  return (
    <>
      <Secao titulo="Você" icone={UserRound}>
        {eu ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${COR_DESTAQUE}` }}>
            <Avatar atleta={eu} tamanho={64} destaque />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{eu.nome}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <BotaoFoto atleta={eu} rotulo={eu.foto ? 'Trocar foto' : 'Enviar foto'} />
                <button onClick={() => salvarPrefs({ ...p, eu: null })} style={{ ...botaoTexto, marginTop: 0, width: 'auto' }}>Não sou eu</button>
              </div>
            </div>
          </div>
        ) : (
          <BuscaAtleta atletas={atletas} excluir={p.seguindo} placeholder="Se você está jogando, busque seu nome" onEscolher={a => salvarPrefs({ ...p, eu: a.id })} />
        )}
      </Secao>
      <Secao titulo={`Seguindo · ${p.seguindo.length}`} icone={Star}>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {p.seguindo.map(id => {
            const a = atletaPorId.get(id)
            if (!a) return null
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
                <Avatar atleta={a} tamanho={36} destaque />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{a.nome}</span>
                <button onClick={() => remover(id)} aria-label="Parar de seguir" style={{ background: 'none', border: 'none', color: 'var(--color-text-dark-muted)', cursor: 'pointer', padding: 6 }}><X size={18} /></button>
              </div>
            )
          })}
        </div>
        <BuscaAtleta atletas={atletas} excluir={[p.eu, ...p.seguindo].filter(Boolean)} placeholder="Adicionar mais um nome" onEscolher={a => salvarPrefs({ ...p, seguindo: [...p.seguindo, a.id] })} />
      </Secao>
    </>
  )
}
