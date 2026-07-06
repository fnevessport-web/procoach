const variants = {
  default: 'bg-[#2A2D3E] text-[#8B8FA8]',
  accent: 'bg-[#00D4AA]/20 text-[#00D4AA]',
  success: 'bg-[#10B981]/20 text-[#10B981]',
  warning: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  danger: 'bg-[#EF4444]/20 text-[#EF4444]',
  info: 'bg-[#3B82F6]/20 text-[#3B82F6]',
}

export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`
      inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
      ${variants[variant]} ${className}
    `}>
      {children}
    </span>
  )
}
