import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, ChevronDown, ChevronUp, Trash2, UserPlus, Trophy, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { exportarInscricoesEventoPDF } from '../../lib/eventoPdf'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-light-primary)',
  fontSize: '12px', outline: 'none', boxSizing: 'border-box',
}

const FORM_VAZIO = { nome_crianca: '', data_nascimento: '', nome_responsavel: '', whatsapp_responsavel: '', status: 'confirmado', slot_id: '' }

// Mesmas chaves do checklist "disponibilidade" preenchido no formulário público
// (EventoInscricaoPage.jsx) — só pra rotular o array salvo em disponibilidade_turmas.
const LABEL_DISPONIBILIDADE = {
  turma1: 'Turma 1 (Seg/Qua 17h)', turma2: 'Turma 2 (Seg/Qua 18h)',
  turma3: 'Turma 3 (Ter/Qui 17h)', turma4: 'Turma 4 (Ter/Qui 18h)',
  nenhuma: 'Nenhuma opção',
}

function useEventos() {
  return useQuery({
    queryKey: ['eventos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eventos').select('*').order('data_evento', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

function useSlots(eventoId) {
  return useQuery({
    queryKey: ['evento_slots', eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evento_slots').select('*')
        .eq('evento_id', eventoId).order('ordem', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!eventoId,
  })
}

function useInscricoes(eventoId) {
  return useQuery({
    queryKey: ['evento_inscricoes', eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evento_inscricoes').select('*, evento_slots(horario, quadra)')
        .eq('evento_id', eventoId).order('criado_em', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!eventoId,
  })
}

function useExcluirInscricao(eventoId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('evento_inscricoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evento_inscricoes', eventoId] }),
  })
}

function useIncluirInscricao(eventoId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados) => {
      const { error } = await supabase.from('evento_inscricoes').insert({ ...dados, evento_id: eventoId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evento_inscricoes', eventoId] }),
  })
}

function calcularIdade(dataNascimento, dataReferencia) {
  const nasc = new Date(dataNascimento + 'T12:00:00')
  const ref = new Date(dataReferencia + 'T12:00:00')
  let idade = ref.getFullYear() - nasc.getFullYear()
  const aindaNaoFezAniversario = (ref.getMonth() < nasc.getMonth()) ||
    (ref.getMonth() === nasc.getMonth() && ref.getDate() < nasc.getDate())
  if (aindaNaoFezAniversario) idade--
  return idade
}

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function LinkCopiavel({ link }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button onClick={copiar} style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px',
      border: '1px solid rgba(165,76,46,0.3)', background: 'rgba(165,76,46,0.08)',
      color: 'var(--color-action-primary)', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
    }}>
      {copiado ? <Check size={13} /> : <Copy size={13} />}
      {copiado ? 'Copiado!' : 'Copiar link'}
    </button>
  )
}

function whatsappLink(numero) {
  const digitos = (numero || '').replace(/\D/g, '')
  const comDDI = digitos.startsWith('55') ? digitos : `55${digitos}`
  return `https://wa.me/${comDDI}`
}

function LinhaInscricao({ inscricao, dataEvento, onExcluir, excluindo }) {
  const [confirmando, setConfirmando] = useState(false)
  const idade = calcularIdade(inscricao.data_nascimento, dataEvento)
  const espera = inscricao.status === 'lista_espera'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-light-overlay)',
      border: `1px solid ${espera ? 'rgba(165,76,46,0.25)' : 'var(--color-border-light)'}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', fontWeight: '600' }}>
          {inscricao.nome_crianca} <span style={{ color: 'var(--color-text-light-secondary)', fontWeight: '400' }}>· {idade} anos</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)' }}>
          Responsável: {inscricao.nome_responsavel}
          {inscricao.evento_slots && ` · ${inscricao.evento_slots.horario?.slice(0, 5)} ${inscricao.evento_slots.quadra}`}
        </div>
        {inscricao.disponibilidade_turmas?.length > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
            Disponibilidade: {inscricao.disponibilidade_turmas.map(v => LABEL_DISPONIBILIDADE[v] || v).join(', ')}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {espera && (
          <span style={{ fontSize: '10px', color: 'var(--color-action-primary)', background: 'rgba(165,76,46,0.1)', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
            LISTA DE ESPERA
          </span>
        )}
        <a href={whatsappLink(inscricao.whatsapp_responsavel)} target="_blank" rel="noreferrer" style={{
          fontSize: '11px', color: 'var(--color-state-success)', textDecoration: 'none', fontWeight: '600',
          border: '1px solid rgba(75,139,106,0.3)', padding: '5px 10px', borderRadius: '6px',
        }}>
          WhatsApp
        </a>
        {confirmando ? (
          <>
            <button onClick={() => { onExcluir(inscricao.id); setConfirmando(false) }} disabled={excluindo} style={{
              fontSize: '11px', color: 'white', background: 'var(--color-state-danger)', border: 'none',
              padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
            }}>
              Confirmar
            </button>
            <button onClick={() => setConfirmando(false)} style={{
              fontSize: '11px', color: 'var(--color-text-light-secondary)', background: 'none', border: '1px solid var(--color-border-light)',
              padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmando(true)} title="Excluir inscrição" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(180,71,47,0.3)',
            background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer',
          }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function FormIncluirInscricao({ eventoId, inscricoes, onFechar }) {
  const [form, setForm] = useState(FORM_VAZIO)
  const { data: slots } = useSlots(eventoId)
  const incluir = useIncluirInscricao(eventoId)

  // Inclusão manual é INSERT direto (não passa pela RPC nem pelo lock de capacidade) — mostra
  // vagas restantes na própria opção pra reduzir o risco de estourar um slot de 4 vagas sem
  // perceber, já que aqui não há trava de banco, só aviso visual.
  const confirmadosPorSlot = {}
  ;(inscricoes || []).forEach(i => {
    if (i.status === 'confirmado') confirmadosPorSlot[i.slot_id] = (confirmadosPorSlot[i.slot_id] || 0) + 1
  })

  async function handleSalvar() {
    // Confirmado sempre precisa de um horário real; lista de espera pode ficar "geral" (sem
    // slot_id), já que o clube pode abrir horários além dos 6 atuais.
    if ((form.status === 'confirmado' && !form.slot_id) || !form.nome_crianca.trim() || !form.data_nascimento || !form.nome_responsavel.trim() || !form.whatsapp_responsavel.trim()) {
      return toast.error('Preencha todos os campos', { style: toastStyle })
    }
    try {
      await incluir.mutateAsync({
        slot_id: form.slot_id || null,
        nome_crianca: form.nome_crianca.trim(),
        data_nascimento: form.data_nascimento,
        nome_responsavel: form.nome_responsavel.trim(),
        whatsapp_responsavel: form.whatsapp_responsavel.trim(),
        status: form.status,
      })
      toast.success('Inscrição incluída!', { style: toastStyle })
      onFechar()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid rgba(165,76,46,0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <select value={form.slot_id} onChange={e => setForm(f => ({ ...f, slot_id: e.target.value }))} style={inputStyle}>
        <option value="">Sem horário (lista de espera geral)</option>
        {slots?.map(s => (
          <option key={s.id} value={s.id}>
            {s.horario?.slice(0, 5)} · {s.quadra} ({confirmadosPorSlot[s.id] || 0}/{s.capacidade} vagas)
          </option>
        ))}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <input placeholder="Nome da criança" style={inputStyle} value={form.nome_crianca} onChange={e => setForm(f => ({ ...f, nome_crianca: e.target.value }))} />
        <input type="date" style={inputStyle} value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
        <input placeholder="Nome do responsável" style={inputStyle} value={form.nome_responsavel} onChange={e => setForm(f => ({ ...f, nome_responsavel: e.target.value }))} />
        <input placeholder="WhatsApp do responsável" style={inputStyle} value={form.whatsapp_responsavel} onChange={e => setForm(f => ({ ...f, whatsapp_responsavel: e.target.value }))} />
      </div>
      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
        <option value="confirmado">Confirmado</option>
        <option value="lista_espera">Lista de espera</option>
      </select>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onFechar} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={handleSalvar} disabled={incluir.isPending} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
          {incluir.isPending ? 'Salvando...' : '✓ Incluir'}
        </button>
      </div>
    </div>
  )
}

function CardEvento({ evento }) {
  const [aberto, setAberto] = useState(false)
  const [incluindoNovo, setIncluindoNovo] = useState(false)
  const [exportando, setExportando] = useState(false)
  const { data: inscricoes } = useInscricoes(aberto ? evento.id : null)
  const { data: slots } = useSlots(aberto ? evento.id : null)
  const excluir = useExcluirInscricao(evento.id)
  const confirmados = inscricoes?.filter(i => i.status === 'confirmado') || []
  const espera = inscricoes?.filter(i => i.status === 'lista_espera') || []
  // Soma da capacidade dos slots em vez de evento.capacidade_maxima direto — evita duas fontes
  // de verdade divergirem se algum slot for editado depois de criado.
  const totalVagas = slots?.reduce((soma, s) => soma + s.capacidade, 0)
  const link = `${window.location.origin}/eventos/${evento.slug}`

  async function handleExcluir(id) {
    try {
      await excluir.mutateAsync(id)
      toast.success('Inscrição excluída.', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  async function handleExportarPDF() {
    setExportando(true)
    try {
      // Inscrições podem não ter carregado ainda se o card acabou de abrir — busca direto
      // em vez de depender só do estado do useInscricoes, pra não exportar lista vazia.
      const { data, error } = await supabase
        .from('evento_inscricoes').select('*, evento_slots(horario, quadra)')
        .eq('evento_id', evento.id).order('criado_em', { ascending: true })
      if (error) throw error
      await exportarInscricoesEventoPDF(evento, data || [])
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={{ borderRadius: '14px', backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
      <div style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setAberto(a => !a)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>
              <Trophy size={14} color="var(--color-action-primary)" style={{ flexShrink: 0 }} /> {evento.nome}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
              {formatarData(evento.data_evento)} · {evento.hora_inicio?.slice(0, 5)}–{evento.hora_fim?.slice(0, 5)}
              {evento.idade_min != null && ` · ${evento.idade_min}-${evento.idade_max} anos`}
            </div>
          </div>
          {aberto ? <ChevronUp size={16} color="var(--color-text-light-secondary)" /> : <ChevronDown size={16} color="var(--color-text-light-secondary)" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-action-primary)', fontWeight: '600' }}>
            {aberto ? confirmados.length : '...'} / {aberto ? (totalVagas ?? '...') : evento.capacidade_maxima} vagas
          </div>
          {aberto && espera.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>· {espera.length} na lista de espera</div>
          )}
          <div onClick={e => e.stopPropagation()}><LinkCopiavel link={link} /></div>
          <button onClick={e => { e.stopPropagation(); handleExportarPDF() }} disabled={exportando} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px',
            border: '1px solid var(--color-border-light)', background: 'none',
            color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
          }}>
            <FileDown size={13} />
            {exportando ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {aberto && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!inscricoes ? (
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', padding: '8px 0' }}>Carregando inscrições...</div>
          ) : (
            <>
              {inscricoes.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', padding: '8px 0' }}>Nenhuma inscrição ainda.</div>
              )}
              {confirmados.map(i => (
                <LinhaInscricao key={i.id} inscricao={i} dataEvento={evento.data_evento} onExcluir={handleExcluir} excluindo={excluir.isPending} />
              ))}
              {espera.map(i => (
                <LinhaInscricao key={i.id} inscricao={i} dataEvento={evento.data_evento} onExcluir={handleExcluir} excluindo={excluir.isPending} />
              ))}
            </>
          )}

          {incluindoNovo ? (
            <FormIncluirInscricao eventoId={evento.id} inscricoes={inscricoes} onFechar={() => setIncluindoNovo(false)} />
          ) : (
            <button onClick={() => setIncluindoNovo(true)} style={{
              marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px dashed var(--color-border-light)',
              background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <UserPlus size={13} /> Incluir inscrição manualmente
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function EventosPage() {
  const { data: eventos, isLoading } = useEventos()

  if (isLoading) return <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px' }}>Carregando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '4px' }}>
        Eventos com inscrição pública (seletivas, experimentais). Compartilhe o link com os pais — as inscrições e a lista de espera aparecem aqui em tempo real.
      </div>
      {eventos?.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)' }}>Nenhum evento cadastrado ainda.</div>
      )}
      {eventos?.map(evento => <CardEvento key={evento.id} evento={evento} />)}
    </div>
  )
}
