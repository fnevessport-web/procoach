import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { temaDaRota } from '../../constants/temaPorRota'

// Dual-contexto: usa os aliases genéricos (var(--surface), var(--text-primary)...) definidos em
// src/index.css (.theme-dark/.theme-light) — funciona certo tanto aberto a partir de uma página
// clara (Cadastros) quanto de uma escura (Ranking), sem precisar de prop de tema. Como o modal
// escapa via createPortal pro <body> (fora da árvore DOM do <main class="theme-x">), a classe
// de tema não seria herdada por cascata normal — por isso aplica a própria classe aqui,
// resolvida pela rota atual, direto no wrapper do portal. `theme` (opcional) força um contexto
// específico independente da rota — usado por ilhas escuras como ConquistasCard, cujos modais
// precisam ficar sempre escuros mesmo quando abertos de dentro de uma página Clara (ficha do aluno).
export function Modal({ open, onClose, title, children, size = 'md', theme }) {
  const { pathname } = useLocation()

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const maxWidths = { sm: '400px', md: '520px', lg: '600px', xl: '720px' }

  // Via portal pro <body>: escapa do .app-main (overflow-y + scroll-touch), que no WebKit
  // mobile "prende" filhos position:fixed dentro dele em vez de cobrir a tela toda — por
  // isso o modal aparecia cortado, com a BottomNav visível por baixo dele.
  return createPortal((
    <div className={theme || temaDaRota(pathname)} style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: 0,
    }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: maxWidths[size],
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        maxHeight: '90dvh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px', borderRadius: '8px', border: 'none',
              backgroundColor: 'var(--border-subtle)', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  ), document.body)
}
