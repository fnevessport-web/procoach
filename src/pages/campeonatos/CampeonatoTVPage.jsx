import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Radio, CalendarClock, Smartphone, Check } from 'lucide-react'
import { useCampeonato } from '../../hooks/useCampeonato'
import { nomeCurto, iniciais, rotuloFaseCurto, ordenarJogos } from '../../lib/campeonato'
import { Marcas, CartaoJogo, Chave, SorteioAoVivo, QrCode, AvataresDupla } from './componentes'
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
  const primeiro = a => (a ? nomeCurto(a.nome).split(' ')[0] : 'A definir')
  return `${primeiro(d.atleta1)} & ${primeiro(d.atleta2)}`
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

// Peça da tela de entrada: a FOTO é a protagonista (muita gente não se conhece), nome pequeno
// embaixo. Check-in = anel verde-lima + ✓; quem não chegou fica em preto e branco, apagado.
function CartaoAtletaEntrada({ atleta: a, foto = 112 }) {
  const [primeiro, ...resto] = nomeCurto(a.nome).split(' ')
  return (
    <div className={a.presente ? 'cp-entrar' : ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, gap: 8 }}>
      <div style={{ position: 'relative', width: foto, height: foto, flexShrink: 0 }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%', padding: 3, boxSizing: 'border-box',
          background: a.presente ? 'var(--color-brand-lima)' : 'var(--color-border-dark-subtle)',
          boxShadow: a.presente ? '0 0 22px color-mix(in srgb, var(--color-brand-lima) 35%, transparent)' : 'none',
          filter: a.presente ? 'none' : 'grayscale(1)', opacity: a.presente ? 1 : 0.45, transition: 'all 0.5s',
        }}>
          {a.foto
            ? <img src={a.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-secondary)', fontSize: foto * 0.3, fontWeight: 700, letterSpacing: '1px' }}>{iniciais(a.nome)}</span>}
        </div>
        {a.presente && (
          <span style={{ position: 'absolute', right: foto * 0.02, bottom: foto * 0.02, width: foto * 0.26, height: foto * 0.26, borderRadius: '50%', backgroundColor: 'var(--color-brand-lima)', color: 'var(--color-brand-verde-court)', border: '3px solid var(--color-brand-verde-court)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}><Check size={foto * 0.14} strokeWidth={4} /></span>
        )}
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.15, maxWidth: '100%', opacity: a.presente ? 1 : 0.55 }}>
        <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>{primeiro}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-dark-secondary)', overflowWrap: 'anywhere' }}>{resto.join(' ')}</div>
      </div>
    </div>
  )
}

// Um lado da tela de entrada (Mulheres ou Homens), em ordem alfabética, com os números.
// A grade se adapta: até 16 nomes em 2 colunas; mais que isso abre 3 ou 4 colunas e diminui o
// cartão, para nunca espremer nem sobrepor.
function LadoEntrada({ titulo, lista, inscritosTxt, linhas, colunas, foto, suplentesPresentes = 0 }) {
  const presentes = lista.filter(a => a.presente).length
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '6px', color: 'var(--color-text-dark-primary)' }}>{titulo}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, fontSize: 19, color: 'var(--color-text-dark-secondary)', flexWrap: 'wrap' }}>
          <span>{lista.length} {inscritosTxt}</span>
          <span style={{ color: 'var(--color-text-dark-muted)' }}>·</span>
          <span className="cp-display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-brand-lima)', lineHeight: 1 }}>{presentes}</span>
          <span>{presentes === 1 ? 'já fez check-in' : 'já fizeram check-in'}</span>
          {suplentesPresentes > 0 && <span style={{ color: 'var(--color-text-dark-muted)' }}>· {suplentesPresentes} {suplentesPresentes === 1 ? 'suplente presente' : 'suplentes presentes'}</span>}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${colunas}, minmax(0,1fr))`, gridTemplateRows: `repeat(${linhas}, minmax(0,1fr))`, gap: 10, alignItems: 'center' }}>
        {lista.map(a => <CartaoAtletaEntrada key={`${a.id}-${a.presente}-${!!a.foto}`} atleta={a} foto={foto} />)}
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
  // Mesma grade dos dois lados, para as colunas ficarem alinhadas e preencherem a altura.
  const maior = Math.max(mulheres.length, homens.length)
  const colunas = maior <= 16 ? 4 : maior <= 20 ? 5 : 6
  const linhas = Math.max(3, Math.ceil(maior / colunas))
  // Tamanho da foto: o maior que cabe na coluna e na altura disponível (~850px para as linhas).
  const foto = Math.round(Math.min({ 4: 112, 5: 92, 6: 76 }[colunas], 850 / linhas - 56))
  const suplentes = g => atletas.filter(a => a.genero === g && a.situacao === 'espera' && a.presente).length
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
        <LadoEntrada titulo="MULHERES" lista={mulheres} inscritosTxt={mulheres.length === 1 ? 'inscrita' : 'inscritas'} linhas={linhas} colunas={colunas} foto={foto} suplentesPresentes={suplentes('F')} />
        {/* divisória fina, só no meio da altura */}
        <div style={{ width: 1, alignSelf: 'center', height: '62%', background: 'linear-gradient(to bottom, transparent, var(--color-border-dark) 20%, var(--color-border-dark) 80%, transparent)' }} />
        <LadoEntrada titulo="HOMENS" lista={homens} inscritosTxt={homens.length === 1 ? 'inscrito' : 'inscritos'} linhas={linhas} colunas={colunas} foto={foto} suplentesPresentes={suplentes('M')} />
      </div>
    </div>
  )
}
