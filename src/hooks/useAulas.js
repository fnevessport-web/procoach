import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { format, addDays } from 'date-fns'
import { horarioInicioDaAula, horarioParaMinutos, isAulaIndividual, getModalidadeDaAula, VAGAS_INDIVIDUAL, VAGAS_GRUPO } from '../constants/modalidades'
import { getFeriado } from '../constants/feriados'

// Motivos de cancelamento (de MOTIVOS_CANCELAMENTO em AulasCoordenador.jsx) que dão
// direito a reposição automática pro aluno. Fica só como constante — ajustar essa lista
// no futuro não precisa de migração nenhuma.
const MOTIVOS_FORCA_MAIOR = ['Chuva']

// empresaId: escopo do tenant (null = aulas do clube, comportamento de hoje — nenhum chamador
// existente precisa passar nada). dataInicio/dataFim: busca por intervalo (ex: a semana inteira
// da Agenda Particular) em vez de um único dia — usar em vez de `data` quando precisar de mais
// de uma data de uma vez.
export function useAulas({ data, dataInicio, dataFim, professorId, modalidadeId, status, empresaId } = {}) {
  return useQuery({
    queryKey: ['aulas', data, dataInicio, dataFim, professorId, modalidadeId, status, empresaId],
    queryFn: async () => {
      let q = supabase
        .from('aulas')
        .select(`
          *,
          turmas(nome, horario_inicio, horario_fim, horario_dia_semana, professor_titular_id, modalidade_id, quadras(nome), modalidades(nome, icone_emoji, cor_hex), turmas_alunos(id, ativo)),
          professores!professor_executou_id(id, nome, foto_url),
          prof_titular:professores!professor_titular_id(id, nome),
          presencas(id, aluno_id, presente, status_presenca, tipo_participacao, alerta_nivel, nivel_avaliado_prof, obs_nivel_prof, criado_por, criado_por_nome, criado_em, alunos(id, nome, alerta_nivel, nivel_avaliado_prof, obs_nivel_prof)),
          contratantes(id, nome, tipo)
        `)
        .order('data_aula', { ascending: false })

      if (data) q = q.eq('data_aula', data)
      if (dataInicio) q = q.gte('data_aula', dataInicio)
      if (dataFim) q = q.lte('data_aula', dataFim)
      if (professorId) q = q.eq('professor_executou_id', professorId)
      if (status) q = q.eq('status', status)
      q = empresaId ? q.eq('empresa_id', empresaId) : q.is('empresa_id', null)

      const { data: aulas, error } = await q
      if (error) throw error

      if (modalidadeId) {
        return aulas.filter(a =>
          !a.turma_id || // inclui aulas avulsas sempre
          a.turmas?.modalidades?.id === modalidadeId ||
          (typeof modalidadeId === 'string' && a.turmas?.modalidades?.nome)
        )
      }

      return aulas
    },
    staleTime: 30000
  })
}

// Confirma automaticamente (paga_professor=true) toda aula que já tem aluno e cujo horário já
// passou — ou que caiu num feriado (conta como paga sem precisar esperar o horário, já que
// ninguém vai dar aula mesmo). Chamado no início de toda tela que soma dinheiro, pra nunca
// depender de um clique manual — só "Sem Aula"/"Cancelada" (status_aula diferente de 'dada')
// travam isso, e sempre por ação explícita de alguém.
export async function confirmarAulasElegiveis({ professorId = null, dataInicio = null, dataFim = null } = {}) {
  try {
    let q = supabase
      .from('aulas')
      .select('id, data_aula, turma_id, observacoes, turmas(horario_inicio), presencas(id)')
      .eq('status_aula', 'dada')
      .or('paga_professor.is.null,paga_professor.eq.false')
    if (professorId) q = q.eq('professor_executou_id', professorId)
    if (dataInicio) q = q.gte('data_aula', dataInicio)
    q = q.lte('data_aula', dataFim || format(new Date(), 'yyyy-MM-dd'))

    const { data: candidatas, error } = await q
    if (error || !candidatas?.length) return

    const hoje = format(new Date(), 'yyyy-MM-dd')
    const agoraMin = new Date().getHours() * 60 + new Date().getMinutes()

    const elegiveis = candidatas.filter(a => {
      if (!a.presencas?.length) return false
      if (getFeriado(a.data_aula)) return true
      if (a.data_aula < hoje) return true
      if (a.data_aula > hoje) return false
      const inicioMin = horarioParaMinutos(horarioInicioDaAula(a))
      return inicioMin != null && inicioMin <= agoraMin
    })

    if (elegiveis.length === 0) return
    await supabase.from('aulas').update({ paga_professor: true }).in('id', elegiveis.map(a => a.id))
  } catch {
    // não trava nenhuma tela por causa disso — no pior caso, tenta de novo no próximo carregamento
  }
}

// Modalidade de uma aula (aceita tanto turma-linked quanto avulsa) resolvida pro id real —
// getModalidadeDaAula (constants/modalidades.js) já sabe inferir a modalidade de uma aula
// avulsa pela quadra (parseada da observação), mas devolve só o NOME; aqui resolve o id de
// verdade pra gravar em alunos_modalidades/reposicoes.modalidade_id, que são FKs.
async function resolverModalidadeIdDaAula(aula) {
  if (aula?.turmas?.modalidades?.id) return aula.turmas.modalidades.id
  const nomeModalidade = getModalidadeDaAula(aula)
  if (!nomeModalidade) return null
  const { data: mod } = await supabase.from('modalidades').select('id').eq('nome', nomeModalidade).maybeSingle()
  return mod?.id || null
}

// FIFO: toda vez que uma reposição é agendada — seja pela aba dedicada de Reposição, seja
// marcando "Reposição" na lista de presença de qualquer aula — resolve sempre a falta pendente
// mais antiga do aluno, nunca deixa escolher qual. Idempotente: se aula_reposicao_id já aponta
// pra essa aula de destino, não mexe de novo (evita consumir uma 2a falta ao salvar a mesma
// aula várias vezes).
async function resolverReposicaoFIFO({ alunoId, aulaDestinoId }) {
  const { data: jaResolvida } = await supabase
    .from('reposicoes')
    .select('id')
    .eq('aluno_id', alunoId)
    .eq('aula_reposicao_id', aulaDestinoId)
    .maybeSingle()
  if (jaResolvida) return null

  const { data: faltas } = await supabase
    .from('presencas')
    .select('aula_id, aulas!inner(data_aula)')
    .eq('aluno_id', alunoId)
    .eq('status_presenca', 'falta_justificada')
  if (!faltas?.length) return null

  const aulaIds = faltas.map(f => f.aula_id)
  const { data: reposExistentes } = await supabase
    .from('reposicoes')
    .select('id, aula_origem_id, status')
    .eq('aluno_id', alunoId)
    .in('aula_origem_id', aulaIds)

  const reposPorAula = {}
  reposExistentes?.forEach(r => { reposPorAula[r.aula_origem_id] = r })

  const pendentes = faltas
    .filter(f => {
      const r = reposPorAula[f.aula_id]
      return !r || r.status === 'pendente'
    })
    .sort((a, b) => (a.aulas?.data_aula || '').localeCompare(b.aulas?.data_aula || ''))

  const maisAntiga = pendentes[0]
  if (!maisAntiga) return null

  const existente = reposPorAula[maisAntiga.aula_id]
  const { error } = await supabase
    .from('reposicoes')
    .upsert({
      id: existente?.id,
      aluno_id: alunoId,
      aula_origem_id: maisAntiga.aula_id,
      status: 'agendada',
      aula_reposicao_id: aulaDestinoId,
    }, { onConflict: 'aluno_id,aula_origem_id' })
  if (error) throw error

  return { dataFaltaResolvida: maisAntiga.aulas?.data_aula }
}

// Cancelamento por força maior (ver MOTIVOS_FORCA_MAIOR): todo aluno matriculado na aula
// ganha crédito de reposição automático — falta_justificada + reposicoes pendente, prazo
// de 60 dias. Chamada pelos dois fluxos de cancelamento em AulasCoordenador.jsx (individual
// e em massa) — nenhum dos dois passa por useSalvarPresencas, que é onde isso já acontece
// hoje pra faltas justificadas marcadas manualmente.
export async function gerarReposicoesPorCancelamento(aulaId, motivoCancelamento) {
  if (!MOTIVOS_FORCA_MAIOR.includes(motivoCancelamento)) return

  const { data: aula } = await supabase
    .from('aulas')
    .select('id, turma_id, turmas(modalidade_id)')
    .eq('id', aulaId)
    .single()
  if (!aula) return
  const modalidadeId = aula.turmas?.modalidade_id || null

  const { data: presencasAula } = await supabase
    .from('presencas')
    .select('id, aluno_id')
    .eq('aula_id', aulaId)
  if (!presencasAula?.length) return

  await supabase
    .from('presencas')
    .update({ status_presenca: 'falta_justificada', presente: false })
    .eq('aula_id', aulaId)

  const alunoIds = presencasAula.map(p => p.aluno_id)
  const { data: reposExistentes } = await supabase
    .from('reposicoes')
    .select('aluno_id')
    .eq('aula_origem_id', aulaId)
    .in('aluno_id', alunoIds)
  const jaTem = new Set((reposExistentes || []).map(r => r.aluno_id))

  // Só cria reposição pra quem ainda não tem uma pra essa aula — evita duplicar se o
  // coordenador reabrir e recancelar a mesma aula com o mesmo motivo.
  const faltantes = alunoIds.filter(id => !jaTem.has(id))
  if (faltantes.length === 0) return

  const dataLimite = format(addDays(new Date(), 60), 'yyyy-MM-dd')
  const { error } = await supabase.from('reposicoes').insert(
    faltantes.map(alunoId => ({
      aluno_id: alunoId,
      aula_origem_id: aulaId,
      modalidade_id: modalidadeId,
      status: 'pendente',
      data_limite: dataLimite,
    }))
  )
  if (error) throw error
}

// Roda no início das telas que leem reposicoes — sem cron ainda, só "de graça" a cada
// carregamento (mesmo padrão de confirmarAulasElegiveis). Só afeta reposições que já têm
// data_limite (criadas a partir da Fase 2) — as antigas não expiram automaticamente aqui.
export async function expirarReposicoesPendentesVencidas() {
  try {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    await supabase
      .from('reposicoes')
      .update({ status: 'expirada' })
      .eq('status', 'pendente')
      .lt('data_limite', hoje)
  } catch {
    // não trava nenhuma tela por causa disso
  }
}

// Agenda um aluno numa aula respeitando a capacidade (individual = 1, grupo = 4), com
// proteção contra dois cliques simultâneos reservarem a mesma vaga: cada presença de
// agendamento self-service recebe um vaga_numero sequencial, com índice único parcial em
// presencas(aula_id, vaga_numero) — o segundo insert que tentar o mesmo número perde a
// corrida com erro de unicidade (23505) e tenta de novo com a contagem atualizada. Usado
// tanto pra reposição quanto pra aula avulsa — mesma fila, sem prioridade entre elas.
export async function agendarSlotAtomico({ aulaId, alunoId, tipoParticipacao, valorCobrado = null }) {
  const { data: aula, error: erroAula } = await supabase
    .from('aulas')
    .select('id, turma_id, observacoes, turmas(niveis(nome), modalidades(id, nome))')
    .eq('id', aulaId)
    .single()
  if (erroAula || !aula) throw new Error('Aula não encontrada')

  // Mesma sincronização de useSalvarPresencas — o Card do Aluno lê de alunos_modalidades,
  // não de turmas_alunos/presencas.
  const modalidadeIdSlot = await resolverModalidadeIdDaAula(aula)
  if (modalidadeIdSlot) {
    await supabase.from('alunos_modalidades').upsert(
      { aluno_id: alunoId, modalidade_id: modalidadeIdSlot },
      { onConflict: 'aluno_id,modalidade_id', ignoreDuplicates: true }
    )
  }

  const capacidade = isAulaIndividual(aula) ? VAGAS_INDIVIDUAL : VAGAS_GRUPO

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: presencasAtuais, error: erroConsulta } = await supabase
      .from('presencas')
      .select('id, aluno_id')
      .eq('aula_id', aulaId)
    if (erroConsulta) throw erroConsulta

    if (presencasAtuais.some(p => p.aluno_id === alunoId)) {
      throw new Error('Esse aluno já está agendado nessa aula.')
    }
    if (presencasAtuais.length >= capacidade) {
      throw new Error('Vaga já preenchida, tente outro horário.')
    }

    const vagaNumero = presencasAtuais.length + 1
    const { error: erroInsert } = await supabase.from('presencas').insert({
      aula_id: aulaId,
      aluno_id: alunoId,
      presente: false,
      status_presenca: 'presente',
      tipo_participacao: tipoParticipacao,
      vaga_numero: vagaNumero,
    })

    if (!erroInsert) {
      if (tipoParticipacao === 'reposicao') {
        const resultado = await resolverReposicaoFIFO({ alunoId, aulaDestinoId: aulaId })
        return { vagaNumero, ...resultado }
      }
      if (tipoParticipacao === 'avulso') {
        const { data: vagaAberta } = await supabase
          .from('vagas_avulsas')
          .select('id')
          .eq('aula_id', aulaId)
          .eq('status', 'aberta')
          .limit(1)
          .maybeSingle()
        if (vagaAberta) {
          await supabase.from('vagas_avulsas').update({
            status: 'preenchida',
            aluno_preenchimento_id: alunoId,
            valor_cobrado: valorCobrado,
          }).eq('id', vagaAberta.id)
        }
      }
      return { vagaNumero }
    }

    if (erroInsert.code !== '23505') throw erroInsert
    // 23505 = unique_violation — outro clique venceu a corrida por esse vaga_numero.
    // Tenta de novo com a contagem atualizada (até 3 vezes).
  }

  throw new Error('Vaga já preenchida, tente outro horário.')
}

export function useAtualizarStatusAula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, statusAula, pagaProfessor, motivoCancelamento }) => {
      const { data, error } = await supabase
        .from('aulas')
        .update({
          status_aula: statusAula,
          paga_professor: pagaProfessor,
          motivo_cancelamento: statusAula === 'cancelada' ? (motivoCancelamento || null) : null,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', aulaId)
        .select()
        .single()
      if (error) throw error

      if (statusAula === 'cancelada') {
        await gerarReposicoesPorCancelamento(aulaId, motivoCancelamento)
      }

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
    }
  })
}

export function useSalvarPresencas() {
  const qc = useQueryClient()
  return useMutation({
    // idsNovos: aluno_ids que estão sendo incluídos na aula agora (não existiam antes) —
    // só essas linhas recebem criado_por/criado_por_nome. Precisa ser um INSERT/upsert
    // separado do resto: se o mesmo upsert misturasse linhas com e sem essas chaves, o
    // PostgREST monta um único INSERT com a união das colunas e preenche de NULL quem não
    // mandou a chave, apagando o "quem incluiu" de presenças já existentes a cada salvamento.
    mutationFn: async ({ aulaId, presencas, idsNovos = [] }) => {
      const novosSet = new Set(idsNovos)

      let criadoPor = null, criadoPorNome = null
      if (novosSet.size > 0) {
        const { data: { session } } = await supabase.auth.getSession()
        criadoPor = session?.user?.email || null
        if (session?.user?.id) {
          const { data: perfil } = await supabase
            .from('perfis_usuario').select('nome').eq('user_id', session.user.id).maybeSingle()
          criadoPorNome = perfil?.nome || null
        }
      }

      const rowBase = p => ({
        aula_id: aulaId,
        aluno_id: p.aluno_id,
        presente: p.status_presenca === 'presente',
        // Banco só aceita presente/falta/falta_justificada (ou nulo) — nunca string vazia,
        // senão viola presencas_status_presenca_check.
        status_presenca: p.status_presenca || null,
        tipo_participacao: p.tipo_participacao || 'mensalista',
      })

      const linhasNovas = presencas.filter(p => novosSet.has(p.aluno_id))
        .map(p => ({ ...rowBase(p), criado_por: criadoPor, criado_por_nome: criadoPorNome }))
      const linhasExistentes = presencas.filter(p => !novosSet.has(p.aluno_id)).map(rowBase)

      if (linhasNovas.length > 0) {
        const { error } = await supabase.from('presencas').upsert(linhasNovas, { onConflict: 'aula_id,aluno_id' })
        if (error) throw error
      }
      if (linhasExistentes.length > 0) {
        const { error } = await supabase.from('presencas').upsert(linhasExistentes, { onConflict: 'aula_id,aluno_id' })
        if (error) throw error
      }

      // Modalidade da aula (turma-linked ou avulsa) — usada tanto pra manter alunos_modalidades
      // sincronizado quanto pra preencher reposicoes.modalidade_id. turmas_alunos/presencas já
      // dirigem a grade e o financeiro sozinhos, mas o Card do Aluno lê de alunos_modalidades —
      // sem isso, um aluno incluído direto numa aula (em vez de cadastrado via Cadastros >
      // Alunos) nunca aparecia com a modalidade no card, mesmo jogando toda semana.
      const { data: aulaInfo } = await supabase
        .from('aulas').select('turma_id, observacoes, turmas(modalidades(id, nome))').eq('id', aulaId).single()
      const modalidadeId = aulaInfo ? await resolverModalidadeIdDaAula(aulaInfo) : null

      if (modalidadeId) {
        const alunoIds = [...new Set(presencas.map(p => p.aluno_id))]
        await supabase.from('alunos_modalidades').upsert(
          alunoIds.map(aluno_id => ({ aluno_id, modalidade_id: modalidadeId })),
          { onConflict: 'aluno_id,modalidade_id', ignoreDuplicates: true }
        )
      }

      const faltasJustificadas = presencas.filter(p => p.status_presenca === 'falta_justificada')
      if (faltasJustificadas.length > 0) {
        const dataLimite = format(addDays(new Date(), 60), 'yyyy-MM-dd')
        const repos = faltasJustificadas.map(p => ({
          aluno_id: p.aluno_id,
          aula_origem_id: aulaId,
          status: 'pendente',
          modalidade_id: modalidadeId,
          data_limite: dataLimite,
        }))
        const { error: errRepos } = await supabase.from('reposicoes').upsert(repos, { onConflict: 'aluno_id,aula_origem_id' })
        if (errRepos) throw errRepos
      }

      // Aluno marcado como "Reposição" nesta aula (fora da aba dedicada de Reposição) também
      // baixa a falta pendente mais antiga dele — os dois fluxos convergem pro mesmo lugar.
      const reposicoesBaixadas = []
      for (const p of presencas.filter(p => p.tipo_participacao === 'reposicao')) {
        const resultado = await resolverReposicaoFIFO({ alunoId: p.aluno_id, aulaDestinoId: aulaId })
        if (resultado) reposicoesBaixadas.push(resultado)
      }

      return { reposicoesBaixadas }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
    }
  })
}

export function useRelatorioReposicoes() {
  return useQuery({
    queryKey: ['relatorio_repos'],
    queryFn: async () => {
      await expirarReposicoesPendentesVencidas()
      const hoje = new Date()
      const dataFim = format(hoje, 'yyyy-MM-dd')
      const umAnoAtras = new Date(hoje)
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
      const dataInicio = format(umAnoAtras, 'yyyy-MM-dd')

      const { data: faltas, error } = await supabase
        .from('presencas')
        .select(`
          id, aluno_id, aula_id,
          alunos(id, nome, nivel_avaliado_prof),
          aulas!inner(id, data_aula, turma_id, observacoes,
            turmas(id, nome, modalidades(id, nome, icone_emoji, cor_hex), niveis(nome))
          )
        `)
        .eq('status_presenca', 'falta_justificada')
        .gte('aulas.data_aula', dataInicio)
        .lte('aulas.data_aula', dataFim)
      if (error) throw error
      if (!faltas?.length) return []

      const aulaIdsUnicos = [...new Set(faltas.map(f => f.aula_id))]
      const { data: repos } = await supabase
        .from('reposicoes')
        .select(`
          id, aluno_id, aula_origem_id, status, aula_reposicao_id,
          aula_reposicao:aulas!aula_reposicao_id(id, data_aula, turmas(nome, quadras(nome)))
        `)
        .in('aula_origem_id', aulaIdsUnicos)

      const reposMap = {}
      repos?.forEach(r => {
        if (!reposMap[r.aluno_id]) reposMap[r.aluno_id] = {}
        reposMap[r.aluno_id][r.aula_origem_id] = r
      })

      const porAluno = {}
      faltas.forEach(f => {
        const aluno = f.alunos
        if (!aluno) return
        const aula = f.aulas
        const modalidade = aula?.turmas?.modalidades || null
        const tipoAula = isAulaIndividual(aula) ? 'individual' : 'grupo'

        if (!porAluno[aluno.id]) {
          porAluno[aluno.id] = { id: aluno.id, nome: aluno.nome, nivel: aluno.nivel_avaliado_prof, modalidade, tiposAula: new Set(), faltas: [] }
        }
        if (!porAluno[aluno.id].modalidade && modalidade) {
          porAluno[aluno.id].modalidade = modalidade
        }
        porAluno[aluno.id].tiposAula.add(tipoAula)
        porAluno[aluno.id].faltas.push({
          presencaId: f.id,
          aulaId: f.aula_id,
          dataAula: aula?.data_aula,
          turmaNome: aula?.turmas?.nome || null,
          reposicao: reposMap[aluno.id]?.[f.aula_id] || null,
        })
      })

      return Object.values(porAluno).map(a => {
        const pendentes = a.faltas.filter(f => !f.reposicao || f.reposicao.status === 'pendente')
        // Concluída (já aconteceu ou é hoje) vs. ainda vai acontecer — mesmo status 'agendada',
        // separadas pela data da aula de destino.
        const resolvidas = a.faltas.filter(f => f.reposicao?.status === 'agendada')
        const agendadas = resolvidas.filter(f => (f.reposicao.aula_reposicao?.data_aula || '9999-99-99') > dataFim)
        const repostas = resolvidas.filter(f => (f.reposicao.aula_reposicao?.data_aula || '') <= dataFim)
        return { ...a, tiposAula: [...a.tiposAula], pendentes, agendadas, repostas }
      }).sort((a, b) => b.pendentes.length - a.pendentes.length)
    },
    staleTime: 60000,
  })
}

// Painel "Minhas Reposições" (Fase 2) — todas as reposições de um aluno específico,
// incluindo as já expiradas (diferente de useRelatorioReposicoes, que só olha pendentes
// pra montar a fila de trabalho da equipe).
export function useReposicoesDoAluno(alunoId) {
  return useQuery({
    queryKey: ['reposicoes_aluno', alunoId],
    queryFn: async () => {
      await expirarReposicoesPendentesVencidas()
      const { data, error } = await supabase
        .from('reposicoes')
        .select(`
          id, status, data_limite, created_at, aula_origem_id, aula_reposicao_id,
          modalidades(id, nome, icone_emoji, cor_hex),
          aula_origem:aulas!aula_origem_id(data_aula),
          aula_reposicao:aulas!aula_reposicao_id(data_aula, turmas(nome, quadras(nome)))
        `)
        .eq('aluno_id', alunoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!alunoId,
  })
}

export function useAulasDiaParaReposicao(data) {
  return useQuery({
    queryKey: ['aulas_dia_repos', data],
    queryFn: async () => {
      if (!data) return []
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(id, nome, modalidade_id, horario_inicio, horario_fim, quadras(id, nome), niveis(nome)),
          presencas(id, aluno_id)
        `)
        .eq('data_aula', data)
        .not('turma_id', 'is', null)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return (aulas || []).sort((a, b) =>
        (a.turmas?.horario_inicio || '').localeCompare(b.turmas?.horario_inicio || '')
      )
    },
    enabled: !!data,
    staleTime: 30000,
  })
}

// Mesma ideia de useAulasDiaParaReposicao, mas pro intervalo de uma semana inteira de uma vez
// (grade estilo Disponibilidade — dias x horário) em vez de um dia por consulta. Usado pelo
// picker visual de reposição em AulasAdmin.jsx (ModalReposicao).
export function useAulasSemanaParaReposicao(dataInicio, dataFim) {
  return useQuery({
    queryKey: ['aulas_semana_repos', dataInicio, dataFim],
    queryFn: async () => {
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(id, nome, modalidade_id, horario_inicio, horario_fim, quadras(id, nome), niveis(nome)),
          presencas(id, aluno_id)
        `)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
        .not('turma_id', 'is', null)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return aulas || []
    },
    enabled: !!dataInicio && !!dataFim,
    staleTime: 30000,
  })
}

export function useAulasDisponiveisReposicao() {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['aulas_disp_repos', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(id, nome, horario_inicio, horario_fim, quadras(nome)),
          presencas(id, aluno_id)
        `)
        .gte('data_aula', hoje)
        .not('turma_id', 'is', null)
        .neq('status_aula', 'cancelada')
        .order('data_aula', { ascending: true })
        .limit(200)
      if (error) throw error
      return (data || []).filter(a => (a.presencas?.length || 0) < 4)
    },
    staleTime: 60000,
  })
}

// Agenda sempre resolve a falta pendente mais antiga do aluno (FIFO) — não recebe qual falta
// baixar, só o aluno e a aula de destino. Por baixo usa agendarSlotAtomico — mesma
// proteção de concorrência e mesma fila que a agenda self-service (Fase 2).
export function useAgendarReposicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alunoId, aulaId }) =>
      agendarSlotAtomico({ aulaId, alunoId, tipoParticipacao: 'reposicao' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['aulas_disp_repos'] })
    }
  })
}

// Agenda de um aluno (Fase 2) — usada tanto pra usar uma reposição pendente quanto pra
// comprar uma aula avulsa numa vaga aberta. Ver agendarSlotAtomico.
export function useAgendarSlotAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: agendarSlotAtomico,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reposicoes_aluno'] })
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['aulas_dia_repos'] })
      qc.invalidateQueries({ queryKey: ['vagas_avulsas_abertas'] })
    }
  })
}

export function useGerarAulas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ turmaId, dataInicio, dataFim, professorOverrideId }) => {
      const { data: turma } = await supabase
        .from('turmas')
        .select(`*, professores!professor_titular_id(id), turmas_alunos(aluno_id, ativo)`)
        .eq('id', turmaId)
        .single()

      if (!turma) throw new Error('Turma não encontrada')

      const alunosFixos = turma.turmas_alunos
        ?.filter(ta => ta.ativo)
        .map(ta => ta.aluno_id) || []

      const diasSemana = {
        'domingo': 0, 'segunda': 1, 'terca': 2,
        'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
      }
      const diaSemanaNum = diasSemana[turma.horario_dia_semana?.toLowerCase()] ?? 1

      const aulasParaInserir = []
      const inicio = new Date(dataInicio)
      const fim = new Date(dataFim)

      for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === diaSemanaNum) {
          aulasParaInserir.push({
            turma_id: turmaId,
            empresa_id: turma.empresa_id || null, // propaga o escopo da turma pra aula gerada —
            // sem isso, a aula nasceria empresa_id null (bucket do clube) mesmo vindo de uma
            // turma Particular, furando o isolamento entre tenants.
            contratante_id: turma.contratante_id || null, // mesmo motivo do empresa_id acima —
            // aula gerada "sabe" quem fatura sem precisar de join pra turmas em toda leitura.
            professor_executou_id: professorOverrideId || turma.professores?.id || turma.professor_titular_id,
            data_aula: format(new Date(d), 'yyyy-MM-dd'),
            status: 'pendente',
            status_aula: 'dada',
            paga_professor: true,
            eh_substituicao: false
          })
        }
      }

      if (aulasParaInserir.length === 0) return 0

      // paga_professor: false por padrão — só vira true quando professor confirmar a aula.
      // (status_aula fica 'dada', já setado no push acima — 'agendada' não existe na
      // constraint aulas_status_aula_check e travava a criação de qualquer turma nova.)
      aulasParaInserir.forEach(a => { a.paga_professor = false })

      const { data: aulasCriadas, error } = await supabase
        .from('aulas')
        .insert(aulasParaInserir)
        .select('id')
      if (error) throw error

      if (alunosFixos.length > 0 && aulasCriadas?.length > 0) {
        const presencasParaInserir = []
        for (const aula of aulasCriadas) {
          for (const alunoId of alunosFixos) {
            presencasParaInserir.push({
              aula_id: aula.id,
              aluno_id: alunoId,
              presente: false,
              status_presenca: 'presente',
              tipo_participacao: 'mensalista',
            })
          }
        }
        await supabase.from('presencas').insert(presencasParaInserir)
      }

      return aulasCriadas.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}

// "Avisar falta" (Fase 2): aluno avisa com antecedência que vai faltar numa aula
// específica (não recorrente). Marca a presença como falta_justificada (mesma regra de
// reposição automática das faltas justificadas manuais) e abre a vaga como avulsa pra
// qualquer outro aluno comprar.
export function useAvisarFalta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, alunoId }) => {
      const { error: errPres } = await supabase
        .from('presencas')
        .update({ status_presenca: 'falta_justificada', presente: false })
        .eq('aula_id', aulaId)
        .eq('aluno_id', alunoId)
      if (errPres) throw errPres

      const { data: repoExistente } = await supabase
        .from('reposicoes')
        .select('id')
        .eq('aluno_id', alunoId)
        .eq('aula_origem_id', aulaId)
        .maybeSingle()
      if (!repoExistente) {
        const { data: aula } = await supabase
          .from('aulas').select('turma_id, turmas(modalidade_id)').eq('id', aulaId).single()
        const dataLimite = format(addDays(new Date(), 60), 'yyyy-MM-dd')
        await supabase.from('reposicoes').insert({
          aluno_id: alunoId,
          aula_origem_id: aulaId,
          modalidade_id: aula?.turmas?.modalidade_id || null,
          status: 'pendente',
          data_limite: dataLimite,
        })
      }

      const { error: errVaga } = await supabase.from('vagas_avulsas').insert({
        aula_id: aulaId,
        origem: 'falta_avisada',
        status: 'aberta',
      })
      if (errVaga) throw errVaga
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
      qc.invalidateQueries({ queryKey: ['vagas_avulsas_abertas'] })
    }
  })
}

export function useVagasAvulsasAbertas() {
  return useQuery({
    queryKey: ['vagas_avulsas_abertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vagas_avulsas')
        .select('id, aula_id, created_at')
        .eq('status', 'aberta')
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })
}