export function Card({ children, className = '', onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        boxSizing: 'border-box',
      }}
      className={className}
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