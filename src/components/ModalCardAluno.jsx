import { useState } from 'react'
import { ChevronLeft, CalendarDays } from 'lucide-react'
import { Modal } from './ui/Modal'
import { AlunoCard } from './AlunoCard'

// Ficha do aluno em pop-up, aberta clicando no nome dele dentro da aula (agenda). Clicar num
// familiar troca a ficha ali mesmo (pilha, com "Voltar" pro anterior) em vez de sair da agenda.
export function ModalCardAluno({ alunoId, onClose, onVoltarGrade }) {
  const [pilha, setPilha] = useState([alunoId])
  const atual = pilha[pilha.length - 1]

  const estiloBotao = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px',
    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  }

  return (
    <Modal open onClose={onClose} title="Ficha do aluno" size="lg">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => (pilha.length > 1 ? setPilha(p => p.slice(0, -1)) : onClose())}
          style={{ ...estiloBotao, border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)' }}
        >
          <ChevronLeft size={14} /> {pilha.length > 1 ? 'Voltar' : 'Voltar para a aula'}
        </button>
        {onVoltarGrade && (
          <button onClick={onVoltarGrade} style={{ ...estiloBotao, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)' }}>
            <CalendarDays size={14} /> Voltar para a grade de aulas
          </button>
        )}
      </div>
      <AlunoCard key={atual} alunoId={atual} onAbrirAluno={id => setPilha(p => [...p, id])} />
    </Modal>
  )
}
