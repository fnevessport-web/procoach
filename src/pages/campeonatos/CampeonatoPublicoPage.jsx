import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, Camera, X, Plus, Star, Radio, GitBranch, Users, UserRound, Check, CalendarClock, MapPin, Phone, MessageCircle, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCampeonato } from '../../hooks/useCampeonato'
import { nomeCurto, normalizar, ordenarJogos } from '../../lib/campeonato'
import { EditorFoto } from './EditorFoto'
import { Marcas, Avatar, AvataresDupla, CartaoJogo, Chave, SorteioAoVivo } from './componentes'
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
  const rolagem = useRef(null)
  const irParaTopo = useCallback(() => rolagem.current?.scrollTo({ top: 0, behavior: 'smooth' }), [])

  const salvarPrefs = (p) => {
    setPrefs(p)
    localStorage.setItem(chaveLocal(slug), JSON.stringify(p))
  }

  const seguindo = useMemo(() => new Set([...(prefs?.seguindo || []), ...(prefs?.eu ? [prefs.eu] : [])]), [prefs])

  if (carregando) return <div className="cp-fundo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Marcas altura={34} /></div>
  if (erro || !campeonato) return <div className="cp-fundo" style={{ padding: 40, textAlign: 'center' }}>{erro || 'Campeonato não encontrado'}</div>

  const emSorteio = campeonato.status === 'sorteio'

  return (
    <div ref={rolagem} className="cp-fundo cp-rolagem" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <Cabecalho campeonato={campeonato} seguindo={seguindo} atletaPorId={atletaPorId} onEditar={() => setAba('eu')} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '0 14px' }}>
        {campeonato.status === 'inscricoes' && (aba === 'jogos' || aba === 'duplas') && <AvisoSorteio campeonato={campeonato} />}

        {campeonato.status === 'inscricoes' && prefs?.eu && atletaPorId.get(prefs.eu) && (aba === 'jogos' || aba === 'eu') && (
          <CardCheckin atleta={atletaPorId.get(prefs.eu)} onMudou={dados.recarregar} />
        )}

        {!emSorteio && prefs?.eu && atletaPorId.get(prefs.eu) && aba !== 'chave' && (
          <CardParceiro campeonato={campeonato} eu={atletaPorId.get(prefs.eu)} duplas={duplas} atletaPorId={atletaPorId} slug={slug} />
        )}

        {/* Durante o sorteio, a tela (menos "Meus atletas") vira o sorteio ao vivo. */}
        {emSorteio && aba !== 'eu' && (
          <SorteioCelular campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} seguindo={seguindo} eu={prefs?.eu} irParaTopo={irParaTopo} />
        )}
        {!emSorteio && aba === 'jogos' && <AbaJogos dados={dados} seguindo={seguindo} />}
        {!emSorteio && aba === 'chave' && (
          <Secao titulo="Chaveamento">
            <Chave campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={seguindo} porRodada />
          </Secao>
        )}
        {!emSorteio && aba === 'duplas' && (
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
              <button key={id} onClick={() => { setAba(id); irParaTopo() }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', border: 'none', borderRadius: 12, cursor: 'pointer', backgroundColor: ativa ? 'var(--color-surface-dark-overlay)' : 'transparent', color: ativa ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-muted)', fontSize: 11, fontWeight: 700, position: 'relative' }}>
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

// Antes do sorteio: avisa que o sorteio é ao vivo nesta tela (30 min antes do primeiro jogo).
function AvisoSorteio({ campeonato }) {
  const [h, m] = String(campeonato.hora_inicio || '09:30').split(':').map(Number)
  const total = h * 60 + m - 30
  const hora = `${Math.floor(total / 60)}h${total % 60 ? String(total % 60).padStart(2, '0') : ''}`
  return (
    <div style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--color-accent-live)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent-live) 22%, var(--color-surface-dark-raised)), var(--color-surface-dark-raised))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '2.5px', color: 'var(--color-text-dark-primary)' }}>
        <span className="cp-pulso" style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />SORTEIO AO VIVO ÀS {hora.toUpperCase()}
      </div>
      <div className="cp-display" style={{ fontSize: 21, fontWeight: 700, margin: '8px 0 4px', lineHeight: 1.2 }}>As duplas mistas serão sorteadas ao vivo, aqui nesta tela</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', lineHeight: 1.5 }}>Deixe esta página aberta: as duplas aparecem uma a uma e, quando sair a sua, você vê na hora quem é seu parceiro.</div>
    </div>
  )
}

// Sorteio no celular: a dupla de quem está logado e as de quem ele segue ficam fixas no topo
// enquanto o sorteio continua. Quando sai a dupla dele, a tela inteira destaca "É VOCÊ!".
function SorteioCelular({ campeonato, duplas, duplaPorId, atletas, seguindo, eu, irParaTopo }) {
  const revelados = campeonato.sorteio_revelados || 0
  const visivel = d => d.numero <= revelados
  const minha = eu ? duplas.find(d => d.atleta1_id === eu || d.atleta2_id === eu) : null
  const minhaVisivel = minha && visivel(minha) ? duplaPorId.get(minha.id) : null
  const seguidas = duplas.filter(d => d.id !== minha?.id && visivel(d) && (seguindo.has(d.atleta1_id) || seguindo.has(d.atleta2_id))).map(d => duplaPorId.get(d.id))
  const [destaqueVisto, setDestaqueVisto] = useState(() => !!minhaVisivel)
  const mostrarDestaque = !!minhaVisivel && !destaqueVisto

  // Fecha o destaque sozinho depois de alguns segundos e volta para o topo (dupla fixa).
  useEffect(() => {
    if (!mostrarDestaque) return
    const t = setTimeout(() => { setDestaqueVisto(true); irParaTopo() }, 5000)
    return () => clearTimeout(t)
  }, [mostrarDestaque, irParaTopo])

  // Aviso discreto quando sai a dupla de alguém que a pessoa segue.
  const avisadas = useRef(null)
  useEffect(() => {
    const ids = seguidas.map(d => d.id)
    if (avisadas.current === null) { avisadas.current = new Set(ids); return }
    for (const d of seguidas) {
      if (avisadas.current.has(d.id)) continue
      avisadas.current.add(d.id)
      const quem = [d.atleta1, d.atleta2].find(a => a && seguindo.has(a.id))
      toast(`${quem?.nome.split(' ')[0] || 'Quem você segue'} já tem dupla!`, { icon: '⭐', duration: 3500 })
    }
  }, [seguidas, seguindo])

  const nomeDupla = d => `${nomeCurto(d.atleta1?.nome)} & ${nomeCurto(d.atleta2?.nome)}`
  const parceiroDe = d => (d.atleta1_id === eu ? d.atleta2 : d.atleta1)

  return (
    <>
      {(minhaVisivel || seguidas.length > 0) && (
        <div style={{ position: 'sticky', top: 0, zIndex: 15, margin: '0 -14px 14px', padding: '10px 14px', backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-base) 90%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border-dark-subtle)' }}>
          {minhaVisivel && (
            <div className="cp-entrar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, border: `1.5px solid ${COR_DESTAQUE}`, backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 14%, var(--color-surface-dark-raised))' }}>
              <AvataresDupla dupla={minhaVisivel} tamanho={44} destaque />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: COR_DESTAQUE }}>SUA DUPLA · Nº {minhaVisivel.numero}</div>
                <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Você & {parceiroDe(minhaVisivel)?.nome.split(' ')[0]}</div>
              </div>
            </div>
          )}
          {seguidas.length > 0 && (
            <div className="cp-sem-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: minhaVisivel ? 8 : 0 }}>
              {seguidas.map(d => (
                <span key={d.id} className="cp-entrar" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 999, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-raised)', fontSize: 12, fontWeight: 600 }}>
                  <AvataresDupla dupla={d} tamanho={22} />
                  <span style={{ color: 'var(--color-text-dark-muted)' }}>{d.numero}</span>{nomeDupla(d)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <SorteioAoVivo campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} seguindo={seguindo} colunas={1} escala={0.95} />

      {mostrarDestaque && (
        <div className="cp-fade-in" onClick={() => { setDestaqueVisto(true); irParaTopo() }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: 'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--color-brand-lima) 22%, var(--color-surface-dark-base)), color-mix(in srgb, var(--color-surface-dark-base) 97%, transparent) 70%)' }}>
          <div className="cp-zoom" style={{ fontSize: 13, fontWeight: 800, letterSpacing: '4px', color: COR_DESTAQUE }}>SUA DUPLA SAIU!</div>
          <div className="cp-display cp-zoom" style={{ fontSize: 46, fontWeight: 700, margin: '6px 0 22px', animationDelay: '0.1s' }}>É você!</div>
          <div className="cp-zoom" style={{ display: 'flex', alignItems: 'center', gap: 14, animationDelay: '0.25s' }}>
            {[minhaVisivel.atleta1, minhaVisivel.atleta2].map((a, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 130 }}>
                <Avatar atleta={a} tamanho={118} destaque />
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{a?.id === eu ? 'Você' : nomeCurto(a?.nome)}</div>
              </div>
            ))}
          </div>
          <div className="cp-zoom" style={{ marginTop: 22, fontSize: 14, color: 'var(--color-text-dark-secondary)', animationDelay: '0.4s' }}>Dupla nº {minhaVisivel.numero} · toque para continuar vendo o sorteio</div>
        </div>
      )}
    </>
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

// ---------- check-in pelo celular ----------

// O associado confirma que chegou ao clube. Acende o nome dele no telão e entra no sorteio
// (o sorteio usa quem fez check-in). Só vale antes do sorteio.
function CardCheckin({ atleta, onMudou }) {
  const [salvando, setSalvando] = useState(false)
  const primeiro = atleta.nome.split(' ')[0]
  const marcar = async (presente) => {
    setSalvando(true)
    const { error } = await supabase.rpc('campeonato_checkin', { p_atleta_id: atleta.id, p_presente: presente })
    setSalvando(false)
    if (error) return toast.error(error.message)
    if (presente) toast.success('Check-in feito! Seu nome já acendeu no telão.')
    onMudou?.()
  }
  if (atleta.presente) {
    return (
      <div className="cp-entrar" style={{ marginBottom: 16, padding: 16, borderRadius: 16, border: `1px solid ${COR_DESTAQUE}`, backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 12%, var(--color-surface-dark-raised))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: COR_DESTAQUE, color: 'var(--color-brand-verde-court)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={24} strokeWidth={3} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: COR_DESTAQUE }}>Check-in feito, {primeiro}!</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginTop: 2 }}>{atleta.situacao === 'espera' ? 'Você está na lista de espera. Se abrir vaga, a mesa te chama.' : 'Você está no sorteio. Fique de olho no telão às 9h.'}</div>
          </div>
        </div>
        {!atleta.foto && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)' }}>Falta sua foto para aparecer no telão:</span>
            <BotaoFoto atleta={atleta} rotulo="Colocar foto" onEnviada={onMudou} />
          </div>
        )}
        <button onClick={() => marcar(false)} disabled={salvando} style={{ ...botaoTexto, marginTop: 10, fontSize: 12, width: 'auto' }}>Fiz check-in sem querer, desfazer</button>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 16, padding: 16, borderRadius: 16, border: '1px solid var(--color-brand-saibro)', backgroundColor: 'color-mix(in srgb, var(--color-brand-saibro) 14%, var(--color-surface-dark-raised))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}><MapPin size={18} />Já está no Beyond, {primeiro}?</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', margin: '4px 0 12px', lineHeight: 1.5 }}>Faça o check-in quando chegar ao clube. O sorteio das duplas usa só quem fez check-in.</div>
      <button onClick={() => marcar(true)} disabled={salvando} style={{ ...botaoPrincipal, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? 'Confirmando...' : 'Cheguei! Fazer meu check-in'}
      </button>
    </div>
  )
}

// ---------- sua dupla (contato do parceiro) ----------

function formatarTelefone(t) {
  const d = String(t || '').replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t
}

// Depois que a dupla é revelada no sorteio, mostra foto e nome do parceiro e libera o WhatsApp
// dele. O telefone vem de uma função fechada no banco: só sai depois de a pessoa confirmar os 4
// últimos dígitos do PRÓPRIO telefone de inscrição (fica lembrado neste aparelho).
function CardParceiro({ campeonato, eu, duplas, atletaPorId, slug }) {
  const minha = duplas.find(d => d.atleta1_id === eu.id || d.atleta2_id === eu.id)
  const revelada = !!minha && !(campeonato.status === 'sorteio' && minha.numero > (campeonato.sorteio_revelados || 0))
  const parceiroId = minha ? (minha.atleta1_id === eu.id ? minha.atleta2_id : minha.atleta1_id) : null
  const parceiro = parceiroId ? atletaPorId.get(parceiroId) : null
  const chaveFinal = `campeonato:${slug}:final:${eu.id}`
  const [contato, setContato] = useState(null)
  const [pedindo, setPedindo] = useState(false)
  const [final, setFinal] = useState('')
  const [carregando, setCarregando] = useState(false)

  // Se este aparelho já confirmou os dígitos antes, busca o contato sozinho.
  useEffect(() => {
    if (!revelada || !parceiroId) return
    let salvo
    try { salvo = localStorage.getItem(chaveFinal) } catch { salvo = null }
    if (!salvo) return
    let vivo = true
    supabase.rpc('campeonato_contato_parceiro', { p_atleta_id: eu.id, p_final: salvo }).then(({ data, error }) => {
      if (vivo && !error && data?.[0]) setContato(data[0])
    })
    return () => { vivo = false }
  }, [revelada, parceiroId, eu.id, chaveFinal])

  if (!revelada || !parceiro) return null

  const buscar = async () => {
    setCarregando(true)
    const { data, error } = await supabase.rpc('campeonato_contato_parceiro', { p_atleta_id: eu.id, p_final: final })
    setCarregando(false)
    if (error) return toast.error(error.message)
    try { localStorage.setItem(chaveFinal, final) } catch { /* sem armazenamento: pede de novo na próxima */ }
    setContato(data?.[0] || { nome: parceiro.nome, telefone: null })
    setPedindo(false)
  }

  const primeiro = parceiro.nome.split(' ')[0]
  const mensagem = `Oi ${primeiro}! Sou ${eu.nome.split(' ')[0]}, sua dupla no ${campeonato.nome}. Vamos nos encontrar para conversar antes do nosso jogo? Onde você está?`
  const tel = contato?.telefone ? String(contato.telefone).replace(/\D/g, '') : null
  const verde = 'rgb(37, 211, 102)' // verde do WhatsApp (cor de marca de terceiro)

  return (
    <div className="cp-entrar" style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: `1px solid ${COR_DESTAQUE}`, background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand-lima) 14%, var(--color-surface-dark-raised)), var(--color-surface-dark-raised))' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2.5px', color: COR_DESTAQUE }}>SUA DUPLA · Nº {minha.numero}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <Avatar atleta={parceiro} tamanho={72} destaque />
        <div style={{ minWidth: 0 }}>
          <div className="cp-display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>{parceiro.nome}</div>
          {tel && <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)', marginTop: 4 }}>{formatarTelefone(tel)}</div>}
        </div>
      </div>

      {tel ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <a href={`https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer" style={{ flex: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, backgroundColor: verde, color: 'var(--color-brand-verde-court)', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
            <MessageCircle size={18} />Chamar no WhatsApp
          </a>
          <a href={`tel:+${tel}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 12, border: '1px solid var(--color-border-dark)', color: 'var(--color-text-dark-primary)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            <Phone size={16} />Ligar
          </a>
        </div>
      ) : contato ? (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-dark-secondary)' }}>O telefone de {primeiro} não está no cadastro. Procure a mesa do torneio.</div>
      ) : pedindo ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} />Para proteger os contatos, digite os 4 últimos dígitos do SEU telefone da inscrição.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={final} onChange={e => setFinal(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="0000" autoFocus
              style={{ width: 110, boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 20, letterSpacing: '6px', textAlign: 'center', outline: 'none' }} />
            <button onClick={buscar} disabled={final.length < 4 || carregando} style={{ ...botaoPrincipal, flex: 1, width: 'auto', opacity: final.length < 4 || carregando ? 0.5 : 1 }}>{carregando ? 'Conferindo...' : 'Ver contato'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setPedindo(true)} style={{ ...botaoPrincipal, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <MessageCircle size={18} />Ver contato de {primeiro} para combinar
        </button>
      )}
    </div>
  )
}

// ---------- foto ----------

function BotaoFoto({ atleta, onEnviada, rotulo = 'Enviar minha foto' }) {
  const ref = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const escolher = (e) => {
    const arq = e.target.files?.[0]
    e.target.value = ''
    if (arq) setArquivo(arq)
  }
  // Depois do ajuste no editor (rosto no círculo), envia a foto recortada.
  const enviar = async (foto) => {
    setEnviando(true)
    try {
      const { error } = await supabase.rpc('campeonato_salvar_foto', { p_atleta_id: atleta.id, p_foto: foto, p_token: tokenDoAparelho() })
      if (error) throw error
      toast.success('Foto enviada!')
      setArquivo(null)
      onEnviada?.()
    } catch (err) {
      toast.error(err.message || 'Não foi possível enviar a foto')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <>
      {arquivo && <EditorFoto arquivo={arquivo} salvando={enviando} onCancelar={() => setArquivo(null)} onConfirmar={enviar} />}
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
