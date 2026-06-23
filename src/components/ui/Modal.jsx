import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`
        relative w-full ${sizes[size]}
        bg-[#1A1D27] border border-[#2A2D3E]
        rounded-t-3xl sm:rounded-2xl
        shadow-2xl slide-up
        max-h-[90vh] flex flex-col
      `}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2A2D3E] flex-shrink-0">
          <h2 className="text-lg font-semibold text-[#F0F2F5]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#F0F2F5] hover:bg-[#2A2D3E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
