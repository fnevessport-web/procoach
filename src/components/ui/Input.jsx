export function Input({ label, error, className = '', type = 'text', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#8B8FA8]">{label}</label>
      )}
      <input
        type={type}
        className={`
          w-full px-4 py-3 rounded-xl
          bg-[#0F1117] border border-[#2A2D3E]
          text-[#F0F2F5] placeholder-[#4A4D65]
          focus:border-[#00D4AA] focus:ring-1 focus:ring-[#00D4AA]/30
          transition-colors text-sm
          ${error ? 'border-[#EF4444]' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-xs text-[#EF4444]">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#8B8FA8]">{label}</label>}
      <textarea
        className={`
          w-full px-4 py-3 rounded-xl resize-none
          bg-[#0F1117] border border-[#2A2D3E]
          text-[#F0F2F5] placeholder-[#4A4D65]
          focus:border-[#00D4AA] focus:ring-1 focus:ring-[#00D4AA]/30
          transition-colors text-sm
          ${error ? 'border-[#EF4444]' : ''}
          ${className}
        `}
        rows={3}
        {...props}
      />
      {error && <span className="text-xs text-[#EF4444]">{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#8B8FA8]">{label}</label>}
      <select
        className={`
          w-full px-4 py-3 rounded-xl appearance-none
          bg-[#0F1117] border border-[#2A2D3E]
          text-[#F0F2F5]
          focus:border-[#00D4AA] focus:ring-1 focus:ring-[#00D4AA]/30
          transition-colors text-sm cursor-pointer
          ${error ? 'border-[#EF4444]' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-[#EF4444]">{error}</span>}
    </div>
  )
}
