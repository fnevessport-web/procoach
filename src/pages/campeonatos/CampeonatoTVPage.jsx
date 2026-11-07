import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Radio, CalendarClock, Smartphone, Check } from 'lucide-react'
import { useCampeonato } from '../../hooks/useCampeonato'
import { nomeCurto, rotuloFaseCurto, ordenarJogos } from '../../lib/campeonato'
import { Marcas, Avatar, CartaoJogo, Chave, SorteioAoVivo, QrCode, AvataresDupla } from './componentes'
import { urlPublica, duplasOcultas } from './util'

// Telão do clube. Desenhado em 1920x1080 e escalado para caber em qualquer TV.
// Antes do sorteio: boas-vindas + QR code + inscritos. Durante o sorteio: sorteio em tela cheia.
// Depois: quadras em andamento (quadra, fase, duplas, placar), próximos jogos e a chave espelhada.

const L = 1920
const A = 1080

function useEscala() {
  const calc = () => Math.min(window.innerWidth / L, window.innerHeight / A)
  const [s, setS] = useState(calc)
  useEffect(() => {
    const f = () => setS(calc())
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return s
}

function Relogio() {
  const [agora, setAgora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
}

export function CampeonatoTVPage() {
  const { slug } = useParams()
  const escala = useEscala()
  const dados = useCampeonato({ slug })
  const { campeonato, carregando, erro } = dados

  return (
    <div className="cp-fundo" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        width: L, height: A, position: 'absolute', left: '50%', top: '50%',
        transform: `translate(-50%, -50%) scale(${escala})`, transformOrigin: 'center center',
      }}>
        {carregando ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Marcas altura={60} /></div>
        ) : erro || !campeonato ? (
          <div style={{ padding: 80, fontSize: 32 }}>{erro || 'Campeonato não encontrado'}</div>
        ) : campeonato.status === 'inscricoes' ? (
          <TelaBoasVindas dados={dados} />
        ) : campeonato.status === 'sorteio' ? (
          <TelaSorteio dados={dados} />
        ) : (
          <TelaJogos dados={dados} />
        )}
      </div>
    </div>
  )
}

function Topo({ campeonato, qr = true }) {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', padding: '0 48px', gap: 32, borderBottom: '1px solid var(--color-border-dark-subtle)' }}>
      <Marcas altura={44} />
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '4px', color: 'var(--color-brand-lima)' }}>{(campeonato.subtitulo || 'TORNEIO').toUpperCase()}</div>
        <div className="cp-display" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.05 }}>{campeonato.nome}</div>
      </div>
      <div className="cp-display" style={{ fontSize: 54, fontWeight: 700, color: 'var(--color-text-dark-secondary)' }}><Relogio /></div>
      {qr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 10px 8px 16px', borderRadius: 16, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-brand-lima)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}><Smartphone size={16} />ACOMPANHE</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)' }}>seus jogos<br />no celular</div>
          </div>
          <QrCode url={urlPublica(campeonato.slug)} tamanho={92} />
        </div>
      )}
    </div>
  )
}

function TituloBloco({ icone: Icone, children, cor = 'var(--color-text-dark-secondary)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, letterSpacing: '3px', color: cor, marginBottom: 14, textTransform: 'uppercase' }}>
      {Icone && <Icone size={20} />}{children}
    </div>
  )
}

function TelaJogos({ dados }) {
  const { campeonato, jogos, duplas, duplaPorId } = dados
  const semSeguidos = new Set()
  const ocultas = duplasOcultas(campeonato, duplas)
  const ordenados = ordenarJogos(jogos.filter(j => j.status !== 'bye' && !ocultas.has(j.dupla_a_id) && !ocultas.has(j.dupla_b_id)))
    .sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const aoVivo = ordenados.filter(j => j.status === 'ao_vivo')
  const quadras = [...new Set([...(campeonato.quadras || []), ...aoVivo.map(j => j.quadra).filter(Boolean)])]
  const proximos = ordenados.filter(j => j.status === 'agendado' && j.dupla_a_id && j.dupla_b_id)
  const aguardando = ordenados.filter(j => j.status === 'agendado' && !(j.dupla_a_id && j.dupla_b_id))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Topo campeonato={campeonato} />
      <div style={{ flex: 1, display: 'flex', gap: 36, padding: '26px 48px 30px', minHeight: 0 }}>
        <div style={{ width: 600, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <TituloBloco icone={Radio} cor="var(--color-accent-live)">Em quadra agora</TituloBloco>
          <div style={{ display: 'grid', gap: 14 }}>
            {quadras.map(q => {
              const jogo = aoVivo.find(j => j.quadra === q)
              if (jogo) return <CartaoJogo key={q} jogo={jogo} duplaPorId={duplaPorId} seguindo={semSeguidos} escala={1.32} numero={jogo.ordem || null} />
              const prox = proximos.find(j => j.quadra === q)
              return (
                <div key={q} style={{ borderRadius: 20, padding: '18px 22px', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px dashed var(--color-border-dark)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span className="cp-display" style={{ fontSize: 26, fontWeight: 700 }}>{q}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '2px', color: 'var(--color-text-dark-muted)' }}>{campeonato.status === 'encerrado' ? 'ENCERRADO' : 'AGUARDANDO'}</span>
                  </div>
                  {prox && (
                    <div style={{ marginTop: 10, fontSize: 18, color: 'var(--color-text-dark-secondary)' }}>
                      A seguir: <b style={{ color: 'var(--color-text-dark-primary)' }}>{nomesDupla(duplaPorId.get(prox.dupla_a_id))}</b> x <b style={{ color: 'var(--color-text-dark-primary)' }}>{nomesDupla(duplaPorId.get(prox.dupla_b_id))}</b>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 28, flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TituloBloco icone={CalendarClock}>Próximos jogos</TituloBloco>
            <div style={{ display: 'grid', gap: 8 }}>
              {[...proximos, ...aguardando].slice(0, 6).map(j => (
                <LinhaProximo key={j.id} jogo={j} duplaPorId={duplaPorId} />
              ))}
              {!proximos.length && !aguardando.length && (
                <div style={{ fontSize: 18, color: 'var(--color-text-dark-muted)' }}>{campeonato.status === 'encerrado' ? 'Torneio encerrado. Obrigado a todos!' : 'Nenhum jogo na fila.'}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 24, padding: '20px 10px 16px', backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-raised) 55%, transparent)', border: '1px solid var(--color-border-dark-subtle)' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chave campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={semSeguidos} espelhada escala={1.08} />
          </div>
        </div>
      </div>
    </div>
  )
}

function nomesDupla(d) {
  if (!d) return 'A definir'
  return `${nomeCurto(d.atleta1?.nome).split(' ')[0]} & ${nomeCurto(d.atleta2?.nome).split(' ')[0]}`
}

function LinhaProximo({ jogo, duplaPorId }) {
  const a = duplaPorId.get(jogo.dupla_a_id)
  const b = duplaPorId.get(jogo.dupla_b_id)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
      <div style={{ width: 78, flexShrink: 0, lineHeight: 1.15 }}>
        <div className="cp-display" style={{ fontSize: 24, fontWeight: 700 }}>{jogo.horario || '--:--'}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-muted)', whiteSpace: 'nowrap' }}>{jogo.quadra || ''}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--color-brand-saibro)', filter: 'brightness(1.4)', textTransform: 'uppercase' }}>{rotuloFaseCurto(jogo.fase)}{jogo.ordem ? ` · Jogo ${jogo.ordem}` : ''}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {a ? <AvataresDupla dupla={a} tamanho={26} /> : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomesDupla(a)}</span>
          <span style={{ color: 'var(--color-text-dark-muted)', fontWeight: 500 }}>x</span>
          {b ? <AvataresDupla dupla={b} tamanho={26} /> : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomesDupla(b)}</span>
        </div>
      </div>
    </div>
  )
}

function TelaSorteio({ dados }) {
  const { campeonato, atletas, duplas, duplaPorId } = dados
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Topo campeonato={campeonato} />
      <div style={{ flex: 1, padding: '34px 70px', overflow: 'hidden' }}>
        <SorteioAoVivo campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} escala={1.5} colunas={4} />
      </div>
    </div>
  )
}

// Peça da tela de entrada: um atleta (acende quando faz check-in).
function CartaoAtletaEntrada({ atleta: a }) {
  return (
    <div className={a.presente ? 'cp-entrar' : ''} style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', borderRadius: 16, minWidth: 0,
      backgroundColor: a.presente ? 'color-mix(in srgb, var(--color-brand-lima) 12%, var(--color-surface-dark-raised))' : 'var(--color-surface-dark-raised)',
      border: `1px solid ${a.presente ? 'var(--color-brand-lima)' : 'var(--color-border-dark-subtle)'}`,
      opacity: a.presente ? 1 : 0.42, transition: 'opacity 0.4s',
    }}>
      <Avatar atleta={a} tamanho={52} destaque={a.presente} />
      {/* Primeiro nome em destaque e sobrenome embaixo: nunca corta, mesmo nome comprido. */}
      <span style={{ minWidth: 0, lineHeight: 1.15 }}>
        <span style={{ display: 'block', fontSize: 21, fontWeight: 700, overflowWrap: 'anywhere' }}>{nomeCurto(a.nome).split(' ')[0]}</span>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 500, color: 'var(--color-text-dark-secondary)', overflowWrap: 'anywhere' }}>{nomeCurto(a.nome).split(' ').slice(1).join(' ')}</span>
      </span>
      {a.presente && (
        <span style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', backgroundColor: 'var(--color-brand-lima)', color: 'var(--color-brand-verde-court)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} strokeWidth={3.5} /></span>
      )}
    </div>
  )
}

// Um lado da tela de entrada (Mulheres ou Homens), em ordem alfabética, com os números.
function LadoEntrada({ titulo, lista, inscritosTxt, linhas }) {
  const presentes = lista.filter(a => a.presente).length
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '6px', color: 'var(--color-text-dark-primary)' }}>{titulo}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, fontSize: 19, color: 'var(--color-text-dark-secondary)' }}>
          <span>{lista.length} {inscritosTxt}</span>
          <span style={{ color: 'var(--color-text-dark-muted)' }}>·</span>
          <span className="cp-display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-brand-lima)', lineHeight: 1 }}>{presentes}</span>
          <span>{presentes === 1 ? 'já fez check-in' : 'já fizeram check-in'}</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gridTemplateRows: `repeat(${linhas}, minmax(0,1fr))`, gridAutoFlow: 'column', gap: 12 }}>
        {lista.map(a => <CartaoAtletaEntrada key={`${a.id}-${a.presente}-${!!a.foto}`} atleta={a} />)}
      </div>
    </div>
  )
}

function TelaBoasVindas({ dados }) {
  const { campeonato, atletas } = dados
  const inscritos = atletas.filter(a => a.situacao === 'inscrito')
  const porNome = (x, y) => x.nome.localeCompare(y.nome, 'pt-BR', { sensitivity: 'base' })
  const mulheres = inscritos.filter(a => a.genero === 'F').sort(porNome)
  const homens = inscritos.filter(a => a.genero === 'M').sort(porNome)
  const presentes = inscritos.filter(a => a.presente).length
  // Mesmo número de linhas dos dois lados, para as colunas ficarem alinhadas e preencherem a altura.
  const linhas = Math.max(6, Math.ceil(Math.max(mulheres.length, homens.length) / 2))
  const dataFmt = campeonato.data ? new Date(campeonato.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''
  return (
    <div style={{ height: '100%', display: 'flex', padding: '60px 70px', gap: 60, boxSizing: 'border-box' }}>
      <div style={{ width: 600, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <Marcas altura={58} />
        <div style={{ marginTop: 56, fontSize: 19, fontWeight: 800, letterSpacing: '5px', color: 'var(--color-brand-lima)', lineHeight: 1.4 }}>{(campeonato.subtitulo || '').toUpperCase()}</div>
        <div className="cp-display" style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, margin: '14px 0 18px' }}>{campeonato.nome}</div>
        <div style={{ fontSize: 26, color: 'var(--color-text-dark-secondary)', textTransform: 'capitalize' }}>{dataFmt}{campeonato.local ? ` · ${campeonato.local}` : ''}</div>
        <div style={{ marginTop: 36, display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="cp-display" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1 }}>{inscritos.length}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-dark-secondary)' }}>atletas no total</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8 }}>
          <span className="cp-display" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, color: 'var(--color-brand-lima)' }}>{presentes}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-dark-secondary)' }}>{presentes === 1 ? 'já fez check-in' : 'já fizeram check-in'}</span>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 24, padding: 22, borderRadius: 28, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)' }}>
          <QrCode url={urlPublica(campeonato.slug)} tamanho={190} />
          <div>
            <div className="cp-display" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>Aponte a câmera</div>
            <div style={{ fontSize: 20, color: 'var(--color-text-dark-secondary)', marginTop: 10, lineHeight: 1.4 }}>Escolha seu nome, faça o check-in, coloque sua foto e acompanhe o sorteio, seus jogos e a chave ao vivo.</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: 36 }}>
        <LadoEntrada titulo="MULHERES" lista={mulheres} inscritosTxt={mulheres.length === 1 ? 'inscrita' : 'inscritas'} linhas={linhas} />
        {/* divisória fina, só no meio da altura */}
        <div style={{ width: 1, alignSelf: 'center', height: '62%', background: 'linear-gradient(to bottom, transparent, var(--color-border-dark) 20%, var(--color-border-dark) 80%, transparent)' }} />
        <LadoEntrada titulo="HOMENS" lista={homens} inscritosTxt={homens.length === 1 ? 'inscrito' : 'inscritos'} linhas={linhas} />
      </div>
    </div>
  )
}
