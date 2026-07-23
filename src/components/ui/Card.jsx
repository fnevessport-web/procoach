// Dual-contexto: aliases genéricos. O hover (borda vira --color-action-primary) está em
// src/index.css, classe .ui-card:hover.
export function Card({ children, className = '', onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        boxSizing: 'border-box',
      }}
      className={`ui-card ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className={className}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div style={{ padding: '16px 20px' }} className={className}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div style={{ padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: '8px' }} className={className}>
      {children}
    </div>
  )
}
