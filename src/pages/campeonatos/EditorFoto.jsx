import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { RotateCw, ZoomIn, ZoomOut, Move } from 'lucide-react'
import { prepararImagem, girarImagem, recortarFoto } from '../../lib/campeonato'

// Editor da foto do atleta: depois de tirar/escolher a foto, a pessoa arrasta para centralizar o
// rosto no círculo, aproxima (dois dedos, roda do mouse ou a barra) e pode girar. Só o que está
// dentro do círculo vira a foto que aparece na TV, na chave e no sorteio.

const ZOOM_MAX = 5

export function EditorFoto({ arquivo, onCancelar, onConfirmar, salvando = false }) {
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [girando, setGirando] = useState(false)
  const ponteiros = useRef(new Map())
  const pinca = useRef(null)
  const janela = Math.min(300, (typeof window !== 'undefined' ? window.innerWidth : 360) - 64)

  useEffect(() => {
    let vivo = true
    prepararImagem(arquivo)
      .then(r => { if (vivo) setImg(r) })
      .catch(e => { toast.error(e.message); onCancelar() })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo])

  const base = img ? janela / Math.min(img.w, img.h) : 1
  const limitar = (p, z) => {
    if (!img) return p
    const mx = Math.max(0, (img.w * base * z - janela) / 2)
    const my = Math.max(0, (img.h * base * z - janela) / 2)
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
  }
  const mudarZoom = (z) => {
    const novo = Math.min(ZOOM_MAX, Math.max(1, z))
    setZoom(novo)
    setPos(p => limitar(p, novo))
  }

  const aoBaixar = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      pinca.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  const aoMover = (e) => {
    const anterior = ponteiros.current.get(e.pointerId)
    if (!anterior) return
    const atual = { x: e.clientX, y: e.clientY }
    ponteiros.current.set(e.pointerId, atual)
    if (ponteiros.current.size === 1) {
      setPos(p => limitar({ x: p.x + atual.x - anterior.x, y: p.y + atual.y - anterior.y }, zoom))
    } else if (ponteiros.current.size === 2 && pinca.current) {
      const [a, b] = [...ponteiros.current.values()]
      mudarZoom(pinca.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinca.current.dist))
    }
  }
  const aoSoltar = (e) => {
    ponteiros.current.delete(e.pointerId)
    if (ponteiros.current.size < 2) pinca.current = null
  }

  const girar = async () => {
    if (!img || girando) return
    setGirando(true)
    try {
      setImg(await girarImagem(img))
      setZoom(1)
      setPos({ x: 0, y: 0 })
    } finally {
      setGirando(false)
    }
  }

  const confirmar = async () => {
    if (!img) return
    onConfirmar(await recortarFoto(img, janela, zoom, pos))
  }

  const esc = base * zoom
  const botaoIcone = { width: 44, height: 44, borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-base) 97%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top)) 20px calc(16px + env(safe-area-inset-bottom))', color: 'var(--color-text-dark-primary)', fontFamily: 'var(--font-family-sans)' }}>
      <div className="cp-display" style={{ fontSize: 24, fontWeight: 700 }}>Ajuste sua foto</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', margin: '6px 0 18px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Move size={14} />Arraste para deixar o rosto no meio do círculo
      </div>

      <div
        onPointerDown={aoBaixar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onWheel={e => mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93))}
        style={{ position: 'relative', width: janela, height: janela, overflow: 'hidden', borderRadius: 20, touchAction: 'none', cursor: 'grab', backgroundColor: 'var(--color-surface-dark-raised)', userSelect: 'none' }}
      >
        {img ? (
          <img src={img.src} alt="" draggable={false} style={{
            position: 'absolute', left: '50%', top: '50%', width: img.w * esc, height: img.h * esc, maxWidth: 'none',
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, pointerEvents: 'none',
          }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--color-text-dark-muted)' }}>Carregando foto...</div>
        )}
        {/* máscara: escurece fora do círculo e marca a borda */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', boxShadow: '0 0 0 1000px color-mix(in srgb, var(--color-surface-dark-base) 72%, transparent)', border: '2px solid var(--color-brand-lima)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: janela, marginTop: 18 }}>
        <button onClick={() => mudarZoom(zoom / 1.2)} style={botaoIcone} aria-label="Afastar"><ZoomOut size={18} /></button>
        <input type="range" min={1} max={ZOOM_MAX} step={0.01} value={zoom} onChange={e => mudarZoom(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--color-brand-lima)' }} aria-label="Zoom" />
        <button onClick={() => mudarZoom(zoom * 1.2)} style={botaoIcone} aria-label="Aproximar"><ZoomIn size={18} /></button>
        <button onClick={girar} disabled={girando} style={botaoIcone} aria-label="Girar"><RotateCw size={18} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, width: janela, marginTop: 22 }}>
        <button onClick={onCancelar} disabled={salvando} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent', color: 'var(--color-text-dark-secondary)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
        <button onClick={confirmar} disabled={!img || salvando} style={{ flex: 1.6, padding: '13px 0', borderRadius: 12, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: !img || salvando ? 0.6 : 1 }}>
          {salvando ? 'Salvando...' : 'Usar esta foto'}
        </button>
      </div>
    </div>
  )
}
