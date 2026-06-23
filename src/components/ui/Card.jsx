export function Card({ children, className = '', onClick, ...props }) {
  return (
    <div
      className={`
        bg-[#1A1D27] rounded-2xl border border-[#2A2D3E]
        ${onClick ? 'cursor-pointer hover:bg-[#1E2235] hover:border-[#3A3D4E] transition-all active:scale-[0.98]' : ''}
        ${className}
      `}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-5 pt-5 pb-0 flex items-center justify-between ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-5 pb-5 pt-0 flex items-center gap-2 ${className}`}>
      {children}
    </div>
  )
}
