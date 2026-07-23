import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { AlunoCard } from '../../components/AlunoCard'

export function AlunoCardPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 22px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: 'var(--color-action-primary)', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: 0 }}>
          Perfil do aluno
        </h1>
      </div>

      <AlunoCard alunoId={id} />
    </div>
  )
}
