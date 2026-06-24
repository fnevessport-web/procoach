import { useState } from 'react'
import { Users, BookOpen, Grid3X3, Target, GraduationCap } from 'lucide-react'
import ProfessoresPage from './ProfessoresPage'
import { AlunosPage } from './AlunosPage'
import { TurmasPage } from './TurmasPage'
import { NiveisPage } from './NiveisPage'
import { QuadrasPage } from './QuadrasPage'

const ABAS = [
  { id: 'professores', label: 'Professores', icon: Users, component: ProfessoresPage },
  { id: 'alunos', label: 'Alunos', icon: GraduationCap, component: AlunosPage },
  { id: 'turmas', label: 'Turmas', icon: BookOpen, component: TurmasPage },
  { id: 'niveis', label: 'Níveis', icon: Target, component: NiveisPage },
  { id: 'quadras', label: 'Quadras', icon: Grid3X3, component: QuadrasPage },
]

export function CadastrosPage() {
  const [abaAtiva, setAbaAtiva] = useState('professores')

  const AbaComponent = ABAS.find(a => a.id === abaAtiva)?.component

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-0">
        <h1 className="text-xl font-bold text-[#F0F2F5] mb-4">Cadastros</h1>
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {ABAS.map(aba => {
            const Icon = aba.icon
            const ativa = abaAtiva === aba.id
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  ativa
                    ? 'bg-[#00D4AA] text-[#0A0B0F]'
                    : 'text-[#8B8FA8] hover:text-[#F0F2F5]'
                }`}
              >
                <Icon size={14} />
                {aba.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {AbaComponent && <AbaComponent />}
      </div>
    </div>
  )
}