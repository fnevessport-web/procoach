import { Search, X } from 'lucide-react'

export function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A4D65]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2.5 rounded-xl
          bg-[#1A1D27] border border-[#2A2D3E]
          text-[#F0F2F5] placeholder-[#4A4D65]
          focus:border-[#00D4AA] focus:ring-1 focus:ring-[#00D4AA]/20
          transition-colors text-sm
        "
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A4D65] hover:text-[#8B8FA8]"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
