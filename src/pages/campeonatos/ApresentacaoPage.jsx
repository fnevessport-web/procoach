import { useEffect, useRef, useState } from 'react'
import { Shuffle, Radio, Trophy, Smartphone, Tv, Users, Camera, MessageCircle, Star, ShieldCheck, Zap, Wifi, QrCode, PartyPopper, ListOrdered, UserPlus } from 'lucide-react'
import { Marcas } from './componentes'
import './campeonato.css'

// Página pública de apresentação da aba Campeonatos (/apresentacao-campeonatos), para enviar a
// clubes e parceiros. Prints e trechos animados vêm da gravação de demonstração (torneio fictício,
// atletas e fotos ilustradas) e ficam em /public/apresentacao.

const M = n => `/apresentacao/${n}`
const VIDEO_COMPLETO = M('demonstracao.mp4')

// Revela o conteúdo quando ele entra na tela (sobe com fade; `tipo` muda o efeito).
function Revelar({ children, tipo = '', atraso = 0, estilo }) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); obs.disconnect() } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return <div ref={ref} className={`lp-rev ${tipo} ${visivel ? 'lp-visivel' : ''}`} style={{ '--atraso': `${atraso}ms`, ...estilo }}>{children}</div>
}

// Vídeo do topo: começa inclinado em 3D e vai se endireitando/crescendo conforme a rolagem.
function TelaInclinada({ children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const rolagem = el?.closest('.cp-rolagem')
    if (!el || !rolagem) return
    let quadro = 0
    const atualizar = () => {
      quadro = 0
      const r = el.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.95)))
      el.style.setProperty('--p', p.toFixed(3))
    }
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(atualizar) }
    atualizar()
    rolagem.addEventListener('scroll', aoRolar, { passive: true })
    window.addEventListener('resize', aoRolar)
    return () => { rolagem.removeEventListener('scroll', aoRolar); window.removeEventListener('resize', aoRolar); cancelAnimationFrame(quadro) }
  }, [])
  return <div style={{ perspective: 1400 }}><div ref={ref} className="lp-inclinada">{children}</div></div>
}

function Video({ src, poster, estilo, className }) {
  const ref = useRef(null)
  // Só toca quando aparece na tela (economiza dados no celular).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause() }, { threshold: 0.25 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="metadata" style={{ display: 'block', width: '100%', ...estilo }} />
}

function Tela(props) {
  return <Revelar tipo="lp-zoom"><TelaBase {...props} /></Revelar>
}

function TelaBase({ children, tipo = 'tv', estilo }) {
  if (tipo === 'celular') {
    return (
      <div style={{ width: '100%', maxWidth: 300, margin: '0 auto', padding: 10, borderRadius: 44, background: 'linear-gradient(160deg, var(--color-surface-dark-overlay), var(--color-surface-dark-base))', border: '1px solid var(--color-border-dark)', boxShadow: '0 30px 60px -20px rgba(0,0,0,.55)', ...estilo }}>
        <div style={{ borderRadius: 34, overflow: 'hidden', aspectRatio: '390 / 664', backgroundColor: 'var(--color-surface-dark-base)' }}>{children}</div>
      </div>
    )
  }
  return (
    <div style={{ padding: 8, borderRadius: 18, background: 'linear-gradient(160deg, var(--color-surface-dark-overlay), var(--color-surface-dark-base))', border: '1px solid var(--color-border-dark)', boxShadow: '0 30px 70px -25px rgba(0,0,0,.6)', ...estilo }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 9', backgroundColor: 'var(--color-surface-dark-base)' }}>{children}</div>
    </div>
  )
}

const img = (n, alt) => <img src={M(n)} alt={alt} loading="lazy" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />

function Rotulo({ children, cor = 'var(--color-brand-lima)' }) {
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '3px', color: cor, textTransform: 'uppercase' }}>{children}</div>
}

let contadorRecurso = 0
function Recurso({ icone: Icone, titulo, texto }) {
  const [atraso] = useState(() => (contadorRecurso++ % 6) * 90)
  return (
    <Revelar atraso={atraso} estilo={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 14%, transparent)', color: 'var(--color-brand-lima)' }}><Icone size={20} /></span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{titulo}</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-dark-secondary)' }}>{texto}</div>
      </div>
    </Revelar>
  )
}

function Secao({ id, rotulo, titulo, texto, children, alt }) {
  return (
    <section id={id} style={{ padding: 'clamp(56px, 9vw, 110px) 20px', backgroundColor: alt ? 'color-mix(in srgb, var(--color-surface-dark-raised) 45%, transparent)' : 'transparent', borderTop: '1px solid var(--color-border-dark-subtle)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Revelar estilo={{ maxWidth: 720, marginBottom: 44 }}>
          <Rotulo>{rotulo}</Rotulo>
          <h2 className="cp-display" style={{ fontSize: 'clamp(30px, 4.6vw, 50px)', fontWeight: 700, lineHeight: 1.1, margin: '12px 0 14px' }}>{titulo}</h2>
          {texto && <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--color-text-dark-secondary)', margin: 0 }}>{texto}</p>}
        </Revelar>
        {children}
      </div>
    </section>
  )
}

const grade2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 'clamp(28px, 4vw, 56px)', alignItems: 'center' }

export function ApresentacaoPage() {
  const [videoAberto, setVideoAberto] = useState(false)
  return (
    <div className="cp-fundo cp-rolagem" style={{ fontFamily: 'var(--font-family-sans)' }}>
      {/* topo */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, padding: '14px 20px', backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-base) 82%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border-dark-subtle)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Marcas altura={28} />
          <button onClick={() => setVideoAberto(true)} style={{ padding: '10px 18px', borderRadius: 999, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 800, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ Ver o vídeo</button>
        </div>
      </header>

      {/* hero */}
      <section style={{ padding: 'clamp(48px, 8vw, 96px) 20px 40px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', textAlign: 'center' }}>
          <div className="lp-entrada"><Rotulo>Gestão de torneios · Procopio</Rotulo></div>
          <h1 className="cp-display lp-entrada" style={{ fontSize: 'clamp(38px, 7vw, 82px)', fontWeight: 700, lineHeight: 1.03, margin: '16px auto 18px', maxWidth: 980 }}>
            O seu torneio com cara de <span style={{ color: 'var(--color-brand-lima)' }}>grande evento</span>
          </h1>
          <p className="lp-entrada lp-d2" style={{ fontSize: 'clamp(16px, 2vw, 20px)', lineHeight: 1.6, color: 'var(--color-text-dark-secondary)', maxWidth: 760, margin: '0 auto 34px' }}>
            Sorteio ao vivo, placar em tempo real, telão do clube e o celular de cada atleta conectados. Tudo controlado por um painel simples, sem ninguém precisar instalar aplicativo.
          </p>
          <div className="lp-entrada lp-d3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 54 }}>
            <button onClick={() => setVideoAberto(true)} style={{ padding: '15px 26px', borderRadius: 14, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>▶ Assistir à demonstração</button>
          </div>
          <TelaInclinada><Tela><Video src={M('hero.mp4')} poster={M('tv-chave.jpg')} /></Tela></TelaInclinada>
        </div>
      </section>

      {/* três visões */}
      <section style={{ padding: '30px 20px 70px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          {[
            [Users, 'Organizador', 'Check-in, sorteio, placar, substituições e ordem dos jogos em um painel.'],
            [Smartphone, 'Atleta', 'Entra pelo QR code, coloca a foto, acompanha os próprios jogos e chama a dupla no WhatsApp.'],
            [Tv, 'Telão', 'Chegada, sorteio, jogos em quadra, chave, comemoração de vitória e pódio.'],
          ].map(([Icone, t, x], i) => (
            <Revelar key={t} atraso={i * 130} estilo={{ padding: 22, borderRadius: 18, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
              <Icone size={26} color="var(--color-brand-lima)" />
              <div className="cp-display" style={{ fontSize: 24, fontWeight: 700, margin: '12px 0 6px' }}>{t}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-dark-secondary)' }}>{x}</div>
            </Revelar>
          ))}
        </div>
      </section>

      <Secao id="organizador" rotulo="Visão do organizador" titulo="Tudo do torneio na palma da mão" texto="Um painel pensado para a mesa do torneio: poucos toques, nada de planilha, e tudo que você muda aparece na hora no telão e no celular dos atletas.">
        <div style={grade2}>
          <Tela><Video src={M('gestor-placar.mp4')} poster={M('gestor-placar.jpg')} /></Tela>
          <div style={{ display: 'grid', gap: 22 }}>
            <Recurso icone={Users} titulo="Check-in e lista de espera" texto="Inscritos separados de quem está na fila, numerada na ordem de chamada. Quem chega faz check-in pelo próprio celular." />
            <Recurso icone={Shuffle} titulo="Sorteio ao vivo com um toque" texto="As duplas são sorteadas entre os presentes e reveladas uma a uma no telão e nos celulares. Se sobrar alguém, a dupla fica como “A definir” e joga por último." />
            <Recurso icone={Radio} titulo="Placar com + e −" texto="Cada game marcado aparece na hora para todos. Ao fechar o jogo, a dupla vencedora avança sozinha na chave." />
            <Recurso icone={ListOrdered} titulo="Ordem de jogos e quadras" texto="Horário “não antes de”, quadra de cada jogo e o próximo de cada quadra destacado. Dá para trocar a ordem com um toque." />
            <Recurso icone={UserPlus} titulo="Imprevistos resolvidos" texto="Substitua um atleta, chame a dupla que perdeu para entrar no lugar, dê W.O. ou corrija um placar: a chave se ajusta sozinha." />
          </div>
        </div>
        <div style={{ ...grade2, marginTop: 'clamp(40px, 6vw, 70px)' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <Tela>{img('gestor-sorteio.jpg', 'Painel do sorteio')}</Tela>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <Tela>{img('gestor-atletas.jpg', 'Painel de atletas e check-in')}</Tela>
          </div>
        </div>
      </Secao>

      <Secao id="atleta" alt rotulo="Visão do atleta" titulo="Cada atleta com o torneio no celular" texto="Sem aplicativo e sem cadastro: o atleta aponta a câmera para o QR code do telão, escolhe o nome e pronto.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 28, marginBottom: 'clamp(40px, 6vw, 64px)' }}>
          {[
            ['cel-entrada.mp4', 'cel-entrada.jpg', 'Escolhe o nome e ajusta a foto'],
            ['cel-sorteio.mp4', 'cel-sorteio.jpg', 'Vê o sorteio ao vivo e o “É você!”'],
            ['cel-dupla.mp4', 'cel-dupla.jpg', 'Chama a dupla no WhatsApp'],
            ['cel-chave.mp4', 'cel-chave.jpg', 'Acompanha jogos e a chave por fase'],
          ].map(([v, p, t], i) => (
            <Revelar key={v} atraso={i * 140}>
              <TelaBase tipo="celular"><Video src={M(v)} poster={M(p)} estilo={{ height: '100%', objectFit: 'cover' }} /></TelaBase>
              <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, marginTop: 14 }}>{t}</div>
            </Revelar>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 22 }}>
          <Recurso icone={QrCode} titulo="Entra pelo QR code" texto="Busca o próprio nome com autocomplete. Funciona em qualquer celular, direto no navegador." />
          <Recurso icone={Camera} titulo="Foto ajustada pelo próprio atleta" texto="Tira ou escolhe a foto, arrasta e dá zoom para o rosto ficar certinho no círculo. A foto aparece no telão, no sorteio e na chave." />
          <Recurso icone={Star} titulo="Segue quem quiser" texto="O marido acompanha a esposa, os amigos se seguem: os jogos dessas pessoas ficam em destaque." />
          <Recurso icone={MessageCircle} titulo="Contato da dupla, com privacidade" texto="Depois do sorteio, cada um vê o WhatsApp só do próprio parceiro, depois de confirmar o próprio telefone." />
        </div>
      </Secao>

      <Secao id="telao" rotulo="O telão do clube" titulo="Uma transmissão ao vivo do seu torneio" texto="O telão acompanha o evento do começo ao fim e muda de tela sozinho em cada momento.">
        <div style={grade2}>
          <div>
            <Tela><Video src={M('tv-sorteio.mp4')} poster={M('tv-sorteio.jpg')} /></Tela>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>Sorteio ao vivo das duplas</div>
          </div>
          <div>
            <Tela><Video src={M('tv-vitoria.mp4')} poster={M('tv-vitoria.jpg')} /></Tela>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>Comemoração de vitória e a linha da chave</div>
          </div>
          <div>
            <Tela>{img('tv-entrada.jpg', 'Telão de chegada com check-in')}</Tela>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>Chegada: quem faz check-in acende com a foto</div>
          </div>
          <div>
            <Tela><Video src={M('tv-podio.mp4')} poster={M('tv-podio.jpg')} /></Tela>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>Pódio animado no encerramento</div>
          </div>
        </div>
      </Secao>

      <Secao alt rotulo="Por que funciona" titulo="Feito para o dia do evento">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 26 }}>
          <Recurso icone={Zap} titulo="Tempo real de verdade" texto="Painel, telão e celulares atualizam juntos, em segundos." />
          <Recurso icone={Wifi} titulo="Leve no 4G" texto="Cada mudança envia só o necessário. Funciona bem mesmo com muita gente conectada." />
          <Recurso icone={ShieldCheck} titulo="Privacidade" texto="Telefones protegidos e só o organizador mexe no torneio." />
          <Recurso icone={PartyPopper} titulo="Experiência premium" texto="Visual com a identidade do clube, fotos dos atletas e animações nos momentos certos." />
          <Recurso icone={Trophy} titulo="Qualquer formato" texto="Eliminatória com chave de 8, 16 ou 32, disputa de 3º lugar e sets curtos com tie-break." />
          <Recurso icone={Tv} titulo="Telão em tela cheia" texto="Abre no navegador da TV e se adapta a qualquer tamanho de tela." />
        </div>
      </Secao>

      {/* chamada final */}
      <section style={{ padding: 'clamp(64px, 10vw, 120px) 20px', textAlign: 'center', borderTop: '1px solid var(--color-border-dark-subtle)', background: 'radial-gradient(ellipse 60% 70% at 50% 100%, color-mix(in srgb, var(--color-brand-saibro) 22%, transparent), transparent 70%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}><Marcas altura={40} /></div>
        <Revelar><h2 className="cp-display" style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1.1, margin: '0 auto 16px', maxWidth: 820 }}>Leve essa experiência para o seu clube</h2></Revelar>
        <p style={{ fontSize: 17, color: 'var(--color-text-dark-secondary)', margin: '0 auto 30px', maxWidth: 620, lineHeight: 1.6 }}>Assista à demonstração completa e veja o torneio acontecendo do check-in ao pódio.</p>
        <button onClick={() => setVideoAberto(true)} style={{ padding: '16px 30px', borderRadius: 14, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>▶ Assistir à demonstração</button>
        <div style={{ marginTop: 40, fontSize: 12, color: 'var(--color-text-dark-muted)' }}>Demonstração com atletas e fotos fictícios.</div>
      </section>

      {videoAberto && (
        <div onClick={() => setVideoAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-base) 94%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1180 }}>
            <video src={VIDEO_COMPLETO} controls autoPlay playsInline style={{ width: '100%', borderRadius: 14, display: 'block', backgroundColor: 'black' }} />
            <button onClick={() => setVideoAberto(false)} style={{ display: 'block', margin: '16px auto 0', padding: '10px 20px', borderRadius: 12, border: '1px solid var(--color-border-dark)', background: 'none', color: 'var(--color-text-dark-primary)', fontWeight: 700, cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
