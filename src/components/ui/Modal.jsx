import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const maxWidths = { sm: '400px', md: '520px', lg: '600px', xl: '720px' }

  return (
    <div style={{
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
        backgroundColor: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #2a2a2a', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#F0F2F5', margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px', borderRadius: '8px', border: 'none',
              backgroundColor: 'rgba(255,255,255,0.05)', color: '#888',
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
  )
}