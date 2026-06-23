import { Loader2 } from 'lucide-react'

export function Loading({ text = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 size={32} className="spin text-[#00D4AA]" />
      <span className="text-sm text-[#8B8FA8]">{text}</span>
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="fixed inset-0 bg-[#0F1117] flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/20 flex items-center justify-center">
          <span className="text-3xl">🏆</span>
        </div>
        <div className="text-xl font-bold text-[#F0F2F5]">ProCoach</div>
        <Loader2 size={24} className="spin text-[#00D4AA]" />
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-4xl">{icon || '📭'}</div>
      <div className="text-base font-medium text-[#F0F2F5]">{title}</div>
      {description && <p className="text-sm text-[#8B8FA8] max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
