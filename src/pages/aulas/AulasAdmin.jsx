import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { format, addDays, addMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Calendar, UserPlus, X, ChevronRight, ChevronLeft, Copy, Check, CheckCircle2, Zap, Lightbulb, AlertTriangle, User } from 'lucide-react'
import { useAulas, useGerarAulas, useRelatorioReposicoes } from '../../hooks/useAulas'
import { useTurmas } from '../../hooks/useTurmas'
import { useProfessores } from '../../hooks/useProfessores'
import { useAlunos, useSalvarAluno } from '../../hooks/useAlunos'
import { useQuadras } from '../../hooks/useQuadras'
import { useNiveis } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { AulasCoordenador } from './AulasCoordenador'
import { GradeSemanalReposicao } from '../../components/GradeSemanalReposicao'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { calcReposicaoStatus } from '../../constants/reposicao'

const TIPOS_PARTICIPACAO = [
  { value: 'mensalista', label: 'Mensalista', color: 'var(--color-state-success)' },
  { value: 'avulso', label: 'Avulso', color: 'var(--color-action-primary)' },
  { value: 'cortesia', label: 'Cortesia', color: 'var(--color-state-warning)' },
  { value: 'reposicao', label: 'Reposição', color: 'var(--color-state-info)' },
]

const NIVEIS_ALUNO = [
  'Iniciante 1', 'Iniciante 2',
  'Intermediário 1', 'Intermediário 2',
  'Avançado',
  'Kids Iniciante', 'Kids Intermediário', 'Kids Avançado',
]

const inputInline = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

export function AulasAdmin() {
  const location = useLocation()
  const [tab, setTab] = useState('hoje')
  const [modalGerar, setModalGerar] = useState(null)
  const [atalho, setAtalho] = useState(null)
  const { data: _relatorioAtual } = useRelatorioReposicoes()
  const totalReposicoes = (_relatorioAtual || []).filter(a => a.pendentes.length > 0).length

  // Escolher uma aula na grade de reposição (ModalReposicao, aba "↩ Reposição") navega pra cá
  // com esse mesmo state — precisa trocar pra aba "Por Dia" pra AulasCoordenador (que só monta
  // nessa aba) conseguir abrir a aula de verdade. Ajusta durante o render (não num efeito) —
  // é exatamente o padrão que o React recomenda pra "sincronizar estado quando algo externo
  // muda": https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [locationStateVisto, setLocationStateVisto] = useState(location.state)
  if (location.state !== locationStateVisto) {
    setLocationStateVisto(location.state)
    if (location.state?.abrirAoDestacar) setTab('hoje')
  }

  function handleCelulaVazia({ horario, quadraNome, data }) {
    setAtalho({ horario, quadraNome, data })
    setModalGerar('menu_atalho')
  }

  function fecharTudo() {
    setModalGerar(null)
    setAtalho(null)
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: 0 }}>
          Gestão de Aulas
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setModalGerar('copiar')} title="Copiar Grade" style={{
            padding: '8px', borderRadius: '10px', border: 'none',
            background: 'none', color: 'var(--color-text-light-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Copy size={18} />
          </button>
          <button onClick={() => setModalGerar('menu')} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>
            <Calendar size={14} /> Gerar Aulas
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '3px', marginBottom: '20px',
        padding: '4px', backgroundColor: 'var(--color-surface-light-raised)',
        border: '1px solid rgba(30,43,36,0.06)', borderRadius: '12px',
      }}>
        {[
          { key: 'hoje', label: 'Por Dia' },
          { key: 'reposicoes', label: '↩ Reposição', count: totalReposicoes },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '7px 4px', borderRadius: '8px', border: 'none',
            fontSize: '12px', fontWeight: '500', cursor: 'pointer',
            background: tab === t.key ? 'var(--color-action-primary)' : 'transparent',
            color: tab === t.key ? 'white' : 'var(--color-text-light-secondary)', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                minWidth: '16px', height: '16px', borderRadius: '8px', fontSize: '10px', fontWeight: '700',
                backgroundColor: tab === t.key ? 'rgba(30,43,36,0.3)' : 'rgba(61,107,122,0.25)',
                color: tab === t.key ? 'white' : 'var(--color-state-info)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'hoje'
        ? <AulasCoordenador onCelulaVazia={handleCelulaVazia} />
        : <AulasReposicoes />
      }

      {/* Menu normal */}
      <Modal open={modalGerar === 'menu'} onClose={() => setModalGerar(null)} title="Gerar Aulas" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => setModalGerar('avulsa')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: 'var(--color-surface-light-overlay)', outline: '1px solid var(--color-border-light)',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}><Zap size={13} /> Aula Avulsa</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Uma única aula — sem data de término</div>
            </div>
            <ChevronRight size={16} color="var(--color-text-light-secondary)" />
          </button>
          <button onClick={() => setModalGerar('mensal')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: 'var(--color-surface-light-overlay)', outline: '1px solid var(--color-border-light)',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}><Calendar size={13} /> Aula Mensal / Recorrente</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Gera aulas de uma turma por período</div>
            </div>
            <ChevronRight size={16} color="var(--color-text-light-secondary)" />
          </button>
        </div>
      </Modal>

      {/* Menu atalho */}
      <Modal open={modalGerar === 'menu_atalho'} onClose={fecharTudo} title="Nova Aula" size="sm">
        <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', border: '1px solid rgba(165,76,46,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-action-primary)', marginBottom: '4px' }}><Zap size={10} /> Atalho selecionado</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', fontWeight: '600' }}>
            {atalho?.quadraNome} · {atalho?.horario}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
            {atalho?.data && format(new Date(atalho.data + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => setModalGerar('avulsa_atalho')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: 'var(--color-surface-light-overlay)', outline: '1px solid var(--color-border-light)',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}><Zap size={13} /> Aula Avulsa</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Quadra e horário já preenchidos</div>
            </div>
            <ChevronRight size={16} color="var(--color-text-light-secondary)" />
          </button>
          <button onClick={() => setModalGerar('mensal')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: 'var(--color-surface-light-overlay)', outline: '1px solid var(--color-border-light)',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}><Calendar size={13} /> Aula Mensal / Recorrente</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Gera aulas de uma turma por período</div>
            </div>
            <ChevronRight size={16} color="var(--color-text-light-secondary)" />
          </button>
        </div>
      </Modal>

      <ModalCopiarGrade open={modalGerar === 'copiar'} onClose={fecharTudo} />
      <ModalGerarAulas open={modalGerar === 'mensal'} onClose={fecharTudo} />
      <ModalAulaAvulsa
        open={modalGerar === 'avulsa' || modalGerar === 'avulsa_atalho'}
        onClose={fecharTudo}
        atalho={modalGerar === 'avulsa_atalho' ? atalho : null}
      />
    </div>
  )
}

function ModalCopiarGrade({ open, onClose }) {
  const qc = useQueryClient()
  const [dataOrigem, setDataOrigem] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataDestino, setDataDestino] = useState('')
  const [copiando, setCopiando] = useState(false)
  const [resultado, setResultado] = useState(null)

  function resetar() {
    setDataOrigem(format(new Date(), 'yyyy-MM-dd'))
    setDataDestino('')
    setResultado(null)
  }

  async function handleCopiar() {
    if (!dataDestino) return toast.error('Selecione o dia de destino', { style: toastStyle })
    if (dataOrigem === dataDestino) return toast.error('Origem e destino não podem ser iguais', { style: toastStyle })
    setCopiando(true)
    try {
      // Busca aulas avulsas do dia origem
      const { data: aulasOrigem, error: errBusca } = await supabase
        .from('aulas')
        .select('*')
        .eq('data_aula', dataOrigem)
        .not('observacoes', 'is', null)
        .ilike('observacoes', '⚡ Avulsa%')

      if (errBusca) throw errBusca
      if (!aulasOrigem || aulasOrigem.length === 0) {
        toast.error('Nenhuma aula avulsa encontrada no dia de origem', { style: toastStyle })
        setCopiando(false)
        return
      }

      // Verifica quais já existem no destino (por observacoes com mesma quadra+horario)
      const { data: aulasDestino } = await supabase
        .from('aulas')
        .select('observacoes')
        .eq('data_aula', dataDestino)

      const obsDestino = aulasDestino?.map(a => a.observacoes) || []

      // Filtra aulas que ainda não existem no destino
      const aulasParaCopiar = aulasOrigem.filter(a => {
        // Extrai quadra+horário da observação
        const partes = (a.observacoes || '').split('·').map(s => s.trim())
        const quadra = partes[1] || ''
        const horario = partes[2] || ''
        // Verifica se já existe no destino
        return !obsDestino.some(obs => obs?.includes(quadra) && obs?.includes(horario))
      })

      if (aulasParaCopiar.length === 0) {
        toast.error('Todas as aulas já existem no dia de destino', { style: toastStyle })
        setCopiando(false)
        return
      }

      // Busca as presenças das aulas de origem (apenas alunos, sem status)
      const idsOrigem = aulasParaCopiar.map(a => a.id)
      const { data: presencasOrigem } = await supabase
        .from('presencas')
        .select('aula_id, aluno_id, tipo_participacao')
        .in('aula_id', idsOrigem)

      // Cria as aulas no destino
      const novasAulas = aulasParaCopiar.map(a => ({
        professor_executou_id: a.professor_executou_id,
        data_aula: dataDestino,
        status: 'confirmada_coord',
        status_aula: 'dada',
        paga_professor: true,
        eh_substituicao: false,
        observacoes: a.observacoes,
      }))

      const { data: aulasCriadas, error: errInsert } = await supabase
        .from('aulas')
        .insert(novasAulas)
        .select('id, observacoes')
      if (errInsert) throw errInsert

      // Copia as presenças (sem marcar presente/falta — status neutro)
      if (presencasOrigem && presencasOrigem.length > 0 && aulasCriadas) {
        const presencasNovas = []
        for (const aulaOrigemId of idsOrigem) {
          // Acha a aula origem e a aula nova correspondente pela observação
          const aulaOrig = aulasParaCopiar.find(a => a.id === aulaOrigemId)
          const aulaNova = aulasCriadas.find(a => a.observacoes === aulaOrig?.observacoes)
          if (!aulaNova) continue
          const presencasDaAula = presencasOrigem.filter(p => p.aula_id === aulaOrigemId)
          for (const p of presencasDaAula) {
            presencasNovas.push({
              aula_id: aulaNova.id,
              aluno_id: p.aluno_id,
              presente: false,
              status_presenca: 'falta',
              tipo_participacao: p.tipo_participacao || 'mensalista',
            })
          }
        }
        if (presencasNovas.length > 0) {
          await supabase.from('presencas').insert(presencasNovas)
        }
      }

      qc.invalidateQueries({ queryKey: ['aulas'] })
      setResultado(aulasParaCopiar.length)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setCopiando(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { resetar(); onClose() }} title={<><Copy size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Copiar Grade</>} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={40} color="var(--color-state-success)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '6px' }}>{resultado} aulas copiadas!</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
              Grade de {format(new Date(dataOrigem + 'T12:00'), "dd/MM", { locale: ptBR })} → {format(new Date(dataDestino + 'T12:00'), "dd/MM", { locale: ptBR })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '8px' }}>
              As aulas foram criadas sem presenças. Adicione os alunos clicando em cada aula.
            </div>
            <button onClick={() => { resetar(); onClose() }} style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>Fechar</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', border: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
              <Lightbulb size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              Copia a estrutura das aulas avulsas (quadra, horário, professor, nível) sem as presenças.
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Dia de origem (copiar DE)</div>
              <input type="date" value={dataOrigem} onChange={e => setDataOrigem(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-light-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }} />
              {dataOrigem && (
                <div style={{ fontSize: '11px', color: 'var(--color-action-primary)', marginTop: '4px', textTransform: 'capitalize' }}>
                  {format(new Date(dataOrigem + 'T12:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', color: 'var(--color-text-light-muted)' }}>↓</span>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Dia de destino (colar EM)</div>
              <input type="date" value={dataDestino} onChange={e => setDataDestino(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid rgba(165,76,46,0.3)',
                color: 'var(--color-text-light-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }} />
              {dataDestino && (
                <div style={{ fontSize: '11px', color: 'var(--color-action-primary)', marginTop: '4px', textTransform: 'capitalize' }}>
                  {format(new Date(dataDestino + 'T12:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </div>
              )}
            </div>

            <button onClick={handleCopiar} disabled={copiando || !dataDestino} style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: !dataDestino ? 'var(--color-surface-light-raised)' : 'var(--color-action-primary)',
              color: !dataDestino ? 'var(--color-text-light-secondary)' : 'white',
              fontSize: '14px', fontWeight: '600',
              cursor: !dataDestino || copiando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              outline: !dataDestino ? '1px solid var(--color-border-light)' : 'none',
            }}>
              <Copy size={16} />
              {copiando ? 'Copiando...' : 'Copiar Grade'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}


function fmtData(d) {
  return d ? format(new Date(d + 'T12:00'), "dd/MM/yyyy", { locale: ptBR }) : '—'
}

const SORT_OPTS = [
  { value: 'urgencia', label: 'Mais urgente' },
  { value: 'quantidade', label: 'Mais faltas' },
  { value: 'alfabetico', label: 'Alfabético' },
]

const TIPO_AULA_OPTS = [
  { value: 'individual', label: 'Individual' },
  { value: 'grupo', label: 'Grupo' },
]

const NIVEL_OPTS = NIVEIS_ALUNO.map(n => ({ value: n, label: n }))

function urgenciaMenor(pendentes) {
  if (!pendentes.length) return 999
  return pendentes.reduce((min, f) => {
    const d = calcReposicaoStatus(f.dataAula).diasRestantes
    return d < min ? d : min
  }, Infinity)
}

const LIMITE_LISTA = 20

// Dropdown de filtro genérico — reusado pra Modalidade, Tipo, Nível e Ordenar.
function FiltroDropdown({ label, valor, opcoes, onChange, aberto, onToggle, permiteTodas = true }) {
  const labelAtual = opcoes.find(o => o.value === valor)?.label || label
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
        padding: '8px 12px', borderRadius: '8px', border: 'none',
        backgroundColor: valor ? 'rgba(165,76,46,0.08)' : 'var(--color-surface-light-raised)',
        outline: `1px solid ${valor ? 'rgba(165,76,46,0.3)' : 'var(--color-border-light)'}`,
        color: valor ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
      }}>
        <span>{labelAtual}</span>
        <span style={{ fontSize: '8px', opacity: 0.6 }}>▾</span>
      </button>
      {aberto && (
        <>
          <div onClick={onToggle} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 20,
            backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', borderRadius: '10px',
            padding: '6px', minWidth: '160px', maxHeight: '260px', overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {permiteTodas && (
              <button onClick={() => onChange(null)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '8px 10px', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                backgroundColor: !valor ? 'rgba(165,76,46,0.08)' : 'transparent',
                color: !valor ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
              }}>
                Todas {!valor && '✓'}
              </button>
            )}
            {opcoes.map(op => (
              <button key={op.value} onClick={() => onChange(op.value)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '8px 10px', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                backgroundColor: valor === op.value ? 'rgba(165,76,46,0.08)' : 'transparent',
                color: valor === op.value ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
              }}>
                {op.label} {valor === op.value && '✓'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AulasReposicoes() {
  const [busca, setBusca] = useState('')
  const [modFilter, setModFilter] = useState(null)
  const [tipoFilter, setTipoFilter] = useState(null)
  const [nivelFilter, setNivelFilter] = useState(null)
  const [sortBy, setSortBy] = useState('urgencia')
  const [menuAberto, setMenuAberto] = useState(null) // 'mod' | 'tipo' | 'nivel' | 'sort' | null
  const [viewTab, setViewTab] = useState('pendentes') // 'pendentes' | 'repostas'
  const [verTodos, setVerTodos] = useState(false)
  const [alunoSel, setAlunoSel] = useState(null)

  const { data: relatorio, isLoading } = useRelatorioReposicoes()

  const modalidades = [...new Map(
    (relatorio || []).filter(a => a.modalidade).map(a => [a.modalidade.nome, a.modalidade])
  ).values()]

  const totalAPor = (relatorio || []).reduce((s, a) => s + a.pendentes.length, 0)
  const totalAlunosRepostos = (relatorio || []).filter(a => a.repostas.length > 0).length

  let filtrada = (relatorio || []).filter(a => {
    if (modFilter && a.modalidade?.nome !== modFilter) return false
    if (tipoFilter && !a.tiposAula?.includes(tipoFilter)) return false
    if (nivelFilter && a.nivel !== nivelFilter) return false
    if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  filtrada = viewTab === 'repostas'
    ? filtrada.filter(a => a.repostas.length > 0)
    : filtrada

  if (sortBy === 'urgencia') {
    filtrada = [...filtrada].sort((a, b) => urgenciaMenor(a.pendentes) - urgenciaMenor(b.pendentes))
  } else if (sortBy === 'quantidade') {
    filtrada = [...filtrada].sort((a, b) => b.pendentes.length - a.pendentes.length)
  } else if (sortBy === 'alfabetico') {
    filtrada = [...filtrada].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  }

  const capativa = !busca && !verTodos && filtrada.length > LIMITE_LISTA
  const lista = capativa ? filtrada.slice(0, LIMITE_LISTA) : filtrada

  function toggleMenu(nome) {
    setMenuAberto(m => m === nome ? null : nome)
  }

  return (
    <div>
      {/* Resumo geral */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <div style={{ backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '4px' }}>Aulas p/ repor</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--color-state-info)' }}>{totalAPor}</div>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '4px' }}>Alunos repostos</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--color-state-success)' }}>{totalAlunosRepostos}</div>
        </div>
      </div>

      {/* Sub-tabs: Pendentes / Repostas */}
      <div style={{
        display: 'flex', gap: '3px', marginBottom: '12px',
        padding: '4px', backgroundColor: 'var(--color-surface-light-raised)',
        border: '1px solid rgba(30,43,36,0.06)', borderRadius: '10px',
      }}>
        {[
          { key: 'pendentes', label: 'Pendentes' },
          { key: 'repostas', label: '✓ Aulas Repostas' },
        ].map(t => (
          <button key={t.key} onClick={() => setViewTab(t.key)} style={{
            flex: 1, padding: '7px 4px', borderRadius: '7px', border: 'none',
            fontSize: '12px', fontWeight: '500', cursor: 'pointer',
            background: viewTab === t.key ? 'var(--color-action-primary)' : 'transparent',
            color: viewTab === t.key ? 'white' : 'var(--color-text-light-secondary)', transition: 'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="Buscar aluno..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{
            width: '100%', padding: '9px 14px', borderRadius: '8px', border: 'none',
            outline: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)',
            color: 'var(--color-text-light-primary)', fontSize: '13px', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filtros: modalidade + tipo + nível + ordenação */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
        <FiltroDropdown label="Modalidade" valor={modFilter}
          opcoes={modalidades.map(m => ({ value: m.nome, label: m.nome }))}
          onChange={v => { setModFilter(v); setMenuAberto(null) }}
          aberto={menuAberto === 'mod'} onToggle={() => toggleMenu('mod')} />
        <FiltroDropdown label="Tipo" valor={tipoFilter} opcoes={TIPO_AULA_OPTS}
          onChange={v => { setTipoFilter(v); setMenuAberto(null) }}
          aberto={menuAberto === 'tipo'} onToggle={() => toggleMenu('tipo')} />
        <FiltroDropdown label="Nível" valor={nivelFilter} opcoes={NIVEL_OPTS}
          onChange={v => { setNivelFilter(v); setMenuAberto(null) }}
          aberto={menuAberto === 'nivel'} onToggle={() => toggleMenu('nivel')} />
        <FiltroDropdown label="Ordenar" valor={sortBy} opcoes={SORT_OPTS} permiteTodas={false}
          onChange={v => { setSortBy(v); setMenuAberto(null) }}
          aberto={menuAberto === 'sort'} onToggle={() => toggleMenu('sort')} />
      </div>

      {isLoading ? <Loading /> : filtrada.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={40} />}
          title={viewTab === 'repostas' ? 'Nenhuma reposição feita ainda' : 'Nenhuma falta justificada'}
          description={viewTab === 'repostas' ? 'Ninguém repôs aula com esses filtros' : 'Nenhuma reposição pendente'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lista.map(aluno => {
            const cor = aluno.modalidade?.cor_hex || 'var(--color-text-light-secondary)'
            const statusUrgente = aluno.pendentes.length > 0
              ? calcReposicaoStatus(aluno.pendentes.reduce((w, f) => {
                  const sw = calcReposicaoStatus(w.dataAula), sf = calcReposicaoStatus(f.dataAula)
                  return sf.diasRestantes < sw.diasRestantes ? f : w
                }).dataAula)
              : null
            return (
              <button key={aluno.id} onClick={() => setAlunoSel(aluno)} style={{
                display: 'flex', flexDirection: 'column',
                backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', borderRadius: '12px',
                padding: '12px 14px', cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Chip modalidade — só texto, sem emoji */}
                  {aluno.modalidade && (
                    <div style={{
                      flexShrink: 0, borderRadius: '6px', padding: '4px 8px',
                      backgroundColor: `${cor}18`, border: `1px solid ${cor}44`,
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: cor, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                        {aluno.modalidade.nome}
                      </div>
                    </div>
                  )}
                  {/* Badge contagem */}
                  <div style={{
                    minWidth: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: viewTab === 'repostas' ? 'rgba(75,139,106,0.15)' : aluno.pendentes.length > 0 ? 'rgba(61,107,122,0.15)' : 'rgba(75,139,106,0.1)',
                    border: `1px solid ${viewTab === 'repostas' ? 'rgba(75,139,106,0.35)' : aluno.pendentes.length > 0 ? 'rgba(61,107,122,0.35)' : 'rgba(75,139,106,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: '700', color: viewTab === 'repostas' ? 'var(--color-state-success)' : aluno.pendentes.length > 0 ? 'var(--color-state-info)' : 'var(--color-state-success)',
                  }}>
                    {viewTab === 'repostas' ? aluno.repostas.length : (aluno.pendentes.length > 0 ? aluno.pendentes.length : '✓')}
                  </div>
                  {/* Nome + nível */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{aluno.nome}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)', marginTop: '2px' }}>
                      {aluno.nivel || '-'}
                      {viewTab === 'pendentes' && aluno.agendadas.length > 0 && <span style={{ color: 'var(--color-state-success)', marginLeft: '8px' }}>✓ {aluno.agendadas.length} agendada{aluno.agendadas.length !== 1 ? 's' : ''}</span>}
                      {viewTab === 'repostas' && aluno.pendentes.length > 0 && <span style={{ color: 'var(--color-state-info)', marginLeft: '8px' }}>{aluno.pendentes.length} ainda pendente{aluno.pendentes.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </div>

                {/* Barra de prazo mais urgente */}
                {viewTab === 'pendentes' && statusUrgente && aluno.pendentes.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border-light-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-light-muted)' }}>Prazo mais urgente</span>
                      <span style={{ color: statusUrgente.cor, fontWeight: '600' }}>{statusUrgente.label}</span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: 'var(--color-border-light-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${statusUrgente.progresso}%`, height: '100%', backgroundColor: statusUrgente.cor, borderRadius: '2px' }} />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
          {capativa && (
            <button onClick={() => setVerTodos(true)} style={{
              padding: '10px', borderRadius: '10px', border: '1px dashed var(--color-border-light)', background: 'none',
              color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer',
            }}>
              + {filtrada.length - LIMITE_LISTA} aluno{filtrada.length - LIMITE_LISTA !== 1 ? 's' : ''} — buscar pelo nome ou ver todos
            </button>
          )}
        </div>
      )}

      {alunoSel && <ModalReposicao aluno={alunoSel} onClose={() => setAlunoSel(null)} />}
    </div>
  )
}

// Card de uma falta pendente, com a barrinha de prazo (60 dias). Clicável só quando `destaque`
// (a mais antiga, "próxima a baixar") — é a única que o FIFO de fato vai resolver se o gestor
// agendar uma reposição agora, então é a única que faz sentido levar direto pra grade.
function CardFaltaPendente({ item, destaque, onClick }) {
  const status = calcReposicaoStatus(item.dataAula)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} style={{
      padding: '12px 14px', borderRadius: '12px', width: '100%', textAlign: 'left',
      backgroundColor: 'var(--color-surface-light-overlay)', outline: destaque ? `1px solid ${status.cor}66` : '1px solid var(--color-border-light)',
      border: 'none', cursor: onClick ? 'pointer' : 'default', display: 'block',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', fontWeight: '600' }}>
          {item.dataAula ? format(new Date(item.dataAula + 'T12:00'), "dd/MM/yyyy · EEEE", { locale: ptBR }) : 'Data desconhecida'}
        </div>
        {destaque && (
          <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--color-action-primary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            próxima a baixar {onClick && '· toque pra agendar'}
          </span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>{item.turmaNome || 'Individual'}</div>
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
          <span style={{ color: 'var(--color-text-light-muted)' }}>Prazo: {item.dataAula ? format(new Date(new Date(item.dataAula + 'T12:00').getTime() + 60 * 24 * 60 * 60 * 1000), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
          <span style={{ color: status.cor, fontWeight: '600' }}>{status.label}</span>
        </div>
        <div style={{ height: '3px', backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${status.progresso}%`, height: '100%', backgroundColor: status.cor, borderRadius: '2px' }} />
        </div>
      </div>
    </Tag>
  )
}

// Card de um par falta → reposição (agendada no futuro, ou já reposta)
function CardReposicaoPar({ item, concluida }) {
  const destino = item.reposicao?.aula_reposicao
  return (
    <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-overlay)', outline: '1px solid var(--color-border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Faltou</div>
          <div style={{ color: 'var(--color-text-light-primary)', fontWeight: '600', marginTop: '2px' }}>{fmtData(item.dataAula)}</div>
          <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '11px', marginTop: '1px' }}>{item.turmaNome || 'Individual'}</div>
        </div>
        <span style={{ color: concluida ? 'var(--color-state-success)' : 'var(--color-state-info)', fontSize: '16px', flexShrink: 0 }}>→</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', color: concluida ? 'var(--color-state-success)' : 'var(--color-state-info)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {concluida ? 'Repôs em' : 'Vai repor em'}
          </div>
          <div style={{ color: 'var(--color-text-light-primary)', fontWeight: '600', marginTop: '2px' }}>{fmtData(destino?.data_aula)}</div>
          <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '11px', marginTop: '1px' }}>{destino?.turmas?.nome || destino?.turmas?.quadras?.nome || '—'}</div>
        </div>
      </div>
    </div>
  )
}

function ModalReposicao({ aluno, onClose }) {
  const [mostrarGrade, setMostrarGrade] = useState(false)

  const pendentesOrdenadas = [...aluno.pendentes].sort((a, b) => (a.dataAula || '').localeCompare(b.dataAula || ''))
  const proximaFalta = pendentesOrdenadas[0] || null

  if (mostrarGrade) {
    return (
      <GradeSemanalReposicao
        aluno={{ id: aluno.id, nome: aluno.nome }}
        modalidadeId={aluno.modalidade?.id}
        proximaFalta={proximaFalta}
        onVoltar={() => setMostrarGrade(false)}
        onFecharTudo={onClose}
      />
    )
  }

  /* ── Vista principal: histórico completo do aluno ────────────── */
  return (
    <Modal open onClose={onClose} title={aluno.nome} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
            {aluno.pendentes.length} p/ repor · {aluno.agendadas.length} agendada{aluno.agendadas.length !== 1 ? 's' : ''} · {aluno.repostas.length} reposta{aluno.repostas.length !== 1 ? 's' : ''}
            {aluno.modalidade ? ` · ${aluno.modalidade.nome}` : ''}
          </div>

          {aluno.pendentes.length === 0 && aluno.agendadas.length === 0 && aluno.repostas.length === 0 && (
            <EmptyState icon={<CheckCircle2 size={40} />} title="Nada por aqui" description="Sem faltas registradas" />
          )}

          {aluno.pendentes.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-state-info)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Pendentes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendentesOrdenadas.map(item => (
                  <CardFaltaPendente key={item.aulaId} item={item} destaque={item === proximaFalta}
                    onClick={item === proximaFalta ? () => setMostrarGrade(true) : undefined} />
                ))}
              </div>
            </div>
          )}

          {aluno.agendadas.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-state-info)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Agendadas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aluno.agendadas.map(item => <CardReposicaoPar key={item.aulaId} item={item} />)}
              </div>
            </div>
          )}

          {aluno.repostas.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-state-success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Repostas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aluno.repostas.map(item => <CardReposicaoPar key={item.aulaId} item={item} concluida />)}
              </div>
            </div>
          )}

          {aluno.pendentes.length > 0 && (
            <button onClick={() => setMostrarGrade(true)} style={{
              width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>
              + Agendar reposição — baixa {fmtData(proximaFalta?.dataAula)}
            </button>
          )}
        </div>
      </Modal>
    )
}

function ModalGerarAulas({ open, onClose }) {
  const { data: turmas } = useTurmas()
  const gerar = useGerarAulas()
  const [form, setForm] = useState({
    turma_id: '', professor_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })
  const [resultado, setResultado] = useState(null)
  const turmaSelecionada = turmas?.find(t => t.id === form.turma_id)
  const { professores } = useProfessores(turmaSelecionada?.modalidade_id)

  function handleTurmaChange(turma_id) {
    const turma = turmas?.find(t => t.id === turma_id)
    setForm(f => ({ ...f, turma_id, professor_id: turma?.professor_titular_id || '' }))
  }

  async function handleGerar() {
    try {
      const n = await gerar.mutateAsync({
        turmaId: form.turma_id, dataInicio: form.data_inicio,
        dataFim: form.data_fim, professorOverrideId: form.professor_id || null,
      })
      setResultado(n)
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={open} onClose={onClose} title={<><Calendar size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Aula Mensal / Recorrente</>} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={40} color="var(--color-state-success)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: '600', color: 'var(--color-text-light-primary)' }}>{resultado} aulas geradas!</div>
            <button onClick={() => { onClose(); setResultado(null) }} style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>Fechar</button>
          </div>
        ) : (
          <>
            <Select label="Turma" value={form.turma_id} onChange={e => handleTurmaChange(e.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
            <Select label="Professor (opcional — substitui o titular)" value={form.professor_id}
              onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
              <option value="">Professor titular da turma</option>
              {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            <Input label="Data Início" type="date" value={form.data_inicio}
              onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            <Input label="Data Fim" type="date" value={form.data_fim}
              onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            <button onClick={handleGerar} disabled={gerar.isPending || !form.turma_id} style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '14px', fontWeight: '600',
              cursor: !form.turma_id ? 'not-allowed' : 'pointer',
              opacity: !form.turma_id ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <Calendar size={16} />
              {gerar.isPending ? 'Gerando...' : 'Gerar Aulas'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function ModalAulaAvulsa({ open, onClose, atalho }) {
  const qc = useQueryClient()
  const { data: modalidades } = useModalidades()
  const { data: todosAlunos, refetch: refetchAlunos } = useAlunos()
  const salvarAluno = useSalvarAluno()
  const { data: todasQuadras } = useQuadras(null)

  const [modalidadeId, setModalidadeId] = useState('')
  const { professores } = useProfessores(modalidadeId || null)
  const { data: quadras } = useQuadras(modalidadeId || null)
  const { data: niveis } = useNiveis(null)

  const quadraIdAtalho = atalho?.quadraNome
    ? todasQuadras?.find(q => q.nome === atalho.quadraNome)?.id || ''
    : ''

  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '',
  })

  useState(() => {
    if (atalho) {
      setForm(f => ({
        ...f,
        data: atalho.data || format(new Date(), 'yyyy-MM-dd'),
        horario: atalho.horario || '07:00',
        quadra_id: quadraIdAtalho,
      }))
    }
  })

  const [alunos, setAlunos] = useState([])
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'replicar'
  const [aulaOrigem, setAulaOrigem] = useState(null)
  const [datasSelecionadas, setDatasSelecionadas] = useState(new Set())
  const [mesCalendario, setMesCalendario] = useState(new Date())
  const [replicando, setReplicando] = useState(false)
  const [novoAluno, setNovoAluno] = useState({
    show: false, nome: '', telefone: '', nivel: '',
    menor_idade: false, nome_responsavel: '', modalidades_ids: [],
  })

  const horarios = Array.from({ length: 18 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  const alunosFiltrados = buscaAluno.length >= 1
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      )
    : []

  const sugestoesNome = novoAluno.nome.length >= 2
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(novoAluno.nome.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      ) || []
    : []

  function adicionarAluno(aluno, tipo = 'avulso') {
    setAlunos(prev => [...prev, { aluno_id: aluno.id, nome: aluno.nome, tipo }])
    setBuscaAluno('')
  }

  function removerAluno(alunoId) {
    setAlunos(prev => prev.filter(a => a.aluno_id !== alunoId))
  }

  function updateTipoAluno(alunoId, tipo) {
    setAlunos(prev => prev.map(a => a.aluno_id === alunoId ? { ...a, tipo } : a))
  }

  function toggleModalidadeNovoAluno(id) {
    setNovoAluno(n => ({
      ...n,
      modalidades_ids: n.modalidades_ids.includes(id)
        ? n.modalidades_ids.filter(m => m !== id)
        : [...n.modalidades_ids, id]
    }))
  }

  function resetNovoAluno() {
    setNovoAluno({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '', modalidades_ids: [] })
  }

  function resetTudo() {
    setAlunos([])
    setModalidadeId('')
    setBuscaAluno('')
    setForm({ data: format(new Date(), 'yyyy-MM-dd'), horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '' })
    resetNovoAluno()
    setStep('form')
    setAulaOrigem(null)
    setDatasSelecionadas(new Set())
  }

  function resetForm() {
    setAlunos([])
    setModalidadeId('')
    setBuscaAluno('')
    setForm({ data: format(new Date(), 'yyyy-MM-dd'), horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '' })
    resetNovoAluno()
  }

  const quadraIdResolvida = atalho?.quadraNome
    ? todasQuadras?.find(q => q.nome === atalho.quadraNome)?.id || ''
    : ''

  if (open && atalho && (form.horario !== atalho.horario || form.data !== atalho.data)) {
    setForm(f => ({
      ...f,
      data: atalho.data || f.data,
      horario: atalho.horario || f.horario,
      quadra_id: quadraIdResolvida || f.quadra_id,
    }))
  }

  async function handleCadastrarAluno() {
    if (!novoAluno.nome.trim()) return toast.error('Nome obrigatório')
    if (novoAluno.menor_idade && !novoAluno.nome_responsavel.trim()) return toast.error('Nome do responsável obrigatório')
    try {
      const result = await salvarAluno.mutateAsync({
        nome: novoAluno.nome, telefone: novoAluno.telefone,
        nivel: novoAluno.nivel || null, menor_idade: novoAluno.menor_idade,
        nome_responsavel: novoAluno.menor_idade ? novoAluno.nome_responsavel : null,
        modalidade_id: novoAluno.modalidades_ids[0] || modalidadeId || null, ativo: true,
      })
      if (result?.id && novoAluno.modalidades_ids.length > 0) {
        await supabase.from('alunos_modalidades').insert(
          novoAluno.modalidades_ids.map(mid => ({ aluno_id: result.id, modalidade_id: mid }))
        )
      }
      await refetchAlunos()
      adicionarAluno({ id: result.id, nome: result.nome }, 'avulso')
      resetNovoAluno()
      toast.success('Aluno cadastrado e adicionado!')
    } catch (err) { toast.error(err.message) }
  }

  async function handleReplicar() {
    if (datasSelecionadas.size === 0) return
    setReplicando(true)
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const datas = Array.from(datasSelecionadas).sort()
    let criadas = 0
    let puladas = 0
    for (const dataStr of datas) {
      const { data: existentes } = await supabase
        .from('aulas').select('id').eq('data_aula', dataStr)
        .ilike('observacoes', `%${aulaOrigem.quadraNome}%`)
        .ilike('observacoes', `%${aulaOrigem.horario}%`)
      if (existentes?.length > 0) { puladas++; continue }
      const { data: novaAula, error } = await supabase.from('aulas').insert({
        professor_executou_id: aulaOrigem.professor_id,
        data_aula: dataStr, status: 'confirmada_coord', status_aula: 'dada',
        paga_professor: dataStr < hoje, eh_substituicao: false,
        observacoes: aulaOrigem.observacoes,
      }).select().single()
      if (error || !novaAula) { puladas++; continue }
      if (aulaOrigem.alunos.length > 0) {
        await supabase.from('presencas').insert(
          aulaOrigem.alunos.map(al => ({
            aula_id: novaAula.id, aluno_id: al.aluno_id,
            presente: true, status_presenca: 'presente', tipo_participacao: al.tipo,
          }))
        )
      }
      criadas++
    }
    qc.invalidateQueries({ queryKey: ['aulas'] })
    const msg = puladas > 0
      ? `${criadas} aula(s) replicada(s)${puladas > 0 ? `, ${puladas} ignorada(s) por conflito` : ''}`
      : `Aula replicada em ${criadas} dia(s)!`
    toast.success(msg)
    resetTudo()
    onClose()
    setReplicando(false)
  }

  async function handleSalvar() {
    if (!form.professor_id) return toast.error('Selecione um professor')
    if (!form.quadra_id) return toast.error('Selecione uma quadra')
    if (!form.data) return toast.error('Selecione uma data')
    setSalvando(true)
    try {
      const quadraNome = quadras?.find(q => q.id === form.quadra_id)?.nome
        || todasQuadras?.find(q => q.id === form.quadra_id)?.nome || ''

      // Checa conflito nas aulas do dia — turma-linked não tem `observacoes` preenchido (só
      // avulsa usa esse texto pra descrever quadra/horário), então checar só por `ilike` em
      // observacoes nunca detecta um horário já ocupado por uma turma normal (falso negativo:
      // deixava criar avulsa em cima de turma existente) nem é confiável pra achar conflito de
      // verdade (falso positivo: texto de outra aula avulsa em quadra/horário parecido também
      // batia). Olha os dois casos: turma (via quadra_id/horario_inicio) e avulsa (via texto).
      const { data: aulasDoDia } = await supabase
        .from('aulas')
        .select('id, observacoes, turmas(quadra_id, horario_inicio)')
        .eq('data_aula', form.data)
        .neq('status_aula', 'cancelada')

      const temConflito = (aulasDoDia || []).some(a => a.turmas
        ? a.turmas.quadra_id === form.quadra_id && a.turmas.horario_inicio?.slice(0, 5) === form.horario
        : a.observacoes?.includes(quadraNome) && a.observacoes?.includes(form.horario)
      )

      if (temConflito) {
        toast.error(`Já existe uma aula em ${quadraNome} às ${form.horario} neste dia!`)
        setSalvando(false)
        return
      }

      const nivelNome = niveis?.find(n => n.id === form.nivel_id)?.nome || ''

      const { data: aulaData, error: aulaError } = await supabase.from('aulas').insert({
        professor_executou_id: form.professor_id,
        data_aula: form.data, status: 'confirmada_coord', status_aula: 'dada',
        paga_professor: form.data < format(new Date(), 'yyyy-MM-dd'), eh_substituicao: false,
        observacoes: `⚡ Avulsa · ${quadraNome} · ${form.horario}${nivelNome ? ' · ' + nivelNome : ''}`,
      }).select().single()
      if (aulaError) throw aulaError

      if (alunos.length > 0) {
        await supabase.from('presencas').insert(
          alunos.map(al => ({
            aula_id: aulaData.id, aluno_id: al.aluno_id,
            presente: true, status_presenca: 'presente', tipo_participacao: al.tipo,
          }))
        )
      }
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula avulsa criada!')
      setAulaOrigem({
        aulaId: aulaData.id,
        professor_id: form.professor_id,
        alunos: [...alunos],
        quadraNome,
        horario: form.horario,
        nivelNome,
        observacoes: `⚡ Avulsa · ${quadraNome} · ${form.horario}${nivelNome ? ' · ' + nivelNome : ''}`,
        dataOrigem: form.data,
      })
      setMesCalendario(new Date(form.data + 'T12:00:00'))
      setStep('replicar')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { resetTudo(); onClose() }} title={step === 'replicar'
      ? <><Calendar size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Replicar Aula</>
      : <><Zap size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Aula Avulsa</>} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Step: Replicar ── */}
        {step === 'replicar' && aulaOrigem && (() => {
          const primeiroDia = startOfMonth(mesCalendario)
          const totalDias = getDaysInMonth(mesCalendario)
          const iniciaSemana = getDay(primeiroDia)
          const cells = [
            ...Array(iniciaSemana).fill(null),
            ...Array.from({ length: totalDias }, (_, i) => {
              const d = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), i + 1)
              return format(d, 'yyyy-MM-dd')
            }),
          ]
          const hoje = format(new Date(), 'yyyy-MM-dd')
          const toggleData = (ds) => setDatasSelecionadas(prev => {
            const next = new Set(prev)
            if (next.has(ds)) next.delete(ds); else next.add(ds)
            return next
          })
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(75,139,106,0.08)', border: '1px solid rgba(75,139,106,0.25)', borderRadius: '10px', fontSize: '12px', color: 'var(--color-state-success)' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>✓ Aula criada em {format(new Date(aulaOrigem.dataOrigem + 'T12:00:00'), "dd/MM", { locale: ptBR })}</div>
                <div style={{ color: 'var(--color-text-light-secondary)' }}>{aulaOrigem.quadraNome} · {aulaOrigem.horario}{aulaOrigem.nivelNome ? ' · ' + aulaOrigem.nivelNome : ''} · {aulaOrigem.alunos.length} aluno(s)</div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', fontWeight: '500' }}>Selecione os dias para replicar:</div>

              {/* Calendário */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <button onClick={() => setMesCalendario(m => addMonths(m, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-secondary)', padding: '4px' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-light-secondary)', textTransform: 'capitalize' }}>
                    {format(mesCalendario, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button onClick={() => setMesCalendario(m => addMonths(m, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-secondary)', padding: '4px' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', textAlign: 'center' }}>
                  {['D','S','T','Q','Q','S','S'].map((d, i) => (
                    <div key={i} style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', paddingBottom: '4px', fontWeight: '600' }}>{d}</div>
                  ))}
                  {cells.map((ds, i) => {
                    if (!ds) return <div key={i} />
                    const isOrigem = ds === aulaOrigem.dataOrigem
                    const isSel = datasSelecionadas.has(ds)
                    const isHoje = ds === hoje
                    return (
                      <button
                        key={ds}
                        disabled={isOrigem}
                        onClick={() => toggleData(ds)}
                        style={{
                          aspectRatio: '1', borderRadius: '8px', border: 'none',
                          fontSize: '11px', fontWeight: isSel || isOrigem ? '700' : '400',
                          cursor: isOrigem ? 'default' : 'pointer',
                          background: isOrigem ? 'rgba(165,76,46,0.15)'
                            : isSel ? 'var(--color-action-primary)'
                            : 'transparent',
                          color: isOrigem ? 'var(--color-action-primary)' : isSel ? 'white' : isHoje ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
                          outline: isHoje && !isSel && !isOrigem ? '1px solid rgba(165,76,46,0.3)' : 'none',
                        }}
                      >
                        {parseInt(ds.split('-')[2])}
                      </button>
                    )
                  })}
                </div>
              </div>

              {datasSelecionadas.size > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', textAlign: 'center' }}>
                  {datasSelecionadas.size} dia(s) selecionado(s)
                </div>
              )}

              <button
                onClick={handleReplicar}
                disabled={datasSelecionadas.size === 0 || replicando}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: datasSelecionadas.size > 0 ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
                  color: datasSelecionadas.size > 0 ? 'white' : 'var(--color-text-light-muted)',
                  fontSize: '14px', fontWeight: '600',
                  cursor: datasSelecionadas.size > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Copy size={15} />
                {replicando ? 'Replicando...' : `Replicar em ${datasSelecionadas.size || '—'} dia(s)`}
              </button>

              <button onClick={() => { resetTudo(); onClose() }} style={{ background: 'none', border: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>
                Não, finalizar sem replicar
              </button>
            </div>
          )
        })()}

        {/* ── Step: Formulário ── */}
        {step === 'form' && <>

        {atalho && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: 'rgba(165,76,46,0.08)', border: '1px solid rgba(165,76,46,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--color-action-primary)' }}>
            <Zap size={11} style={{ flexShrink: 0 }} /> Atalho: <strong>{atalho.quadraNome}</strong> · <strong>{atalho.horario}</strong>
          </div>
        )}

        <Select label="Modalidade" value={modalidadeId} onChange={e => { setModalidadeId(e.target.value); setForm(f => ({ ...f, professor_id: '', nivel_id: '' })) }}>
          <option value="">Selecione...</option>
          {modalidades?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Select>

        <Input label="Data da Aula" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />

        <Select label="Horário" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}>
          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
        </Select>

        <Select label="Quadra" value={form.quadra_id} onChange={e => setForm(f => ({ ...f, quadra_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {(todasQuadras || quadras)?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </Select>

        <Select label="Professor" value={form.professor_id} onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '8px' }}>Nível da Aula (opcional)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {niveis?.map(n => (
              <button key={n.id} onClick={() => setForm(f => ({ ...f, nivel_id: f.nivel_id === n.id ? '' : n.id }))} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '12px',
                background: form.nivel_id === n.id ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
                outline: form.nivel_id === n.id ? 'none' : '1px solid var(--color-border-light)',
                color: form.nivel_id === n.id ? 'white' : 'var(--color-text-light-secondary)', cursor: 'pointer',
              }}>{n.nome}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '8px' }}>Alunos ({alunos.length})</div>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {alunos.map(al => (
                <div key={al.aluno_id} style={{ backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', flex: 1 }}>{al.nome}</span>
                  <select value={al.tipo} onChange={e => updateTipoAluno(al.aluno_id, e.target.value)} style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)', color: TIPOS_PARTICIPACAO.find(t => t.value === al.tipo)?.color || 'var(--color-text-light-secondary)', cursor: 'pointer', outline: 'none' }}>
                    {TIPOS_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button onClick={() => removerAluno(al.aluno_id)} style={{ padding: '4px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer' }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <input placeholder="Buscar aluno para adicionar..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--color-action-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border-light)'} />
            {alunosFiltrados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)', borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                {alunosFiltrados.map(a => (
                  <button key={a.id} onClick={() => adicionarAluno(a)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: 'var(--color-text-light-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-border-light)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >{a.nome}</button>
                ))}
              </div>
            )}
          </div>

          {!novoAluno.show ? (
            <button onClick={() => setNovoAluno(n => ({ ...n, show: true }))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <UserPlus size={13} /> Cadastrar novo aluno
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid rgba(165,76,46,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '600', color: 'var(--color-action-primary)' }}><User size={13} /> Novo Aluno</div>
              <div style={{ position: 'relative' }}>
                <input placeholder="Nome completo *" value={novoAluno.nome} onChange={e => setNovoAluno(n => ({ ...n, nome: e.target.value }))} style={inputInline} />
                {sugestoesNome.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid rgba(165,76,46,0.4)', borderRadius: '10px', marginTop: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--color-action-primary)', padding: '6px 12px 4px', borderBottom: '1px solid var(--color-border-light)' }}><AlertTriangle size={10} /> Já cadastrado — clique para adicionar direto</div>
                    {sugestoesNome.map(a => (
                      <button key={a.id} onClick={() => { adicionarAluno(a, 'avulso'); resetNovoAluno() }} style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', color: 'var(--color-text-light-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-border-light)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <span>{a.nome}</span>
                        {a.nivel && <span style={{ fontSize: '10px', color: 'var(--color-state-info)' }}>{a.nivel}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input placeholder="Telefone (WhatsApp)" value={novoAluno.telefone} onChange={e => setNovoAluno(n => ({ ...n, telefone: e.target.value }))} style={inputInline} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Nível do Aluno (opcional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {NIVEIS_ALUNO.map(n => (
                    <button key={n} onClick={() => setNovoAluno(na => ({ ...na, nivel: na.nivel === n ? '' : n }))} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', background: novoAluno.nivel === n ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)', outline: novoAluno.nivel === n ? 'none' : '1px solid var(--color-border-light)', color: novoAluno.nivel === n ? 'white' : 'var(--color-text-light-secondary)', cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setNovoAluno(n => ({ ...n, menor_idade: !n.menor_idade }))} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: novoAluno.menor_idade ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-raised)', outline: novoAluno.menor_idade ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)', color: novoAluno.menor_idade ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '12px' }}>
                <span>{novoAluno.menor_idade ? '✓' : '○'}</span><span>Menor de idade</span>
              </button>
              {novoAluno.menor_idade && (
                <input placeholder="Nome do responsável *" value={novoAluno.nome_responsavel} onChange={e => setNovoAluno(n => ({ ...n, nome_responsavel: e.target.value }))} style={inputInline} />
              )}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Modalidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {modalidades?.map(m => (
                    <button key={m.id} onClick={() => toggleModalidadeNovoAluno(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', border: 'none', background: novoAluno.modalidades_ids.includes(m.id) ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-raised)', outline: novoAluno.modalidades_ids.includes(m.id) ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)', color: novoAluno.modalidades_ids.includes(m.id) ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', cursor: 'pointer', fontSize: '12px', width: '100%' }}>
                      <span>{m.nome}</span>
                      <span>{novoAluno.modalidades_ids.includes(m.id) ? '✓' : '+'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={resetNovoAluno} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCadastrarAluno} disabled={salvarAluno.isPending} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvarAluno.isPending ? 'Salvando...' : '✓ Cadastrar e Adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSalvar} disabled={salvando} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Plus size={16} />
          {salvando ? 'Salvando...' : 'Criar Aula Avulsa'}
        </button>
        </>}
      </div>
    </Modal>
  )
}