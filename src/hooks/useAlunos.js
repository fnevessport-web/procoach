import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { format, subDays } from 'date-fns'
import { getModalidadeDaAula } from '../constants/modalidades'
import { nivelPorPcScore, FAIXAS_ETARIAS, REAVALIACAO_PRAZO_DIAS } from '../lib/pcScore'
import { buscarProfessoresDoAlunoNaModalidade } from './useProfessoresDoAluno'
import { criarAlerta } from './useAlertas'
import { verificarEAtualizarConquistas } from './useConquistas'

export function useAlunos(modalidadeId = null) {
  return useQuery({
    queryKey: ['alunos', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('alunos')
        .select('*, modalidades(nome, icone_emoji, cor_hex)')
        .eq('ativo', true)
        .order('nome')

      if (modalidadeId) q = q.eq('modalidade_id', modalidadeId)

      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useSalvarAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }) => {
      if (id) {
        const { data: anterior } = await supabase.from('alunos').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('alunos').update(dados).eq('id', id).select().single()
        if (error) throw error
        await logAudit('alunos', id, 'UPDATE', anterior, data)
        return data
      } else {
        const { data, error } = await supabase.from('alunos').insert(dados).select().single()
        if (error) throw error
        await logAudit('alunos', data.id, 'INSERT', null, data)
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alunos'] })
  })
}

export function useExcluirAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('alunos').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alunos'] })
  })
}

// Aluno + vínculos familiares + modalidades matriculadas (com o nível ativo de cada
// uma, se já houver histórico registrado em aluno_modalidade_nivel).
export function useAlunoCompleto(alunoId) {
  return useQuery({
    queryKey: ['aluno_completo', alunoId],
    queryFn: async () => {
      await verificarEAtualizarConquistas(alunoId)

      const [{ data: aluno, error: erroAluno }, { data: familia }, { data: modsAluno }, { data: niveisAtivos }, { data: presencasAluno }] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', alunoId).single(),
        supabase.from('aluno_familia').select('*, vinculo:alunos!vinculo_aluno_id(id, nome)').eq('aluno_id', alunoId).order('created_at'),
        supabase.from('alunos_modalidades').select('created_at, modalidade_id, modalidades(id, nome, icone_emoji, cor_hex)').eq('aluno_id', alunoId),
        supabase.from('aluno_modalidade_nivel').select('*').eq('aluno_id', alunoId).eq('ativo', true),
        // Só pra achar a data real de entrada em cada modalidade (primeira aula que o aluno
        // de fato teve) — alunos_modalidades.created_at não serve pra isso porque a linha pode
        // ter sido criada bem depois (ex.: backfill), sem relação com quando o aluno começou.
        supabase.from('presencas').select('aula_id, aulas(data_aula, turma_id, observacoes, turmas(modalidade_id))').eq('aluno_id', alunoId),
      ])
      if (erroAluno) throw erroAluno

      const nivelPorModalidade = {}
      niveisAtivos?.forEach(n => { nivelPorModalidade[n.modalidade_id] = n })

      // Enquanto o histórico por modalidade (aluno_modalidade_nivel) ainda não tem
      // registro pra essa modalidade, cai no nível genérico do aluno como estimativa —
      // impreciso pra quem joga mais de uma modalidade, mas evita o card nascer vazio
      // pra todo mundo só porque a tabela nova começa zerada.
      const nivelGenerico = aluno.nivel_avaliado_prof || aluno.nivel || null

      // Nome → id das modalidades do próprio aluno, pra resolver a modalidade de aulas avulsas
      // (que não têm turma_id, só a quadra na observação) sem precisar buscar todas as
      // modalidades do clube.
      const nomeParaModalidadeId = {}
      modsAluno?.forEach(m => { if (m.modalidades?.nome) nomeParaModalidadeId[m.modalidades.nome] = m.modalidade_id })

      const primeiraAulaPorModalidade = {}
      presencasAluno?.forEach(p => {
        if (!p.aulas?.data_aula) return
        const modId = p.aulas.turma_id
          ? p.aulas.turmas?.modalidade_id
          : nomeParaModalidadeId[getModalidadeDaAula(p.aulas)]
        if (!modId) return
        if (!primeiraAulaPorModalidade[modId] || p.aulas.data_aula < primeiraAulaPorModalidade[modId]) {
          primeiraAulaPorModalidade[modId] = p.aulas.data_aula
        }
      })

      const modalidadesDetalhe = (modsAluno || []).map(m => {
        const registroAtivo = nivelPorModalidade[m.modalidade_id]
        return {
          ...m.modalidades,
          dataEntrada: primeiraAulaPorModalidade[m.modalidade_id] || m.created_at,
          nivelAtual: registroAtivo?.nivel || nivelGenerico,
          nivelRegistrado: !!registroAtivo,
        }
      })

      return { ...aluno, familia: familia || [], modalidadesDetalhe }
    },
    enabled: !!alunoId,
  })
}

// Histórico completo (todos os registros, não só o ativo) de nível numa modalidade —
// usado no modal de detalhe da modalidade, mais recente primeiro.
export function useHistoricoNivel(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['historico_nivel', alunoId, modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aluno_modalidade_nivel')
        .select('*')
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .order('data_inicio', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId && !!modalidadeId,
  })
}

export function useFamiliaAluno(alunoId) {
  return useQuery({
    queryKey: ['aluno_familia', alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aluno_familia')
        .select('*, vinculo:alunos!vinculo_aluno_id(id, nome)')
        .eq('aluno_id', alunoId)
        .order('created_at')
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId,
  })
}

export function useSalvarVinculoFamilia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, vinculoAlunoId, nomeVinculo, tipoVinculo }) => {
      const { error } = await supabase.from('aluno_familia').insert({
        aluno_id: alunoId,
        vinculo_aluno_id: vinculoAlunoId || null,
        nome_vinculo: nomeVinculo,
        tipo_vinculo: tipoVinculo,
      })
      if (error) throw error
    },
    onSuccess: (_, { alunoId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_familia', alunoId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

export function useExcluirVinculoFamilia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, alunoId }) => {
      const { error } = await supabase.from('aluno_familia').delete().eq('id', id)
      if (error) throw error
      return { alunoId }
    },
    onSuccess: ({ alunoId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_familia', alunoId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Dimensões técnicas cadastradas pra uma modalidade (Fase 3) — define o formulário
// dinâmico de avaliação e os eixos do gráfico radar.
export function useDimensoesModalidade(modalidadeId) {
  return useQuery({
    queryKey: ['modalidade_dimensoes', modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalidade_dimensoes')
        .select('*')
        .eq('modalidade_id', modalidadeId)
        .order('ordem')
      if (error) throw error
      return data || []
    },
    enabled: !!modalidadeId,
  })
}

// Todas as avaliações técnicas do aluno numa modalidade, mais antiga primeiro (pronto pro
// gráfico de evolução — a última posição do array é a mais recente). Traz junto quem ainda
// falta confirmar (avaliacoes_tecnicas_confirmacoes) pra quando a mais recente for
// 'pendente' — EvolucaoTecnicaTenis.jsx usa isso pro selo "Aguardando confirmação de X".
export function useAvaliacoesModalidade(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['avaliacoes_modalidade', alunoId, modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_tecnicas')
        .select('*, professores(nome), avaliacoes_tecnicas_confirmacoes(confirmado_em, professores(nome))')
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .order('data_avaliacao', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId && !!modalidadeId,
  })
}

// Dispara a narrativa da Edge Function em segundo plano — nunca trava o salvamento da
// avaliação por causa disso (1-2s de latência da Anthropic não deveria bloquear o
// professor seguindo pro próximo aluno). A própria function já cai num texto de
// fallback e grava sozinha em avaliacoes_tecnicas.narrativa_ia se algo falhar.
function dispararNarrativaIA({ avaliacaoId, alunoNome, modalidadeNome, faixaEtaria, dimensoes, pcScore, historico }) {
  const faixaLabel = FAIXAS_ETARIAS.find(f => f.chave === faixaEtaria)?.label || faixaEtaria
  const nivelLabel = nivelPorPcScore(pcScore)?.label || ''
  supabase.functions.invoke('narrativa-tecnica', {
    body: {
      avaliacaoId, alunoNome, modalidadeNome,
      faixaEtariaLabel: faixaLabel, dimensoes, pcScoreAtual: pcScore,
      nivelAtualLabel: nivelLabel, historico,
    },
  }).catch(() => {
    // Sem internet / function fora do ar — a avaliação já foi salva com as notas certas,
    // só a análise em texto que fica sem gerar dessa vez.
  })
}

// Se o aluno tem mais de um professor titular na modalidade avaliada, a avaliação nasce
// 'pendente' (e cria uma linha de confirmação + um alerta pra cada um dos outros) em vez de
// 'confirmada' direto — ninguém deve ver uma nota que ainda pode ser corrigida em conjunto.
// Só entra na regra quem tem login no ProCoach (sem user_id não há como confirmar).
async function aplicarConfirmacaoMultiProfessor({ novaAvaliacao, alunoId, modalidadeId, professorId, professorNome, alunoNome, modalidadeNome }) {
  const professores = await buscarProfessoresDoAlunoNaModalidade(alunoId, modalidadeId)
  const outros = professores.filter(p => p.professorId !== professorId && p.userId)
  if (outros.length === 0) return { ...novaAvaliacao, status: 'confirmada' }

  await supabase.from('avaliacoes_tecnicas').update({ status: 'pendente' }).eq('id', novaAvaliacao.id)
  await supabase.from('avaliacoes_tecnicas_confirmacoes').insert(
    outros.map(p => ({ avaliacao_id: novaAvaliacao.id, professor_id: p.professorId }))
  )
  for (const p of outros) {
    await criarAlerta({
      usuarioId: p.userId,
      tipo: 'avaliacao_pendente_confirmacao',
      referenciaId: novaAvaliacao.id,
      alunoId,
      prioridade: 'media',
      mensagem: `${professorNome || 'Um professor'} avaliou ${alunoNome} em ${modalidadeNome} — confirme ou discuta.`,
    })
  }
  return { ...novaAvaliacao, status: 'pendente' }
}

export function useSalvarAvaliacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      alunoId, modalidadeId, professorId, professorNome, alunoNome, modalidadeNome,
      dimensoes, notaGeral, notaGeralManual, comentario,
      dataAvaliacao, pcScore, faixaEtaria, historicoPcScore,
    }) => {
      const { data: nova, error } = await supabase.from('avaliacoes_tecnicas').insert({
        aluno_id: alunoId,
        modalidade_id: modalidadeId,
        professor_id: professorId,
        data_avaliacao: dataAvaliacao,
        dimensoes,
        nota_geral: notaGeral,
        nota_geral_manual: notaGeralManual,
        comentario: comentario || null,
        pc_score: pcScore ?? null,
        faixa_etaria: faixaEtaria ?? null,
      }).select().single()
      if (error) throw error

      const avaliacaoFinal = await aplicarConfirmacaoMultiProfessor({
        novaAvaliacao: nova, alunoId, modalidadeId, professorId, professorNome, alunoNome, modalidadeNome,
      })

      if (pcScore != null) {
        dispararNarrativaIA({
          avaliacaoId: nova.id, alunoNome, modalidadeNome, faixaEtaria, dimensoes, pcScore,
          historico: historicoPcScore || [],
        })
        // Conquista é coisa "oficial" — só recalcula quando a avaliação já nasce confirmada
        // (sem outro professor titular pra confirmar). Uma pendente pode ainda mudar.
        if (avaliacaoFinal.status === 'confirmada') {
          await verificarEAtualizarConquistas(alunoId)
        }
      }

      return avaliacaoFinal
    },
    onSuccess: (_, { alunoId, modalidadeId }) => {
      qc.invalidateQueries({ queryKey: ['avaliacoes_modalidade', alunoId, modalidadeId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Edição de uma avaliação já lançada — capacidade nova, exclusiva de quem tem
// podeEditarAvaliacaoTecnica (hoje só o role gestor, ver usePermissions.js). Só atualiza os
// campos da nota em si; diferente de useSalvarAvaliacao, não mexe em status/confirmação
// multi-professor nem redispara narrativa da IA/concessão de badge — isso é fluxo de
// avaliação NOVA, corrigir uma nota já lançada não deveria reabrir tudo isso de novo.
// Registra em audit_log (dados_anteriores/dados_novos) porque reescrever a avaliação de um
// professor é uma ação sensível — precisa ficar rastreável quem mudou o quê.
export function useEditarAvaliacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      avaliacaoId,
      dimensoes, notaGeral, notaGeralManual, comentario, dataAvaliacao, pcScore, faixaEtaria,
    }) => {
      const { data: anterior } = await supabase.from('avaliacoes_tecnicas').select('*').eq('id', avaliacaoId).single()
      const { data: atualizada, error } = await supabase.from('avaliacoes_tecnicas').update({
        dimensoes,
        nota_geral: notaGeral,
        nota_geral_manual: notaGeralManual,
        comentario: comentario || null,
        data_avaliacao: dataAvaliacao,
        pc_score: pcScore ?? null,
        faixa_etaria: faixaEtaria ?? null,
      }).eq('id', avaliacaoId).select().single()
      if (error) throw error

      await logAudit('avaliacoes_tecnicas', avaliacaoId, 'UPDATE', anterior, atualizada)
      return atualizada
    },
    onSuccess: (_, { alunoId, modalidadeId }) => {
      qc.invalidateQueries({ queryKey: ['avaliacoes_modalidade', alunoId, modalidadeId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Confirmações pendentes de um professor — avaliações feitas por outro professor do mesmo
// aluno que aguardam ele confirmar (fase 2, ver migration 011). Alimenta o painel no
// DashboardProfessor.jsx.
export function usePendenciasConfirmacao(professorId) {
  return useQuery({
    queryKey: ['pendencias_confirmacao', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_tecnicas_confirmacoes')
        .select(`
          id,
          avaliacoes_tecnicas!inner(
            id, aluno_id, modalidade_id, data_avaliacao, dimensoes, pc_score, comentario, professor_id,
            alunos(nome), modalidades(nome), professores(nome)
          )
        `)
        .eq('professor_id', professorId)
        .is('confirmado_em', null)
      if (error) throw error
      return (data || []).map(c => ({ confirmacaoId: c.id, ...c.avaliacoes_tecnicas }))
    },
    refetchInterval: 30000,
  })
}

// Confirma a linha de confirmação desse professor; se essa era a última pendente, a
// avaliação vira 'confirmada' de vez e os badges técnicos represados desde o salvamento
// (ver useSalvarAvaliacao) são concedidos agora.
export function useConfirmarAvaliacaoTecnica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ confirmacaoId, avaliacaoId, alunoId }) => {
      const { error } = await supabase
        .from('avaliacoes_tecnicas_confirmacoes')
        .update({ confirmado_em: new Date().toISOString() })
        .eq('id', confirmacaoId)
      if (error) throw error

      const { count: faltam } = await supabase
        .from('avaliacoes_tecnicas_confirmacoes')
        .select('*', { count: 'exact', head: true })
        .eq('avaliacao_id', avaliacaoId)
        .is('confirmado_em', null)

      if (faltam === 0) {
        await supabase.from('avaliacoes_tecnicas').update({ status: 'confirmada' }).eq('id', avaliacaoId)
        await verificarEAtualizarConquistas(alunoId)
      }
    },
    onSuccess: (_, { alunoId, modalidadeId, professorId }) => {
      qc.invalidateQueries({ queryKey: ['pendencias_confirmacao', professorId] })
      qc.invalidateQueries({ queryKey: ['avaliacoes_modalidade', alunoId, modalidadeId] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Faixa etária escolhida manualmente por professor/gestor (kids/infantil/adulto) — usada
// no cálculo do PC Score só enquanto o aluno não tem data_nascimento cadastrada (que, tendo,
// sempre tem prioridade — ver src/lib/pcScore.js). Propriedade do aluno, não da avaliação:
// escolhida uma vez, vale pra qualquer avaliação futura dele.
export function useAtualizarFaixaEtariaManual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, faixaEtariaManual }) => {
      const { error } = await supabase.from('alunos').update({ faixa_etaria_manual: faixaEtariaManual }).eq('id', alunoId)
      if (error) throw error
    },
    onSuccess: (_, { alunoId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
    }
  })
}

// Atualiza o nível do aluno numa modalidade (Fase 3, usado no formulário de avaliação) —
// nunca sobrescreve o registro anterior, sempre insere um novo e desativa o(s) antigo(s)
// (mesma regra de "histórico, nunca overwrite" definida na Fase 1).
export function useAtualizarNivelModalidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, modalidadeId, nivel }) => {
      await supabase
        .from('aluno_modalidade_nivel')
        .update({ ativo: false })
        .eq('aluno_id', alunoId)
        .eq('modalidade_id', modalidadeId)
        .eq('ativo', true)

      const { error } = await supabase.from('aluno_modalidade_nivel').insert({
        aluno_id: alunoId,
        modalidade_id: modalidadeId,
        nivel,
        data_inicio: format(new Date(), 'yyyy-MM-dd'),
        ativo: true,
      })
      if (error) throw error
    },
    onSuccess: (_, { alunoId, modalidadeId }) => {
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
      qc.invalidateQueries({ queryKey: ['historico_nivel', alunoId, modalidadeId] })
    }
  })
}

// Histórico de presença do aluno numa modalidade específica (Fase 3) — turmas casam por
// modalidade_id direto; aulas avulsas usam a mesma inferência por quadra já usada em todo
// o resto do app (getModalidadeDaAula), já que não têm turma_id.
export function useHistoricoPresencaModalidade(alunoId, modalidadeId, modalidadeNome) {
  return useQuery({
    queryKey: ['historico_presenca_modalidade', alunoId, modalidadeId],
    queryFn: async () => {
      // PostgREST não ordena as linhas externas por uma coluna de relação many-to-one
      // (order com foreignTable só funciona pra listas aninhadas) — teve que ordenar no
      // cliente depois de buscar.
      const { data, error } = await supabase
        .from('presencas')
        .select(`
          id, status_presenca, presente, tipo_participacao,
          aulas(id, data_aula, turma_id, observacoes, turmas(modalidade_id, nome))
        `)
        .eq('aluno_id', alunoId)
      if (error) throw error
      const hoje = format(new Date(), 'yyyy-MM-dd')
      return (data || [])
        .filter(p => p.aulas)
        // Aulas futuras (turma recorrente já gerada pra semanas adiante) ainda não aconteceram —
        // a presença delas nasce com um valor "presente" só de placeholder, não é presença real.
        .filter(p => p.aulas.data_aula <= hoje)
        .filter(p => p.aulas.turma_id ? p.aulas.turmas?.modalidade_id === modalidadeId : getModalidadeDaAula(p.aulas) === modalidadeNome)
        .sort((a, b) => (b.aulas.data_aula || '').localeCompare(a.aulas.data_aula || ''))
        // Sem limite de linhas — o PDF de Evolução Técnica soma "aulas com presença desde o
        // início" (EvolucaoTecnicaTenis.jsx), e um corte fixo de 100 truncava esse total pra
        // qualquer aluno com mais de ~2 anos de frequência regular. A tela que agrupa isso por
        // mês (AlunoCard.jsx) já é paginada visualmente por mês, então não precisa de um cap
        // aqui pra não crescer demais.
    },
    enabled: !!alunoId && !!modalidadeId,
  })
}

// Resumo técnico da turma (Fase 3, item 14) — média por dimensão dos alunos matriculados com
// avaliação CONFIRMADA nos últimos REAVALIACAO_PRAZO_DIAS (mesma janela da regra individual),
// cobertura (quantos dos matriculados têm avaliação recente) e o gargalo coletivo (dimensão
// com a média mais baixa do grupo). Só matemática client-side sobre dado já existente — sem
// custo de IA; a sugestão de plano de treino (item 15) usa esse resumo como entrada.
export function useResumoTecnicoTurma(turmaId) {
  return useQuery({
    queryKey: ['resumo_tecnico_turma', turmaId],
    enabled: !!turmaId,
    queryFn: async () => {
      const { data: turma, error: erroTurma } = await supabase
        .from('turmas').select('id, nome, modalidade_id, modalidades(nome)').eq('id', turmaId).single()
      if (erroTurma) throw erroTurma

      const { data: matriculados } = await supabase
        .from('turmas_alunos').select('aluno_id').eq('turma_id', turmaId).eq('ativo', true)
      const alunoIds = [...new Set((matriculados || []).map(m => m.aluno_id))]

      const base = { turmaNome: turma.nome, modalidadeNome: turma.modalidades?.nome, totalAlunos: alunoIds.length, alunosAvaliados: 0, mediaPorDimensao: [], gargaloColetivo: null }
      if (!alunoIds.length) return base

      const { data: avaliacoes } = await supabase
        .from('avaliacoes_tecnicas')
        .select('aluno_id, data_avaliacao, dimensoes')
        .eq('modalidade_id', turma.modalidade_id)
        .eq('status', 'confirmada')
        .in('aluno_id', alunoIds)
        .order('data_avaliacao', { ascending: true })

      // última avaliação confirmada de cada aluno (a última posição vence, já que veio ordenado)
      const ultimaPorAluno = {}
      ;(avaliacoes || []).forEach(a => { ultimaPorAluno[a.aluno_id] = a })

      const limite = format(subDays(new Date(), REAVALIACAO_PRAZO_DIAS), 'yyyy-MM-dd')
      const recentes = Object.values(ultimaPorAluno).filter(a => a.data_avaliacao >= limite)
      if (!recentes.length) return base

      const somaPorDimensao = {}
      const contagemPorDimensao = {}
      recentes.forEach(a => {
        Object.entries(a.dimensoes || {}).forEach(([nome, valor]) => {
          somaPorDimensao[nome] = (somaPorDimensao[nome] || 0) + valor
          contagemPorDimensao[nome] = (contagemPorDimensao[nome] || 0) + 1
        })
      })
      const mediaPorDimensao = Object.keys(somaPorDimensao).map(nome => ({
        dimensao: nome,
        media: Math.round((somaPorDimensao[nome] / contagemPorDimensao[nome]) * 10) / 10,
      }))
      const gargaloColetivo = mediaPorDimensao.length
        ? mediaPorDimensao.reduce((pior, atual) => (atual.media < pior.media ? atual : pior))
        : null

      return { ...base, alunosAvaliados: recentes.length, mediaPorDimensao, gargaloColetivo }
    },
  })
}
