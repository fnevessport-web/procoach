import useAppStore from '../../store/useAppStore'
import { AulasCoordenador } from './AulasCoordenador'

// Reaproveita o mesmo grid/modal do gestor (status da aula, presenças com nome dos alunos,
// discutir aula) filtrado só pras próprias aulas do professor — assim os dois lados ficam
// sempre visualmente idênticos. Ações de gestor (editar aula, excluir, editar turma, ação em
// massa) ficam escondidas via a prop professorProprioId.
export function AulasProfessor() {
  const { perfil } = useAppStore()
  return <AulasCoordenador professorProprioId={perfil?.professor_id} />
}
