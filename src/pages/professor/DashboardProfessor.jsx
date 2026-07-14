import { useState, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, addDays, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, X, AlertTriangle, Check, MessageCircle, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { confirmarAulasElegiveis } from '../../hooks/useAulas'
import { usePendenciasConfirmacao, useConfirmarAvaliacaoTecnica, useResumoTecnicoTurma } from '../../hooks/useAlunos'
import { useAlertaFaltasConsecutivas } from '../../hooks/useAlertaFaltas'
import { useAbrirConversaDoAluno } from '../../hooks/useMensagens'
import { nivelPorPcScore, REAVALIACAO_PRAZO_DIAS } from '../../lib/pcScore'
import useAppStore from '../../store/useAppStore'
import { horarioParaMinutos, horarioInicioDaAula, horarioFimDaAula, diaSemanaDaData } from '../../constants/modalidades'
import { Loading } from '../../components/ui/Loading'
import { ModalDetalhesDia } from '../cadastros/ProfessoresPage'
import toast from 'react-hot-toast'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']
const DIAS_SEMANA = ['segunda','terca','quarta','quinta','sexta','sabado','domingo']
const DIAS_LABEL = ['SEG','TER','QUA','QUI','SEX','SAB','DOM']
const HORARIOS_GRADE = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

function minutosAgora() {
  const agora = new Date()
  return agora.getHours() * 60 + agora.getMinutes()
}

// Tolerância de 10min após o término oficial (intervalo normal entre aulas)
function aulaEmAndamento(aula) {
  const inicio = horarioParaMinutos(horarioInicioDaAula(aula))
  const fim = horarioParaMinutos(horarioFimDaAula(aula))
  if (inicio == null || fim == null) return false
  const agora = minutosAgora()
  return agora >= inicio && agora < fim + 10
}

// Conta pela presença real daquela ocorrência (inclui reposição), não pela matrícula fixa
// da turma — uma aula com só um aluno de reposição não tem ninguém em turmas_alunos, mas
// ainda assim é uma aula de verdade acontecendo.
function aulaTemAluno(aula) {
  if (!aula.turma_id) return true
  return (aula.presencas?.length || 0) > 0
}

// professorIdProp: usado quando o gestor abre o painel de um professor específico
// (dentro do card dele em Cadastros) — nesse caso não é "o meu painel", é uma visão
// somente-leitura do painel de outra pessoa, com os mesmos dados em tempo real.
export function DashboardProfessor({ professorIdProp } = {}) {
  const navigate = useNavigate()
  const { perfil } = useAppStore()
  const professorId = professorIdProp || perfil?.professor_id

  const [mesExpandido, setMesExpandido] = useState(null)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [celulaAtiva, setCelulaAtiva] = useState(null)

  // Painel só aparece no meu próprio painel, não na visão somente-leitura do gestor sobre
  // outro professor (professorIdProp) — confirmar é uma ação pessoal de quem foi chamado.
  const { data: pendencias = [] } = usePendenciasConfirmacao(!professorIdProp ? professorId : null)
  const confirmarAvaliacao = useConfirmarAvaliacaoTecnica()
  const abrirConversaDoAluno = useAbrirConversaDoAluno()

  // Mesmo aviso da Home do gestor (aluno com aula hoje/amanhã já emendando 2+ faltas
  // seguidas), mas só as ocorrências onde ESSE professor é quem vai dar a aula — um professor
  // não precisa (nem deveria) ver esse alerta sobre aluno de outro professor.
  const { data: alertasFaltas = [] } = useAlertaFaltasConsecutivas()
  const meusAlertasFaltas = professorId
    ? alertasFaltas
        .map(a => ({ ...a, ocorrencias: a.ocorrencias.filter(o => o.professorId === professorId) }))
        .filter(a => a.ocorrencias.length > 0)
    : []

  function abrirAulaDoAlerta(aulaId) {
    navigate('/aulas', { state: { highlightAulaId: aulaId } })
  }

  async function handleConfirmarPendencia(pendencia) {
    try {
      await confirmarAvaliacao.mutateAsync({
        confirmacaoId: pendencia.confirmacaoId, avaliacaoId: pendencia.id,
        alunoId: pendencia.aluno_id, modalidadeId: pendencia.modalidade_id, professorId,
      })
      toast.success('Avaliação confirmada!', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  async function handleDiscutirPendencia(pendencia) {
    const { data: perfilAvaliador } = await supabase
      .from('perfis_usuario').select('user_id').eq('professor_id', pendencia.professor_id).maybeSingle()
    if (!perfilAvaliador?.user_id) {
      toast.error('Não foi possível abrir a conversa com esse professor.', { style: toastStyle })
      return
    }
    try {
      const conversaId = await abrirConversaDoAluno.mutateAsync({ alunoId: pendencia.aluno_id, outroUserId: perfilAvaliador.user_id })
      navigate('/mensagens', { state: { conversaId } })
    } catch {
      toast.error('Não foi possível abrir a conversa.', { style: toastStyle })
    }
  }

  const hoje = format(new Date(), 'yyyy-MM-dd')
  const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const agora = new Date()
  const mesAtual = agora.getMonth() + 1
  const anoAtual = agora.getFullYear()

  const { data: professor, isLoading: loadingProf } = useQuery({
    queryKey: ['dashboard_prof_perfil', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores').select('*, modalidades(nome)').eq('id', professorId).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { data: aulasHojeAmanha = [], isLoading: loadingAulas } = useQuery({
    queryKey: ['dashboard_prof_aulas', professorId, hoje, amanha],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id, status, status_aula, observacoes,
          turmas(nome, horario_inicio, horario_fim, quadras(nome), modalidades(nome, icone_emoji, cor_hex), turmas_alunos(id, ativo)),
          presencas(id, status_presenca, presente)
        `)
        .in('data_aula', [hoje, amanha])
        .eq('professor_executou_id', professorId)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return data || []
    },
    refetchInterval: 20000,
    staleTime: 15000,
  })

  const { data: aulasHistorico = [] } = useQuery({
    queryKey: ['dashboard_prof_historico', professorId, hoje],
    enabled: !!professorId,
    queryFn: async () => {
      await confirmarAulasElegiveis({ professorId, dataFim: hoje })
      const { data, error } = await supabase
        .from('aulas')
        .select('id, data_aula, status_aula, paga_professor')
        .eq('professor_executou_id', professorId)
        .eq('status_aula', 'dada')
        .eq('paga_professor', true)
        .lte('data_aula', hoje)
      if (error) throw error
      return data || []
    },
  })

  const { data: pagamentosExtras = [] } = useQuery({
    queryKey: ['dashboard_prof_extras', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_extras').select('*').eq('professor_id', professorId)
      if (error) throw error
      return data || []
    },
  })

  const { data: turmasProprias = [] } = useQuery({
    queryKey: ['dashboard_prof_turmas', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select('*, modalidades(nome, icone_emoji, cor_hex), niveis(nome), quadras(nome), turmas_alunos(id, ativo, alunos(nome))')
        .eq('professor_titular_id', professorId)
      if (error) throw error
      return data || []
    },
  })

  // Aulas de verdade dessa semana (seg-dom) — é daqui que vem quem realmente está
  // presente (inclusive reposição) e se algum horário foi trocado pra outra turma
  // (via "Editar turma > só essa aula"), coisa que a matrícula fixa não mostra.
  const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 })
  const inicioSemanaStr = format(inicioSemana, 'yyyy-MM-dd')
  const fimSemanaStr = format(addDays(inicioSemana, 6), 'yyyy-MM-dd')
  const { data: aulasDaSemana = [] } = useQuery({
    queryKey: ['dashboard_prof_semana', professorId, inicioSemanaStr],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(nome, horario_inicio, niveis(nome), quadras(nome)),
          presencas(id, status_presenca, tipo_participacao, alunos(nome))
        `)
        .eq('professor_executou_id', professorId)
        .gte('data_aula', inicioSemanaStr)
        .lte('data_aula', fimSemanaStr)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return data || []
    },
  })
  const aulaSemanaPorSlot = {}
  aulasDaSemana.forEach(a => {
    const dia = diaSemanaDaData(a.data_aula)
    const horarioSlot = a.turmas?.horario_inicio?.slice(0, 5)
    if (dia && horarioSlot) aulaSemanaPorSlot[`${dia}_${horarioSlot}`] = a
  })

  const aulasHojeTodas = aulasHojeAmanha.filter(a => a.data_aula === hoje).filter(aulaTemAluno)
  const aulasAmanha = aulasHojeAmanha.filter(a => a.data_aula === amanha).filter(aulaTemAluno)
  const aoVivoAgora = aulasHojeTodas.filter(aulaEmAndamento)

  function calcularGanhosMes(mes, ano) {
    const doMes = aulasHistorico.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    })
    const qtd = doMes.length
    const valorAula = professor?.valor_aula || 0
    const valorExtras = pagamentosExtras
      .filter(p => p.mes === mes && p.ano === ano)
      .reduce((acc, p) => acc + (p.valor || 0), 0)
    return { qtd, valor: qtd * valorAula + valorExtras }
  }

  const ganhosMesAtual = calcularGanhosMes(mesAtual, anoAtual)
  const totalAulas = aulasHistorico.length

  const historico6Meses = Array.from({ length: 6 }, (_, i) => {
    const m = mesAtual - 5 + i
    const mes = m <= 0 ? m + 12 : m
    const ano = m <= 0 ? anoAtual - 1 : anoAtual
    return { mes, ano, label: `${MESES[mes - 1]} ${ano}`, ...calcularGanhosMes(mes, ano) }
  })

  // Grade semanal: turmas onde é titular, uma célula por dia x horário
  function getCelula(dia, horario) {
    return turmasProprias.find(t => t.horario_dia_semana === dia && t.horario_inicio?.slice(0, 5) === horario)
  }

  // Junta o padrão recorrente da turma (pra saber o nome "normal" do horário) com a aula
  // de verdade dessa semana (pra saber quem está presente de fato, inclusive reposição, e
  // se esse horário específico virou outra coisa via "Editar turma > só essa aula").
  function getInfoCelula(dia, horario) {
    const turmaRecorrente = getCelula(dia, horario)
    const aulaSemana = aulaSemanaPorSlot[`${dia}_${horario}`]
    if (!turmaRecorrente && !aulaSemana) return null

    const presencas = (aulaSemana?.presencas || []).filter(p => p.alunos)
    const presencasRegulares = presencas.filter(p => p.tipo_participacao !== 'reposicao')
    const presencasReposicao = presencas.filter(p => p.tipo_participacao === 'reposicao')
    const ehOverride = !!(aulaSemana && turmaRecorrente && aulaSemana.turma_id !== turmaRecorrente.id)
    const removida = turmaRecorrente?.ativo === false

    let corBorda
    if (removida) corBorda = 'rgba(239,68,68,0.5)'
    else if (ehOverride) corBorda = 'rgba(59,130,246,0.6)'
    else if (presencasRegulares.length > 0 || presencasReposicao.length > 0) corBorda = 'rgba(34,197,94,0.5)'
    else corBorda = 'rgba(252,200,37,0.5)'

    const nomeRecorrente = turmaRecorrente?.niveis?.nome || turmaRecorrente?.nome || ''
    const nomeEfetivo = aulaSemana?.turmas?.niveis?.nome || aulaSemana?.turmas?.nome || ''
    const individual = (turmaRecorrente?.niveis?.nome === 'Individual') || (aulaSemana?.turmas?.niveis?.nome === 'Individual')

    return {
      turmaRecorrente, aulaSemana, ehOverride, removida, corBorda, individual,
      presencasRegulares, presencasReposicao, nomeRecorrente, nomeEfetivo,
      quadraNome: aulaSemana?.turmas?.quadras?.nome || turmaRecorrente?.quadras?.nome || '',
    }
  }

  // Individual lota com 1 aluno; turma em grupo tem 4 vagas — quanto mais perto de lotar, mais quente a cor
  function corContagem(qtd, individual) {
    if (individual) return qtd >= 1 ? '#EF4444' : '#22c55e'
    if (qtd >= 4) return '#EF4444'
    if (qtd >= 2) return '#fcc825'
    if (qtd === 1) return '#22c55e'
    return '#444'
  }

  if (loadingProf || !professor) return <Loading text="Carregando painel..." />

  const modalidadeLabel = professor.modalidades?.nome || ''

  return (
    <div className="fade-in">
      {/* Header pessoal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px' }}>
        <a
          href={professor.foto_url || undefined}
          target={professor.foto_url ? '_blank' : undefined}
          rel="noreferrer"
          title={professor.foto_url ? 'Abrir foto em tamanho real' : undefined}
          style={{ position: 'relative', width: 120, height: 120, flexShrink: 0, cursor: professor.foto_url ? 'pointer' : 'default' }}
        >
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', padding: '3px', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid #110f0f', boxSizing: 'border-box', overflow: 'hidden', backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {professor.foto_url
                ? <img src={professor.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '38px', fontWeight: '700', color: '#fcc825' }}>
                    {professor.nome?.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </span>
              }
            </div>
          </div>
          {aoVivoAgora.length > 0 && (
            <span className="pulse-badge" style={{
              position: 'absolute', bottom: '6px', right: '6px', width: '18px', height: '18px',
              borderRadius: '50%', backgroundColor: '#22c55e', border: '3px solid #110f0f',
            }} />
          )}
        </a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#F0F2F5', lineHeight: 1.2 }}>
            {professor.apelido || professor.nome}
          </div>
          {professor.apelido && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{professor.nome}</div>
          )}
          <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{modalidadeLabel}</div>
          {aoVivoAgora.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <span className="pulse-badge" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>Dando aula agora</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmações pendentes — avaliações de outro professor aguardando confirmação */}
      {pendencias.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{
            fontSize: '13px', fontWeight: '700', color: '#fcc825', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <AlertTriangle size={13} /> Confirmações pendentes ({pendencias.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendencias.map(p => (
              <CardConfirmacaoPendente
                key={p.confirmacaoId}
                pendencia={p}
                confirmando={confirmarAvaliacao.isPending}
                onConfirmar={() => handleConfirmarPendencia(p)}
                onDiscutir={() => handleDiscutirPendencia(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Alunos meus com aula hoje/amanhã já emendando 2+ faltas seguidas */}
      {meusAlertasFaltas.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{
            fontSize: '13px', fontWeight: '700', color: '#fcc825', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            👀 De olho ({meusAlertasFaltas.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {meusAlertasFaltas.map(a => {
              const proxima = a.ocorrencias[0]
              const ehHoje = proxima?.data === hoje
              return (
                <div key={`${a.alunoId}-${a.modalidadeId}`}
                  onClick={() => proxima && abrirAulaDoAlerta(proxima.aulaId)}
                  style={{
                    padding: '10px 12px', borderRadius: '10px', cursor: proxima ? 'pointer' : 'default',
                    backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.25)',
                    fontSize: '12px', color: '#F0F2F5',
                  }}>
                  <b>{a.alunoNome}</b> · {a.faltasConsecutivas} faltas seguidas · {a.modalidadeNome}
                  {proxima && <> · aula {ehHoje ? 'hoje' : 'amanhã'} {proxima.horario}</>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3 cards do dia */}
      {loadingAulas ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <CardResumoDia titulo="Aulas Hoje" valor={aulasHojeTodas.length} cor="#fcc825" onClick={() => navigate('/aulas')} />
          <CardResumoDia titulo="Ao Vivo Agora" valor={aoVivoAgora.length} cor="#22c55e" pulsando={aoVivoAgora.length > 0} onClick={() => navigate('/aulas')} />
          <CardResumoDia titulo="Amanhã" valor={aulasAmanha.length} cor="#3b82f6" onClick={() => navigate('/aulas', { state: { data: amanha } })} />
        </div>
      )}

      {/* Financeiro */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '14px', padding: '16px', border: '1px solid rgba(252,200,37,0.15)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {MESES[mesAtual - 1]} {anoAtual} · {ganhosMesAtual.qtd} aulas
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#fcc825' }}>
              R$ {ganhosMesAtual.valor.toFixed(2).replace('.', ',')}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#F0F2F5', lineHeight: 1 }}>{totalAulas}</div>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Total de<br/>Aulas</div>
          </div>
        </div>
      </div>

      {/* Ver grade completa */}
      <button
        onClick={() => navigate('/aulas', { state: { from: '/dashboard-professor', modoGradeCompleta: true } })}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: '12px', border: '1px solid #2a2a2a',
          backgroundColor: '#1a1a1a', color: '#F0F2F5', fontSize: '13px', fontWeight: '600',
          cursor: 'pointer', marginBottom: '20px',
        }}
      >
        Ver grade completa
        <ChevronRight size={16} color="#555" />
      </button>

      {/* Histórico 6 meses */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Histórico
        </h3>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {historico6Meses.map(m => {
            const atual = m.mes === mesAtual && m.ano === anoAtual
            return (
              <button
                key={`${m.mes}-${m.ano}`}
                onClick={() => setMesExpandido(v => (v?.mes === m.mes && v?.ano === m.ano) ? null : { mes: m.mes, ano: m.ano })}
                style={{
                  flexShrink: 0, minWidth: '96px', padding: '12px', borderRadius: '12px', cursor: 'pointer',
                  backgroundColor: atual ? 'rgba(252,200,37,0.1)' : '#1a1a1a',
                  border: atual ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '10px', color: atual ? '#fcc825' : '#555', textTransform: 'uppercase', fontWeight: '700', marginBottom: '6px' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#F0F2F5' }}>{m.qtd}</div>
                <div style={{ fontSize: '9px', color: '#555' }}>aulas</div>
              </button>
            )
          })}
        </div>

        {mesExpandido && (
          <MesExpandidoDetalhe
            mes={mesExpandido.mes}
            ano={mesExpandido.ano}
            valorAula={professor?.valor_aula || 0}
            aulas={aulasHistorico.filter(a => {
              const d = new Date(a.data_aula + 'T12:00')
              return d.getMonth() + 1 === mesExpandido.mes && d.getFullYear() === mesExpandido.ano
            })}
            onClose={() => setMesExpandido(null)}
            onSelecionarDia={dataStr => setDiaSelecionado(dataStr)}
          />
        )}
      </div>

      {diaSelecionado && (
        <ModalDetalhesDia
          professorId={professorId}
          dataStr={diaSelecionado}
          onClose={() => setDiaSelecionado(null)}
        />
      )}

      {/* Grade semanal */}
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Minha grade semanal
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7, 1fr)`, gap: '4px', minWidth: '560px' }}>
            <div />
            {DIAS_LABEL.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', color: '#555', fontWeight: '700', padding: '4px 0' }}>{d}</div>
            ))}
            {HORARIOS_GRADE.map(horario => (
              <Fragment key={horario}>
                <div style={{ fontSize: '10px', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '4px' }}>
                  {horario}
                </div>
                {DIAS_SEMANA.map(dia => {
                  const info = getInfoCelula(dia, horario)
                  return (
                    <button
                      key={`${dia}-${horario}`}
                      onClick={() => info && setCelulaAtiva({ info, horario })}
                      disabled={!info}
                      style={{
                        minHeight: '46px', borderRadius: '6px', cursor: info ? 'pointer' : 'default',
                        backgroundColor: info ? '#1a1a1a' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${info ? info.corBorda : 'transparent'}`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '2px', padding: '3px', overflow: 'hidden', boxSizing: 'border-box',
                      }}
                    >
                      {info && (
                        <>
                          {info.ehOverride ? (
                            <>
                              <span style={{ fontSize: '8px', color: '#777', textDecoration: 'line-through', lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>
                                {info.nomeRecorrente}
                              </span>
                              <span style={{ fontSize: '7px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                {info.nomeEfetivo}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '8px', color: '#ccc', lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>
                              {info.nomeRecorrente || info.nomeEfetivo}
                            </span>
                          )}
                          {(info.presencasRegulares.length > 0 || info.presencasReposicao.length > 0) && (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '1px' }}>
                              {info.presencasRegulares.length > 0 && (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#ddd', borderBottom: `2px solid ${corContagem(info.presencasRegulares.length, info.individual)}`, paddingBottom: '1px' }}>
                                  {info.presencasRegulares.length}
                                </span>
                              )}
                              {info.presencasReposicao.length > 0 && (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#ddd', borderBottom: '2px solid #3b82f6', paddingBottom: '1px' }}>
                                  {info.presencasReposicao.length}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
          <Legenda tipo="borda" cor="#22c55e" label="Borda: tem aluno" />
          <Legenda tipo="borda" cor="#fcc825" label="Borda: sua turma, vazia" />
          <Legenda tipo="borda" cor="#3b82f6" label="Borda: virou outra aula hoje" />
          <Legenda tipo="borda" cor="#EF4444" label="Borda: removida" />
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
          <Legenda tipo="sublinhado" cor="#22c55e" label="Nº: ainda tem vaga" />
          <Legenda tipo="sublinhado" cor="#fcc825" label="Nº: poucas vagas" />
          <Legenda tipo="sublinhado" cor="#EF4444" label="Nº: lotada" />
          <Legenda tipo="sublinhado" cor="#3b82f6" label="Nº: reposição" />
        </div>
      </div>

      {celulaAtiva && (
        <ModalCelula celulaAtiva={celulaAtiva} onClose={() => setCelulaAtiva(null)} />
      )}
    </div>
  )
}

function CardConfirmacaoPendente({ pendencia, confirmando, onConfirmar, onDiscutir }) {
  const nivel = pendencia.pc_score != null ? nivelPorPcScore(pendencia.pc_score) : null
  const dimensoes = Object.entries(pendencia.dimensoes || {})

  return (
    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid rgba(252,200,37,0.25)', padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#F0F2F5' }}>{pendencia.alunos?.nome}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {pendencia.modalidades?.nome} · avaliado por {pendencia.professores?.nome} em{' '}
            {format(new Date(pendencia.data_avaliacao + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR })}
          </div>
        </div>
        {nivel && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: nivel.cor }}>{pendencia.pc_score}</div>
            <div style={{ fontSize: '10px', color: nivel.cor, fontWeight: '600' }}>{nivel.label}</div>
          </div>
        )}
      </div>

      {dimensoes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {dimensoes.map(([nome, valor]) => (
            <span key={nome} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#111', color: '#ccc' }}>
              {nome}: <strong style={{ color: '#fcc825' }}>{valor}/5</strong>
            </span>
          ))}
        </div>
      )}

      {pendencia.comentario && (
        <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', marginBottom: '10px' }}>"{pendencia.comentario}"</div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onDiscutir} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '9px', borderRadius: '9px', border: '1px solid #2a2a2a', cursor: 'pointer',
          backgroundColor: '#111', color: '#888', fontSize: '12px', fontWeight: '600',
        }}>
          <MessageCircle size={13} /> Discutir
        </button>
        <button onClick={onConfirmar} disabled={confirmando} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '9px', borderRadius: '9px', border: 'none', cursor: confirmando ? 'default' : 'pointer',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '700',
          opacity: confirmando ? 0.6 : 1,
        }}>
          <Check size={13} /> Confirmar
        </button>
      </div>
    </div>
  )
}

function CardResumoDia({ titulo, valor, cor, pulsando, onClick }) {
  return (
    <button onClick={onClick} style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '14px 10px', border: '1px solid #2a2a2a', textAlign: 'center', cursor: 'pointer' }}>
      <div style={{ fontSize: '24px', fontWeight: '800', color: cor, lineHeight: 1 }} className={pulsando ? 'pulse-badge' : ''}>
        {valor}
      </div>
      <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px' }}>{titulo}</div>
    </button>
  )
}

function Legenda({ cor, label, tipo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {tipo === 'borda' ? (
        <span style={{ width: '9px', height: '9px', borderRadius: '3px', border: `1.5px solid ${cor}` }} />
      ) : tipo === 'sublinhado' ? (
        <span style={{ fontSize: '10px', fontWeight: '700', color: '#ddd', borderBottom: `2px solid ${cor}`, paddingBottom: '1px' }}>2</span>
      ) : (
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: cor }} />
      )}
      <span style={{ fontSize: '11px', color: '#888' }}>{label}</span>
    </div>
  )
}

function MesExpandidoDetalhe({ mes, ano, aulas, valorAula, onClose, onSelecionarDia }) {
  const porDia = {}
  aulas.forEach(a => { (porDia[a.data_aula] ||= []).push(a) })
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a))

  return (
    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #2a2a2a', padding: '14px', marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#F0F2F5' }}>{MESES[mes - 1]} {ano} · {aulas.length} aulas</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      {dias.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#555' }}>Nenhuma aula dada nesse mês.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
          {dias.map(dataStr => {
            const doDia = porDia[dataStr]
            return (
              <button key={dataStr} onClick={() => onSelecionarDia(dataStr)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '12px', color: '#F0F2F5', padding: '10px 12px', borderRadius: '8px',
                backgroundColor: '#111', border: '1px solid #222', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ textTransform: 'capitalize' }}>{format(new Date(dataStr + 'T12:00'), "dd 'de' MMM", { locale: ptBR })}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#888' }}>{doDia.length} aula{doDia.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: '#fcc825', fontWeight: '600' }}>R$ {(doDia.length * valorAula).toFixed(2).replace('.', ',')}</span>
                  <ChevronRight size={14} color="#555" />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModalCelula({ celulaAtiva, onClose }) {
  const { info, horario } = celulaAtiva
  const nomeExibir = info.ehOverride ? info.nomeEfetivo : (info.nomeRecorrente || info.nomeEfetivo)
  const totalAlunos = info.presencasRegulares.length + info.presencasReposicao.length
  // Via portal pro <body>: sem isso, o WebKit mobile prende esse position:fixed dentro do
  // .app-main (overflow-y + scroll-touch) e o modal fica cortado, sem cobrir a tela toda.
  return createPortal((
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1a1a1a', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '20px', width: '100%', maxWidth: '340px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>{nomeExibir}</div>
            {info.ehOverride && (
              <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px' }}>Substituindo {info.nomeRecorrente} nessa semana</div>
            )}
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{info.quadraNome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '13px', color: '#F0F2F5', marginBottom: '10px' }}>{horario} — {totalAlunos} aluno(s)</div>
        {(info.presencasRegulares.length > 0 || info.presencasReposicao.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
            {info.presencasRegulares.map(p => (
              <div key={p.id} style={{ fontSize: '13px', color: '#ccc', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#111' }}>
                {p.alunos.nome}
              </div>
            ))}
            {info.presencasReposicao.map(p => (
              <div key={p.id} style={{ fontSize: '13px', color: '#ccc', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {p.alunos.nome}
                <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: '600' }}>reposição</span>
              </div>
            ))}
          </div>
        )}
        {info.removida && <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '6px' }}>Turma removida</div>}
        {info.turmaRecorrente?.id && <ResumoTecnicoTurma turmaId={info.turmaRecorrente.id} />}
      </div>
    </div>
  ), document.body)
}

// Item 14 (Fase 3): média por dimensão dos alunos da turma com avaliação confirmada recente,
// cobertura e gargalo coletivo — só matemática sobre dado já existente, sem custo de IA.
// Item 15: botão "Sugerir plano de treino" chama a Edge Function plano-turma (Haiku, mesmo
// padrão de narrativa-tecnica) só habilitado com cobertura >= 50% da turma, pra não sugerir
// plano em cima de dado incompleto. Sem persistência — o texto vive só no estado local
// enquanto o modal estiver aberto, cada clique gera de novo.
function ResumoTecnicoTurma({ turmaId }) {
  const { data: resumo, isLoading } = useResumoTecnicoTurma(turmaId)
  const [plano, setPlano] = useState(null)
  const [gerandoPlano, setGerandoPlano] = useState(false)

  if (isLoading || !resumo || resumo.totalAlunos === 0) return null

  const cobertura = resumo.totalAlunos > 0 ? resumo.alunosAvaliados / resumo.totalAlunos : 0
  const coberturaSuficiente = cobertura >= 0.5

  async function handleSugerirPlano() {
    setGerandoPlano(true)
    try {
      const { data, error } = await supabase.functions.invoke('plano-turma', {
        body: {
          turmaNome: resumo.turmaNome, modalidadeNome: resumo.modalidadeNome,
          totalAlunos: resumo.totalAlunos, alunosAvaliados: resumo.alunosAvaliados,
          mediaPorDimensao: resumo.mediaPorDimensao, gargaloColetivo: resumo.gargaloColetivo,
        },
      })
      if (error) throw error
      setPlano(data?.plano || null)
    } catch {
      toast.error('Não foi possível gerar o plano agora.', { style: toastStyle })
    } finally {
      setGerandoPlano(false)
    }
  }

  return (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2a2a2a' }}>
      <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '8px' }}>
        Resumo técnico da turma
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
        {resumo.alunosAvaliados} de {resumo.totalAlunos} avaliados nos últimos {REAVALIACAO_PRAZO_DIAS} dias
      </div>
      {resumo.mediaPorDimensao.length > 0 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
            {resumo.mediaPorDimensao.map(d => (
              <div key={d.dimensao} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ccc' }}>
                <span>{d.dimensao}</span>
                <strong style={{ color: d.dimensao === resumo.gargaloColetivo?.dimensao ? '#cf1b9b' : '#fcc825' }}>{d.media}/5</strong>
              </div>
            ))}
          </div>
          {resumo.gargaloColetivo && (
            <div style={{ fontSize: '11px', color: '#cf1b9b', marginBottom: '10px' }}>
              Gargalo coletivo: {resumo.gargaloColetivo.dimensao} ({resumo.gargaloColetivo.media}/5)
            </div>
          )}

          {plano ? (
            <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.5', backgroundColor: '#111', borderRadius: '8px', padding: '10px' }}>
              {plano}
            </div>
          ) : (
            <button
              onClick={handleSugerirPlano}
              disabled={!coberturaSuficiente || gerandoPlano}
              title={!coberturaSuficiente ? 'Precisa de pelo menos metade da turma avaliada recentemente' : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '9px', borderRadius: '9px', border: 'none',
                cursor: (!coberturaSuficiente || gerandoPlano) ? 'default' : 'pointer',
                background: coberturaSuficiente ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                color: coberturaSuficiente ? 'white' : '#555',
                fontSize: '12px', fontWeight: '700', opacity: gerandoPlano ? 0.6 : 1,
              }}
            >
              <Sparkles size={13} />
              {gerandoPlano ? 'Gerando plano...' : coberturaSuficiente ? 'Sugerir plano de treino' : 'Cobertura insuficiente pra sugerir plano'}
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: '11px', color: '#555' }}>Sem avaliações recentes o suficiente pra calcular a média da turma.</div>
      )}
    </div>
  )
}
