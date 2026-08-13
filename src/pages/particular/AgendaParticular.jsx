import { useState, useEffect } from 'react'
import { format, addDays, addWeeks, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Lock, Settings, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import useAppStore from '../../store/useAppStore'
import { useTurmas, useSalvarTurma } from '../../hooks/useTurmas'
import { useAulas, useGerarAulas } from '../../hooks/useAulas'
import { useHorariosAgenda, useCriarHorarioAgenda, useExcluirHorarioAgenda } from '../../hooks/useHorariosAgenda'
import { useBloqueiosAgenda, useCriarBloqueioAgenda, useRemoverBloqueioAgenda } from '../../hooks/useBloqueiosAgenda'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] // index = Date.getDay()
const STATUS_OPCOES = [
  { value: 'dada', label: 'Dada' },
  { value: 'nao_dada', label: 'Sem Aula' },
  { value: 'cancelada', label: 'Cancelada' },
]

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

// Agenda semanal do modo Particular — 7 colunas (seg-dom) em vez do dia único com colunas por
// quadra que a grade do clube usa (AulasCoordenador.jsx), porque aqui só existe UMA "coluna" de
// atividade (a do próprio profissional), sem quadra nenhuma. Não importa nada de
// AulasCoordenador/AulasAdmin — só os hooks de dados (useTurmas/useAulas/useGerarAulas), que já
// toleram turma/aula sem quadra_id (mesmo caminho da aula avulsa do clube).
export function AgendaParticular() {
  const qc = useQueryClient()
  const { empresaSelecionada } = useAppStore()
  const empresaId = empresaSelecionada?.id

  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const dias = Array.from({ length: 7 }, (_, i) => addDays(semanaBase, i))
  const dataInicio = format(semanaBase, 'yyyy-MM-dd')
  const dataFim = format(dias[6], 'yyyy-MM-dd')

  const { data: horarios = [], isLoading: loadingHorarios } = useHorariosAgenda(empresaId)
  const { data: turmas = [] } = useTurmas(null, empresaId)
  const { data: aulasSemana = [], isLoading: loadingAulas } = useAulas({ empresaId, dataInicio, dataFim })
  const { data: bloqueios = [] } = useBloqueiosAgenda(empresaId, dataInicio, dataFim)

  const salvarTurma = useSalvarTurma()
  const gerarAulas = useGerarAulas()
  const criarHorario = useCriarHorarioAgenda()
  const excluirHorario = useExcluirHorarioAgenda()
  const criarBloqueio = useCriarBloqueioAgenda()
  const removerBloqueio = useRemoverBloqueioAgenda()

  const turmasPosicionadas = turmas.filter(t => t.horario_dia_semana && t.horario_inicio)
  const turmasSemHorario = turmas.filter(t => !t.horario_dia_semana)

  // Garante que toda turma já posicionada tem aula gerada na semana visível — sem cron, gera
  // sob demanda ao navegar (mesmo padrão de uso do useGerarAulas que já existe pro clube).
  useEffect(() => {
    if (!empresaId || turmasPosicionadas.length === 0) return
    turmasPosicionadas.forEach(t => {
      const diaSemanaNum = DIAS_SEMANA.indexOf(t.horario_dia_semana)
      const jaTemAula = aulasSemana.some(a => a.turma_id === t.id && a.data_aula >= dataInicio && a.data_aula <= dataFim)
      if (!jaTemAula && diaSemanaNum >= 0) {
        gerarAulas.mutate({ turmaId: t.id, dataInicio, dataFim })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, dataInicio, dataFim, turmasPosicionadas.map(t => t.id).join(',')])

  const [celulaVazia, setCelulaVazia] = useState(null) // { dataStr, horario } | null
  const [bloqueioAberto, setBloqueioAberto] = useState(null) // bloqueio row | null
  const [aulaAberta, setAulaAberta] = useState(null) // aula row | null
  const [gerenciandoHorarios, setGerenciandoHorarios] = useState(false)

  function celulaDoTipo(dataStr, horarioStr) {
    const bloqueio = bloqueios.find(b => b.data === dataStr && b.horario?.slice(0, 5) === horarioStr)
    if (bloqueio) return { tipo: 'bloqueio', bloqueio }
    const aula = aulasSemana.find(a => a.data_aula === dataStr && a.turmas?.horario_inicio?.slice(0, 5) === horarioStr)
    if (aula) return { tipo: 'aula', aula }
    return { tipo: 'vazia' }
  }

  if (loadingHorarios || loadingAulas) return <Loading text="Carregando agenda..." />

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: 0 }}>Agenda</h1>
        <button onClick={() => setGerenciandoHorarios(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9px',
          border: '1px solid var(--color-border-light)', background: 'var(--color-surface-light-raised)',
          color: 'var(--color-text-light-secondary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
        }}>
          <Settings size={13} /> Horários
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => setSemanaBase(s => addWeeks(s, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-text-light-secondary)' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-light-primary)', textTransform: 'capitalize' }}>
          {format(semanaBase, "dd 'de' MMM", { locale: ptBR })} – {format(dias[6], "dd 'de' MMM", { locale: ptBR })}
        </div>
        <button onClick={() => setSemanaBase(s => addWeeks(s, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-text-light-secondary)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7, minmax(96px, 1fr))`, minWidth: '760px' }}>
          <div />
          {dias.map(d => (
            <div key={d.toISOString()} style={{ textAlign: 'center', padding: '6px 4px', fontSize: '11px', fontWeight: '700', color: 'var(--color-text-light-secondary)', textTransform: 'capitalize' }}>
              {format(d, 'EEE', { locale: ptBR })}<br />
              <span style={{ fontSize: '13px', color: 'var(--color-text-light-primary)' }}>{format(d, 'dd/MM')}</span>
            </div>
          ))}

          {horarios.map(h => {
            const horarioStr = h.horario.slice(0, 5)
            return (
              <div key={h.id} style={{ display: 'contents' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '11px', color: 'var(--color-text-light-muted)' }}>
                  {horarioStr}
                </div>
                {dias.map(d => {
                  const dataStr = format(d, 'yyyy-MM-dd')
                  const cel = celulaDoTipo(dataStr, horarioStr)
                  if (cel.tipo === 'bloqueio') {
                    return (
                      <button key={dataStr} onClick={() => setBloqueioAberto(cel.bloqueio)} style={{
                        margin: '2px', padding: '8px 6px', borderRadius: '8px', minHeight: '44px',
                        border: '1px dashed var(--color-border-light)', background: 'rgba(122,122,122,0.08)',
                        color: 'var(--color-text-light-muted)', fontSize: '10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                      }}>
                        <Lock size={11} />
                        {cel.bloqueio.motivo || 'Bloqueado'}
                      </button>
                    )
                  }
                  if (cel.tipo === 'aula') {
                    return (
                      <button key={dataStr} onClick={() => setAulaAberta(cel.aula)} style={{
                        margin: '2px', padding: '8px 6px', borderRadius: '8px', minHeight: '44px',
                        border: '1px solid rgba(165,76,46,0.3)', background: 'rgba(165,76,46,0.08)',
                        color: 'var(--color-action-primary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        textAlign: 'left',
                      }}>
                        {cel.aula.turmas?.nome || 'Aula'}
                      </button>
                    )
                  }
                  return (
                    <button key={dataStr} onClick={() => setCelulaVazia({ dataStr, horario: horarioStr })} style={{
                      margin: '2px', padding: '8px 6px', borderRadius: '8px', minHeight: '44px',
                      border: '1px dashed var(--color-border-light)', background: 'none', cursor: 'pointer',
                    }} />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {celulaVazia && (
        <ModalCelulaVazia
          dataStr={celulaVazia.dataStr}
          horario={celulaVazia.horario}
          empresaId={empresaId}
          turmasSemHorario={turmasSemHorario}
          onFechar={() => setCelulaVazia(null)}
          onPosicionarExistente={async (turma) => {
            const diaSemana = DIAS_SEMANA[new Date(celulaVazia.dataStr + 'T12:00').getDay()]
            await salvarTurma.mutateAsync({ id: turma.id, horario_dia_semana: diaSemana, horario_inicio: celulaVazia.horario })
            await gerarAulas.mutateAsync({ turmaId: turma.id, dataInicio, dataFim })
            toast.success('Turma posicionada na agenda!')
            setCelulaVazia(null)
          }}
          onCriarNova={async (nome) => {
            const diaSemana = DIAS_SEMANA[new Date(celulaVazia.dataStr + 'T12:00').getDay()]
            const turmaId = await salvarTurma.mutateAsync({ nome, empresa_id: empresaId, horario_dia_semana: diaSemana, horario_inicio: celulaVazia.horario })
            await gerarAulas.mutateAsync({ turmaId, dataInicio, dataFim })
            toast.success('Turma criada e posicionada!')
            setCelulaVazia(null)
          }}
          onCongelar={async (motivo) => {
            await criarBloqueio.mutateAsync({ empresaId, data: celulaVazia.dataStr, horario: celulaVazia.horario, motivo })
            toast.success('Horário congelado.')
            setCelulaVazia(null)
          }}
        />
      )}

      {bloqueioAberto && (
        <Modal open onClose={() => setBloqueioAberto(null)} title="Horário congelado" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bloqueioAberto.motivo || 'Sem motivo informado.'}</div>
            <button
              onClick={async () => {
                await removerBloqueio.mutateAsync(bloqueioAberto.id)
                toast.success('Congelamento removido.')
                setBloqueioAberto(null)
              }}
              style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-state-danger)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >Remover congelamento</button>
          </div>
        </Modal>
      )}

      {aulaAberta && (
        <ModalAula
          aula={aulaAberta}
          onFechar={() => setAulaAberta(null)}
          onSalvar={async (statusAula, observacoes) => {
            await supabase.from('aulas').update({
              status_aula: statusAula,
              paga_professor: statusAula === 'dada',
              observacoes: observacoes || null,
              atualizado_em: new Date().toISOString(),
            }).eq('id', aulaAberta.id)
            qc.invalidateQueries({ queryKey: ['aulas'] })
            toast.success('Aula atualizada!')
            setAulaAberta(null)
          }}
        />
      )}

      {gerenciandoHorarios && (
        <ModalHorarios
          empresaId={empresaId}
          horarios={horarios}
          onFechar={() => setGerenciandoHorarios(false)}
          onAdicionar={async (horario) => { await criarHorario.mutateAsync({ empresaId, horario }) }}
          onRemover={async (id) => { await excluirHorario.mutateAsync(id) }}
        />
      )}
    </div>
  )
}

function ModalCelulaVazia({ dataStr, horario, turmasSemHorario, onFechar, onPosicionarExistente, onCriarNova, onCongelar }) {
  const [aba, setAba] = useState('nova') // 'nova' | 'existente' | 'congelar'
  const [nome, setNome] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function rodar(fn) {
    setSalvando(true)
    try { await fn() } catch (err) { toast.error(err.message) } finally { setSalvando(false) }
  }

  return (
    <Modal open onClose={onFechar} title={`${format(new Date(dataStr + 'T12:00'), "dd/MM", { locale: ptBR })} · ${horario}`} size="sm">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: 'var(--surface)', borderRadius: '10px', padding: '4px' }}>
        {[{ key: 'nova', label: 'Nova turma' }, { key: 'existente', label: 'Já cadastrada' }, { key: 'congelar', label: 'Congelar' }].map(t => (
          <button key={t.key} onClick={() => setAba(t.key)} style={{
            flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
            background: aba === t.key ? 'var(--color-action-primary)' : 'transparent',
            color: aba === t.key ? 'white' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {aba === 'nova' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input style={inputStyle} placeholder="Nome (ex: nome do aluno)" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          <button disabled={!nome.trim() || salvando} onClick={() => rodar(() => onCriarNova(nome.trim()))} style={{
            padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: !nome.trim() ? 0.5 : 1,
          }}>{salvando ? 'Salvando...' : 'Criar e posicionar aqui'}</button>
        </div>
      )}

      {aba === 'existente' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
          {turmasSemHorario.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
              Nenhuma turma sem horário definido ainda.
            </div>
          ) : turmasSemHorario.map(t => (
            <button key={t.id} disabled={salvando} onClick={() => rodar(() => onPosicionarExistente(t))} style={{
              padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
            }}>{t.nome}</button>
          ))}
        </div>
      )}

      {aba === 'congelar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input style={inputStyle} placeholder="Motivo (ex: deslocamento)" value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus />
          <button disabled={salvando} onClick={() => rodar(() => onCongelar(motivo.trim()))} style={{
            padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-state-danger)', color: 'white',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>{salvando ? 'Salvando...' : 'Congelar este horário'}</button>
        </div>
      )}
    </Modal>
  )
}

function ModalAula({ aula, onFechar, onSalvar }) {
  const [status, setStatus] = useState(aula.status_aula || 'dada')
  const [observacoes, setObservacoes] = useState(aula.observacoes || '')
  const [salvando, setSalvando] = useState(false)

  return (
    <Modal open onClose={onFechar} title={aula.turmas?.nome || 'Aula'} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {format(new Date(aula.data_aula + 'T12:00'), "dd/MM 'às' ", { locale: ptBR })}{aula.turmas?.horario_inicio?.slice(0, 5)}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {STATUS_OPCOES.map(o => (
            <button key={o.value} onClick={() => setStatus(o.value)} style={{
              flex: 1, padding: '9px', borderRadius: '9px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
              border: `1px solid ${status === o.value ? 'var(--color-action-primary)' : 'var(--border)'}`,
              background: status === o.value ? 'rgba(165,76,46,0.12)' : 'var(--surface)',
              color: status === o.value ? 'var(--color-action-primary)' : 'var(--text-secondary)',
            }}>{o.label}</button>
          ))}
        </div>
        <textarea
          style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Observação (opcional)"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
        />
        <button
          disabled={salvando}
          onClick={async () => { setSalvando(true); await onSalvar(status, observacoes.trim()); setSalvando(false) }}
          style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  )
}

function ModalHorarios({ horarios, onFechar, onAdicionar, onRemover }) {
  const [novoHorario, setNovoHorario] = useState('')
  const [salvando, setSalvando] = useState(false)

  return (
    <Modal open onClose={onFechar} title="Horários da agenda" size="sm">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input type="time" style={inputStyle} value={novoHorario} onChange={e => setNovoHorario(e.target.value)} />
        <button
          disabled={!novoHorario || salvando}
          onClick={async () => {
            setSalvando(true)
            try { await onAdicionar(novoHorario); setNovoHorario('') }
            catch (err) { toast.error(err.message) }
            finally { setSalvando(false) }
          }}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 14px', borderRadius: '10px',
            border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', opacity: !novoHorario ? 0.5 : 1,
          }}
        ><Plus size={13} /> Adicionar</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
        {horarios.map(h => (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--surface)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{h.horario.slice(0, 5)}</span>
            <button onClick={() => onRemover(h.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)',
              display: 'flex', alignItems: 'center', padding: '4px',
            }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
