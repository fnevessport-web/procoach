import { Bell, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAulasPendentes } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'

export function Header() {
  const { perfil, signOut } = useAuth()
  const { data: pendentes = 0 } = useAulasPendentes()
  const [menuOpen, setMenuOpen] = useState(false)
  const { modalidadeSelecionada, setModalidadeSelecionada } = useAppStore()

  return (
    <header className="sticky top-0 z-40 bg-[#0F1117]/95 backdrop-blur border-b border-[#2A2D3E]">
      <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00D4AA]/20 flex items-center justify-center">
            <span className="text-xl">🏆</span>
          </div>
          <span className="text-lg font-bold text-[#F0F2F5]">ProCoach</span>
        </div>

        <div className="flex items-center gap-2">
          {pendentes > 0 && (
            <div className="relative">
              <Bell size={20} className="text-[#8B8FA8]" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#EF4444] rounded-full text-xs text-white flex items-center justify-center pulse-badge font-bold">
                {pendentes > 9 ? '9+' : pendentes}
              </span>
            </div>
          )}

          {modalidadeSelecionada && (
            <button
              onClick={() => setModalidadeSelecionada(null)}
              className="px-2.5 py-1 rounded-lg bg-[#00D4AA]/15 text-[#00D4AA] text-xs font-medium border border-[#00D4AA]/30 flex items-center gap-1"
            >
              {modalidadeSelecionada.icone_emoji} {modalidadeSelecionada.nome}
              <span className="text-[#00D4AA]/60">×</span>
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1A1D27] border border-[#2A2D3E] hover:bg-[#1E2235] transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[#00D4AA]/30 flex items-center justify-center">
                <span className="text-xs font-bold text-[#00D4AA]">
                  {(perfil?.nome || 'U')[0].toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-[#8B8FA8] hidden sm:block max-w-24 truncate">
                {perfil?.nome || perfil?.role || 'Usuário'}
              </span>
              <ChevronDown size={12} className="text-[#4A4D65]" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1A1D27] border border-[#2A2D3E] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2A2D3E]">
                    <div className="text-sm font-medium text-[#F0F2F5]">{perfil?.nome || 'Usuário'}</div>
                    <div className="text-xs text-[#8B8FA8] capitalize">{perfil?.role}</div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); signOut() }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
