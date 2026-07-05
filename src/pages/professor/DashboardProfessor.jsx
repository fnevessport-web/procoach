import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { horarioParaMinutos, horarioInicioDaAula, horarioFimDaAula } from '../../constants/modalidades'
import { Loading } from '../../components/ui/Loading'

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']
const DIAS_SEMANA = ['segunda','terca','quarta','quinta','sexta','sabado','domingo']
const DIAS_LABEL = ['SEG','TER','QUA','QUI','SEX','SAB','DOM']
const HORARIOS_GRADE = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

function minutosAgora() {
  const agora = new Date()
  return agora.getHours() * 60 + agora.getMinutes()
}

function aulaEmAndamento(aula) {
  const inicio = horarioParaMinutos(horarioInicioDaAula(aula))
  const fim = horarioParaMinutos(horarioFimDaAula(aula))
  if (inicio == null || fim == null) return false
  const agora = minutosAgora()
  return agora >= inicio && agora < fim
}

// Avulsas sempre contam como ativas; turma só conta se tiver aluno ativo matriculado
function turmaAtiva(aula) {
  if (!aula.turma_id) return true
  return !!aula.turmas?.turmas_alunos?.some(ta => ta.ativo)
}

export function DashboardProfessor() {
  const navigate = useNavigate()
  const { perfil } = useAppStore()
  const professorId = perfil?.professor_id

  const [mesExpandido, setMesExpandido] = useState(null)
  const [celulaAtiva, setCelulaAtiva] = useState(null)

  const hoje = format(new Date(), 'yyyy-MM-dd')
  const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const agora = new Date()
  const mesAtual = agora.getMonth() + 1
  const anoAtual = agora.getFullYear()
  const hojeSemana = DIAS_SEMANA[(agora.getDay() + 6) % 7]

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
      const { data, error } = await supabase
        .from('aulas')
        .select('data_aula, status, status_aula')
        .eq('professor_executou_id', professorId)
        .eq('status_aula', 'dada')
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
        .select('*, modalidades(nome, icone_emoji, cor_hex), niveis(nome), quadras(nome), turmas_alunos(id, ativo)')
        .eq('professor_titular_id', professorId)
      if (error) throw error
      return data || []
    },
  })

  const aulasHojeTodas = aulasHojeAmanha.filter(a => a.data_aula === hoje).filter(turmaAtiva)
  const aulasAmanha = aulasHojeAmanha.filter(a => a.data_aula === amanha).filter(turmaAtiva)
  const aoVivoAgora = aulasHojeTodas.filter(aulaEmAndamento)

  function calcularGanhosMes(mes, ano) {
    const doMes = aulasHistorico.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    })
    const qtd = doMes.length
    const qtdValidado = doMes.filter(a => a.status === 'match' || a.status === 'confirmada_coord').length
    const qtdAguardandoMatch = doMes.filter(a => a.status === 'confirmada_professor').length
    const valorAula = professor?.valor_aula || 0
    const valorValidado = qtdValidado * valorAula
    const valorAguardandoMatch = qtdAguardandoMatch * valorAula
    const valorExtras = pagamentosExtras
      .filter(p => p.mes === mes && p.ano === ano)
      .reduce((acc, p) => acc + (p.valor || 0), 0)
    return { qtd, qtdValidado, qtdAguardandoMatch, valorValidado: valorValidado + valorExtras, valorAguardandoMatch }
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

  function corCelula(turma) {
    if (!turma) return null
    if (turma.ativo === false) return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', dot: '#EF4444' }
    const temAluno = turma.turmas_alunos?.some(ta => ta.ativo)
    if (!temAluno) return { bg: 'rgba(252,200,37,0.1)', border: 'rgba(252,200,37,0.3)', dot: '#fcc825' }
    return { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', dot: '#22c55e' }
  }

  if (loadingProf || !professor) return <Loading text="Carregando painel..." />

  const modalidadeLabel = professor.modalidades?.nome || ''

  return (
    <div className="fade-in">
      {/* Header pessoal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px' }}>
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
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
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#F0F2F5', lineHeight: 1.2 }}>
            {professor.apelido || professor.nome}
          </div>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{modalidadeLabel}</div>
          {aoVivoAgora.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <span className="pulse-badge" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>Dando aula agora</span>
            </div>
          )}
        </div>
      </div>

      {/* 3 cards do dia */}
      {loadingAulas ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <CardResumoDia titulo="Aulas Hoje" valor={aulasHojeTodas.length} cor="#fcc825" />
          <CardResumoDia titulo="Ao Vivo Agora" valor={aoVivoAgora.length} cor="#22c55e" pulsando={aoVivoAgora.length > 0} />
          <CardResumoDia titulo="Amanhã" valor={aulasAmanha.length} cor="#3b82f6" />
        </div>
      )}

      {/* Financeiro */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '14px', padding: '16px', border: '1px solid rgba(252,200,37,0.15)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {MESES[mesAtual - 1]} {anoAtual} · {ganhosMesAtual.qtdValidado + ganhosMesAtual.qtdAguardandoMatch} aulas
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#fcc825' }}>
              R$ {ganhosMesAtual.valorValidado.toFixed(2).replace('.', ',')}
            </div>
            {ganhosMesAtual.valorAguardandoMatch > 0 && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                R$ {ganhosMesAtual.valorAguardandoMatch.toFixed(2).replace('.', ',')} aguardando match
              </div>
            )}
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
            aulas={aulasHistorico.filter(a => {
              const d = new Date(a.data_aula + 'T12:00')
              return d.getMonth() + 1 === mesExpandido.mes && d.getFullYear() === mesExpandido.ano
            })}
            onClose={() => setMesExpandido(null)}
          />
        )}
      </div>

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
                  const turma = getCelula(dia, horario)
                  const cor = corCelula(turma)
                  const ehHoje = dia === hojeSemana
                  return (
                    <button
                      key={`${dia}-${horario}`}
                      onClick={() => turma && setCelulaAtiva({ turma, dia, horario })}
                      disabled={!turma}
                      style={{
                        height: '30px', borderRadius: '6px', cursor: turma ? 'pointer' : 'default',
                        backgroundColor: cor ? cor.bg : 'rgba(255,255,255,0.02)',
                        border: cor ? `1px solid ${cor.border}` : '1px solid transparent',
                        outline: ehHoje ? '1px solid rgba(252,200,37,0.5)' : 'none',
                        outlineOffset: '-1px',
                      }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
          <Legenda cor="#22c55e" label="Confirmada" />
          <Legenda cor="#fcc825" label="Sem aluno" />
          <Legenda cor="#EF4444" label="Removida" />
        </div>
      </div>

      {celulaAtiva && (
        <ModalCelula
          celulaAtiva={celulaAtiva}
          ehHoje={celulaAtiva.dia === hojeSemana}
          onClose={() => setCelulaAtiva(null)}
          onIrParaAulas={() => navigate('/aulas')}
        />
      )}
    </div>
  )
}

function CardResumoDia({ titulo, valor, cor, pulsando }) {
  return (
    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '14px 10px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
      <div style={{ fontSize: '24px', fontWeight: '800', color: cor, lineHeight: 1 }} className={pulsando ? 'pulse-badge' : ''}>
        {valor}
      </div>
      <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px' }}>{titulo}</div>
    </div>
  )
}

function Legenda({ cor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: cor }} />
      <span style={{ fontSize: '11px', color: '#888' }}>{label}</span>
    </div>
  )
}

function MesExpandidoDetalhe({ mes, ano, aulas, onClose }) {
  const ordenadas = [...aulas].sort((a, b) => a.data_aula.localeCompare(b.data_aula))
  return (
    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #2a2a2a', padding: '14px', marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#F0F2F5' }}>{MESES[mes - 1]} {ano} · {ordenadas.length} aulas</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      {ordenadas.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#555' }}>Nenhuma aula dada nesse mês.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
          {ordenadas.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', padding: '6px 8px', borderRadius: '8px', backgroundColor: '#111' }}>
              <span>{format(new Date(a.data_aula + 'T12:00'), "dd 'de' MMM", { locale: ptBR })}</span>
              <span style={{ color: a.status === 'match' || a.status === 'confirmada_coord' ? '#22c55e' : '#fcc825' }}>
                {a.status === 'match' || a.status === 'confirmada_coord' ? 'Validada' : 'Aguardando match'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalCelula({ celulaAtiva, ehHoje, onClose, onIrParaAulas }) {
  const { turma, horario } = celulaAtiva
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1a1a1a', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '20px', width: '100%', maxWidth: '340px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>{turma.nome}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{turma.niveis?.nome} · {turma.quadras?.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '13px', color: '#F0F2F5', marginBottom: '4px' }}>{horario} — {turma.turmas_alunos?.filter(t => t.ativo).length || 0} aluno(s)</div>
        {turma.ativo === false && <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '6px' }}>Turma removida</div>}
        {ehHoje && turma.ativo !== false && (
          <button onClick={onIrParaAulas} style={{
            width: '100%', marginTop: '14px', padding: '12px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #d28c3c, #cf1b9b)', color: 'white',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
          }}>
            Confirmar presença em Minhas Aulas
          </button>
        )}
      </div>
    </div>
  )
}
