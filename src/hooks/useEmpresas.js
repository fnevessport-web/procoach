import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Empresas (tenants) que o usuário logado tem vínculo — cada vínculo já traz
// o role específico dentro daquela empresa (usuario_empresas.role)
export function useMinhasEmpresas(userId) {
  return useQuery({
    queryKey: ['minhas_empresas', userId],
    queryFn: async () => {
      // Tabela usuario_empresas pode ainda não existir (fase de transição) — trata como
      // "sem conceito de empresa ainda" em vez de quebrar o app
      const { data, error } = await supabase
        .from('usuario_empresas')
        .select('id, role, empresas(id, nome, logo_url)')
        .eq('user_id', userId)
      if (error) return []
      return (data || [])
        .filter(v => v.empresas)
        .map(v => ({ id: v.empresas.id, nome: v.empresas.nome, logoUrl: v.empresas.logo_url, role: v.role }))
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
