import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, startOfMonth, endOfMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, addDays, isSameMonth, isToday, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Check, X, ExternalLink, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAulasDoMes, useAulas, useConfirmarAulaCoordenador } from '../../hooks/useAulas'
import { criarAlerta } from '../../hooks/useAlertas'
import { useAbrirConversaDaAula } from '../../hooks/useMensagens'
import useAppStore from '../../store/useAppStore'
import { useQueryClient } from '@tanstack/react-query'
import { parseObservacoes } from '../../constants/modalidades'
import { StatusBadge } from '../../components/ui/Badge'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import { Loading } from '../../components/ui/Loading'

const STATUS_PENDENTE = ['pendente', 'confirmada_professor']
const STATUS_VALIDADO = ['match', 'confirmada_coord']
const CORES = { verde: '#1D9E75', vermelho: '#e24b4a', amarelo: '#fcc825' }
const DIAS_SEMANA_LABEL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function corDoDia(statuses) {
  if (!statuses || statuses.length === 0) return null
  if (statuses.some(s => STATUS_PENDENTE.includes(s))) return 'vermelho'
  if (statuses.some(s => s === 'divergencia')) return 'amarelo'
  if (statuses.every(s => STATUS_VALIDADO.includes(s) || s === 'nao_dada')) return 'verde'
  return null
}

function getInfoAula(aula) {
  if (aula.turma_id) {
    return {
      nome: aula.turmas?.nome || '—',
      quadra: aula.turmas?.quadras?.nome || '',
      horario: aula.turmas?.horario_inicio?.slice(0, 5) || '',
    }
  }
  const p = parseObservacoes(aula.observacoes)
  return { nome: p.nivel || 'Avulsa', quadra: p.quadra, horario: p.horario }
}

async function checarDivergenciasAutomaticas(qc) {
  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)

  const { data: atrasadas } = await supabase
    .from('aulas')
    .select('id')
    .eq('status', 'confirmada_professor')
    .lt('atualizado_em', seteDiasAtras.toISOString())

  if (!atrasadas?.length) return

  await supabase.from('aulas').update({ status: 'divergencia' }).in('id', atrasadas.map(a => a.id))

  const { data: responsaveis } = await supabase.from('perfis_usuario').select('user_id').in('role', ['admin', 'gestor', 'coordenador'])
  for (const r of responsaveis || []) {
    await criarAlerta({
      usuarioId: r.user_id,
      tipo: 'divergencia_aberta',
      prioridade: 'media',
      mensagem: `${atrasadas.length} aula${atrasadas.length > 1 ? 's ficaram' : ' ficou'} 7+ dias sem validação e ${atrasadas.length > 1 ? 'viraram' : 'virou'} divergência.`,
    })
  }

  qc.invalidateQueries({ queryKey: ['aulas'] })
  qc.invalidateQueries({ queryKey: ['aulas_mes'] })
}

function PainelDia({ data, onFechar }) {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const { data: aulasTodas = [], isLoading } = useAulas({ data })
  const confirmar = useConfirmarAulaCoordenador()
  const abrirConversaDaAula = useAbrirConversaDaAula()

  // Match só faz sentido se tem aluno de verdade na aula (avulsa já nasce com aluno)
  const aulas = aulasTodas.filter(a => !a.turma_id || (a.presencas?.length || 0) > 0)

  async function discutir(aula) {
    if (!aula.professores?.id) return
    const { data: perfilProfessor } = await supabase
      .from('perfis_usuario')
      .select('user_id')
      .eq('professor_id', aula.professores.id)
      .maybeSingle()
    if (!perfilProfessor?.user_id || perfilProfessor.user_id === user?.id) return
    try {
      const conversaId = await abrirConversaDaAula.mutateAsync({ aulaId: aula.id, outroUserId: perfilProfessor.user_id })
      navigate('/mensagens', { state: { conversaId } })
    } catch {
      // migração da coluna aula_id ainda não rodou — sem feedback bloqueante aqui
    }
  }

  async function validar(aula, confirmada) {
    await confirmar.mutateAsync({ aulaId: aula.id, confirmada })
    if (!confirmada && aula.professores?.id) {
      const { data: perfilProfessor } = await supabase
        .from('perfis_usuario')
        .select('user_id')
        .eq('professor_id', aula.professores.id)
        .maybeSingle()
      if (perfilProfessor?.user_id) {
        await criarAlerta({
          usuarioId: perfilProfessor.user_id,
          tipo: 'divergencia_aberta',
          prioridade: 'alta',
          mensagem: `Sua aula de ${getInfoAula(aula).nome} não foi validada pelo coordenador.`,
        })
      }
    }
  }

  return (
    <div className="sheet-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 50,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
    }} onClick={onFechar}>
      <div className="sheet-content" onClick={e => e.stopPropagation()} style={{
        maxHeight: '85vh', overflowY: 'auto',
        backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
        padding: '20px 16px', boxSizing: 'border-box',
      }}>
        <div className="sheet-handle" style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', textTransform: 'capitalize' }}>
            {format(new Date(data + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}>
            <X size={20} />
          </button>
        </div>

        <button onClick={() => navigate('/aulas', { state: { data, from: '/match' } })} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #2a2a2a',
          background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer', marginBottom: '16px',
        }}>
          <ExternalLink size={13} /> Ver agenda completa do dia
        </button>

        {isLoading ? <Loading /> : aulas.length === 0 ? (
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#555' }}>Nenhuma aula nesse dia.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {aulas.map(aula => {
              const info = getInfoAula(aula)
              const presentes = aula.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
              const faltas = aula.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
              const aguardandoAcao = STATUS_PENDENTE.includes(aula.status)

              return (
                <div key={aula.id} style={{ backgroundColor: '#111', borderRadius: '12px', padding: '12px', border: '1px solid #222' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <FotoProfessor src={aula.professores?.foto_url} nome={aula.professores?.nome} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5' }}>{aula.professores?.nome || 'Sem professor'}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{info.horario} · {info.nome} {info.quadra && `· ${info.quadra}`}</div>
                    </div>
                    <StatusBadge status={aula.status} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aguardandoAcao ? '10px' : 0 }}>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#888' }}>
                      <span style={{ color: '#1D9E75' }}>✓ {presentes} presentes</span>
                      <span style={{ color: '#e24b4a' }}>✗ {faltas} faltas</span>
                    </div>
                    {aula.professores?.id && (
                      <button onClick={() => discutir(aula)} style={{
                        display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
                        color: '#555', fontSize: '11px', cursor: 'pointer', padding: '2px',
                      }}>
                        <MessageCircle size={12} /> Discutir
                      </button>
                    )}
                  </div>

                  {aguardandoAcao && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => validar(aula, true)} disabled={confirmar.isPending} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'rgba(29,158,117,0.15)', color: '#1D9E75', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      }}>
                        <Check size={13} /> Validar
                      </button>
                      <button onClick={() => validar(aula, false)} disabled={confirmar.isPending} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'rgba(226,75,74,0.15)', color: '#e24b4a', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      }}>
                        <X size={13} /> Não validar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AbaDivergencias({ onAbrirDia }) {
  const { data: aulas = [], isLoading } = useAulas({ status: 'divergencia' })

  return (
    <div>
      {isLoading ? <Loading /> : aulas.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#555', padding: '32px 0' }}>Nenhuma divergência no momento.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {aulas.map(aula => {
            const info = getInfoAula(aula)
            return (
              <button key={aula.id} onClick={() => onAbrirDia(aula.data_aula)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '12px', borderRadius: '12px', backgroundColor: '#1a1a1a',
                border: '1px solid rgba(252,200,37,0.2)', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
              }}>
                <FotoProfessor src={aula.professores?.foto_url} nome={aula.professores?.nome} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5' }}>{aula.professores?.nome || '—'}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {format(new Date(aula.data_aula + 'T12:00:00'), 'dd/MM')} · {info.horario} · {info.nome}
                  </div>
                </div>
                <StatusBadge status="divergencia" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MatchAulas() {
  const qc = useQueryClient()
  const [mesAtual, setMesAtual] = useState(startOfMonth(new Date()))
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [aba, setAba] = useState('calendario')

  const inicioStr = format(startOfMonth(mesAtual), 'yyyy-MM-dd')
  const fimStr = format(endOfMonth(mesAtual), 'yyyy-MM-dd')
  const { data: aulasMes = [] } = useAulasDoMes(inicioStr, fimStr)

  useEffect(() => { checarDivergenciasAutomaticas(qc) }, [])

  const statusesPorDia = useMemo(() => {
    const mapa = {}
    aulasMes.forEach(a => {
      if (!mapa[a.data_aula]) mapa[a.data_aula] = []
      mapa[a.data_aula].push(a.status)
    })
    return mapa
  }, [aulasMes])

  const dias = useMemo(() => {
    const inicioGrade = startOfWeek(startOfMonth(mesAtual))
    const fimGrade = endOfWeek(endOfMonth(mesAtual))
    const lista = []
    for (let d = inicioGrade; d <= fimGrade; d = addDays(d, 1)) lista.push(d)
    return lista
  }, [mesAtual])

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: '16px 0 16px' }}>Match de Aulas</h1>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {[{ id: 'calendario', label: 'Calendário' }, { id: 'divergencias', label: 'Divergências' }].map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            background: aba === t.id ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
            color: aba === t.id ? 'white' : '#555',
          }}>{t.label}</button>
        ))}
      </div>

      {aba === 'calendario' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button onClick={() => setMesAtual(subMonths(mesAtual, 1))} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', textTransform: 'capitalize' }}>
              {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={() => setMesAtual(addMonths(mesAtual, 1))} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {DIAS_SEMANA_LABEL.map((l, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: '#555', fontWeight: '700' }}>{l}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {dias.map(dia => {
              const diaStr = format(dia, 'yyyy-MM-dd')
              const cor = corDoDia(statusesPorDia[diaStr])
              const foraDoMes = !isSameMonth(dia, mesAtual)
              return (
                <button key={diaStr} onClick={() => setDiaSelecionado(diaStr)} style={{
                  aspectRatio: '1', borderRadius: '10px', border: isToday(dia) ? '1px solid #fcc825' : '1px solid #222',
                  backgroundColor: cor ? `${CORES[cor]}22` : '#161616',
                  color: foraDoMes ? '#333' : '#F0F2F5', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                  fontSize: '12px', fontWeight: isToday(dia) ? '700' : '400',
                }}>
                  {format(dia, 'd')}
                  {cor && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: CORES[cor] }} />}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '14px', marginTop: '16px', flexWrap: 'wrap' }}>
            {[
              { cor: 'verde', label: 'Tudo validado' },
              { cor: 'vermelho', label: 'Pendente' },
              { cor: 'amarelo', label: 'Divergência' },
            ].map(item => (
              <div key={item.cor} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CORES[item.cor] }} />
                <span style={{ fontSize: '11px', color: '#555' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <AbaDivergencias onAbrirDia={setDiaSelecionado} />
      )}

      {diaSelecionado && (
        <PainelDia data={diaSelecionado} onFechar={() => setDiaSelecionado(null)} />
      )}
    </div>
  )
}
