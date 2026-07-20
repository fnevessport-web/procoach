import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  backgroundColor: '#111', border: '1px solid #2a2a2a', color: '#F0F2F5',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

const labelStyle = { fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '600' }

const FORM_VAZIO = { nome_crianca: '', data_nascimento: '', nome_responsavel: '', whatsapp_responsavel: '' }

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarHora(horaStr) {
  return horaStr ? horaStr.slice(0, 5) : ''
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

export function EventoInscricaoPage() {
  const { slug } = useParams()
  const [evento, setEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(FORM_VAZIO)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // 'confirmado' | 'lista_espera' | null
  const [mostrarPromptEspera, setMostrarPromptEspera] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('eventos').select('*')
        .eq('slug', slug).eq('ativo', true).maybeSingle()
      setEvento(data || null)
      setLoading(false)
    }
    carregar()
  }, [slug])

  function validar() {
    if (!form.nome_crianca.trim()) return 'Informe o nome completo da criança.'
    if (!form.data_nascimento) return 'Informe a data de nascimento.'
    if (!form.nome_responsavel.trim()) return 'Informe o nome do responsável.'
    if (!form.whatsapp_responsavel.trim()) return 'Informe o WhatsApp do responsável.'
    if (evento.idade_min != null && evento.idade_max != null) {
      const idade = calcularIdade(form.data_nascimento, evento.data_evento)
      if (idade < evento.idade_min || idade > evento.idade_max) {
        return `Este evento é para crianças de ${evento.idade_min} a ${evento.idade_max} anos. A idade calculada foi ${idade} anos.`
      }
    }
    return ''
  }

  async function inscrever(aceitarEspera) {
    const { data, error } = await supabase.rpc('inscrever_evento', {
      p_evento_id: evento.id,
      p_nome_crianca: form.nome_crianca.trim(),
      p_data_nascimento: form.data_nascimento,
      p_nome_responsavel: form.nome_responsavel.trim(),
      p_whatsapp_responsavel: form.whatsapp_responsavel.trim(),
      p_aceitar_espera: aceitarEspera,
    })
    if (error) throw error
    return data?.[0]?.status
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const msgErro = validar()
    if (msgErro) { setErro(msgErro); return }
    setErro('')
    setEnviando(true)
    try {
      const status = await inscrever(false)
      if (status === 'esgotado') {
        setMostrarPromptEspera(true)
      } else {
        setResultado(status)
      }
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleConfirmarListaEspera() {
    setEnviando(true)
    try {
      const status = await inscrever(true)
      setResultado(status)
      setMostrarPromptEspera(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontSize: '14px' }}>Carregando...</div>
    </div>
  )

  if (!evento) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
        <div style={{ color: '#F0F2F5', fontSize: '16px', fontWeight: '600' }}>Link inválido</div>
        <div style={{ color: '#555', fontSize: '13px', marginTop: '8px' }}>Este evento não existe ou as inscrições foram encerradas.</div>
      </div>
    </div>
  )

  if (resultado === 'confirmado') return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ color: '#F0F2F5', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Inscrição confirmada!</div>
        <div style={{ color: '#888', fontSize: '13px', lineHeight: '1.6' }}>
          {form.nome_crianca} está inscrito(a) na {evento.nome}. Nos próximos dias vamos organizar os grupos e avisaremos por WhatsApp o horário exato do seu filho(a).
        </div>
      </div>
    </div>
  )

  if (resultado === 'lista_espera') return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <div style={{ color: '#F0F2F5', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Você está na lista de espera!</div>
        <div style={{ color: '#888', fontSize: '13px', lineHeight: '1.6' }}>
          {form.nome_crianca} entrou na lista de espera da {evento.nome}. Se abrirmos mais horários, avisaremos {form.nome_responsavel} por WhatsApp.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100vh', backgroundColor: '#0f0f0f', padding: '20px 16px', boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '20px', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ▶ PRO COACH
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', marginBottom: '6px' }}>🏆 {evento.nome}</div>
          <div style={{ fontSize: '13px', color: '#fcc825', fontWeight: '600' }}>
            {formatarData(evento.data_evento)} · das {formatarHora(evento.hora_inicio)} às {formatarHora(evento.hora_fim)}
          </div>
        </div>

        <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #2a2a2a', marginBottom: '14px', fontSize: '13px', color: '#ccc', lineHeight: '1.7' }}>
          O evento acontece das {formatarHora(evento.hora_inicio)} às {formatarHora(evento.hora_fim)}. Nos dias que antecedem o evento, vamos dividir as crianças inscritas em grupos — um grupo por horário — e avisaremos cada responsável, por WhatsApp, em qual horário o seu filho(a) deve comparecer.
        </div>

        <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #2a2a2a', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#F0F2F5', marginBottom: '8px' }}>Sobre a turma Kids Competitivo</div>
          <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.7' }}>
            O Kids Competitivo é uma turma específica para um treinamento mais focado em formação desportiva. Por isso, as crianças que entram nesse grupo já precisam ter um nível de jogo consolidado.
          </div>
        </div>

        <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.3)', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825', marginBottom: '6px' }}>⚠️ Esta turma não é indicada para iniciantes</div>
          <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.6' }}>
            Crianças iniciantes, que ainda não jogam tênis, devem se matricular nas aulas regulares que temos durante a semana, para aprimorar a técnica — e, quem sabe, no futuro, fazer parte dessa turma competitiva.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={labelStyle}>Nome completo da criança *</div>
            <input style={inputStyle} value={form.nome_crianca} onChange={e => setForm(f => ({ ...f, nome_crianca: e.target.value }))} placeholder="Nome completo" />
          </div>
          <div>
            <div style={labelStyle}>Data de nascimento *</div>
            <input type="date" style={inputStyle} value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
          </div>
          <div>
            <div style={labelStyle}>Nome do responsável *</div>
            <input style={inputStyle} value={form.nome_responsavel} onChange={e => setForm(f => ({ ...f, nome_responsavel: e.target.value }))} placeholder="Nome completo" />
          </div>
          <div>
            <div style={labelStyle}>WhatsApp do responsável *</div>
            <input style={inputStyle} value={form.whatsapp_responsavel} onChange={e => setForm(f => ({ ...f, whatsapp_responsavel: e.target.value }))} placeholder="(11) 99999-9999" />
          </div>

          {erro && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '12px' }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '15px', fontWeight: '700',
            cursor: enviando ? 'not-allowed' : 'pointer', marginTop: '4px', marginBottom: '32px',
          }}>
            {enviando ? 'Enviando...' : '✅ Inscrever'}
          </button>
        </form>
      </div>

      {mostrarPromptEspera && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}>
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(252,200,37,0.3)', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', textAlign: 'center' }}>⏳</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5', marginBottom: '8px', textAlign: 'center' }}>As vagas esgotaram!</div>
            <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.6', marginBottom: '20px', textAlign: 'center' }}>
              As 24 vagas da {evento.nome} já foram preenchidas. Podemos colocar {form.nome_crianca || 'seu filho(a)'} na lista de espera — se abrirmos mais horários, avisaremos vocês por WhatsApp.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setMostrarPromptEspera(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleConfirmarListaEspera} disabled={enviando} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '700', cursor: enviando ? 'not-allowed' : 'pointer' }}>
                {enviando ? 'Enviando...' : 'Entrar na lista de espera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
