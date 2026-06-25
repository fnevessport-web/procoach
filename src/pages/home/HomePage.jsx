import { useModalidades } from '../../hooks/useModalidades'
import { useAulasPendentes } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ICONES_MODALIDADES = {
  'Tênis':          '/images/tenis.png',
  'Padel':          '/images/padel.png',
  'Pickleball':     '/images/pickleball.png',
  'Squash':         '/images/squash.png',
  'Beach Tennis':   '/images/beachtennis.png',
  'Futevôlei':      '/images/futevolei.png',
  'Vôlei de Praia': '/images/voleidepraia.png',
}

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
    <div className="fade-in" style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse at 20% 20%, rgba(252,200,37,0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(67,12,58,0.4) 0%, transparent 60%),
        radial-gradient(ellipse at 50% 50%, rgba(207,27,155,0.05) 0%, transparent 70%),
        #110f0f
      `,
    }}>

      {/* Logos — sem bordas horizontais, só separador vertical */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0',
        padding: '14px 16px',
        marginBottom: '4px',
      }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <img src="/images/logobeyond.png" alt="Beyond"
            style={{ height: '32px', maxWidth: '90px', objectFit: 'contain' }} />
        </div>
        <div style={{ width: '1px', height: '28px', backgroundColor: '#2a2a2a', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <img src="/images/logoprocopio.png" alt="Procopio"
            style={{ height: '32px', maxWidth: '90px', objectFit: 'contain' }} />
        </div>
        <div style={{ width: '1px', height: '28px', backgroundColor: '#2a2a2a', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <img src="/images/logobeacharena.png" alt="Beach Arena"
            style={{ height: '32px', maxWidth: '90px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Saudação */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
            Olá, {perfil?.nome?.split(' ')[0] || 'Usuário'} 👋
          </h1>
          <p style={{ fontSize: '12px', color: '#555', margin: '2px 0 0', textTransform: 'capitalize' }}>{role}</p>
        </div>
        {pendentes > 0 && (
          <button
            onClick={() => navigate('/aulas')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', borderRadius: '12px',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
            }}
          >
            <Bell size={16} />
            <span>{pendentes} pendente{pendentes > 1 ? 's' : ''}</span>
          </button>
        )}
      </div>

      {/* Modalidades */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', margin: 0 }}>Modalidades</h2>
          {modalidadeSelecionada && (
            <button
              onClick={() => setModalidadeSelecionada(null)}
              style={{ fontSize: '12px', color: '#fcc825', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Ver todas
            </button>
          )}
        </div>

        {isLoading ? <Loading /> : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
          }}>
            {modalidades?.map(mod => {
              const selected = modalidadeSelecionada?.id === mod.id
              const icone = ICONES_MODALIDADES[mod.nome]
              return (
                <button
                  key={mod.id}
                  onClick={() => selectModalidade(mod)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                    borderRadius: '16px',
                    border: selected
                      ? '1.5px solid rgba(207,27,155,0.8)'
                      : '1px solid rgba(255,255,255,0.07)',
                    background: selected
                      ? 'linear-gradient(135deg, rgba(252,200,37,0.08), rgba(207,27,155,0.12))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    boxShadow: selected
                      ? '0 0 20px rgba(207,27,155,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Glow amarelo sutil no canto superior */}
                  {!selected && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px', left: '-10px',
                      width: '40px', height: '40px',
                      background: 'radial-gradient(circle, rgba(252,200,37,0.15) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }} />
                  )}
                  {icone ? (
                    <img
                      src={icone}
                      alt={mod.nome}
                      style={{
                        width: '75%',
                        height: '75%',
                        objectFit: 'contain',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '40px' }}>{mod.icone_emoji}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Acesso Rápido */}
      <QuickActions role={role} navigate={navigate} />

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '24px', paddingBottom: '8px' }}>
        <span style={{ fontSize: '10px', color: '#222', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </span>
      </div>
    </div>
  )
}

function QuickActions({ role, navigate }) {
  const actions = {
    admin: [
      { label: 'Ver Aulas Hoje', path: '/aulas', color: '#fcc825' },
      { label: 'Professores', path: '/cadastros/professores', color: '#cf1b9b' },
      { label: 'Turmas', path: '/cadastros/turmas', color: '#d28c3c' },
      { label: 'Financeiro', path: '/financeiro', color: '#7c3aed' },
    ],
    coordenador: [
      { label: 'Ver Aulas Hoje', path: '/aulas', color: '#fcc825' },
      { label: 'KPIs', path: '/kpis', color: '#cf1b9b' },
    ],
    professor: [
      { label: 'Minhas Aulas', path: '/aulas', color: '#fcc825' },
    ],
  }

  const items = actions[role] || actions.professor

  return (
    <div>
      <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '10px' }}>
        Acesso Rápido
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(({ label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px', borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              width: '100%',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#F0F2F5' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}