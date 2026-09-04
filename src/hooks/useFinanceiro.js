import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { format } from 'date-fns'
import { confirmarAulasElegiveis } from './useAulas'
import { calcularValorAula } from '../constants/modalidades'

const CAMPOS_PAGAMENTO = ['banco', 'tipo_pagamento', 'agencia', 'conta', 'tipo_conta', 'chave_pix', 'nome_titular', 'cpf_titular']

// Dados de pagamento (banco/PIX/boleto/titular) de um professor pra uma empresa específica —
// mesma ideia de valor_aula/valor_aula_beach (ver calcularValorAula em constants/modalidades.js):
// os campos sem sufixo são os da Procópio, os "_beach" são os da Beach Arena. Cai pros campos
// sem sufixo quando os "_beach" estão vazios, pra colaborador cadastrado só na Beach Arena antes
// dessa separação existir continuar funcionando sem precisar reeditar o cadastro.
export function dadosPagamentoEmpresa(professor, empresa) {
  if (empresa !== 'beach_arena') {
    return Object.fromEntries(CAMPOS_PAGAMENTO.map(c => [c, professor?.[c] ?? null]))
  }
  const temDadosBeach = CAMPOS_PAGAMENTO.some(c => professor?.[`${c}_beach`])
  return Object.fromEntries(CAMPOS_PAGAMENTO.map(c => [c, (temDadosBeach ? professor?.[`${c}_beach`] : professor?.[c]) ?? null]))
}

// ──────────────────────────────────────────────────────────────────────
// Autorização de pagamento pelo coordenador
// SQL para criar a tabela no Supabase:
//
// CREATE TABLE IF NOT EXISTS liberacoes_pagamento (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   professor_id uuid REFERENCES professores(id) ON DELETE CASCADE,
//   mes int NOT NULL, ano int NOT NULL,
//   autorizado_em timestamptz DEFAULT now(),
//   UNIQUE(professor_id, mes, ano)
// );
// ALTER TABLE liberacoes_pagamento ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin_all" ON liberacoes_pagamento FOR ALL TO authenticated USING (true);
// ──────────────────────────────────────────────────────────────────────

export function useLiberacoesPagamento({ mes, ano }) {
  return useQuery({
    queryKey: ['liberacoes_pag', mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liberacoes_pagamento')
        .select('professor_id')
        .eq('mes', mes)
        .eq('ano', ano)
      if (error) { console.warn('liberacoes_pagamento:', error.message); return new Set() }
      return new Set((data || []).map(r => r.professor_id))
    },
    enabled: !!mes && !!ano,
    staleTime: 30000,
  })
}

export function useLiberar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano }) => {
      const { error } = await supabase
        .from('liberacoes_pagamento')
        .upsert({ professor_id: professorId, mes, ano }, { onConflict: 'professor_id,mes,ano' })
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['liberacoes_pag', v.mes, v.ano] }),
  })
}

export function useDesautorizar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano }) => {
      const { error } = await supabase
        .from('liberacoes_pagamento')
        .delete()
        .eq('professor_id', professorId)
        .eq('mes', mes)
        .eq('ano', ano)
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['liberacoes_pag', v.mes, v.ano] }),
  })
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export const QUADRAS_EMPRESA = {
  procopio: ['Quadra 1', 'Quadra 2', 'Quadra 3', 'Quadra 4', 'Quadra de Padel', 'Quadra de Squash'],
  beach_arena: ['Quadra 1 Areia', 'Quadra 3 Areia', 'Quadra 5 Areia'],
}

function parseQuadraObs(obs) {
  if (!obs) return ''
  const partes = obs.split('·').map(s => s.trim())
  return partes[1] || ''
}

function parseHorarioObs(obs) {
  if (!obs) return ''
  const partes = obs.split('·').map(s => s.trim())
  return partes[2] || ''
}

// Mesmo limite de 1000 linhas por consulta do PostgREST que afetava o Relatório Mensal
// (ver useRelatorioMensal.js) também vale aqui — um período com muita aula paga (2+ meses,
// ou as duas empresas somadas) pode passar de 1000 e cortar silenciosamente o cálculo de
// quanto cada professor recebe. `.order('id')` é obrigatório: sem ordenação estável, cada
// página do `.range()` pode repetir ou pular linhas.
async function buscarTodasAsAulas(construirQuery) {
  const TAMANHO_PAGINA = 1000
  let offset = 0
  let todas = []
  while (true) {
    const { data, error } = await construirQuery().order('id', { ascending: true }).range(offset, offset + TAMANHO_PAGINA - 1)
    if (error) throw error
    todas = todas.concat(data || [])
    if (!data || data.length < TAMANHO_PAGINA) break
    offset += TAMANHO_PAGINA
  }
  return todas
}

// Retorna true se a aula já começou (para o dia de hoje, filtra por horário)
function aulaJaComecou(dataAula, horarioInicio) {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  if (dataAula !== hoje) return true  // dias passados ou futuros: nao filtra por horario
  if (!horarioInicio) return true
  const [h, m] = horarioInicio.split(':').map(Number)
  const inicio = new Date()
  inicio.setHours(h, m, 0, 0)
  return new Date() >= inicio
}

// ──────────────────────────────────────────────────────────────────────
// Hooks legados (mantidos para compatibilidade)
// ──────────────────────────────────────────────────────────────────────

export function useFechamentos(professorId = null) {
  return useQuery({
    queryKey: ['fechamentos', professorId],
    queryFn: async () => {
      let q = supabase
        .from('fechamentos')
        .select('*, professores(nome, banco, agencia, conta, tipo_conta, pix, valor_hora_aula)')
        .order('criado_em', { ascending: false })
      if (professorId) q = q.eq('professor_id', professorId)
      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useCalcularFechamento() {
  return useMutation({
    mutationFn: async ({ professorId, periodoInicio, periodoFim }) => {
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select('id, data_aula, turmas(horario_inicio, horario_fim)')
        .eq('professor_executou_id', professorId)
        .eq('status', 'match')
        .gte('data_aula', periodoInicio)
        .lte('data_aula', periodoFim)
      if (error) throw error
      const { data: prof } = await supabase
        .from('professores')
        .select('valor_hora_aula, valor_aula')
        .eq('id', professorId)
        .single()
      const totalAulas = aulas?.length || 0
      const valorHora = prof?.valor_hora_aula || prof?.valor_aula || 0
      const totalBruto = totalAulas * valorHora
      return { totalAulas, valorHora, totalBruto, aulas }
    }
  })
}

export function useCriarFechamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados) => {
      const { data, error } = await supabase
        .from('fechamentos').insert(dados).select().single()
      if (error) throw error
      await logAudit('fechamentos', data.id, 'INSERT', null, data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fechamentos'] })
  })
}

export function useAtualizarFechamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data, error } = await supabase
        .from('fechamentos').update({ status }).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fechamentos'] })
  })
}

// ──────────────────────────────────────────────────────────────────────
// Novos hooks — Financeiro por empresa
// ──────────────────────────────────────────────────────────────────────

// Custo total de professores agrupado por professor, filtrado por empresa+período
export function useCustoProfessores({ empresa, dataInicio, dataFim }) {
  return useQuery({
    queryKey: ['fin_custos_prof', empresa, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresa || !dataInicio || !dataFim) return []
      await confirmarAulasElegiveis({ dataInicio, dataFim })
      const aulas = await buscarTodasAsAulas(() => supabase
        .from('aulas')
        .select(`
          id, professor_executou_id, turma_id, observacoes, data_aula,
          turmas(nome, horario_inicio, quadras(nome), niveis(nome), modalidades(nome)),
          presencas(tipo_participacao),
          professores!professor_executou_id(id, nome, foto_url, valor_aula, valor_hora_aula, valor_aula_beach, trabalha_procopio, trabalha_beach, chave_pix, banco, agencia, conta, tipo_conta, tipo_pagamento, nome_titular, cpf_titular, chave_pix_beach, banco_beach, agencia_beach, conta_beach, tipo_conta_beach, tipo_pagamento_beach, nome_titular_beach, cpf_titular_beach)
        `)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
        .eq('paga_professor', true)
        .eq('status_aula', 'dada'))

      const quadras = QUADRAS_EMPRESA[empresa] || []
      const filtradas = (aulas || []).filter(a => {
        const q = a.turma_id ? (a.turmas?.quadras?.nome || '') : parseQuadraObs(a.observacoes)
        if (!quadras.includes(q)) return false
        const horario = a.turmas?.horario_inicio || parseHorarioObs(a.observacoes)
        return aulaJaComecou(a.data_aula, horario)
      })

      const por = {}
      filtradas.forEach(a => {
        const p = a.professores
        if (!p) return
        if (!por[p.id]) {
          const valorBase = Number(p.valor_aula || p.valor_hora_aula || 0)
          const valorUnitario = empresa === 'beach_arena' && p.valor_aula_beach
            ? Number(p.valor_aula_beach)
            : valorBase
          por[p.id] = { ...p, valorUnitario, totalAulas: 0, totalValor: 0 }
        }
        por[p.id].totalAulas++
        por[p.id].totalValor += calcularValorAula(a, p, empresa)
      })

      return Object.values(por).sort((a, b) => b.totalValor - a.totalValor)
    },
    enabled: !!empresa && !!dataInicio && !!dataFim,
    staleTime: 60000,
  })
}

// Aulas de um professor específico no período, filtradas por empresa. `professor`
// (com valor_aula/valor_aula_beach) é opcional — sem ele, cada aula sai sem o campo
// `valor` calculado (quem chama sem passar professor só quer a lista/contagem).
export function useAulasProfessorFinanceiro({ professorId, professor, empresa, dataInicio, dataFim }) {
  return useQuery({
    queryKey: ['fin_aulas_prof', professorId, empresa, dataInicio, dataFim],
    queryFn: async () => {
      if (!professorId) return []
      await confirmarAulasElegiveis({ professorId, dataInicio, dataFim })
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id, observacoes, status_aula,
          turmas(nome, horario_inicio, quadras(nome), niveis(nome), modalidades(nome)),
          presencas(tipo_participacao, status_presenca)
        `)
        .eq('professor_executou_id', professorId)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
        .eq('paga_professor', true)
        .eq('status_aula', 'dada')
        .order('data_aula', { ascending: true })
      if (error) throw error

      const quadras = QUADRAS_EMPRESA[empresa] || []
      const filtradas = (aulas || []).filter(a => {
        const q = a.turma_id ? (a.turmas?.quadras?.nome || '') : parseQuadraObs(a.observacoes)
        if (empresa && !quadras.includes(q)) return false
        const horario = a.turmas?.horario_inicio || parseHorarioObs(a.observacoes)
        return aulaJaComecou(a.data_aula, horario)
      })
      if (!professor) return filtradas
      return filtradas.map(a => ({ ...a, valor: calcularValorAula(a, professor, empresa) }))
    },
    enabled: !!professorId && !!dataInicio && !!dataFim,
    staleTime: 60000,
  })
}

// Todas as aulas "fechadas" do próprio professor, sem recorte de mês — usado no
// autoatendimento (/meu-financeiro), que monta os 12 meses do ano de uma vez em vez de
// pedir um período por consulta. Cada aula sai com `empresa` resolvida pela quadra (igual
// useCustoProfessores/useAulasProfessorFinanceiro) e `valor` já calculado pra essa empresa.
export function useAulasAnoProfessor({ professorId, professor }) {
  return useQuery({
    // `professor` não entra na key, mas o valor de cada aula é calculado a partir dele —
    // sem isso, se essa query disparasse ANTES da query separada que busca o professor
    // terminar (corrida comum: as duas saem juntas no mount de MeuFinanceiroProfessor.jsx),
    // ela rodava com professor=undefined, calcularValorAula caía no `: 0` do fallback, e o
    // resultado (TODOS os meses do ano com valor R$0,00) ficava em cache até o staleTime
    // expirar — foi exatamente o que aconteceu com o Bruno Borges (financeiro do próprio
    // professor zerado mesmo com 55 aulas em agosto). `enabled` abaixo evita a corrida.
    queryKey: ['fin_aulas_ano_prof', professorId],
    queryFn: async () => {
      if (!professorId) return []
      const hoje = format(new Date(), 'yyyy-MM-dd')
      await confirmarAulasElegiveis({ professorId })
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id, observacoes,
          turmas(nome, horario_inicio, quadras(nome), niveis(nome), modalidades(nome)),
          presencas(tipo_participacao)
        `)
        .eq('professor_executou_id', professorId)
        .eq('paga_professor', true)
        .eq('status_aula', 'dada')
        .lte('data_aula', hoje)
        .order('data_aula', { ascending: true })
      if (error) throw error

      return (aulas || [])
        .map(a => {
          const q = a.turma_id ? (a.turmas?.quadras?.nome || '') : parseQuadraObs(a.observacoes)
          const empresa = QUADRAS_EMPRESA.procopio.includes(q) ? 'procopio'
            : QUADRAS_EMPRESA.beach_arena.includes(q) ? 'beach_arena' : null
          const horario = a.turmas?.horario_inicio || parseHorarioObs(a.observacoes)
          return { ...a, empresa, horario, valor: professor ? calcularValorAula(a, professor, empresa) : 0 }
        })
        .filter(a => aulaJaComecou(a.data_aula, a.horario))
    },
    enabled: !!professorId && !!professor,
    staleTime: 60000,
  })
}

// Boleto do professor para um mês/ano específico
export function useBoletosProfessor(professorId) {
  return useQuery({
    queryKey: ['boletos', professorId],
    queryFn: async () => {
      if (!professorId) return []
      const { data, error } = await supabase
        .from('boletos_professor')
        .select('*')
        .eq('professor_id', professorId)
        .order('ano', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!professorId,
  })
}

// Remove só a URL do anexo (boleto_url ou nf_url) de uma linha de boletos_professor — não
// apaga o arquivo do Storage (o path é fixo por mes/ano/empresa, então um novo upload
// sobrescreve o antigo de qualquer forma), só desvincula o registro. Usado pra corrigir
// anexo no mês errado (ex: NF de julho enviada por engano na janela de agosto).
export function useRemoverAnexoBoleto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano, empresa, campo }) => {
      const { error } = await supabase
        .from('boletos_professor')
        .update({ [campo]: null })
        .eq('professor_id', professorId).eq('mes', mes).eq('ano', ano).eq('empresa', empresa)
      if (error) throw error
    },
    onSuccess: (_, { professorId }) => qc.invalidateQueries({ queryKey: ['boletos', professorId] }),
  })
}

// IDs de professores com pagamento confirmado no mês/ano (por empresa — ver nota em
// useConfirmarPagamento sobre a constraint de boletos_professor incluir `empresa`).
export function usePagamentosConfirmados({ mes, ano, empresa }) {
  return useQuery({
    queryKey: ['pagamentos_confirmados', mes, ano, empresa],
    queryFn: async () => {
      let q = supabase
        .from('boletos_professor')
        .select('professor_id')
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('status', 'pago')
      if (empresa) q = q.eq('empresa', empresa)
      const { data, error } = await q
      if (error) throw error
      return new Set((data || []).map(b => b.professor_id))
    },
    enabled: !!mes && !!ano,
    staleTime: 30000,
  })
}

// boletos_professor é único por (professor_id, mes, ano, empresa) — onConflict precisa
// bater exatamente com essa constraint, senão o Postgres recusa o upsert inteiro com
// 42P10 ("no unique or exclusion constraint matching..."), mesmo quando não há conflito
// de fato. Faltava `empresa` aqui (e em handleUploadBoleto/NF do ProfessoresPage.jsx),
// fazendo TODO upsert nessa tabela falhar sempre — era o motivo de professores não
// conseguirem anexar Boleto/NF nem o gestor conseguir marcar "Pago".
export function useConfirmarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano, empresa }) => {
      const { error } = await supabase
        .from('boletos_professor')
        .upsert({ professor_id: professorId, mes, ano, empresa, status: 'pago' }, { onConflict: 'professor_id,mes,ano,empresa' })
      if (error) throw error
    },
    onSuccess: (_, { mes, ano, professorId }) => {
      qc.invalidateQueries({ queryKey: ['boletos', professorId] })
      qc.invalidateQueries({ queryKey: ['pagamentos_confirmados', mes, ano] })
    },
  })
}

export function useDesfazerPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano, empresa }) => {
      const { error } = await supabase
        .from('boletos_professor')
        .update({ status: 'pendente' })
        .eq('professor_id', professorId)
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('empresa', empresa)
      if (error) throw error
    },
    onSuccess: (_, { mes, ano, professorId }) => {
      qc.invalidateQueries({ queryKey: ['boletos', professorId] })
      qc.invalidateQueries({ queryKey: ['pagamentos_confirmados', mes, ano] })
    },
  })
}

// ──────────────────────────────────────────────────────────────────────
// Lancamentos financeiros (receita + outros custos)
// Requer tabela: financeiro_lancamentos
//
// SQL para criar no Supabase:
// CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   empresa text NOT NULL,
//   tipo text NOT NULL,   -- 'receita' | 'custo_extra'
//   descricao text,
//   valor numeric(10,2) NOT NULL DEFAULT 0,
//   mes int NOT NULL,
//   ano int NOT NULL,
//   arquivo_url text,
//   arquivo_nome text,
//   criado_em timestamptz DEFAULT now()
// );
// ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin_all" ON financeiro_lancamentos FOR ALL TO authenticated USING (true);
// ──────────────────────────────────────────────────────────────────────

export function useLancamentosFinanceiro({ empresa, mes, ano }) {
  return useQuery({
    queryKey: ['fin_lancamentos', empresa, mes, ano],
    queryFn: async () => {
      if (!empresa) return []
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .select('*')
        .eq('empresa', empresa)
        .eq('mes', mes)
        .eq('ano', ano)
        .order('criado_em', { ascending: true })
      if (error) {
        console.warn('financeiro_lancamentos não existe ainda:', error.message)
        return []
      }
      return data || []
    },
    enabled: !!empresa && !!mes && !!ano,
    staleTime: 30000,
  })
}

export function useSalvarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lancamento) => {
      if (lancamento.id) {
        const { data, error } = await supabase
          .from('financeiro_lancamentos')
          .update(lancamento)
          .eq('id', lancamento.id)
          .select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .insert(lancamento)
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fin_lancamentos'] }),
  })
}

export function useRemoverLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fin_lancamentos'] }),
  })
}
