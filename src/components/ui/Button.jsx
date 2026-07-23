import { Loader2 } from 'lucide-react'

// Dual-contexto: variantes secondary/ghost usam os aliases genéricos; primary/danger/outline
// usam --color-action-primary/--color-state-danger, que já são os mesmos hex nos dois contextos
// (não precisam de alias).
export function Button({
  children, variant = 'primary', size = 'md', loading = false,
  disabled = false, className = '', onClick, type = 'button', ...props
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'all 0.15s', border: 'none',
    fontWeight: '500', fontFamily: 'inherit',
  }

  const variants = {
    primary: {
      backgroundColor: 'var(--color-action-primary)',
      color: 'var(--color-action-on-primary)', fontWeight: '600',
    },
    secondary: {
      backgroundColor: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      color: 'var(--text-primary)',
    },
    danger: {
      backgroundColor: 'var(--color-state-danger)',
      color: 'white', fontWeight: '600',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
    },
    outline: {
      backgroundColor: 'transparent',
      border: '1px solid var(--color-action-primary)',
      color: 'var(--color-action-primary)',
    },
  }

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '13px', borderRadius: '8px', gap: '6px' },
    md: { padding: '10px 16px', fontSize: '14px', borderRadius: '10px', gap: '8px' },
    lg: { padding: '14px 24px', fontSize: '15px', borderRadius: '12px', gap: '8px' },
    icon: { padding: '10px', borderRadius: '10px' },
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], ...sizes[size] }}
      className={className}
      {...props}
    >
      {loading ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  )
}
