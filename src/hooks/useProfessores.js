import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'

export function useProfessores(modalidadeId) {
  const queryClient = useQueryClient()

  const { data: professores = [], isLoading } = useQuery({
    queryKey: ['professores', modalidadeId],
    queryFn: async () => {
      let query = supabase
        .from('professores')
        .select('*, modalidades(nome)')
        .order('nome')

      const { data, error } = await query
      if (error) throw error
      if (modalidadeId) {
        return (data || []).filter(p =>
          p.modalidade_id === modalidadeId ||
          (p.modalidades_ids && p.modalidades_ids.includes(modalidadeId))
        )
      }
      return data || []
    },
    enabled: true,
  })

  const invalidar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['professores'] })
  }, [queryClient])

  return { professores, isLoading, invalidar }
}

// Restrição de empresa por conta — reaproveita os mesmos campos trabalha_procopio/
// trabalha_beach já usados em todo o financeiro pra separar custos por empresa (ver
// extraPertenceAEmpresa em FinanceiroPage.jsx). Conta vinculada a só uma empresa (ex:
// "Beach Arena - Financeiro") fica travada nela — financeiro E cadastro de professores.
// Conta vinculada às duas (ex: Fernando, Michel) ou sem professor_id (perfil legado) não
// trava nada. Retorna 'procopio' | 'beach_arena' | null (null = sem restrição).
export function useEmpresaVinculada() {
  const { perfil } = useAppStore()
  const professorId = perfil?.professor_id

  const { data: prof } = useQuery({
    queryKey: ['professor_empresa_vinculada', professorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores').select('trabalha_procopio, trabalha_beach').eq('id', professorId).single()
      if (error) throw error
      return data
    },
    enabled: !!professorId,
    staleTime: 5 * 60 * 1000,
  })

  if (!prof) return null
  if (prof.trabalha_procopio && prof.trabalha_beach) return null
  if (prof.trabalha_beach) return 'beach_arena'
  if (prof.trabalha_procopio) return 'procopio'
  return null
}