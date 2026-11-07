import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { nomeCurto, rotuloFase } from '../../lib/campeonato'
import { Avatar } from './componentes'

// Animação do telão quando um jogo termina:
//   1. zoom: cartão grande no meio da tela com as fotos dos vencedores, "Vitória!" e confete;
//   2. voltar: o cartão encolhe e voa até o quadrado do jogo na chave;
//   3. linha: só uma linha verde-lima "corre" do jogo até o próximo jogo da dupla na chave.
// Coordenadas no palco de 1920x1080 da TV (o palco é escalado; `escala` desfaz isso).

const LARGURA = 980
const CORES_CONFETE = ['var(--color-brand-lima)', 'var(--color-brand-saibro)', 'var(--color-brand-areia)', 'var(--color-state-success)']

function gerarConfete(qtd) {
  return Array.from({ length: qtd }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    atraso: Math.random() * 1.2,
    duracao: 2.6 + Math.random() * 1.8,
    tamanho: 8 + Math.random() * 10,
    cor: CORES_CONFETE[i % CORES_CONFETE.length],
    giro: Math.random() > 0.5 ? 1 : -1,
    redondo: Math.random() > 0.6,
  }))
}

export function CelebracaoVitoria({ jogo, jogos, duplaPorId, palco, escala, onFim }) {
  const [fase, setFase] = useState('zoom')
  const [alvo, setAlvo] = useState(null)
  const [linha, setLinha] = useState(null)
  const [confete] = useState(() => gerarConfete(90))

  const vencedores = duplaPorId.get(jogo.vencedor_id)
  const proximo = jogos.find(j => j.id !== jogo.id && j.fase !== 'terceiro' && j.rodada > jogo.rodada
    && (j.dupla_a_id === jogo.vencedor_id || j.dupla_b_id === jogo.vencedor_id))
  const titulo = jogo.fase === 'final' ? 'Campeões!' : jogo.fase === 'terceiro' ? '3º lugar!' : 'Vitória!'
  const lado = jogo.vencedor_id === jogo.dupla_a_id ? 'a' : 'b'
  const placar = (jogo.sets || []).map(s => `${s[lado] ?? 0}-${s[lado === 'a' ? 'b' : 'a'] ?? 0}`).join('  ')

  useEffect(() => {
    const medir = id => {
      const raiz = palco.current
      const el = raiz?.querySelector(`[data-jogo="${id}"]`)
      if (!raiz || !el) return null
      const b = raiz.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { x: (r.left - b.left) / escala, y: (r.top - b.top) / escala, w: r.width / escala, h: r.height / escala }
    }
    const t1 = setTimeout(() => { setAlvo(medir(jogo.id)); setFase('voltar') }, 7000)
    const t2 = setTimeout(() => {
      const a = medir(jogo.id)
      const b = proximo ? medir(proximo.id) : null
      if (a && b) {
        const paraDireita = b.x + b.w / 2 > a.x + a.w / 2
        const x1 = paraDireita ? a.x + a.w : a.x
        const x2 = paraDireita ? b.x : b.x + b.w
        const y1 = a.y + a.h / 2
        const y2 = b.y + b.h / 2
        const meio = (x1 + x2) / 2
        setLinha({ d: `M ${x1} ${y1} H ${meio} V ${y2} H ${x2}` })
      }
      setFase('linha')
    }, 8000)
    const t3 = setTimeout(onFim, proximo ? 11500 : 8600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    // roda uma vez por jogo celebrado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogo.id])

  if (fase === 'linha') {
    if (!linha) return null
    return (
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', overflow: 'visible' }}>
        <path d={linha.d} pathLength={1} fill="none" stroke="var(--color-brand-lima)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className="cp-linha" style={{ filter: 'drop-shadow(0 0 8px var(--color-brand-lima))' }} />
      </svg>
    )
  }

  // Movimento de volta: do centro (960, 540) até o centro do quadrado na chave.
  const voltando = fase === 'voltar' && alvo
  const transformacao = voltando
    ? `translate(${alvo.x + alvo.w / 2 - 960}px, ${alvo.y + alvo.h / 2 - 540}px) scale(${Math.max(0.08, alvo.w / LARGURA)})`
    : 'translate(0, 0) scale(1)'

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-brand-lima) 18%, var(--color-surface-dark-base)), color-mix(in srgb, var(--color-surface-dark-base) 92%, transparent) 70%)', opacity: voltando ? 0 : 1, transition: 'opacity 0.8s ease' }} />

      {!voltando && confete.map(c => (
        <span key={c.id} className="cp-confete" style={{
          position: 'absolute', top: -40, left: `${c.left}%`, width: c.tamanho, height: c.redondo ? c.tamanho : c.tamanho * 0.45,
          borderRadius: c.redondo ? '50%' : 2, backgroundColor: c.cor,
          animationDelay: `${c.atraso}s`, animationDuration: `${c.duracao}s`, '--giro': c.giro,
        }} />
      ))}

      <div style={{
        position: 'absolute', left: 960 - LARGURA / 2, top: 540 - 300, width: LARGURA,
        transform: transformacao, transformOrigin: 'center center',
        transition: 'transform 0.95s cubic-bezier(0.6, 0, 0.3, 1), opacity 0.95s ease', opacity: voltando ? 0.15 : 1,
      }}>
        <div className="cp-zoom" style={{ padding: '36px 40px 40px', borderRadius: 36, textAlign: 'center', backgroundColor: 'var(--color-surface-dark-raised)', border: '3px solid var(--color-brand-lima)', boxShadow: '0 0 80px color-mix(in srgb, var(--color-brand-lima) 40%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 22, fontWeight: 800, letterSpacing: '6px', color: 'var(--color-brand-lima)' }}>
            <Trophy size={30} />{rotuloFase(jogo.fase).toUpperCase()}{jogo.quadra ? ` · ${jogo.quadra.toUpperCase()}` : ''}
          </div>
          <div className="cp-display" style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, margin: '14px 0 28px' }}>{titulo}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 70 }}>
            {[vencedores?.atleta1, vencedores?.atleta2].map((a, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <Avatar atleta={a} tamanho={210} destaque />
                <div className="cp-display" style={{ fontSize: 38, fontWeight: 700 }}>{nomeCurto(a?.nome)}</div>
              </div>
            ))}
          </div>
          {placar && <div style={{ marginTop: 22, fontSize: 34, fontWeight: 800, letterSpacing: '4px', color: 'var(--color-text-dark-secondary)', fontVariantNumeric: 'tabular-nums' }}>{placar}</div>}
          {proximo && <div style={{ marginTop: 10, fontSize: 22, color: 'var(--color-text-dark-secondary)' }}>Avançam para {rotuloFase(proximo.fase).toLowerCase() === 'final' ? 'a Final' : `as ${rotuloFase(proximo.fase)}`.replace('as Semifinal', 'a Semifinal')}</div>}
        </div>
      </div>
    </div>
  )
}
