import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronLeft, Send, MessageCirclePlus, MessageCircle } from 'lucide-react'
import { format, isToday } from 'date-fns'
import useAppStore from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'
import {
  useConversas, useMensagensDaConversa, useEnviarMensagem, useAbrirConversaDireta, useContatos,
} from '../../hooks/useMensagens'
import { Loading } from '../../components/ui/Loading'

function formatarHora(dataStr) {
  const d = new Date(dataStr)
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd/MM')
}

function ListaConversas({ onAbrirConversa, onNovaConversa }) {
  const { data: conversas = [], isLoading } = useConversas()
  const { podeVerInboxGeral } = usePermissions()

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 18px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Mensagens</h1>
          {podeVerInboxGeral && (
            <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>Inbox geral — todas as conversas</p>
          )}
        </div>
        <button onClick={onNovaConversa} style={{
          width: '36px', height: '36px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <MessageCirclePlus size={17} />
        </button>
      </div>

      {isLoading ? <Loading /> : conversas.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px', textAlign: 'center' }}>
          <MessageCircle size={40} color="#fcc825" style={{ opacity: 0.2, marginBottom: '14px' }} />
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px', fontWeight: '600' }}>Nenhuma conversa ainda</p>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Toque em + pra falar com alguém do time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {conversas.map(c => (
            <button key={c.id} onClick={() => onAbrirConversa(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '12px', border: '0.5px solid #252525', backgroundColor: '#1a1a1a',
              cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '700', color: 'white',
              }}>
                {c.titulo?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5' }}>{c.titulo}</div>
                <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.ultimaMensagem || 'Sem mensagens ainda'}
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#444', flexShrink: 0 }}>{formatarHora(c.ultimaData)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NovaConversa({ onFechar, onConversaCriada }) {
  const { data: contatos = [], isLoading } = useContatos()
  const abrirConversa = useAbrirConversaDireta()

  async function selecionar(contato) {
    const conversaId = await abrirConversa.mutateAsync(contato.user_id)
    onConversaCriada(conversaId)
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0 18px' }}>
        <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fcc825', padding: '4px' }}>
          <ChevronLeft size={22} />
        </button>
        <h1 style={{ fontSize: '17px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Nova conversa</h1>
      </div>

      {isLoading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {contatos.map(c => (
            <button key={c.user_id} disabled={abrirConversa.isPending} onClick={() => selecionar(c)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '12px', border: '0.5px solid #252525', backgroundColor: '#1a1a1a',
              cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '700', color: 'white',
              }}>
                {c.nome?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5' }}>{c.nome}</div>
                <div style={{ fontSize: '11px', color: '#666', textTransform: 'capitalize' }}>{c.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Thread({ conversaId, onVoltar }) {
  const { user } = useAppStore()
  const { data: mensagens = [], isLoading } = useMensagensDaConversa(conversaId)
  const enviar = useEnviarMensagem()
  const [texto, setTexto] = useState('')
  const fimRef = useRef(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  async function handleEnviar() {
    const valor = texto.trim()
    if (!valor) return
    setTexto('')
    await enviar.mutateAsync({ conversaId, texto: valor })
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0 12px', flexShrink: 0 }}>
        <button onClick={onVoltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fcc825', padding: '4px' }}>
          <ChevronLeft size={22} />
        </button>
        <h1 style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Conversa</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
        {isLoading ? <Loading /> : mensagens.map(m => {
          const minha = m.autor_id === user?.id
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: minha ? 'flex-end' : 'flex-start' }}>
              {!minha && <span style={{ fontSize: '10px', color: '#666', margin: '0 4px 2px' }}>{m.autorNome}</span>}
              <div style={{
                maxWidth: '75%', padding: '9px 12px', borderRadius: minha ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: minha ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                border: minha ? 'none' : '0.5px solid #252525',
                color: minha ? 'white' : '#F0F2F5', fontSize: '13px', lineHeight: '1.4',
                wordBreak: 'break-word',
              }}>
                {m.texto}
              </div>
              <span style={{ fontSize: '9px', color: '#444', margin: '2px 4px 0' }}>{formatarHora(m.criado_em)}</span>
            </div>
          )
        })}
        <div ref={fimRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', flexShrink: 0 }}>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleEnviar() }}
          placeholder="Escreva uma mensagem..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: '20px', backgroundColor: '#1a1a1a',
            border: '1px solid #252525', color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button onClick={handleEnviar} disabled={!texto.trim() || enviar.isPending} style={{
          width: '38px', height: '38px', borderRadius: '50%', border: 'none', flexShrink: 0,
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: texto.trim() ? 'pointer' : 'not-allowed', opacity: texto.trim() ? 1 : 0.5,
        }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

export function MensagensPage() {
  const location = useLocation()
  const [conversaAberta, setConversaAberta] = useState(() => location.state?.conversaId || null)
  const [novaConversa, setNovaConversa] = useState(false)

  if (conversaAberta) {
    return <Thread conversaId={conversaAberta} onVoltar={() => setConversaAberta(null)} />
  }
  if (novaConversa) {
    return (
      <NovaConversa
        onFechar={() => setNovaConversa(false)}
        onConversaCriada={id => { setNovaConversa(false); setConversaAberta(id) }}
      />
    )
  }
  return <ListaConversas onAbrirConversa={setConversaAberta} onNovaConversa={() => setNovaConversa(true)} />
}
