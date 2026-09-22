import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronRight, Copy, Gift, Grid3x3, List, MessageCircle, Pencil, RotateCcw, Search, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermissions } from '../../hooks/usePermissions'
import {
  useExtrasAgenda, useExtrasInscritos, useAtualizarProfessorExtra, useCancelarAgendamentoExtra, useAtualizarConferenciaExtra,
  useNomesAlunosAtivos,
} from '../../hooks/useExtrasReposicao'
import {
  DIAS, estadoVagas, faixaHorario, nomeProfessor, rotuloDiaCurto, rotuloDiaLongo, rotuloNivel, usaCreditoIndividualEmGrupo,
} from '../reposicao/constantes'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'

const LINK_PUBLICO = 'https://procoachsport.com.br/reposicao'

const CONFERENCIA = {
  pendente: { rotulo: 'Pendente', cor: 'var(--color-state-warning)' },
  confirmado: { rotulo: 'Aluno confirmado', cor: 'var(--color-state-success)' },
  nao_localizado: { rotulo: 'Não localizado', cor: 'var(--color-state-danger)' },
}

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)', borderRadius: '10px', fontSize: '13px',
}

const cartao = {
  backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
  borderRadius: '12px', boxSizing: 'border-box',
}

// Mesma normalização do extras_norm() no banco (scripts/2026-09-20_reposicao_extra_publica.sql):
// minúsculo, sem acento, só letras/espaço, espaços colapsados.
function normalizarNome(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Compara por CONJUNTO de palavras, não string inteira — cobre nome do meio faltando, ordem
// diferente etc. Reduz falso positivo de "não achei", já que a conferência final é sempre
// manual (WhatsApp/observação) de qualquer jeito; melhor deixar passar um caso duvidoso do que
// marcar sócio de verdade como se não existisse.
function existeNoCadastro(nomeInscricao, palavrasPorAluno) {
  const palavras = normalizarNome(nomeInscricao).split(' ').filter(Boolean)
  if (palavras.length === 0) return true
  return palavrasPorAluno.some(setAluno => palavras.every(p => setAluno.has(p)))
}

function formatarTelefone(t) {
  const d = (t || '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t
}

// "Grupo · SEG, QUA 19h · Iniciante 1  |  Individual · SEG 6h"
function resumoTurma(turmas) {
  if (!Array.isArray(turmas) || !turmas.length) return 'Turma não informada'
  const rotuloDia = k => DIAS.find(d => d.key === k)?.label || k.toUpperCase()
  return turmas.map(t => [
    t.formato === 'individual' ? 'Individual' : 'Grupo',
    `${(t.dias || []).map(rotuloDia).join(', ')} ${t.horario ? `${Number(t.horario.slice(0, 2))}h` : ''}`.trim(),
    t.nivel,
  ].filter(Boolean).join(' · ')).join('  |  ')
}

function Chip({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${ativo ? 'var(--color-action-primary)' : 'var(--color-border-light)'}`,
      backgroundColor: ativo ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
      color: ativo ? 'var(--color-action-on-primary)' : 'var(--color-text-light-secondary)',
    }}>{children}</button>
  )
}

function Selo({ cor, children }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap',
      color: cor, backgroundColor: `color-mix(in srgb, ${cor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 35%, transparent)`,
    }}>{children}</span>
  )
}

function SeletorConferencia({ valor, onChange, disabled }) {
  const c = CONFERENCIA[valor] || CONFERENCIA.pendente
  return (
    <select value={valor} disabled={disabled} onChange={e => onChange(e.target.value)} style={{
      fontSize: '12px', fontWeight: 700, padding: '5px 8px', borderRadius: '8px', cursor: disabled ? 'default' : 'pointer', color: c.cor,
      border: `1px solid color-mix(in srgb, ${c.cor} 45%, transparent)`, backgroundColor: `color-mix(in srgb, ${c.cor} 10%, var(--color-surface-light-overlay))`,
    }}>
      {Object.entries(CONFERENCIA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
    </select>
  )
}

function LinkWhats({ telefone }) {
  const d = (telefone || '').replace(/\D/g, '')
  // O link não pede mais telefone (fica vazio ou só zeros): nada pra mostrar.
  if (!d || /^0+$/.test(d)) return null
  return (
    <a href={`https://wa.me/55${d}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-action-primary)', fontWeight: 600, fontSize: '12px', textDecoration: 'none' }}>
      <MessageCircle size={13} />{formatarTelefone(telefone)}
    </a>
  )
}

// ---------------------------------------------------------------------------------------------
// Aba Agendas
// ---------------------------------------------------------------------------------------------

function ProfessorEditavel({ slot, podeEditar }) {
  const atualizar = useAtualizarProfessorExtra()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(slot.professor || '')

  async function salvar() {
    setEditando(false)
    if ((valor || '').trim() === (slot.professor || '')) return
    try { await atualizar.mutateAsync({ slotId: slot.id, professor: valor }); toast.success('Professor atualizado', { style: toastStyle }) }
    catch (e) { toast.error(e.message, { style: toastStyle }) }
  }

  if (editando) {
    return (
      <input autoFocus value={valor} onChange={e => setValor(e.target.value)} onBlur={salvar}
        onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') { setValor(slot.professor || ''); setEditando(false) } }}
        placeholder="Nome do professor"
        style={{ fontSize: '13px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--color-action-primary)', backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)', width: '150px' }} />
    )
  }
  const nome = nomeProfessor(slot.professor)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: nome ? 'var(--color-text-light-primary)' : 'var(--color-state-warning)', fontWeight: 600 }}>
      {nome || 'Sem professor'}
      {podeEditar && (
        <button type="button" onClick={() => { setValor(slot.professor || ''); setEditando(true) }} aria-label="Editar professor"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--color-text-light-muted)' }}>
          <Pencil size={13} />
        </button>
      )}
    </span>
  )
}

// Lista de quem está agendado num slot — usada tanto no card expansível (modo Lista) quanto
// dentro do modal do mapa de quadrados (modo Mapa). Extraído sem mudar nada do que já
// renderizava dentro do CardHorario, só pra poder reaproveitar no modal novo.
function ListaAlunosSlot({ slot, podeEditar, onCancelar }) {
  const atualizarConf = useAtualizarConferenciaExtra()
  const ativos = (slot.extras_agendamentos || []).filter(a => a.status === 'confirmado')
  const cancelados = (slot.extras_agendamentos || []).filter(a => a.status === 'cancelado')

  async function mudarConferencia(inscricaoId, conferencia) {
    try { await atualizarConf.mutateAsync({ inscricaoId, conferencia }) } catch (e) { toast.error(e.message, { style: toastStyle }) }
  }

  return (
    <>
      {ativos.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '4px 0' }}>Ninguém agendado neste horário.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ativos.map(a => {
          const i = a.extras_inscricoes
          if (!i) return null
          const creditoIndividual = a.tipo === 'reposicao' && usaCreditoIndividualEmGrupo(i.turma_atual || [], slot)
          return (
            <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', paddingBottom: '8px', borderBottom: '1px dashed var(--color-border-light-subtle)' }}>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{i.nome}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'center' }}>
                  <LinkWhats telefone={i.telefone} />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>{resumoTurma(i.turma_atual)}</span>
                </div>
                {creditoIndividual && <div style={{ marginTop: '3px' }}><Selo cor="var(--color-state-warning)">Usa crédito de aula individual em grupo</Selo></div>}
              </div>
              <SeletorConferencia valor={i.conferencia} disabled={!podeEditar} onChange={v => mudarConferencia(i.id, v)} />
              {podeEditar && (
                <button type="button" onClick={() => onCancelar({ agendamentoId: a.id, nome: i.nome, descricao: `${slot.modalidade} · ${rotuloDiaCurto(slot.data_aula)} ${faixaHorario(slot)}` })}
                  style={{ background: 'none', border: '1px solid color-mix(in srgb, var(--color-state-danger) 45%, transparent)', color: 'var(--color-state-danger)', borderRadius: '8px', padding: '5px 9px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <X size={12} /> Cancelar
                </button>
              )}
            </div>
          )
        })}
      </div>
      {cancelados.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)', marginTop: '8px' }}>
          Cancelados: {cancelados.map(a => a.extras_inscricoes?.nome).filter(Boolean).join(', ')}
        </div>
      )}
    </>
  )
}

function CardHorario({ slot, podeEditar, onCancelar }) {
  const [aberto, setAberto] = useState(false)
  const ativos = (slot.extras_agendamentos || []).filter(a => a.status === 'confirmado')
  const comVagas = { ...slot, vagas_restantes: slot.capacidade - ativos.length }
  const estado = estadoVagas(comVagas)
  const kids = slot.publico === 'kids'
  const rotulo = rotuloNivel(slot)

  return (
    <div style={{ ...cartao, overflow: 'hidden' }}>
      <button type="button" onClick={() => setAberto(a => !a)} style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: '10px', color: 'inherit',
      }}>
        <span style={{ color: 'var(--color-text-light-muted)', display: 'flex' }}>{aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text-light-primary)' }}>{faixaHorario(slot)}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>{slot.modalidade}</span>
            {rotulo && <Selo cor={kids ? 'var(--color-brand-verde-card)' : 'var(--color-state-info)'}>{rotulo}</Selo>}
            <Selo cor={slot.tipo === 'reposicao' ? 'var(--color-action-primary)' : 'var(--color-brand-verde-card)'}>{slot.tipo === 'reposicao' ? 'Reposição' : 'Presente'}</Selo>
            {slot.ativo === false && <Selo cor="var(--color-state-danger)">Inativo</Selo>}
          </span>
          <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>{slot.quadra}</span>
        </span>
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: estado.cor }}>{ativos.length}/{slot.capacidade}</span>
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-light-muted)' }}>{estado.chave === 'lotado' ? 'lotado' : `${comVagas.vagas_restantes} livre${comVagas.vagas_restantes === 1 ? '' : 's'}`}</span>
        </span>
      </button>

      <div style={{ padding: '0 14px 12px 40px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>Professor:</span>
        <ProfessorEditavel slot={slot} podeEditar={podeEditar} />
      </div>

      {aberto && (
        <div style={{ borderTop: '1px solid var(--color-border-light-subtle)', padding: '10px 14px 12px', backgroundColor: 'var(--color-surface-light-overlay)' }}>
          <ListaAlunosSlot slot={slot} podeEditar={podeEditar} onCancelar={onCancelar} />
        </div>
      )}
    </div>
  )
}

// Um quadrado do mapa (modo Mapa): mesma cor de vagas do slot, clica e abre modal com os
// alunos. Só leitura de estadoVagas/rotuloNivel — nada de mutação aqui dentro.
function QuadradoSlot({ slot, onClick }) {
  const ativos = (slot.extras_agendamentos || []).filter(a => a.status === 'confirmado')
  const comVagas = { ...slot, vagas_restantes: slot.capacidade - ativos.length }
  const estado = estadoVagas(comVagas)
  const rotulo = rotuloNivel(slot)
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', textAlign: 'center',
      padding: '10px 4px', borderRadius: '10px', cursor: 'pointer', minHeight: '76px', boxSizing: 'border-box',
      border: `1.5px solid color-mix(in srgb, ${estado.cor} 45%, transparent)`,
      backgroundColor: `color-mix(in srgb, ${estado.cor} 12%, var(--color-surface-light-raised))`,
    }}>
      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-light-primary)' }}>{slot.horario_inicio?.slice(0, 5)}</span>
      {rotulo && <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotulo}</span>}
      <span style={{ fontSize: '11px', fontWeight: 800, color: estado.cor }}>{ativos.length}/{slot.capacidade}</span>
    </button>
  )
}

function AbaAgendas({ slots, podeEditar, onCancelar }) {
  const [tipo, setTipo] = useState('todos')
  const [modalidade, setModalidade] = useState('todas')
  const [dia, setDia] = useState('todos')
  const [modo, setModo] = useState('lista')
  const [slotAberto, setSlotAberto] = useState(null)

  const modalidades = useMemo(() => [...new Set(slots.map(s => s.modalidade))], [slots])
  const dias = useMemo(() => [...new Set(slots.map(s => s.data_aula))], [slots])
  const visiveis = useMemo(() => slots.filter(s =>
    (tipo === 'todos' || s.tipo === tipo) && (modalidade === 'todas' || s.modalidade === modalidade) && (dia === 'todos' || s.data_aula === dia)), [slots, tipo, modalidade, dia])

  const grupos = []
  for (const s of visiveis) {
    const g = grupos[grupos.length - 1]
    if (g && g.data === s.data_aula) g.itens.push(s); else grupos.push({ data: s.data_aula, itens: [s] })
  }

  // Reabre o mesmo slot com dado fresco depois de uma mutação (professor editado, alguém
  // cancelado etc.) — sem isso o modal ficaria mostrando a versão antiga até fechar e reabrir.
  const slotAtual = slotAberto ? slots.find(s => s.id === slotAberto) : null

  return (
    <div>
      {/* flexWrap (não scroll horizontal): no desktop não dá pra arrastar com o dedo, então os
          chips ficavam cortados fora da tela sem nenhum indício de que havia mais opções. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Chip ativo={tipo === 'todos'} onClick={() => setTipo('todos')}>Todas</Chip>
          <Chip ativo={tipo === 'reposicao'} onClick={() => setTipo('reposicao')}>Reposição de Tênis</Chip>
          <Chip ativo={tipo === 'presente'} onClick={() => setTipo('presente')}>Presente</Chip>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Chip ativo={modalidade === 'todas'} onClick={() => setModalidade('todas')}>Todas as modalidades</Chip>
          {modalidades.map(m => <Chip key={m} ativo={modalidade === m} onClick={() => setModalidade(m)}>{m}</Chip>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Chip ativo={dia === 'todos'} onClick={() => setDia('todos')}>Todos os dias</Chip>
          {dias.map(d => <Chip key={d} ativo={dia === d} onClick={() => setDia(d)}>{rotuloDiaCurto(d)}</Chip>)}
        </div>
        {/* Alternador de visualização — não mexe em filtro nem em dado, só troca como a mesma
            lista é desenhada. "Lista" continua sendo o padrão de sempre. */}
        <div style={{ display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '10px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', width: 'fit-content' }}>
          {[['lista', 'Lista', List], ['mapa', 'Mapa de quadrados', Grid3x3]].map(([k, r, Icone]) => (
            <button key={k} type="button" onClick={() => setModo(k)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              backgroundColor: modo === k ? 'var(--color-action-primary)' : 'transparent',
              color: modo === k ? 'var(--color-action-on-primary)' : 'var(--color-text-light-secondary)',
            }}><Icone size={13} />{r}</button>
          ))}
        </div>
      </div>

      {grupos.length === 0 && <div style={{ ...cartao, padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)' }}>Nenhum horário com esses filtros.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {grupos.map(g => {
          const inscritosDia = g.itens.reduce((n, s) => n + (s.extras_agendamentos || []).filter(a => a.status === 'confirmado').length, 0)
          return (
            <section key={g.data}>
              <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '9px 14px', borderRadius: '10px', marginBottom: '10px',
                backgroundColor: 'var(--color-brand-verde-court)',
              }}>
                <CalendarDays size={15} style={{ color: 'var(--color-brand-lima)', flexShrink: 0 }} />
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text-dark-primary)' }}>{rotuloDiaLongo(g.data)}</h2>
                <span style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)' }}>{g.itens.length} horários · {inscritosDia} agendamentos</span>
              </div>
              {modo === 'lista' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px', alignItems: 'start' }}>
                  {g.itens.map(s => <CardHorario key={s.id} slot={s} podeEditar={podeEditar} onCancelar={onCancelar} />)}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' }}>
                  {g.itens.map(s => <QuadradoSlot key={s.id} slot={s} onClick={() => setSlotAberto(s.id)} />)}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <Modal open={!!slotAtual} onClose={() => setSlotAberto(null)} title={slotAtual ? `${faixaHorario(slotAtual)} · ${slotAtual.modalidade}` : ''}>
        {slotAtual && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)' }}>{slotAtual.quadra}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>·</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>Professor:</span>
              <ProfessorEditavel slot={slotAtual} podeEditar={podeEditar} />
            </div>
            <ListaAlunosSlot slot={slotAtual} podeEditar={podeEditar} onCancelar={onCancelar} />
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Aba Inscritos
// ---------------------------------------------------------------------------------------------

function CardInscrito({ insc, podeEditar, onCancelar, palavrasAlunos, carregandoCadastro }) {
  const atualizar = useAtualizarConferenciaExtra()
  const [obs, setObs] = useState(insc.observacao || '')
  const ags = [...(insc.extras_agendamentos || [])].sort((a, b) =>
    `${a.extras_slots?.data_aula} ${a.extras_slots?.horario_inicio}`.localeCompare(`${b.extras_slots?.data_aula} ${b.extras_slots?.horario_inicio}`))

  // Só marca "fora do cadastro" depois que a lista de alunos terminou de carregar — antes
  // disso palavrasAlunos vem vazio e marcaria todo mundo à toa.
  const foraDoCadastro = !carregandoCadastro && !existeNoCadastro(insc.nome, palavrasAlunos)

  async function salvar(patch) {
    try { await atualizar.mutateAsync({ inscricaoId: insc.id, ...patch }) } catch (e) { toast.error(e.message, { style: toastStyle }) }
  }

  return (
    <div style={{ ...cartao, padding: '12px 14px', ...(foraDoCadastro ? { borderLeft: '3px solid var(--color-state-danger)' } : {}) }}>
      {foraDoCadastro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
          <Selo cor="var(--color-state-danger)"><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={11} />Não achei esse nome no cadastro do ProCoach</span></Selo>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginBottom: '6px' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>{insc.nome}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'center' }}>
            <LinkWhats telefone={insc.telefone} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>{resumoTurma(insc.turma_atual)}</span>
          </div>
        </div>
        <SeletorConferencia valor={insc.conferencia} disabled={!podeEditar} onChange={v => salvar({ conferencia: v })} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
        {ags.length === 0 && <span style={{ fontSize: '12px', color: 'var(--color-text-light-muted)' }}>Sem aulas agendadas (só cadastro).</span>}
        {ags.map(a => {
          const s = a.extras_slots
          if (!s) return null
          const cancelado = a.status === 'cancelado'
          const cor = a.tipo === 'reposicao' ? 'var(--color-action-primary)' : 'var(--color-brand-verde-card)'
          const cred = a.tipo === 'reposicao' && usaCreditoIndividualEmGrupo(insc.turma_atual || [], s)
          return (
            <span key={a.id} style={{
              display: 'inline-flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', padding: '5px 9px', borderRadius: '8px', maxWidth: '100%', boxSizing: 'border-box',
              border: `1px solid color-mix(in srgb, ${cor} 35%, transparent)`, backgroundColor: `color-mix(in srgb, ${cor} 8%, transparent)`,
              textDecoration: cancelado ? 'line-through' : 'none', opacity: cancelado ? 0.55 : 1,
            }}>
              <span style={{ display: 'flex', flexShrink: 0, marginTop: '2px' }}>
                {a.tipo === 'reposicao' ? <RotateCcw size={12} style={{ color: cor }} /> : <Gift size={12} style={{ color: cor }} />}
              </span>
              <span style={{ minWidth: 0, lineHeight: 1.4 }}>
                <strong>{a.modalidade}</strong> {rotuloDiaCurto(s.data_aula)} {faixaHorario(s)}
                {s.professor && <span style={{ color: 'var(--color-text-light-secondary)' }}> · {nomeProfessor(s.professor)}</span>}
                {cred && !cancelado && <span title="Usa crédito de aula individual em aula em grupo" style={{ color: 'var(--color-state-warning)', fontWeight: 800 }}> · crédito individual</span>}
              </span>
              {podeEditar && !cancelado && (
                <button type="button" aria-label="Cancelar agendamento" onClick={() => onCancelar({ agendamentoId: a.id, nome: insc.nome, descricao: `${a.modalidade} · ${rotuloDiaCurto(s.data_aula)} ${faixaHorario(s)}` })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)', display: 'flex', padding: 0, flexShrink: 0, marginTop: '2px' }}><X size={13} /></button>
              )}
            </span>
          )
        })}
      </div>

      <input value={obs} disabled={!podeEditar} onChange={e => setObs(e.target.value)}
        onBlur={() => { if ((obs || '').trim() !== (insc.observacao || '')) salvar({ observacao: obs }) }}
        placeholder="Observação da conferência (ex.: aluno ativo, já tinha crédito...)"
        style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)' }} />
    </div>
  )
}

function AbaInscritos({ inscritos, podeEditar, onCancelar, nomesAlunos, carregandoCadastro }) {
  const [busca, setBusca] = useState('')
  const [conf, setConf] = useState('todos')
  const [soForaCadastro, setSoForaCadastro] = useState(false)

  // Conjunto de palavras de cada aluno ativo, pra comparar contra o nome digitado no link
  // (ver existeNoCadastro). Recalcula só quando a lista de alunos muda, não a cada tecla.
  const palavrasAlunos = useMemo(() => nomesAlunos.map(n => new Set(normalizarNome(n).split(' ').filter(Boolean))), [nomesAlunos])

  const foraDoCadastroIds = useMemo(() => {
    if (carregandoCadastro) return new Set()
    return new Set(inscritos.filter(i => !existeNoCadastro(i.nome, palavrasAlunos)).map(i => i.id))
  }, [inscritos, palavrasAlunos, carregandoCadastro])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const digitos = q.replace(/\D/g, '')
    return inscritos.filter(i =>
      (conf === 'todos' || i.conferencia === conf) &&
      (!soForaCadastro || foraDoCadastroIds.has(i.id)) &&
      (!q || i.nome.toLowerCase().includes(q) || (digitos && !/^0+$/.test(digitos) && (i.telefone || '').includes(digitos))))
  }, [inscritos, busca, conf, soForaCadastro, foraDoCadastroIds])

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light-muted)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: '14px', padding: '10px 12px 10px 34px', borderRadius: '10px', border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Chip ativo={conf === 'todos'} onClick={() => setConf('todos')}>Todos ({inscritos.length})</Chip>
          {Object.entries(CONFERENCIA).map(([k, v]) => (
            <Chip key={k} ativo={conf === k} onClick={() => setConf(k)}>{v.rotulo} ({inscritos.filter(i => i.conferencia === k).length})</Chip>
          ))}
        </div>
        {!carregandoCadastro && (
          <button type="button" onClick={() => setSoForaCadastro(v => !v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content', padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${soForaCadastro ? 'var(--color-state-danger)' : 'var(--color-border-light)'}`,
            backgroundColor: soForaCadastro ? 'var(--color-state-danger)' : 'var(--color-surface-light-raised)',
            color: soForaCadastro ? 'white' : 'var(--color-state-danger)',
          }}><AlertTriangle size={13} />Só fora do cadastro ({foraDoCadastroIds.size})</button>
        )}
      </div>

      {lista.length === 0 && (
        <div style={{ ...cartao, padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)' }}>
          {inscritos.length === 0 ? 'Ainda não há inscrições pelo link.' : 'Nenhuma inscrição com esses filtros.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {lista.map(i => <CardInscrito key={i.id} insc={i} podeEditar={podeEditar} onCancelar={onCancelar} palavrasAlunos={palavrasAlunos} carregandoCadastro={carregandoCadastro} />)}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------------------------

export function ExtraReposicaoPage() {
  const { podeEditarCadastros } = usePermissions()
  const { data: slots, isLoading: carregandoAgenda, isError: erroAgenda } = useExtrasAgenda()
  const { data: inscritos, isLoading: carregandoInscritos } = useExtrasInscritos()
  const { data: nomesAlunos, isLoading: carregandoCadastro } = useNomesAlunosAtivos()
  const cancelar = useCancelarAgendamentoExtra()
  const [aba, setAba] = useState('agendas')
  const [paraCancelar, setParaCancelar] = useState(null)

  const resumo = useMemo(() => {
    const conf = (slots || []).flatMap(s => (s.extras_agendamentos || []).filter(a => a.status === 'confirmado'))
    return {
      pessoas: (inscritos || []).length,
      reposicoes: conf.filter(a => a.tipo === 'reposicao').length,
      presentes: conf.filter(a => a.tipo === 'presente').length,
      pendentes: (inscritos || []).filter(i => i.conferencia === 'pendente').length,
    }
  }, [slots, inscritos])

  async function copiarLink() {
    try { await navigator.clipboard.writeText(LINK_PUBLICO); toast.success('Link copiado', { style: toastStyle }) }
    catch { toast.error('Não foi possível copiar. Link: ' + LINK_PUBLICO, { style: toastStyle }) }
  }

  async function confirmarCancelamento() {
    try {
      await cancelar.mutateAsync({ agendamentoId: paraCancelar.agendamentoId })
      toast.success('Agendamento cancelado, vaga liberada', { style: toastStyle })
      setParaCancelar(null)
    } catch (e) { toast.error(e.message, { style: toastStyle }) }
  }

  const stat = (rotulo, valor, cor) => (
    <div style={{ ...cartao, padding: '10px 12px', flex: '1 1 150px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: cor || 'var(--color-text-light-primary)', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)', marginTop: '2px' }}>{rotulo}</div>
    </div>
  )

  return (
    <div className="fade-in" style={{ paddingBottom: '24px', color: 'var(--color-text-light-primary)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', margin: '4px 0 14px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, margin: 0, color: 'var(--color-text-light-primary)' }}>Extra Reposição</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', margin: '4px 0 0', maxWidth: '620px', lineHeight: 1.5 }}>
            Aulas extras da chuva (reposição de Tênis e aulas de presente), com professor, vagas e quem agendou pelo link.
            Fica separada da grade oficial de aulas.
          </p>
        </div>
        <button type="button" onClick={copiarLink} style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 13px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
        }}>
          <Copy size={14} /> Copiar link do agendamento
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {stat('pessoas inscritas', resumo.pessoas)}
        {stat('reposições agendadas', resumo.reposicoes, 'var(--color-action-primary)')}
        {stat('aulas de presente', resumo.presentes, 'var(--color-brand-verde-card)')}
        {stat('a conferir', resumo.pendentes, resumo.pendentes ? 'var(--color-state-warning)' : undefined)}
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border-light)', marginBottom: '16px' }}>
        {[['agendas', 'Agendas'], ['inscritos', `Inscritos (${resumo.pessoas})`]].map(([k, r]) => (
          <button key={k} type="button" onClick={() => setAba(k)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, marginBottom: '-1px',
            color: aba === k ? 'var(--color-action-primary)' : 'var(--color-text-light-muted)',
            borderBottom: `2px solid ${aba === k ? 'var(--color-action-primary)' : 'transparent'}`,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>{k === 'inscritos' && <Users size={15} />}{r}</button>
        ))}
      </div>

      {(carregandoAgenda || carregandoInscritos) && <Loading />}
      {erroAgenda && <div style={{ ...cartao, padding: '16px', fontSize: '13px', color: 'var(--color-state-danger)' }}>Não foi possível carregar. Confira se o SQL das aulas extras foi aplicado no Supabase.</div>}

      {slots && aba === 'agendas' && <AbaAgendas slots={slots} podeEditar={podeEditarCadastros} onCancelar={setParaCancelar} />}
      {inscritos && aba === 'inscritos' && (
        <AbaInscritos inscritos={inscritos} podeEditar={podeEditarCadastros} onCancelar={setParaCancelar}
          nomesAlunos={nomesAlunos || []} carregandoCadastro={carregandoCadastro} />
      )}

      <Modal open={!!paraCancelar} onClose={() => setParaCancelar(null)} title="Cancelar agendamento" size="sm">
        {paraCancelar && (
          <div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Cancelar <strong style={{ color: 'var(--text-primary)' }}>{paraCancelar.descricao}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{paraCancelar.nome}</strong>?
              A vaga volta a ficar disponível no link na hora.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setParaCancelar(null)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Manter</button>
              <button type="button" onClick={confirmarCancelamento} disabled={cancelar.isPending} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--color-state-danger)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Check size={15} /> {cancelar.isPending ? 'Cancelando...' : 'Sim, cancelar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
