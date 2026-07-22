import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, ChevronDown, ChevronUp, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#F0F2F5',
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
      border: '1px solid rgba(252,200,37,0.3)', background: 'rgba(252,200,37,0.08)',
      color: '#fcc825', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
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
      padding: '10px 12px', borderRadius: '8px', backgroundColor: '#111',
      border: `1px solid ${espera ? 'rgba(252,200,37,0.25)' : '#2a2a2a'}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>
          {inscricao.nome_crianca} <span style={{ color: '#555', fontWeight: '400' }}>· {idade} anos</span>
        </div>
        <div style={{ fontSize: '11px', color: '#888' }}>
          Responsável: {inscricao.nome_responsavel}
          {inscricao.evento_slots && ` · ${inscricao.evento_slots.horario?.slice(0, 5)} ${inscricao.evento_slots.quadra}`}
        </div>
        {inscricao.disponibilidade_turmas?.length > 0 && (
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
            Disponibilidade: {inscricao.disponibilidade_turmas.map(v => LABEL_DISPONIBILIDADE[v] || v).join(', ')}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {espera && (
          <span style={{ fontSize: '10px', color: '#fcc825', background: 'rgba(252,200,37,0.1)', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
            LISTA DE ESPERA
          </span>
        )}
        <a href={whatsappLink(inscricao.whatsapp_responsavel)} target="_blank" rel="noreferrer" style={{
          fontSize: '11px', color: '#22c55e', textDecoration: 'none', fontWeight: '600',
          border: '1px solid rgba(34,197,94,0.3)', padding: '5px 10px', borderRadius: '6px',
        }}>
          WhatsApp
        </a>
        {confirmando ? (
          <>
            <button onClick={() => { onExcluir(inscricao.id); setConfirmando(false) }} disabled={excluindo} style={{
              fontSize: '11px', color: 'white', background: '#EF4444', border: 'none',
              padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
            }}>
              Confirmar
            </button>
            <button onClick={() => setConfirmando(false)} style={{
              fontSize: '11px', color: '#888', background: 'none', border: '1px solid #2a2a2a',
              padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmando(true)} title="Excluir inscrição" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
            background: 'none', color: '#EF4444', cursor: 'pointer',
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
    if (!form.slot_id || !form.nome_crianca.trim() || !form.data_nascimento || !form.nome_responsavel.trim() || !form.whatsapp_responsavel.trim()) {
      return toast.error('Preencha todos os campos', { style: toastStyle })
    }
    try {
      await incluir.mutateAsync({
        slot_id: form.slot_id,
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
    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#111', border: '1px solid rgba(252,200,37,0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <select value={form.slot_id} onChange={e => setForm(f => ({ ...f, slot_id: e.target.value }))} style={inputStyle}>
        <option value="">Escolha o horário...</option>
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
        <button onClick={onFechar} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={handleSalvar} disabled={incluir.isPending} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
          {incluir.isPending ? 'Salvando...' : '✓ Incluir'}
        </button>
      </div>
    </div>
  )
}

function CardEvento({ evento }) {
  const [aberto, setAberto] = useState(false)
  const [incluindoNovo, setIncluindoNovo] = useState(false)
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

  return (
    <div style={{ borderRadius: '14px', backgroundColor: '#161616', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
      <div style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setAberto(a => !a)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>🏆 {evento.nome}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
              {formatarData(evento.data_evento)} · {evento.hora_inicio?.slice(0, 5)}–{evento.hora_fim?.slice(0, 5)}
              {evento.idade_min != null && ` · ${evento.idade_min}-${evento.idade_max} anos`}
            </div>
          </div>
          {aberto ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: '#fcc825', fontWeight: '600' }}>
            {aberto ? confirmados.length : '...'} / {aberto ? (totalVagas ?? '...') : evento.capacidade_maxima} vagas
          </div>
          {aberto && espera.length > 0 && (
            <div style={{ fontSize: '12px', color: '#888' }}>· {espera.length} na lista de espera</div>
          )}
          <div onClick={e => e.stopPropagation()}><LinkCopiavel link={link} /></div>
        </div>
      </div>

      {aberto && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!inscricoes ? (
            <div style={{ fontSize: '12px', color: '#555', padding: '8px 0' }}>Carregando inscrições...</div>
          ) : (
            <>
              {inscricoes.length === 0 && (
                <div style={{ fontSize: '12px', color: '#555', padding: '8px 0' }}>Nenhuma inscrição ainda.</div>
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
              marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px dashed #2a2a2a',
              background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer',
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

  if (isLoading) return <div style={{ color: '#555', fontSize: '13px' }}>Carregando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
        Eventos com inscrição pública (seletivas, experimentais). Compartilhe o link com os pais — as inscrições e a lista de espera aparecem aqui em tempo real.
      </div>
      {eventos?.length === 0 && (
        <div style={{ fontSize: '13px', color: '#555' }}>Nenhum evento cadastrado ainda.</div>
      )}
      {eventos?.map(evento => <CardEvento key={evento.id} evento={evento} />)}
    </div>
  )
}
