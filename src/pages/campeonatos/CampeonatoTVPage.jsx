import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Radio, CalendarClock, Smartphone, Check, Maximize, Minimize } from 'lucide-react'
import { useCampeonato } from '../../hooks/useCampeonato'
import { nomeCurto, iniciais, rotuloFaseCurto, ordenarJogos, origemDaVaga, formatarDuracao, primeiroNome } from '../../lib/campeonato'
import { Marcas, Avatar, CartaoJogo, Chave, QrCode, AvataresDupla, TempoJogo, SeloQuadra } from './componentes'
import { urlPublica, duplasOcultas, proximosPorQuadra } from './util'
import { CelebracaoVitoria } from './CelebracaoVitoria'
import { TelaPodio } from './PodioTV'

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
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
}

// Tela cheia (some a barra de endereço e as abas). O navegador só deixa entrar com um clique,
// então fica um botão discreto no canto, que se esconde com o mouse parado; duplo clique também
// alterna.
function useTelaCheia() {
  const [cheia, setCheia] = useState(() => !!document.fullscreenElement)
  const [mouseAtivo, setMouseAtivo] = useState(true)
  useEffect(() => {
    const aoMudar = () => setCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', aoMudar)
    let t = setTimeout(() => setMouseAtivo(false), 4000)
    const aoMover = () => {
      setMouseAtivo(true)
      clearTimeout(t)
      t = setTimeout(() => setMouseAtivo(false), 3000)
    }
    window.addEventListener('mousemove', aoMover)
    window.addEventListener('touchstart', aoMover)
    return () => {
      document.removeEventListener('fullscreenchange', aoMudar)
      window.removeEventListener('mousemove', aoMover)
      window.removeEventListener('touchstart', aoMover)
      clearTimeout(t)
    }
  }, [])
  const alternar = () => {
    const el = document.documentElement
    if (document.fullscreenElement) document.exitFullscreen?.()
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
  }
  return { cheia, mouseAtivo, alternar }
}

export function CampeonatoTVPage() {
  const { slug } = useParams()
  const escala = useEscala()
  const dados = useCampeonato({ slug })
  const { campeonato, carregando, erro } = dados
  const { cheia, mouseAtivo, alternar } = useTelaCheia()
  const mostrarBotao = !cheia || mouseAtivo

  return (
    <div className="cp-fundo" onDoubleClick={alternar} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', cursor: mouseAtivo ? 'default' : 'none' }}>
      <button onClick={alternar} title={cheia ? 'Sair da tela cheia' : 'Tela cheia'} style={{
        position: 'absolute', right: 16, bottom: 16, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 12, border: '1px solid var(--color-border-dark)', cursor: 'pointer',
        backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-raised) 85%, transparent)', color: 'var(--color-text-dark-primary)',
        fontSize: 14, fontWeight: 700, opacity: mostrarBotao ? (cheia ? 0.6 : 1) : 0, pointerEvents: mostrarBotao ? 'auto' : 'none', transition: 'opacity 0.4s',
      }}>
        {cheia ? <><Minimize size={16} />Sair da tela cheia</> : <><Maximize size={16} />Tela cheia</>}
      </button>
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
          <TelaJogos dados={dados} escala={escala} />
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, letterSpacing: '3px', color: cor, marginBottom: 10, textTransform: 'uppercase' }}>
      {Icone && <Icone size={20} />}{children}
    </div>
  )
}

function TelaJogos({ dados, escala }) {
  const { campeonato, jogos, duplas, duplaPorId } = dados
  const palco = useRef(null)
  const proximosMapa = proximosPorQuadra(campeonato, jogos)
  // Celebração: só jogos que terminarem com a TV aberta (os já encerrados ao abrir não animam).
  const [jaEncerrados] = useState(() => new Set(jogos.filter(j => j.status === 'finalizado').map(j => j.id)))
  const [celebrados, setCelebrados] = useState(() => new Set())
  const celebrar = jogos
    .filter(j => j.status === 'finalizado' && j.vencedor_id && !jaEncerrados.has(j.id) && !celebrados.has(j.id))
    .sort((a, b) => String(a.finalizado_em).localeCompare(String(b.finalizado_em)))[0]
  const semSeguidos = new Set()
  const ocultas = duplasOcultas(campeonato, duplas)
  const ordenados = ordenarJogos(jogos.filter(j => j.status !== 'bye' && !ocultas.has(j.dupla_a_id) && !ocultas.has(j.dupla_b_id)))
    .sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const aoVivo = ordenados.filter(j => j.status === 'ao_vivo')
  const quadras = [...new Set([...(campeonato.quadras || []), ...aoVivo.map(j => j.quadra).filter(Boolean)])]
  // Programação inteira na ordem dos jogos: os prontos e também os que esperam vencedores
  // ("Vencedor do jogo 3").
  const fila = ordenados.filter(j => j.status === 'agendado')
  const resultados = ordenados.filter(j => ['finalizado', 'wo'].includes(j.status))
    .sort((a, b) => String(b.finalizado_em).localeCompare(String(a.finalizado_em)))

  // Fim do torneio (final e 3º lugar decididos): depois da animação da final, abre o pódio.
  const finalJogo = jogos.find(j => j.fase === 'final')
  const terceiroJogo = jogos.find(j => j.fase === 'terceiro')
  const decidido = j => j && ['finalizado', 'wo'].includes(j.status) && j.vencedor_id
  const terminou = decidido(finalJogo) && (!terceiroJogo || decidido(terceiroJogo))
  if (terminou && !celebrar) return <TelaPodio campeonato={campeonato} jogos={jogos} duplaPorId={duplaPorId} />

  return (
    <div ref={palco} style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {celebrar && (
        <CelebracaoVitoria key={celebrar.id} jogo={celebrar} jogos={jogos} duplaPorId={duplaPorId} palco={palco} escala={escala}
          onFim={() => setCelebrados(s => new Set(s).add(celebrar.id))} />
      )}
      <Topo campeonato={campeonato} />
      <div style={{ flex: 1, display: 'flex', gap: 18, padding: '16px 22px 18px', minHeight: 0 }}>
        {/* ESQUERDA: as quadras e, embaixo, os próximos jogos em destaque */}
        <div style={{ width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <TituloBloco icone={Radio} cor="var(--color-accent-live)">Em quadra agora</TituloBloco>
          {quadras.map(q => (
            <CartaoQuadraTV key={q} quadra={q} jogo={aoVivo.find(j => j.quadra === q)} proximo={jogos.find(j => proximosMapa.get(j.id) === q)}
              campeonato={campeonato} duplaPorId={duplaPorId} jogos={jogos} />
          ))}
          <div style={{ marginTop: 4, flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 20, padding: '12px 12px 6px', border: '2px solid var(--color-brand-lima)', backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 7%, var(--color-surface-dark-raised))' }}>
            <TituloBloco icone={CalendarClock} cor="var(--color-brand-lima)">Próximos jogos</TituloBloco>
            <div style={{ display: 'grid', gap: 8, paddingBottom: 6 }}>
              {fila.slice(0, 2).map(j => (
                <LinhaProximo key={j.id} jogo={j} duplaPorId={duplaPorId} jogos={jogos} campeonato={campeonato} chamado={proximosMapa.get(j.id)} />
              ))}
              {!fila.length && (
                <div style={{ fontSize: 18, color: 'var(--color-text-dark-muted)', padding: '6px 4px 10px' }}>{campeonato.status === 'encerrado' ? 'Torneio encerrado. Obrigado a todos!' : 'Nenhum jogo na fila.'}</div>
              )}
              {fila.length > 2 && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-dark-muted)', textAlign: 'center' }}>+ {fila.length - 2} jogos na programação</div>}
            </div>
          </div>
        </div>

        {/* CENTRO: a chave */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 22, padding: '14px 2px 10px', backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-raised) 55%, transparent)', border: '1px solid var(--color-border-dark-subtle)' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chave campeonato={campeonato} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={semSeguidos} espelhada escala={1.05} proximos={proximosMapa} />
          </div>
        </div>

        {/* DIREITA: últimos resultados subindo */}
        <div style={{ width: 335, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <TituloBloco icone={Check} cor="var(--color-text-dark-primary)">Últimos resultados</TituloBloco>
            <ResultadosRolando resultados={resultados} duplaPorId={duplaPorId} />
          </div>
        </div>
      </div>
    </div>
  )
}

function nomesDupla(d) {
  if (!d) return 'A definir'
  const primeiro = a => (a ? primeiroNome(a.nome) : 'A definir')
  return `${primeiro(d.atleta1)} & ${primeiro(d.atleta2)}`
}

// Uma quadra, com o nome bem grande no topo. Com jogo: duplas, placar e o tempo de jogo correndo.
// Livre: quem é chamado para ela, com o atraso em relação ao horário previsto.
function CartaoQuadraTV({ quadra, jogo, proximo, campeonato, duplaPorId, jogos }) {
  const aoVivo = !!jogo
  const corBorda = aoVivo ? 'var(--color-accent-live)' : proximo ? 'var(--color-state-success)' : 'var(--color-border-dark)'
  const fundoTopo = aoVivo ? 'var(--color-accent-live)' : proximo ? 'color-mix(in srgb, var(--color-state-success) 30%, var(--color-surface-dark-raised))' : 'var(--color-surface-dark-overlay)'
  return (
    <div className={aoVivo ? 'cp-ao-vivo' : ''} style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: 'var(--color-surface-dark-raised)', border: `2px solid ${corBorda}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', backgroundColor: fundoTopo, color: aoVivo ? 'var(--color-accent-on-live)' : 'var(--color-text-dark-primary)' }}>
        <span className="cp-display" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>{quadra}</span>
        <span style={{ marginLeft: 'auto', textAlign: 'right', lineHeight: 1.2 }}>
          {aoVivo ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end', fontSize: 15, fontWeight: 800, letterSpacing: '2px' }}><span className="cp-pulso" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--color-accent-on-live)' }} />AO VIVO</span>
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>{rotuloFaseCurto(jogo.fase)}{jogo.ordem ? ` · Jogo ${jogo.ordem}` : ''}</span>
            </>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '2px', color: proximo ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-muted)' }}>
              {campeonato.status === 'encerrado' ? 'ENCERRADO' : proximo ? 'CHAMANDO' : 'LIVRE'}
            </span>
          )}
        </span>
      </div>
      {aoVivo ? (
        <div style={{ padding: '6px 6px 10px' }}>
          <CartaoJogo jogo={jogo} duplaPorId={duplaPorId} seguindo={SEM_SEGUIDOS} escala={1.12} jogos={jogos} compacto />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px 0' }}>
            <TempoJogo jogo={jogo} dataTorneio={campeonato.data} tamanho={15} rotulo={false} cor="var(--color-text-dark-muted)" />
          </div>
        </div>
      ) : proximo ? (
        <div style={{ padding: '10px 16px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase' }}>
            Jogo {proximo.ordem} · {rotuloFaseCurto(proximo.fase)} · previsto {proximo.horario}
          </div>
          {['a', 'b'].map((l, i) => {
            const d = duplaPorId.get(proximo[`dupla_${l}_id`])
            return (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i ? 6 : 8 }}>
                {d ? <AvataresDupla dupla={d} tamanho={34} /> : null}
                <span style={{ fontSize: 21, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomesDupla(d)}</span>
              </div>
            )
          })}
          <div style={{ marginTop: 8 }}><TempoJogo jogo={proximo} dataTorneio={campeonato.data} tamanho={18} /></div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', fontSize: 16, color: 'var(--color-text-dark-muted)' }}>Nenhum jogo pronto para esta quadra.</div>
      )}
    </div>
  )
}

const SEM_SEGUIDOS = new Set()

// Linha da programação na TV: horário e quadra grandes, as duplas (ou de onde elas vêm) e o
// atraso em vermelho quando já passou do horário previsto.
function LinhaProximo({ jogo, duplaPorId, jogos, campeonato, chamado }) {
  const vaga = lado => {
    const d = duplaPorId.get(jogo[`dupla_${lado}_id`])
    return d ? { d, txt: nomesDupla(d) } : { d: null, txt: origemDaVaga(jogo, lado, jogos) || 'A definir' }
  }
  const lados = [vaga('a'), vaga('b')]
  return (
    <div style={{ padding: '8px 12px', borderRadius: 14, backgroundColor: chamado ? 'color-mix(in srgb, var(--color-state-success) 18%, var(--color-surface-dark-raised))' : 'var(--color-surface-dark-raised)', border: `1px solid ${chamado ? 'var(--color-state-success)' : 'var(--color-border-dark-subtle)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ lineHeight: 1 }}>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--color-text-dark-muted)', marginBottom: 2 }}>PREVISTO</span>
          <span className="cp-display" style={{ fontSize: 28, fontWeight: 700 }}>{jogo.horario || '--:--'}</span>
        </span>
        <SeloQuadra quadra={jogo.quadra} escala={1.05} />
        <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <TempoJogo jogo={jogo} dataTorneio={campeonato.data} tamanho={15} />
        </span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 6, color: chamado ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-secondary)' }}>
        {chamado ? `▶ Próximo na ${chamado} · ` : ''}{rotuloFaseCurto(jogo.fase)}{jogo.ordem ? ` · Jogo ${jogo.ordem}` : ''}
      </div>
      {lados.map((v, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {v.d ? <AvataresDupla dupla={v.d} tamanho={24} /> : null}
          <span style={{ fontSize: v.d ? 17 : 15, fontWeight: v.d ? 700 : 500, fontStyle: v.d ? 'normal' : 'italic', color: v.d ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.txt}</span>
          {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: 'var(--color-text-dark-muted)' }}>VS</span>}
        </div>
      ))}
    </div>
  )
}

// Últimos resultados numa lista que sobe devagar, sem parar (como no telão de torneio). Com
// poucos resultados, fica parada. O conteúdo é duplicado para o loop não ter emenda.
function ResultadosRolando({ resultados, duplaPorId }) {
  if (!resultados.length) {
    return <div style={{ fontSize: 17, color: 'var(--color-text-dark-muted)', padding: '4px 2px' }}>Os placares aparecem aqui assim que os jogos terminarem.</div>
  }
  const rola = resultados.length > 3
  const itens = resultados.slice(0, 16)
  const mascara = rola ? 'linear-gradient(to bottom, transparent, black 6%, black 92%, transparent)' : 'none'
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', maskImage: mascara, WebkitMaskImage: mascara }}>
      <div className={rola ? 'cp-rolar-cima' : ''} style={{ '--duracao': `${itens.length * 5}s` }}>
        {[0, ...(rola ? [1] : [])].map(copia => (
          <div key={copia} style={{ display: 'grid', gap: 10, paddingBottom: 10 }}>
            {itens.map(j => <CartaoResultado key={j.id} jogo={j} duplaPorId={duplaPorId} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function CartaoResultado({ jogo, duplaPorId }) {
  const hora = jogo.finalizado_em ? new Date(jogo.finalizado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  const duracao = jogo.iniciado_em && jogo.finalizado_em && jogo.status === 'finalizado' ? formatarDuracao(new Date(jogo.finalizado_em) - new Date(jogo.iniciado_em)) : null
  return (
    <div style={{ padding: '8px 12px', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-muted)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {hora} · Jogo {jogo.ordem} · {rotuloFaseCurto(jogo.fase)}{jogo.quadra ? ` · ${jogo.quadra}` : ''}{duracao ? ` (${duracao})` : ''}
      </div>
      {['a', 'b'].map(l => {
        const d = duplaPorId.get(jogo[`dupla_${l}_id`])
        const venceu = !!jogo.vencedor_id && jogo.vencedor_id === d?.id
        return (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', opacity: venceu ? 1 : 0.6 }}>
            {d ? <AvataresDupla dupla={d} tamanho={24} destaque={venceu} /> : null}
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: venceu ? 800 : 600, color: venceu ? 'var(--color-brand-lima)' : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomesDupla(d)}</span>
            {jogo.status === 'wo'
              ? (venceu ? <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-state-warning)' }}>W.O.</span> : null)
              : (
                <span style={{ display: 'flex', gap: 4 }}>
                  {(jogo.sets || []).map((s, i) => (
                    <span key={i} style={{ minWidth: 24, textAlign: 'center', borderRadius: 6, padding: '1px 0', fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface-dark-overlay)', color: venceu ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)' }}>{s[l] ?? 0}</span>
                  ))}
                </span>
              )}
          </div>
        )
      })}
    </div>
  )
}

// Sorteio no telão: em cima, os nomes girando e a dupla que acabou de sair, seguida do sorteio do
// número do jogo ("JOGO 3"); embaixo, a chave inteira de ponta a ponta, e a dupla entra no
// quadrado do jogo dela. O ritmo vem da tela da gestão (campeonatos.sorteio_revelados).
function TelaSorteio({ dados }) {
  const { campeonato, atletas, duplas, jogos, duplaPorId } = dados
  const revelados = campeonato.sorteio_revelados || 0
  const total = duplas.length
  const ultima = revelados > 0 ? duplas.find(d => d.numero === revelados) : null
  const jogoDaUltima = ultima ? jogos.find(j => j.rodada === 1 && (j.dupla_a_id === ultima.id || j.dupla_b_id === ultima.id)) : null
  const numerosR1 = jogos.filter(j => j.rodada === 1 && j.status !== 'bye' && j.ordem > 0).map(j => j.ordem)

  // Etapas da dupla que acabou de sair: 'nome' -> 'numero' (girando) -> 'mostra' (número parado e
  // a dupla entra no quadrado da chave) -> 'fixo' (volta a girar os nomes para a próxima)
  const [etapa, setEtapa] = useState({ id: null, fase: 'fixo' })
  const ultimaId = ultima?.id || null
  useEffect(() => {
    if (!ultimaId) return
    const t0 = setTimeout(() => setEtapa({ id: ultimaId, fase: 'nome' }), 0)
    const t1 = setTimeout(() => setEtapa({ id: ultimaId, fase: 'numero' }), 1300)
    const t2 = setTimeout(() => setEtapa({ id: ultimaId, fase: 'mostra' }), 3100)
    const t3 = setTimeout(() => setEtapa({ id: ultimaId, fase: 'fixo' }), 5300)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [ultimaId])
  const fase = !ultimaId ? 'fixo' : etapa.id === ultimaId ? etapa.fase : 'nome'

  // número girando
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    if (fase !== 'numero') return
    const t = setInterval(() => setGiro(g => g + 1), 85)
    return () => clearInterval(t)
  }, [fase])

  // nomes girando enquanto espera a próxima dupla
  const terminou = revelados >= total && total > 0
  const homens = atletas.filter(a => a.genero === 'M' && a.situacao === 'inscrito')
  const mulheres = atletas.filter(a => a.genero === 'F' && a.situacao === 'inscrito')
  const [giroNome, setGiroNome] = useState(0)
  const girandoNomes = !terminou && (!ultima || fase === 'fixo')
  useEffect(() => {
    if (!girandoNomes) return
    const t = setInterval(() => setGiroNome(g => g + 1), 95)
    return () => clearInterval(t)
  }, [girandoNomes])

  const dUltima = ultima ? duplaPorId.get(ultima.id) : null
  const numeroMostrado = fase === 'numero' && numerosR1.length ? numerosR1[giro % numerosR1.length] : jogoDaUltima?.ordem
  const parou = fase === 'mostra' || fase === 'fixo'
  const realce = parou && jogoDaUltima ? jogoDaUltima.id : null
  // a chave só mostra a dupla que acabou de sair depois que o número do jogo parou
  const camp = parou ? campeonato : { ...campeonato, sorteio_revelados: Math.max(0, revelados - 1) }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Topo campeonato={campeonato} />
      <div style={{ height: 250, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 40, padding: '0 70px' }}>
        <div style={{ width: 330, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800, letterSpacing: '5px', color: 'var(--color-accent-live)' }}>
            {!terminou && <span className="cp-pulso" style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />}
            {terminou ? 'DUPLAS DEFINIDAS' : 'SORTEIO AO VIVO'}
          </div>
          <div className="cp-display" style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }}>
            {terminou ? `${total} duplas` : `Dupla ${Math.min(revelados + (girandoNomes ? 1 : 0), total)} de ${total}`}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 36 }}>
          {girandoNomes ? (
            <div className="cp-sorteando" style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '22px 34px', borderRadius: 26, border: '3px solid', backgroundColor: 'var(--color-surface-dark-raised)' }}>
              {[homens[giroNome % Math.max(1, homens.length)], mulheres[(giroNome * 7) % Math.max(1, mulheres.length)]].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, width: 380, justifyContent: i ? 'flex-start' : 'flex-end' }}>
                  {i === 1 && <span className="cp-display" style={{ fontSize: 46, color: 'var(--color-brand-saibro)', filter: 'brightness(1.4)' }}>&amp;</span>}
                  <Avatar atleta={a} tamanho={96} />
                  <span style={{ fontSize: 30, fontWeight: 700, filter: 'blur(0.8px)', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(a?.nome)}</span>
                </div>
              ))}
            </div>
          ) : dUltima ? (
            <>
              <div key={dUltima.id} className="cp-zoom" style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '14px 30px', borderRadius: 26, border: '3px solid var(--color-brand-lima)', backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 12%, var(--color-surface-dark-raised))', boxShadow: '0 0 50px color-mix(in srgb, var(--color-brand-lima) 25%, transparent)' }}>
                {[dUltima.atleta1, dUltima.atleta2].map((a, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 230 }}>
                    <Avatar atleta={a} tamanho={104} destaque />
                    <span className="cp-display" style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{a ? nomeCurto(a.nome) : 'A definir'}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', width: 230 }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '6px', color: 'var(--color-text-dark-secondary)' }}>{fase === 'nome' ? 'SORTEANDO...' : 'JOGO'}</div>
                <div className={parou ? 'cp-zoom' : ''} key={`${dUltima.id}-${parou ? 'p' : fase}`} style={{ fontFamily: 'var(--font-display)', fontSize: 124, fontWeight: 700, lineHeight: 1.05, color: parou ? 'var(--color-brand-lima)' : 'var(--color-text-dark-primary)', fontVariantNumeric: 'tabular-nums', opacity: fase === 'nome' ? 0.25 : 1 }}>
                  {fase === 'nome' ? '?' : numeroMostrado || '?'}
                </div>
                {parou && jogoDaUltima && <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginTop: 10, whiteSpace: 'nowrap' }}>{jogoDaUltima.quadra} · previsto {jogoDaUltima.horario}</div>}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, margin: '0 24px 22px', borderRadius: 22, padding: '12px 2px 16px', backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-raised) 55%, transparent)', border: '1px solid var(--color-border-dark-subtle)' }}>
        <Chave campeonato={camp} jogos={jogos} duplas={duplas} duplaPorId={duplaPorId} seguindo={SEM_SEGUIDOS} espelhada escala={1.12} realce={realce} />
      </div>
    </div>
  )
}

// Peça da tela de entrada: a FOTO é a protagonista (muita gente não se conhece), nome pequeno
// embaixo. Check-in = anel verde-lima + ✓; quem não chegou fica em preto e branco, apagado.
function CartaoAtletaEntrada({ atleta: a, foto = 112 }) {
  const primeiro = primeiroNome(a.nome)
  const resto = [nomeCurto(a.nome).slice(primeiro.length).trim()]
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
