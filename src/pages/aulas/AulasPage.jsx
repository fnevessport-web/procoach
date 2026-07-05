import { usePermissions } from '../../hooks/usePermissions'
import { AulasProfessor } from './AulasProfessor'
import { AulasCoordenador } from './AulasCoordenador'
import { AulasAdmin } from './AulasAdmin'

export function AulasPage() {
  const { role, podeEditarAulas } = usePermissions()

  if (role === 'professor') return <AulasProfessor />
  if (role === 'gestor') return <AulasAdmin />
  if (podeEditarAulas) return <AulasCoordenador />
  // financeiro e auxiliar: só consulta, sem nenhum botão de ação
  return <AulasCoordenador somenteLeitura />
}
