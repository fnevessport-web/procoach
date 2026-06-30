import { useState } from 'react'
import { Users, BookOpen, Grid3X3, Target, GraduationCap, CalendarDays } from 'lucide-react'
import ProfessoresPage from './ProfessoresPage'
import { AlunosPage } from './AlunosPage'
import { TurmasPage } from './TurmasPage'
import { NiveisPage } from './NiveisPage'
import { QuadrasPage } from './QuadrasPage'
import { GradeDisponibilidade } from './GradeDisponibilidade'

const ABAS = [
  { id: 'professores', label: 'Professores', icon: Users, component: ProfessoresPage },
  { id: 'alunos', label: 'Alunos', icon: GraduationCap, component: AlunosPage },
  { id: 'turmas', label: 'Turmas', icon: BookOpen, component: TurmasPage },
  { id: 'niveis', label: 'Níveis', icon: Target, component: NiveisPage },
  { id: 'quadras', label: 'Quadras', icon: Grid3X3, component: QuadrasPage },
  { id: 'grade', label: 'Grade', icon: CalendarDays, component: GradeDisponibilidade },
]

export function CadastrosPage() {
  const [abaAtiva, setAbaAtiva] = useState('professores')
  const AbaComponent = ABAS.find(a => a.id === abaAtiva)?.component

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', marginBottom: '16px' }}>
        Cadastros
      </h1>

      {/* Abas */}
      <div style={{
        display: 'flex', gap: '4px', overflowX: 'auto',
        marginBottom: '20px', paddingBottom: '2px',
      }}>
        {ABAS.map(aba => {
          const Icon = aba.icon
          const ativa = abaAtiva === aba.id
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '10px', border: 'none',
                whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                flexShrink: 0, transition: 'all 0.2s',
                background: ativa ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                color: ativa ? 'white' : '#555',
              }}
            >
              <Icon size={13} />
              {aba.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {AbaComponent && <AbaComponent />}
      </div>
    </div>
  )
}