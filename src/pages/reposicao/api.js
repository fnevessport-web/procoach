import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// Vagas "quase em tempo real": repuxa a cada 15s (e ao voltar pra aba). A decisão de vaga de
// verdade é sempre do servidor (lock nas funções), então uma tela até 15s defasada só gera
// um aviso de "acabou de lotar" — nunca overselling. Mesmo raciocínio do EventoInscricaoPage.
export function useVagas(tipo) {
  return useQuery({
    queryKey: ['extras-vagas', tipo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('extras_vagas', { p_tipo: tipo })
      if (error) throw error
      return data || []
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  })
}

async function chamar(nomeFuncao, args) {
  const { data, error } = await supabase.rpc(nomeFuncao, args)
  if (error) throw new Error('Não foi possível concluir agora. Tente novamente em instantes.')
  return data // { ok, codigo?, mensagem?, slot_ids?, ... }
}

export const confirmarReposicao = ({ nome, telefone, turmas, slotIds }) =>
  chamar('extras_confirmar_reposicao', {
    p_nome: nome, p_telefone: telefone, p_turma_atual: turmas, p_declaracao: true, p_slot_ids: slotIds,
  })

export const confirmarPresente = ({ inscricaoId, slotIds }) =>
  chamar('extras_confirmar_presente', { p_inscricao_id: inscricaoId, p_slot_ids: slotIds })
