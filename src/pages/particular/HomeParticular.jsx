import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

// Home do modo Particular (profissional autônomo assinante) — Fase 1 é só um stub: saudação +
// atalho pra Agenda. Sem nenhum widget de clube (nada de Ranking/Financeiro/Pontuação Beyond
// aqui, mesmo que existam componentes prontos pra isso — essa página não pode importar nada de
// src/pages/home/HomePage.jsx nem de outras telas de clube). Financeiro/indicadores reais
// (aulas hoje/amanhã, inadimplência etc.) ficam pra Fase 2+, quando existir cadastro de aluno.
export function HomeParticular() {
  const navigate = useNavigate()
  const { perfil } = useAppStore()

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: '0 0 6px' }}>
        Olá, {perfil?.nome?.split(' ')[0] || 'professor'}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', margin: '0 0 24px' }}>
        Sua prática particular no ProCoach.
      </p>

      <button
        onClick={() => navigate('/aulas')}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          width: '100%', padding: '20px', borderRadius: '16px',
          backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid rgba(165,76,46,0.25)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
          backgroundColor: 'rgba(165,76,46,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CalendarDays size={22} color="var(--color-action-primary)" />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>Agenda</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>
            Ver e organizar sua semana de aulas
          </div>
        </div>
      </button>
    </div>
  )
}
