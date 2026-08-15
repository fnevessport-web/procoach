import { useState, Fragment } from 'react'
import { format, endOfMonth } from 'date-fns'
import { CheckCircle2, XCircle, Ban, TriangleAlert } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { useAulas } from '../../hooks/useAulas'
import { useValoresParticular } from '../../hooks/useValoresParticular'
import { SeletorMes } from './FinanceiroParticular'
import { Loading } from '../../components/ui/Loading'

const LABEL_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const LABEL_DIA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const HORAS_GRADE = Array.from({ length: 17 }, (_, i) => 6 + i) // 06h–22h

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Intensidade por opacidade do saibro (tom único, claro→escuro) em vez de reaproveitar
// CORES_SEMAFORO/--color-state-* como o heatmap de ocupação do clube (ModalidadePage.jsx)
// faz — aqui a leitura é "quantidade de aula", não "bom/atenção/crítico", então cor de status
// não se aplica (skill dataviz: cor de status é reservada, nunca reusada pra magnitude).
function corIntensidade(count, max) {
  if (!count) return 'var(--color-surface-dark-overlay)'
  const opacidade = 0.18 + 0.72 * Math.min(count / (max || 1), 1)
  return `rgba(165,76,46,${opacidade.toFixed(2)})`
}

export function RelatoriosParticular() {
  const { empresaSelecionada } = useAppStore()
  const empresaId = empresaSelecionada?.id
  const [dataRef, setDataRef] = useState(new Date())
  const mes = dataRef.getMonth() + 1
  const ano = dataRef.getFullYear()
  const dataInicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd')
  const dataFim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd')

  const { data: aulas = [], isLoading } = useAulas({ empresaId, dataInicio, dataFim })
  const { data: valores } = useValoresParticular({ empresaId, mes, ano })

  if (isLoading) return <Loading />

  const dadas = aulas.filter(a => a.status_aula === 'dada')
  const canceladas = aulas.filter(a => a.status_aula === 'cancelada')
  const semAula = aulas.filter(a => a.status_aula === 'nao_dada')

  const porDiaSemana = Array.from({ length: 7 }, () => 0)
  dadas.forEach(a => { porDiaSemana[new Date(a.data_aula + 'T12:00').getDay()]++ })
  const maxDia = Math.max(...porDiaSemana, 1)

  const contagemSlot = {}
  dadas.forEach(a => {
    const horaStr = (a.turmas?.horario_inicio || a.horario)?.slice(0, 2)
    if (!horaStr) return
    const dia = new Date(a.data_aula + 'T12:00').getDay()
    const chave = `${dia}_${horaStr}`
    contagemSlot[chave] = (contagemSlot[chave] || 0) + 1
  })
  const maxSlot = Math.max(...Object.values(contagemSlot), 1)

  const porAluno = {}
  aulas.forEach(a => {
    ;(a.presencas || []).forEach(p => {
      const nome = p.alunos?.nome
      if (!nome) return
      if (!porAluno[p.aluno_id]) porAluno[p.aluno_id] = { id: p.aluno_id, nome, presente: 0, falta: 0, faltaJustificada: 0, historico: [] }
      const reg = porAluno[p.aluno_id]
      if (p.status_presenca === 'presente') reg.presente++
      else if (p.status_presenca === 'falta_justificada') reg.faltaJustificada++
      else if (p.status_presenca === 'falta') reg.falta++
      reg.historico.push({ data: a.data_aula, status: p.status_presenca })
    })
  })
  const listaAlunos = Object.values(porAluno).map(a => {
    const ordenado = [...a.historico].sort((x, y) => x.data.localeCompare(y.data))
    const ultimas3 = ordenado.slice(-3)
    const risco = ultimas3.length === 3 && ultimas3.every(h => h.status === 'falta' || h.status === 'falta_justificada')
    return { ...a, risco }
  }).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: '0 0 6px' }}>Relatórios</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', margin: '0 0 20px' }}>
        Aulas, valores e frequência da sua prática particular.
      </p>

      <SeletorMes dataRef={dataRef} setDataRef={setDataRef} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', margin: '16px 0' }}>
        <CardStat icone={CheckCircle2} label="Dadas" valor={dadas.length} cor="var(--color-state-success)" />
        <CardStat icone={Ban} label="Canceladas" valor={canceladas.length} cor="var(--color-state-danger)" />
        <CardStat icone={XCircle} label="Sem aula" valor={semAula.length} cor="var(--color-state-warning)" />
        <CardStat label="Valor recebido" valor={fmtBRL(valores?.real)} cor="var(--color-text-dark-primary)" />
      </div>

      <Secao titulo="Dias com mais aulas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {LABEL_DIA.map((nome, i) => (
            <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '76px', flexShrink: 0, fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>{nome}</div>
              <div style={{ flex: 1, height: '16px', borderRadius: '5px', backgroundColor: 'var(--color-surface-dark-overlay)', overflow: 'hidden' }}>
                <div style={{ width: `${(porDiaSemana[i] / maxDia) * 100}%`, height: '100%', backgroundColor: 'var(--color-action-primary)', borderRadius: '5px' }} />
              </div>
              <div style={{ width: '20px', flexShrink: 0, fontSize: '11px', fontWeight: '700', color: 'var(--color-text-dark-primary)', textAlign: 'right' }}>{porDiaSemana[i]}</div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Mapa de calor — aulas dadas por dia e horário">
        <div style={{ overflowX: 'auto' }}>
          <div className="heatmap-grid">
            <div />
            {LABEL_DIA_CURTO.map(d => (
              <div key={d} style={{ fontSize: '8px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', fontWeight: '700' }}>{d}</div>
            ))}
            {HORAS_GRADE.map(hora => (
              <Fragment key={hora}>
                <div style={{ fontSize: '8px', color: 'var(--color-text-dark-secondary)', display: 'flex', alignItems: 'center' }}>
                  {String(hora).padStart(2, '0')}h
                </div>
                {LABEL_DIA_CURTO.map((_, dia) => {
                  const count = contagemSlot[`${dia}_${String(hora).padStart(2, '0')}`] || 0
                  return (
                    <div key={`${dia}-${hora}`} className="heatmap-cell" title={count ? `${count} aula${count === 1 ? '' : 's'}` : 'sem dados'}
                      style={{ backgroundColor: corIntensidade(count, maxSlot) }} />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </Secao>

      <Secao titulo="Frequência por aluno">
        {listaAlunos.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--color-text-dark-muted)', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma presença registrada no período.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {listaAlunos.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                padding: '10px 12px', borderRadius: '10px', backgroundColor: 'var(--color-surface-dark-overlay)',
                border: a.risco ? '1px solid rgba(180,71,47,0.4)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {a.risco && <TriangleAlert size={13} color="var(--color-state-danger)" />}
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-dark-primary)' }}>{a.nome}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
                  <span style={{ color: 'var(--color-state-success)' }}>{a.presente} presente{a.presente === 1 ? '' : 's'}</span>
                  {' · '}
                  <span style={{ color: 'var(--color-state-danger)' }}>{a.falta + a.faltaJustificada} falta{(a.falta + a.faltaJustificada) === 1 ? '' : 's'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '16px',
      border: '1px solid rgba(165,76,46,0.2)', padding: '18px', marginBottom: '14px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '12px' }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function CardStat({ icone: Icone, label, valor, cor }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
      border: '1px solid rgba(165,76,46,0.2)', padding: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '6px' }}>
        {Icone && <Icone size={11} color={cor} />} {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: cor }}>{valor}</div>
    </div>
  )
}
