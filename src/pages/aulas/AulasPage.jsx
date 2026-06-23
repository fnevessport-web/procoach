import { useState } from 'react'
import useAppStore from '../../store/useAppStore'
import { AulasProfessor } from './AulasProfessor'
import { AulasCoordenador } from './AulasCoordenador'
import { AulasAdmin } from './AulasAdmin'

export function AulasPage() {
  const { perfil } = useAppStore()
  const role = perfil?.role || 'professor'

  if (role === 'professor') return <AulasProfessor />
  if (role === 'coordenador') return <AulasCoordenador />
  return <AulasAdmin />
}
