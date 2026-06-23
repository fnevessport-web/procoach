import { useModalidades } from '../../hooks/useModalidades'
import { useAulasPendentes } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const { data: modalidades, isLoading } = useModalidades()
  const { data: pendentes = 0 } = useAulasPendentes()
  const { modalidadeSelecionada, setModalidadeSelecionada, perfil } = useAppStore()
  const navigate = useNavigate()

  const role = perfil?.role || 'professor'

  function selectModalidade(mod) {
    if (modalidadeSelecionada?.id === mod.id) {
      setModalidadeSelecionada(null)
    } else {
      setModalidadeSelecionada(mod)
    }
  }

  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-[#F0F2F5]">
              Olá, {perfil?.nome?.split(' ')[0] || 'Usuário'} 👋
            </h1>
            <p className="text-sm text-[#8B8FA8] capitalize">{role}</p>
          </div>
          {pendentes > 0 && (
            <button
              onClick={() => navigate('/aulas')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium"
            >
              <Bell size={16} />
              <span>{pendentes} pendente{pendentes > 1 ? 's' : ''}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#F0F2F5]">Modalidades</h2>
          {modalidadeSelecionada && (
            <button
              onClick={() => setModalidadeSelecionada(null)}
              className="text-xs text-[#00D4AA] hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>

        {isLoading ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {modalidades?.map(mod => {
              const selected = modalidadeSelecionada?.id === mod.id
              return (
                <button
                  key={mod.id}
                  onClick={() => selectModalidade(mod)}
                  className={`
                    relative flex flex-col items-center justify-center gap-2.5
                    p-5 rounded-2xl border transition-all active:scale-95
                    ${selected
                      ? 'border-2 scale-[1.02]'
                      : 'bg-[#1A1D27] border-[#2A2D3E] hover:bg-[#1E2235] hover:border-[#3A3D4E]'
                    }
                  `}
                  style={selected ? {
                    backgroundColor: `${mod.cor_hex}20`,
                    borderColor: mod.cor_hex,
                  } : {}}
                >
                  <span className="text-4xl">{mod.icone_emoji}</span>
                  <span className="text-sm font-semibold text-[#F0F2F5] text-center leading-tight">
                    {mod.nome}
                  </span>
                  {selected && (
                    <div
                      className="absolute top-2 right-2 w-2 h-2 rounded-full"
                      style={{ backgroundColor: mod.cor_hex }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <QuickActions role={role} navigate={navigate} />
    </div>
  )
}

function QuickActions({ role, navigate }) {
  const actions = {
    admin: [
      { label: '📅 Ver Aulas Hoje', path: '/aulas', color: '#00D4AA' },
      { label: '👥 Professores', path: '/cadastros/professores', color: '#3B82F6' },
      { label: '🏫 Turmas', path: '/cadastros/turmas', color: '#8B5CF6' },
      { label: '💰 Financeiro', path: '/financeiro', color: '#F59E0B' },
    ],
    coordenador: [
      { label: '📅 Ver Aulas Hoje', path: '/aulas', color: '#00D4AA' },
      { label: '📊 KPIs', path: '/kpis', color: '#3B82F6' },
    ],
    professor: [
      { label: '📅 Minhas Aulas', path: '/aulas', color: '#00D4AA' },
    ],
  }

  const items = actions[role] || actions.professor

  return (
    <div>
      <h2 className="text-base font-semibold text-[#F0F2F5] mb-3">Acesso Rápido</h2>
      <div className="flex flex-col gap-2">
        {items.map(({ label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#1A1D27] border border-[#2A2D3E] hover:bg-[#1E2235] transition-all active:scale-[0.98] text-left"
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm font-medium text-[#F0F2F5]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
