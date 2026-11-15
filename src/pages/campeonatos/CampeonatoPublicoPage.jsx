import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, BookOpen, CalendarClock, Camera, Check, Clock, GitBranch, Hash, ImageIcon, MapPin, MessageCircle, Plus, Radio, Scale, Search, Shuffle, Star, Swords, Timer, Trophy, UserRound, Users, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCampeonato } from '../../hooks/useCampeonato'
import { nomeCurto, normalizar, ordenarJogos, rotuloFaseCurto, primeiroNome, origemDaVaga } from '../../lib/campeonato'
import { EditorFoto } from './EditorFoto'
import { Marcas, Avatar, AvataresDupla, CartaoJogo, Chave, ChaveCelular, SorteioAoVivo, TempoJogo } from './componentes'
import { COR_DESTAQUE, jogoTemSeguido, duplasOcultas, proximosPorQuadra } from './util'

// Link público do campeonato (QR code no telão). Sem login. O associado escolhe o próprio nome
// (autocomplete com os inscritos) e manda uma foto. Os jogos dele aparecem em destaque. Tudo ao
// vivo. (A opção de "seguir" outros atletas foi tirada em 14/11 a pedido: confundia.)

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
  { id: 'regras', label: 'Regras', icon: BookOpen },
  { id: 'eu', label: 'Eu', icon: UserRound },
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

  // Só a própria pessoa fica em destaque (nada de seguir outros nomes).
  const seguindo = useMemo(() => new Set(prefs?.eu ? [prefs.eu] : []), [prefs])

  if (carregando) return <div className="cp-fundo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Marcas altura={34} /></div>
  if (erro || !campeonato) return <div className="cp-fundo" style={{ padding: 40, textAlign: 'center' }}>{erro || 'Campeonato não encontrado'}</div>

  // Sorteio "ao vivo" só enquanto ainda falta revelar dupla. Revelada a última, o celular já libera
  // tudo (Sua dupla, WhatsApp, jogos), mesmo antes de a mesa publicar a chave.
  const emSorteio = campeonato.status === 'sorteio' && (!duplas.length || (campeonato.sorteio_revelados || 0) < duplas.length)

  return (
    <div ref={rolagem} className="cp-fundo cp-rolagem" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <Cabecalho campeonato={campeonato} seguindo={seguindo} atletaPorId={atletaPorId} onEditar={() => setAba('eu')} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '0 14px' }}>
        {campeonato.status === 'inscricoes' && (aba === 'jogos' || aba === 'duplas') && <AvisoSorteio campeonato={campeonato} />}

        {campeonato.status === 'inscricoes' && prefs?.eu && atletaPorId.get(prefs.eu) && (aba === 'jogos' || aba === 'eu') && (
          <CardCheckin atleta={atletaPorId.get(prefs.eu)} onMudou={dados.recarregar} />
        )}

        {!emSorteio && prefs?.eu && atletaPorId.get(prefs.eu) && aba !== 'eu' && (
          <AvisoMeuJogo campeonato={campeonato} eu={atletaPorId.get(prefs.eu)} duplas={duplas} jogos={jogos} />
        )}

        {!emSorteio && prefs?.eu && atletaPorId.get(prefs.eu) && aba !== 'chave' && (
          <CardParceiro campeonato={campeonato} eu={atletaPorId.get(prefs.eu)} duplas={duplas} atletaPorId={atletaPorId} slug={slug} />
        )}

        {/* Durante o sorteio, a tela (menos a aba "Eu") vira o sorteio ao vivo. */}
        {emSorteio && aba !== 'eu' && aba !== 'regras' && (
          <SorteioCelular campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} seguindo={seguindo} eu={prefs?.eu} irParaTopo={irParaTopo} />
        )}
        {!emSorteio && aba === 'jogos' && <AbaJogos dados={dados} seguindo={seguindo} />}
        {!emSorteio && aba === 'chave' && (
          <AbaChave campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={seguindo} />
        )}
        {!emSorteio && aba === 'duplas' && (
          duplas.length
            ? <SorteioAoVivo campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} seguindo={seguindo} colunas={1} escala={0.95} />
            : <ListaInscritos atletas={atletas} seguindo={seguindo} />
        )}
        {aba === 'regras' && <AbaRegras campeonato={campeonato} />}
        {aba === 'eu' && (
          <AbaEu campeonato={campeonato} atletas={atletas} atletaPorId={atletaPorId} duplas={duplas} duplaPorId={duplaPorId} jogos={jogos} prefs={prefs} salvarPrefs={salvarPrefs} />
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
        <Onboarding campeonato={campeonato} atletas={atletas} atletaPorId={atletaPorId} slug={slug}
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
      toast(`${primeiroNome(quem?.nome) || 'Quem você segue'} já tem dupla!`, { icon: '⭐', duration: 3500 })
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
                <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Você & {primeiroNome(parceiroDe(minhaVisivel)?.nome) || 'A definir'}</div>
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
      {[...seguindo].map(id => atletaPorId.get(id)).filter(Boolean).slice(0, 1).map(eu => (
        <button key={eu.id} onClick={onEditar} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '5px 10px 5px 5px', borderRadius: 999, border: `1px solid ${COR_DESTAQUE}`, background: 'color-mix(in srgb, var(--color-brand-lima) 10%, transparent)', color: COR_DESTAQUE, cursor: 'pointer' }}>
          <Avatar atleta={eu} tamanho={22} destaque />
          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(eu.nome)}</span>
        </button>
      ))}
    </header>
  )
}

// Aba Chave: a chave completa espelhada (igual ao telão, em pé) ou uma fase por vez.
function AbaChave({ campeonato, jogos, duplas, duplaPorId, seguindo }) {
  const [modo, setModo] = useState('completa')
  const proximos = proximosPorQuadra(campeonato, jogos)
  return (
    <Secao titulo="Chaveamento" extra={(
      <span style={{ display: 'inline-flex', padding: 2, borderRadius: 999, border: '1px solid var(--color-border-dark)' }}>
        {[['completa', 'Completa'], ['fase', 'Por fase']].map(([v, t]) => (
          <button key={v} onClick={() => setModo(v)} style={{ padding: '5px 11px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, backgroundColor: modo === v ? 'var(--color-brand-lima)' : 'transparent', color: modo === v ? 'var(--color-brand-verde-court)' : 'var(--color-text-dark-secondary)' }}>{t}</button>
        ))}
      </span>
    )}>
      {modo === 'completa'
        ? <ChaveCelular campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={seguindo} proximos={proximos} />
        : <Chave campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={seguindo} porRodada proximos={proximos} />}
    </Secao>
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
  // Programação completa: todos os jogos ainda por jogar, já com horário e quadra (os das
  // próximas fases mostram de onde vem a dupla: "Vencedor do jogo 3").
  const proximos = ordenados.filter(j => j.status === 'agendado')
  const resultados = ordenados.filter(j => ['finalizado', 'wo'].includes(j.status)).sort((a, b) => String(b.finalizado_em).localeCompare(String(a.finalizado_em)))
  const meus = ordenados.filter(j => jogoTemSeguido(j, duplaPorId, seguindo))
  const cartao = j => <CartaoJogo key={j.id} jogo={j} duplaPorId={duplaPorId} seguindo={seguindo} numero={j.ordem || null} dataTorneio={campeonato.data} jogos={jogos} />

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
        <Secao titulo="Seus jogos" icone={Star}>
          <div style={{ display: 'grid', gap: 10 }}>{meus.filter(j => j.status !== 'finalizado' && j.status !== 'wo').map(cartao)}</div>
          {meus.every(j => ['finalizado', 'wo'].includes(j.status)) && <div style={{ fontSize: 13, color: 'var(--color-text-dark-muted)', padding: '4px 2px' }}>Sem jogos pendentes. Veja os resultados abaixo.</div>}
        </Secao>
      )}
      <Secao titulo="Ao vivo agora" icone={Radio}>
        {aoVivo.length ? <div style={{ display: 'grid', gap: 10 }}>{aoVivo.map(cartao)}</div> : <Vazio texto="Nenhum jogo em quadra neste momento." />}
      </Secao>
      <Secao titulo="Ordem de jogos" icone={CalendarClock}>
        {proximos.length ? <div style={{ display: 'grid', gap: 10 }}>{proximos.map(cartao)}</div> : <Vazio texto="Nenhum jogo na fila." />}
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
  const [pedindoTel, setPedindoTel] = useState(false)
  const primeiro = primeiroNome(atleta.nome)
  const marcar = async (presente) => {
    setSalvando(true)
    const { error } = await supabase.rpc('campeonato_checkin', { p_atleta_id: atleta.id, p_presente: presente })
    setSalvando(false)
    if (error) return toast.error(error.message)
    if (presente) toast.success('Check-in feito! Seu nome já acendeu no telão.')
    setPedindoTel(false)
    onMudou?.()
  }
  // Antes do check-in, se a pessoa não tem WhatsApp no cadastro do torneio, pede (a dupla dela
  // usa para chamar). Se a função do banco não existir ou falhar, segue direto para o check-in.
  const cheguei = async () => {
    setSalvando(true)
    const { data, error } = await supabase.rpc('campeonato_tem_telefone', { p_atleta_id: atleta.id })
    setSalvando(false)
    if (!error && data === false) return setPedindoTel(true)
    marcar(true)
  }
  const salvarTelefone = async (telefone) => {
    setSalvando(true)
    const { error } = await gravarTelefone(atleta.id, telefone)
    setSalvando(false)
    if (error) return toast.error(error.message)
    toast.success('WhatsApp salvo!')
    marcar(true)
  }
  if (pedindoTel && !atleta.presente) {
    return <FormTelefone primeiro={primeiro} salvando={salvando} onSalvar={salvarTelefone} onPular={() => marcar(true)} />
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
      <button onClick={cheguei} disabled={salvando} style={{ ...botaoPrincipal, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? 'Confirmando...' : 'Cheguei! Fazer meu check-in'}
      </button>
    </div>
  )
}

const PAISES = [
  ['55', '🇧🇷 Brasil +55'], ['1', '🇺🇸 EUA / Canadá +1'], ['351', '🇵🇹 Portugal +351'], ['54', '🇦🇷 Argentina +54'],
  ['598', '🇺🇾 Uruguai +598'], ['595', '🇵🇾 Paraguai +595'], ['56', '🇨🇱 Chile +56'], ['34', '🇪🇸 Espanha +34'],
  ['39', '🇮🇹 Itália +39'], ['33', '🇫🇷 França +33'], ['49', '🇩🇪 Alemanha +49'], ['44', '🇬🇧 Reino Unido +44'],
  ['972', '🇮🇱 Israel +972'], ['outro', 'Outro país'],
]

// WhatsApp em 3 partes: país (Brasil já escolhido), DDD e número. Fora do Brasil, número completo
// com código de área. Grava só dígitos com o código do país (ex.: 5511999998888), que é o formato
// do link wa.me.
function FormTelefone({ primeiro, salvando, onSalvar, onPular, titulo, texto, textoBotao = 'Salvar e fazer meu check-in', textoPular = 'Não tenho WhatsApp, só fazer o check-in' }) {
  const [pais, setPais] = useState('55')
  const [outroCodigo, setOutroCodigo] = useState('')
  const [ddd, setDdd] = useState('')
  const [numero, setNumero] = useState('')
  const br = pais === '55'
  const codigo = pais === 'outro' ? outroCodigo : pais
  const valido = br ? ddd.length === 2 && (numero.length === 8 || numero.length === 9) : codigo.length >= 1 && numero.length >= 6
  const campo = { boxSizing: 'border-box', padding: '13px 12px', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 17, outline: 'none', minWidth: 0 }
  const rotulo = t => <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: 'var(--color-text-dark-secondary)', marginBottom: 5, textTransform: 'uppercase' }}>{t}</div>
  return (
    <div className="cp-entrar" style={{ marginBottom: 16, padding: 16, borderRadius: 16, border: '1px solid var(--color-brand-saibro)', backgroundColor: 'color-mix(in srgb, var(--color-brand-saibro) 14%, var(--color-surface-dark-raised))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}><MessageCircle size={18} />{titulo || `Qual é o seu WhatsApp, ${primeiro}?`}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', margin: '4px 0 14px', lineHeight: 1.5 }}>{texto || 'Assim que sair o sorteio, sua dupla te chama por ele para vocês combinarem o jogo. 🎾'}</div>
      <div style={{ marginBottom: 10 }}>
        {rotulo('País')}
        <select value={pais} onChange={e => setPais(e.target.value)} style={{ ...campo, width: '100%' }}>
          {PAISES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {pais === 'outro' && (
          <div style={{ width: 86 }}>
            {rotulo('Código')}
            <input value={outroCodigo} onChange={e => setOutroCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="+" style={{ ...campo, width: '100%' }} />
          </div>
        )}
        {br && (
          <div style={{ width: 76 }}>
            {rotulo('DDD')}
            <input value={ddd} onChange={e => setDdd(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="11" style={{ ...campo, width: '100%', textAlign: 'center' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {rotulo(br ? 'Número' : 'Número com código de área')}
          <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, br ? 9 : 13))} inputMode="numeric" placeholder={br ? '99999-9999' : ''} style={{ ...campo, width: '100%' }} />
        </div>
      </div>
      <button onClick={() => onSalvar(br ? `55${ddd}${numero}` : `${codigo}${numero}`)} disabled={!valido || salvando} style={{ ...botaoPrincipal, marginTop: 14, opacity: !valido || salvando ? 0.5 : 1 }}>
        {salvando ? 'Salvando...' : textoBotao}
      </button>
      <button onClick={onPular} disabled={salvando} style={{ ...botaoTexto, marginTop: 10, fontSize: 13 }}>{textoPular}</button>
    </div>
  )
}

// ---------- aviso "é a sua vez" ----------

// Para quem está jogando: aviso grande e fixo no topo quando o jogo dele é o PRÓXIMO de uma quadra
// (o celular vibra na hora que vira), cartão quando está em quadra, e uma linha discreta com o
// próximo jogo e quantos faltam antes dele.
function AvisoMeuJogo({ campeonato, eu, duplas, jogos }) {
  const minha = duplas.find(d => d.atleta1_id === eu.id || d.atleta2_id === eu.id)
  const proximos = proximosPorQuadra(campeonato, jogos)
  const meus = minha ? jogos.filter(j => j.status !== 'bye' && (j.dupla_a_id === minha.id || j.dupla_b_id === minha.id)) : []
  const aoVivo = meus.find(j => j.status === 'ao_vivo')
  const chamado = !aoVivo ? meus.find(j => proximos.has(j.id)) : null
  const quadraChamada = chamado ? proximos.get(chamado.id) : null
  const seguinte = !aoVivo && !chamado ? meus.filter(j => j.status === 'agendado').sort((a, b) => (a.ordem || 999) - (b.ordem || 999))[0] : null
  const antes = seguinte ? jogos.filter(j => j.status === 'agendado' && (j.ordem || 999) < (seguinte.ordem || 999)).length : 0

  const chamadoId = chamado?.id
  useEffect(() => {
    if (!chamadoId) return
    try { navigator.vibrate?.([400, 150, 400, 150, 400]) } catch { /* sem vibração */ }
  }, [chamadoId])

  if (!minha || (campeonato.status === 'sorteio' && (campeonato.sorteio_revelados || 0) < duplas.length)) return null
  if (chamado) {
    return (
      <div className="cp-entrar" style={{ position: 'sticky', top: 8, zIndex: 16, marginBottom: 16, padding: '18px 16px', borderRadius: 20, textAlign: 'center', border: '2px solid var(--color-brand-lima)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand-lima) 30%, var(--color-surface-dark-raised)), var(--color-surface-dark-raised))', boxShadow: '0 10px 30px color-mix(in srgb, var(--color-surface-dark-base) 70%, transparent)' }}>
        <div className="cp-pulso" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '3px', color: COR_DESTAQUE }}>🎾 FIQUE ATENTO, {primeiroNome(eu.nome).toUpperCase()}!</div>
        <div className="cp-display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, margin: '6px 0 2px' }}>O próximo jogo da</div>
        <div className="cp-display" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.05, color: COR_DESTAQUE }}>{quadraChamada}</div>
        <div className="cp-display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>é o seu!</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)', marginTop: 8, lineHeight: 1.5 }}>Jogo {chamado.ordem} · {rotuloFaseCurto(chamado.fase)}. Vá para perto da quadra e se aqueça: assim que ela liberar, a mesa chama vocês.</div>
      </div>
    )
  }
  if (aoVivo) {
    return (
      <div className="cp-entrar cp-ao-vivo" style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 18, border: '2px solid var(--color-accent-live)', backgroundColor: 'color-mix(in srgb, var(--color-accent-live) 18%, var(--color-surface-dark-raised))', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="cp-pulso" style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--color-accent-live)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: 'var(--color-text-dark-secondary)' }}>VOCÊ ESTÁ EM QUADRA</div>
          <div className="cp-display" style={{ fontSize: 24, fontWeight: 700 }}>{aoVivo.quadra} · Jogo {aoVivo.ordem}</div>
        </div>
        <TempoJogo jogo={aoVivo} dataTorneio={campeonato.data} tamanho={16} rotulo={false} />
      </div>
    )
  }
  if (seguinte) {
    return (
      <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 16, border: `1px solid ${COR_DESTAQUE}`, backgroundColor: 'var(--color-surface-dark-raised)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <CalendarClock size={22} color="var(--color-brand-lima)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4 }}>
          <b>Seu próximo jogo: Jogo {seguinte.ordem}</b>{seguinte.quadra ? ` · ${seguinte.quadra}` : ''}{seguinte.horario ? ` · previsto ${seguinte.horario}` : ''}
          <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)' }}>{antes === 0 ? 'Você é o próximo da fila.' : antes === 1 ? 'Falta 1 jogo antes do seu.' : `Faltam ${antes} jogos antes do seu.`}</div>
        </div>
      </div>
    )
  }
  return null
}

// ---------- sua dupla (contato do parceiro) ----------

// Assim que a dupla é revelada no sorteio: foto e nome do parceiro e o botão do WhatsApp, que já
// abre a conversa com uma mensagem pronta. Sem PIN (tirado em 14/11 a pedido). O telefone vem de
// uma função do banco que só entrega o contato do PRÓPRIO parceiro, e só depois da revelação.
function CardParceiro({ campeonato, eu, duplas, atletaPorId }) {
  const minha = duplas.find(d => d.atleta1_id === eu.id || d.atleta2_id === eu.id)
  const revelada = !!minha && !(campeonato.status === 'sorteio' && minha.numero > (campeonato.sorteio_revelados || 0))
  const parceiroId = minha ? (minha.atleta1_id === eu.id ? minha.atleta2_id : minha.atleta1_id) : null
  const parceiro = parceiroId ? atletaPorId.get(parceiroId) : null
  const [contato, setContato] = useState({ id: null, telefone: null, buscado: false })

  useEffect(() => {
    if (!revelada || !parceiroId) return
    let vivo = true
    supabase.rpc('campeonato_contato_parceiro', { p_atleta_id: eu.id, p_final: null }).then(({ data, error }) => {
      if (vivo) setContato({ id: parceiroId, telefone: !error && data?.[0]?.telefone ? String(data[0].telefone).replace(/\D/g, '') : null, buscado: true })
    })
    return () => { vivo = false }
  }, [revelada, parceiroId, eu.id])

  if (!revelada) return null
  if (!parceiro) {
    return (
      <div className="cp-entrar" style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--color-state-warning)', backgroundColor: 'color-mix(in srgb, var(--color-state-warning) 12%, var(--color-surface-dark-raised))' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2.5px', color: 'var(--color-state-warning)' }}>SUA DUPLA · Nº {minha.numero}</div>
        <div className="cp-display" style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 4px' }}>Seu par será definido pela organização</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', lineHeight: 1.5 }}>O número de inscritos ficou ímpar. Seu jogo é o último da 1ª rodada, e a organização vai convidar alguém para completar sua dupla. Assim que definirem, o nome aparece aqui.</div>
      </div>
    )
  }

  const primeiro = primeiroNome(parceiro.nome)
  const meuPrimeiro = primeiroNome(eu.nome)
  const mensagem = `Olá, ${primeiro}! 🎾 Sou ${meuPrimeiro}, sua dupla no ${campeonato.nome}. Bora combinar antes do nosso jogo? Esse é o meu contato. Até já na quadra!`
  const tel = contato.id === parceiroId ? contato.telefone : null
  const verde = 'rgb(37, 211, 102)' // verde do WhatsApp (cor de marca de terceiro)

  return (
    <div className="cp-entrar" style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: `1px solid ${COR_DESTAQUE}`, background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand-lima) 14%, var(--color-surface-dark-raised)), var(--color-surface-dark-raised))' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2.5px', color: COR_DESTAQUE }}>🎾 SUA DUPLA · Nº {minha.numero}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <Avatar atleta={parceiro} tamanho={76} destaque />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-dark-secondary)' }}>Você joga com</div>
          <div className="cp-display" style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15 }}>{parceiro.nome}</div>
        </div>
      </div>

      {tel ? (
        <a href={`https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', borderRadius: 14, backgroundColor: verde, color: 'var(--color-brand-verde-court)', fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
          <MessageCircle size={20} />Chamar {primeiro} no WhatsApp
        </a>
      ) : contato.buscado && contato.id === parceiroId ? (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-dark-secondary)', lineHeight: 1.5 }}>O WhatsApp de {primeiro} não está no cadastro do torneio. Procure a mesa da organização para se encontrarem.</div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-dark-muted)' }}>Carregando contato...</div>
      )}
    </div>
  )
}

// ---------- foto ----------

// Dois caminhos explícitos: câmera na hora (capture="user" abre direto a câmera frontal) ou
// galeria. O arquivo é copiado para a memória NA HORA em que volta da câmera: em alguns Android a
// foto recém-tirada vem como um link temporário que deixa de poder ser lido logo depois (era o
// motivo de "da câmera não funciona, da galeria funciona").
function BotaoFoto({ atleta, onEnviada, rotulo = 'Tirar foto agora', antesDeAbrir }) {
  const camera = useRef(null)
  const galeria = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const escolher = async (e) => {
    const input = e.target
    const arq = input.files?.[0]
    if (!arq) return
    setLendo(true)
    try {
      const copia = new Blob([await arq.arrayBuffer()], { type: arq.type || 'image/jpeg' })
      setArquivo(copia)
    } catch {
      toast.error('Não consegui ler a foto. Tente de novo.')
    } finally {
      input.value = ''
      setLendo(false)
    }
  }
  const abrir = (ref) => {
    antesDeAbrir?.()
    ref.current?.click()
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
  const ocupado = enviando || lendo
  return (
    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {arquivo && <EditorFoto arquivo={arquivo} salvando={enviando} onCancelar={() => setArquivo(null)} onConfirmar={enviar} />}
      <input ref={camera} type="file" accept="image/*" capture="user" onChange={escolher} style={{ display: 'none' }} />
      <input ref={galeria} type="file" accept="image/*" onChange={escolher} style={{ display: 'none' }} />
      <button onClick={() => abrir(camera)} disabled={ocupado} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 12, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: ocupado ? 0.6 : 1 }}>
        <Camera size={18} />{enviando ? 'Enviando...' : lendo ? 'Abrindo foto...' : rotulo}
      </button>
      <button onClick={() => abrir(galeria)} disabled={ocupado} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent', color: 'var(--color-text-dark-primary)', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: ocupado ? 0.6 : 1 }}>
        <ImageIcon size={18} />Da galeria
      </button>
    </span>
  )
}

// ---------- primeiro acesso ----------

// Primeiro acesso: quem é você -> foto -> pronto. O nome escolhido fica guardado antes de abrir a
// câmera: se o celular recarregar a página ao voltar da câmera (comum em Android com pouca
// memória), a pessoa volta direto para o passo da foto em vez de recomeçar.
function Onboarding({ campeonato, atletas, atletaPorId, slug, onConcluir }) {
  const chavePendente = `campeonato:${slug}:pendente`
  const [eu, setEu] = useState(() => {
    try { return localStorage.getItem(chavePendente) || null } catch { return null }
  })
  const euAtual = eu ? atletaPorId.get(eu) : null
  const passo = euAtual ? 'foto' : 'quem'
  const guardar = id => {
    setEu(id)
    try { if (id) localStorage.setItem(chavePendente, id); else localStorage.removeItem(chavePendente) } catch { /* sem armazenamento */ }
  }
  const concluir = id => {
    try { localStorage.removeItem(chavePendente) } catch { /* sem armazenamento */ }
    onConcluir({ eu: id, seguindo: [] })
  }

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
            <BuscaAtleta atletas={atletas} autoFocus onEscolher={a => guardar(a.id)} />
            <button onClick={() => concluir(null)} style={botaoTexto}>Não estou jogando, só vou acompanhar</button>
          </>
        )}

        {passo === 'foto' && euAtual && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Avatar atleta={euAtual} tamanho={110} destaque /></div>
            <div className="cp-display" style={{ fontSize: 22, fontWeight: 700 }}>Olá, {primeiroNome(euAtual.nome)}!</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)', margin: '6px 0 18px', lineHeight: 1.5 }}>Coloque uma foto sua. Ela aparece na chave, no telão e no sorteio das duplas.</div>
            <BotaoFoto atleta={euAtual} rotulo={euAtual.foto ? 'Tirar outra foto' : 'Tirar foto agora'} onEnviada={() => concluir(euAtual.id)} />
            <div><button onClick={() => concluir(euAtual.id)} style={botaoTexto}>{euAtual.foto ? 'Continuar' : 'Agora não'}</button></div>
            <div><button onClick={() => guardar(null)} style={{ ...botaoTexto, marginTop: 4, fontSize: 13 }}>Não sou {primeiroNome(euAtual.nome)}</button></div>
          </div>
        )}
      </div>
    </div>
  )
}


const botaoTexto = { marginTop: 16, background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', fontSize: 14, textDecoration: 'underline', cursor: 'pointer', width: '100%' }
const botaoPrincipal = { width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }

// ---------- aba "Eu" ----------

// Grava o WhatsApp pelo link público. Usa a função nova (aparelho "dono" pode editar); se ela ainda
// não existir no banco, cai na antiga, que só cadastra quem ainda não tem telefone.
async function gravarTelefone(atletaId, telefone) {
  const r = await supabase.rpc('campeonato_editar_telefone', { p_atleta_id: atletaId, p_telefone: telefone, p_token: tokenDoAparelho() })
  if (!r.error || !/function|schema cache|PGRST202/i.test(`${r.error.message} ${r.error.code}`)) return r
  return supabase.rpc('campeonato_salvar_telefone', { p_atleta_id: atletaId, p_telefone: telefone })
}

function AbaEu({ campeonato, atletas, atletaPorId, duplas, duplaPorId, jogos, prefs, salvarPrefs }) {
  const p = prefs || { eu: null, seguindo: [] }
  const eu = p.eu ? atletaPorId.get(p.eu) : null
  if (!eu) {
    return (
      <Secao titulo="Você" icone={UserRound}>
        <BuscaAtleta atletas={atletas} placeholder="Se você está jogando, busque seu nome" onEscolher={a => salvarPrefs({ eu: a.id, seguindo: [] })} />
      </Secao>
    )
  }
  return (
    <>
      <Secao titulo="Você" icone={UserRound}>
        <div style={{ padding: 14, borderRadius: 16, backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${COR_DESTAQUE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar atleta={eu} tamanho={64} destaque />
            <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700 }}>{eu.nome}</div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <BotaoFoto atleta={eu} rotulo={eu.foto ? 'Tirar outra foto' : 'Tirar foto agora'} />
            <button onClick={() => salvarPrefs({ eu: null, seguindo: [] })} style={{ ...botaoTexto, marginTop: 0, width: 'auto' }}>Não sou eu</button>
          </div>
        </div>
      </Secao>
      <MeuTelefone eu={eu} />
      <MeuHistorico campeonato={campeonato} eu={eu} duplas={duplas} duplaPorId={duplaPorId} jogos={jogos} />
    </>
  )
}

// WhatsApp da pessoa: só o final do número aparece (privacidade). "Editar" abre o mesmo formulário
// do check-in. Só o aparelho que cadastrou consegue trocar; os outros veem "fale com a mesa".
function MeuTelefone({ eu }) {
  const [info, setInfo] = useState(null)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    let vivo = true
    supabase.rpc('campeonato_meu_telefone', { p_atleta_id: eu.id, p_token: tokenDoAparelho() }).then(({ data, error }) => {
      if (vivo) setInfo(error ? { erro: true } : (data?.[0] || { final: null, pode_editar: true }))
    })
    return () => { vivo = false }
  }, [eu.id, versao])

  const salvar = async (tel) => {
    setSalvando(true)
    const { error } = await gravarTelefone(eu.id, tel)
    setSalvando(false)
    if (error) return toast.error(error.message)
    toast.success('WhatsApp atualizado!')
    setEditando(false)
    setVersao(v => v + 1)
  }

  if (editando) {
    return (
      <Secao titulo="Seu WhatsApp" icone={MessageCircle}>
        <FormTelefone primeiro={primeiroNome(eu.nome)} salvando={salvando} onSalvar={salvar} onPular={() => setEditando(false)}
          titulo="Novo WhatsApp" texto="É por ele que sua dupla te chama para combinar o jogo. 🎾" textoBotao="Salvar WhatsApp" textoPular="Cancelar" />
      </Secao>
    )
  }
  const podeEditar = info && !info.erro && info.pode_editar
  let conteudo
  if (!info) conteudo = <span style={{ color: 'var(--color-text-dark-muted)' }}>Carregando...</span>
  else if (info.erro) conteudo = <span style={{ color: 'var(--color-text-dark-secondary)' }}>Para ver ou trocar seu WhatsApp, fale com a mesa do torneio.</span>
  else if (info.final) conteudo = <><b>Cadastrado</b> <span style={{ color: 'var(--color-text-dark-secondary)' }}>· final {info.final}</span></>
  else conteudo = <span style={{ color: 'var(--color-state-warning)', fontWeight: 700 }}>Nenhum WhatsApp cadastrado. Sua dupla não vai conseguir te chamar.</span>
  return (
    <Secao titulo="Seu WhatsApp" icone={MessageCircle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4 }}>
          {conteudo}
          {info && !info.erro && !info.pode_editar && <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginTop: 2 }}>Cadastrado por outro celular. Para trocar, fale com a mesa.</div>}
        </div>
        {podeEditar && (
          <button onClick={() => setEditando(true)} style={{ flexShrink: 0, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent', color: 'var(--color-text-dark-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {info.final ? 'Editar' : 'Cadastrar'}
          </button>
        )}
      </div>
    </Secao>
  )
}

// Jogos da pessoa no torneio: vitória em verde, derrota em vermelho, e o que ainda vem pela frente.
function MeuHistorico({ campeonato, eu, duplas, duplaPorId, jogos }) {
  const minha = duplas.find(d => d.atleta1_id === eu.id || d.atleta2_id === eu.id)
  if (!minha || (campeonato.status === 'sorteio' && minha.numero > (campeonato.sorteio_revelados || 0))) return null
  const meus = jogos
    .filter(j => j.status !== 'bye' && (j.dupla_a_id === minha.id || j.dupla_b_id === minha.id))
    .sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const encerrados = meus.filter(j => ['finalizado', 'wo'].includes(j.status) && j.vencedor_id)
  const vitorias = encerrados.filter(j => j.vencedor_id === minha.id).length
  const derrotas = encerrados.length - vitorias
  const verde = 'var(--color-state-success)'
  const vermelho = 'var(--color-state-danger)'
  const placar = encerrados.length > 0 && (
    <span style={{ fontSize: 12, fontWeight: 800 }}>
      <span style={{ color: verde, filter: 'brightness(1.4)' }}>{vitorias}V</span>
      <span style={{ color: 'var(--color-text-dark-muted)' }}> · </span>
      <span style={{ color: vermelho, filter: 'brightness(1.4)' }}>{derrotas}D</span>
    </span>
  )
  return (
    <Secao titulo="Seus jogos no torneio" icone={Star} extra={placar}>
      {!meus.length && <Vazio texto="Seus jogos aparecem aqui depois do sorteio." />}
      <div style={{ display: 'grid', gap: 10 }}>
        {meus.map(j => {
          const encerrado = ['finalizado', 'wo'].includes(j.status) && !!j.vencedor_id
          const venceu = encerrado && j.vencedor_id === minha.id
          const lado = j.dupla_a_id === minha.id ? 'a' : 'b'
          const outro = lado === 'a' ? 'b' : 'a'
          const adv = duplaPorId.get(j[`dupla_${outro}_id`])
          const aoVivo = j.status === 'ao_vivo'
          const cor = !encerrado ? (aoVivo ? 'var(--color-accent-live)' : 'var(--color-border-dark)') : venceu ? verde : vermelho
          let selo = aoVivo ? 'EM JOGO' : 'PRÓXIMO'
          if (encerrado) selo = `${venceu ? 'VITÓRIA' : 'DERROTA'}${j.status === 'wo' ? ' (W.O.)' : ''}`
          return (
            <div key={j.id} style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${cor}`, backgroundColor: encerrado ? `color-mix(in srgb, ${cor} 13%, var(--color-surface-dark-raised))` : 'var(--color-surface-dark-raised)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', backgroundColor: encerrado || aoVivo ? cor : 'var(--color-surface-dark-overlay)', color: encerrado || aoVivo ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-secondary)' }}>
                <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '1.5px' }}>{selo}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, opacity: 0.9, textAlign: 'right' }}>
                  {rotuloFaseCurto(j.fase)} · Jogo {j.ordem}{j.quadra ? ` · ${j.quadra}` : ''}{!encerrado && j.horario ? ` · previsto ${j.horario}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                {adv ? <AvataresDupla dupla={adv} tamanho={34} /> : null}
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-dark-muted)', fontWeight: 700 }}>CONTRA</div>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {adv ? `${nomeCurto(adv.atleta1?.nome)} & ${nomeCurto(adv.atleta2?.nome)}` : (origemDaVaga(j, outro, jogos) || 'A definir')}
                  </div>
                </div>
                {(j.sets || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {j.sets.map((s, i) => {
                      const meu = Number(s[lado]) || 0
                      const dele = Number(s[outro]) || 0
                      return (
                        <span key={i} style={{ minWidth: 38, textAlign: 'center', padding: 4, borderRadius: 8, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface-dark-overlay)', color: meu > dele ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-secondary)' }}>
                          {meu}-{dele}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Secao>
  )
}

function RegraNumero({ valor, rotulo }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '14px 8px', borderRadius: 16, textAlign: 'center', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
      <div className="cp-display" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: COR_DESTAQUE }}>{valor}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginTop: 6, lineHeight: 1.3 }}>{rotulo}</div>
    </div>
  )
}

function RegraItem({ icone: Icone, titulo, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 14%, transparent)', color: COR_DESTAQUE }}><Icone size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{titulo}</div>
        <div style={{ fontSize: 13.5, color: 'var(--color-text-dark-secondary)', lineHeight: 1.5, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  )
}

// ---------- aba "Regras" ----------

// Resumo do regulamento para ler em 30 segundos: placar em destaque (sets, games, tie-break,
// vantagem) e os pontos práticos de quadra. O texto completo da organização fica no fim.
// A vantagem só aparece se o regulamento falar dela (ex.: "Sem vantagem: ponto decisivo no 40 a 40").
function AbaRegras({ campeonato }) {
  const texto = campeonato.regras || ''
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const acha = re => linhas.find(l => re.test(normalizar(l)))
  const vantagem = acha(/vantagem|ponto decisivo|no-ad|no ad/)
  const aquecimento = acha(/aquecimento/)
  const tolerancia = acha(/tolerancia|w\.?o/)
  const ausencia = acha(/ausencia|suplente/)
  const omissos = acha(/omisso|arbitr/)

  return (
    <>
      <Secao titulo="Como é o placar" icone={Trophy}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <RegraNumero valor="3" rotulo="sets (vence quem ganhar 2)" />
          <RegraNumero valor="4" rotulo="games por set" />
          <RegraNumero valor="7" rotulo="pontos no tie-break" />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <RegraItem icone={Hash} titulo="1º e 2º sets">Até 4 games, com 2 de diferença. Deu 4 a 4? Tie-break até 7 (2 de diferença) e o set fecha em 5 a 4.</RegraItem>
          <RegraItem icone={Zap} titulo="Deu 1 set para cada?">O 3º set é direto um tie-break até 7 pontos (2 de diferença).</RegraItem>
          {vantagem && <RegraItem icone={Scale} titulo="Vantagem">{vantagem}</RegraItem>}
        </div>
      </Secao>

      <Secao titulo="Formato" icone={GitBranch}>
        <div style={{ display: 'grid', gap: 8 }}>
          <RegraItem icone={Shuffle} titulo="Duplas sorteadas na hora">Um homem e uma mulher, sorteados ao vivo entre quem fez check-in.</RegraItem>
          <RegraItem icone={Swords} titulo="Mata-mata">Perdeu, saiu. Quem vence avança na chave até a final{campeonato.disputa_terceiro ? '. Quem perde na semifinal disputa o 3º lugar' : ''}.</RegraItem>
        </div>
      </Secao>

      <Secao titulo="Na quadra" icone={Clock}>
        <div style={{ display: 'grid', gap: 8 }}>
          {aquecimento && <RegraItem icone={Timer} titulo="Aquecimento">{aquecimento}</RegraItem>}
          {tolerancia && <RegraItem icone={AlertTriangle} titulo="Atraso">{tolerancia}</RegraItem>}
          {ausencia && <RegraItem icone={UserRound} titulo="Ausência">{ausencia}</RegraItem>}
          {omissos && <RegraItem icone={MessageCircle} titulo="Dúvidas">{omissos}</RegraItem>}
        </div>
      </Secao>

      {texto && (
        <details style={{ marginBottom: 22, padding: '12px 14px', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Regulamento completo</summary>
          <div style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-dark-secondary)', marginTop: 8 }}>{texto}</div>
        </details>
      )}
    </>
  )
}
