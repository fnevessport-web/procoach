import { useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { AulasProfessor } from './AulasProfessor'
import { AulasCoordenador } from './AulasCoordenador'
import { AulasAdmin } from './AulasAdmin'

export function AulasPage() {
  const { role, podeEditarAulas } = usePermissions()
  const location = useLocation()

  // "Ver grade completa" no dashboard do professor: mostra todos os professores/quadras, só leitura
  if (location.state?.modoGradeCompleta) return <AulasCoordenador somenteLeitura />

  if (role === 'professor') return <AulasProfessor />
  if (role === 'gestor') return <AulasAdmin />
  if (podeEditarAulas) return <AulasCoordenador />
  // financeiro e auxiliar: só consulta, sem nenhum botão de ação
  return <AulasCoordenador somenteLeitura />
}
