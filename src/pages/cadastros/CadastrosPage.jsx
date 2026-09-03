import { useState } from 'react'
import { Users, BookOpen, Grid3X3, Target, GraduationCap, CalendarDays, Trophy, Dumbbell, Clock, ClipboardList } from 'lucide-react'
import ProfessoresPage from './ProfessoresPage'
import { AlunosPage } from './AlunosPage'
import { TurmasPage } from './TurmasPage'
import { NiveisPage } from './NiveisPage'
import { QuadrasPage } from './QuadrasPage'
import { ModalidadesPage } from './ModalidadesPage'
import { HorariosPage } from './HorariosPage'
import { GradeDisponibilidade } from './GradeDisponibilidade'
import { EventosPage } from './EventosPage'
import { PesquisaSociosPage } from './PesquisaSociosPage'

const ABAS = [
  { id: 'professores', label: 'Professores', icon: Users, component: ProfessoresPage },
  { id: 'alunos', label: 'Alunos', icon: GraduationCap, component: AlunosPage },
  { id: 'turmas', label: 'Turmas', icon: BookOpen, component: TurmasPage },
  { id: 'modalidades', label: 'Modalidades', icon: Dumbbell, component: ModalidadesPage },
  { id: 'niveis', label: 'Níveis', icon: Target, component: NiveisPage },
  { id: 'quadras', label: 'Quadras', icon: Grid3X3, component: QuadrasPage },
  { id: 'horarios', label: 'Horários', icon: Clock, component: HorariosPage },
  { id: 'grade', label: 'Grade', icon: CalendarDays, component: GradeDisponibilidade },
  { id: 'eventos', label: 'Eventos', icon: Trophy, component: EventosPage },
  { id: 'pesquisa-socios', label: 'Pesquisa', icon: ClipboardList, component: PesquisaSociosPage },
]

export function CadastrosPage() {
  const [abaAtiva, setAbaAtiva] = useState('professores')
  const AbaComponent = ABAS.find(a => a.id === abaAtiva)?.component

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '16px' }}>
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
                background: ativa ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
                color: ativa ? 'white' : 'var(--color-text-light-secondary)',
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