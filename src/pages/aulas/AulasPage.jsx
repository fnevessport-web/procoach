import { useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { AulasProfessor } from './AulasProfessor'
import { AulasCoordenador } from './AulasCoordenador'
import { AulasAdmin } from './AulasAdmin'

export function AulasPage() {
  const { role, podeEditarAulas, podeIncluirAlunoAula } = usePermissions()
  const location = useLocation()

  // "Ver grade completa" no dashboard do professor: mostra todos os professores/quadras, só leitura
  if (location.state?.modoGradeCompleta) return <AulasCoordenador somenteLeitura />

  if (role === 'professor') return <AulasProfessor />
  if (role === 'gestor') return <AulasAdmin />
  if (podeEditarAulas) return <AulasCoordenador />
  // Recepção: vê a grade igual todo mundo, mas só pode incluir aluno na lista de presença e
  // marcar presente/falta — sem nenhuma ação administrativa (editar turma, mover horário,
  // excluir aula, substituir professor, confirmar/cancelar aula) — e só na aula que está
  // rolando agora (restringirPresencaAoVivo), nunca em aula passada nem futura.
  if (podeIncluirAlunoAula) return <AulasCoordenador somenteLeitura podeMarcarPresenca restringirPresencaAoVivo />
  // financeiro e auxiliar: só consulta, sem nenhum botão de ação
  return <AulasCoordenador somenteLeitura />
}
