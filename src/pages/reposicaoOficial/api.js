import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { demo, modoDemo } from './demo'

// Link oficial de reposição (/reposicao): tudo passa pelas funções repo_* do banco
// (scripts/2026-10-29_reposicao_link_oficial.sql e 2026-10-29b), que revalidam aluno + chave de
// sessão (devolvida pelo repo_identificar; vai no parâmetro p_telefone) a cada chamada
// e conferem todas as regras (saldo, nível, vaga, 7 dias, 2h de antecedência) do lado do servidor.

async function chamar(nomeFuncao, args) {
  const { data, error } = await supabase.rpc(nomeFuncao, args)
  if (error) throw new Error('Não foi possível concluir agora. Tente novamente em instantes.')
  return data
}

export const identificar = ({ nome, telefone }) => modoDemo() ? demo.identificar({ telefone }) :
  chamar('repo_identificar', { p_nome: nome, p_telefone: telefone })

export const agendar = ({ alunoId, telefone, aulaIds }) => modoDemo() ? demo.agendar({ aulaIds }) :
  chamar('repo_agendar', { p_aluno_id: alunoId, p_telefone: telefone, p_aula_ids: aulaIds })

export const entrarListaEspera = ({ alunoId, telefone, dias, faixas, observacao }) => modoDemo() ? demo.ok() :
  chamar('repo_lista_espera', { p_aluno_id: alunoId, p_telefone: telefone, p_dias: dias, p_faixas: faixas, p_observacao: observacao })

export function usePainel(alunoId, telefone) {
  return useQuery({
    queryKey: ['repo-painel', alunoId],
    enabled: !!alunoId,
    staleTime: 10000,
    queryFn: () => modoDemo() ? demo.painel() : chamar('repo_painel', { p_aluno_id: alunoId, p_telefone: telefone }),
  })
}

// Vagas "quase em tempo real" (mesmo raciocínio do link antigo): a decisão final é do servidor,
// então uma tela até 20s defasada só gera o aviso de "acabou de lotar".
export function useGrade(alunoId, telefone) {
  return useQuery({
    queryKey: ['repo-grade', alunoId],
    enabled: !!alunoId,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
    queryFn: () => modoDemo() ? demo.grade() : chamar('repo_grade', { p_aluno_id: alunoId, p_telefone: telefone }),
  })
}

// Aluno entrou pelo nome e o telefone digitado não bate com o cadastro: o número novo vai pra
// fila da equipe aplicar (repo_telefone_atualizacoes), não sobrescreve o cadastro direto.
export const atualizarTelefone = ({ alunoId, chave, telefoneNovo }) => modoDemo() ? demo.ok() :
  chamar('repo_atualizar_telefone', { p_aluno_id: alunoId, p_telefone: chave, p_telefone_novo: telefoneNovo })
