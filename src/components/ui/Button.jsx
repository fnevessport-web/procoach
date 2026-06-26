import { Loader2 } from 'lucide-react'

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
      background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
      color: 'white', fontWeight: '600',
    },
    secondary: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #2a2a2a',
      color: '#F0F2F5',
    },
    danger: {
      backgroundColor: '#EF4444',
      color: 'white', fontWeight: '600',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#888',
    },
    outline: {
      backgroundColor: 'transparent',
      border: '1px solid #fcc825',
      color: '#fcc825',
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