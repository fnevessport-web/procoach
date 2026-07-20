import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

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

function useInscricoes(eventoId) {
  return useQuery({
    queryKey: ['evento_inscricoes', eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evento_inscricoes').select('*')
        .eq('evento_id', eventoId).order('criado_em', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!eventoId,
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

function LinhaInscricao({ inscricao, dataEvento }) {
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
        </div>
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
      </div>
    </div>
  )
}

function CardEvento({ evento }) {
  const [aberto, setAberto] = useState(false)
  const { data: inscricoes } = useInscricoes(aberto ? evento.id : null)
  const confirmados = inscricoes?.filter(i => i.status === 'confirmado') || []
  const espera = inscricoes?.filter(i => i.status === 'lista_espera') || []
  const link = `${window.location.origin}/eventos/${evento.slug}`

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
            {aberto ? confirmados.length : '...'} / {evento.capacidade_maxima} vagas
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
          ) : inscricoes.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#555', padding: '8px 0' }}>Nenhuma inscrição ainda.</div>
          ) : (
            <>
              {confirmados.map(i => <LinhaInscricao key={i.id} inscricao={i} dataEvento={evento.data_evento} />)}
              {espera.map(i => <LinhaInscricao key={i.id} inscricao={i} dataEvento={evento.data_evento} />)}
            </>
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
