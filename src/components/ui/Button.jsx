import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-[#00D4AA] hover:bg-[#00A884] text-[#0F1117] font-semibold',
  secondary: 'bg-[#1E2235] hover:bg-[#252840] text-[#F0F2F5] border border-[#2A2D3E]',
  danger: 'bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold',
  ghost: 'bg-transparent hover:bg-[#1E2235] text-[#8B8FA8] hover:text-[#F0F2F5]',
  outline: 'bg-transparent border border-[#00D4AA] text-[#00D4AA] hover:bg-[#00D4AA]/10',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2',
  icon: 'p-2.5 rounded-xl',
}

export function Button({
  children, variant = 'primary', size = 'md', loading = false,
  disabled = false, className = '', onClick, type = 'button', ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center
        transition-all duration-150 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-95
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  )
}
