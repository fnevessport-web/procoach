import { useState } from 'react'
import { Users, GraduationCap, BookOpen, Target, LayoutGrid } from 'lucide-react'
import { ProfessoresPage } from './ProfessoresPage'
import { AlunosPage } from './AlunosPage'
import { TurmasPage } from './TurmasPage'
import { NiveisPage } from './NiveisPage'
import { QuadrasPage } from './QuadrasPage'

const tabs = [
  { key: 'professores', label: 'Professores', icon: GraduationCap },
  { key: 'alunos', label: 'Alunos', icon: Users },
  { key: 'turmas', label: 'Turmas', icon: BookOpen },
  { key: 'niveis', label: 'Níveis', icon: Target },
  { key: 'quadras', label: 'Quadras', icon: LayoutGrid },
]

export function CadastrosPage() {
  const [tab, setTab] = useState('professores')

  return (
    <div className="fade-in">
      <h1 className="text-xl font-bold text-[#F0F2F5] mb-5">Cadastros</h1>

      <div className="flex gap-1 mb-5 p-1 bg-[#1A1D27] border border-[#2A2D3E] rounded-xl overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center ${
              tab === key ? 'bg-[#00D4AA] text-[#0F1117]' : 'text-[#8B8FA8]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'professores' && <ProfessoresPage />}
      {tab === 'alunos' && <AlunosPage />}
      {tab === 'turmas' && <TurmasPage onIrParaProfessores={() => setTab('professores')} />}
      {tab === 'niveis' && <NiveisPage />}
      {tab === 'quadras' && <QuadrasPage />}
    </div>
  )
}
