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

// A página não pede mais telefone: só o nome completo identifica a pessoa (limite de 2 reposições e
// baixa da aula). A função do banco aceita telefone vazio; se o banco ainda estiver na versão antiga
// (que exigia telefone), tenta de novo com um valor neutro (só zeros), que ela trata como "sem
// telefone" e gera a mesma chave por nome. Assim o link funciona antes e depois de rodar o SQL novo.
export async function confirmarReposicao({ nome, turmas, slotIds }) {
  const enviar = telefone => chamar('extras_confirmar_reposicao', {
    p_nome: nome, p_telefone: telefone, p_turma_atual: turmas, p_declaracao: true, p_slot_ids: slotIds,
  })
  const r = await enviar('')
  if (r?.ok === false && r.codigo === 'dados_invalidos' && /telefone/i.test(r.mensagem || '')) return enviar('0000000000')
  return r
}

export const confirmarPresente = ({ inscricaoId, slotIds }) =>
  chamar('extras_confirmar_presente', { p_inscricao_id: inscricaoId, p_slot_ids: slotIds })
