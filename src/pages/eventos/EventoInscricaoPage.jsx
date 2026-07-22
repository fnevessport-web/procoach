import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { mascararTelefoneBR, apenasDigitosTelefone } from '../../lib/telefone'
import { CORES_CLUBE, COR_VAGA, classificarVaga } from '../../constants/coresClube'

const C = CORES_CLUBE

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  backgroundColor: C.branco, border: `1px solid ${C.textoSuave}55`, color: C.tinta,
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

const labelStyle = { fontSize: '12px', color: C.textoSuave, marginBottom: '6px', fontWeight: '600' }

const cardStyle = {
  padding: '14px 16px', borderRadius: '12px',
  backgroundColor: C.branco, border: `1px solid ${C.textoSuave}33`,
}

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

// Fundo "papel timbrado" do clube (textura sutil sobre o creme) — recriado em CSS em vez de
// usar o PNG de referência (PAGINA_LINK.png) inteiro como imagem de fundo: aquele arquivo é um
// layout A4 fixo, quase todo em branco, que não se adapta a uma página web que rola e muda de
// altura conforme o formulário/estado.
function FundoClube({ children }) {
  return (
    // height + overflowY:auto (em vez de minHeight) porque html/body do app inteiro têm
    // overflow:hidden global (index.css) — sem um contêiner próprio de scroll aqui, a página
    // trava e nada abaixo da primeira tela fica clicável (mesmo truque da versão anterior
    // desta página, que usava exatamente isso).
    <div style={{
      position: 'relative', height: '100vh', backgroundColor: C.creme,
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      {/* position:fixed (não absolute) — fica preso ao viewport em vez de precisar acompanhar
          a altura do conteúdo rolável, que muda conforme o formulário/estado. */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.35, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'url(/images/bg-texture.png)', backgroundRepeat: 'repeat', backgroundSize: '420px',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

function Cabecalho() {
  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '14px' }}>
        {/* logobeyond_preto.png tem uma margem transparente enorme (o texto "BEYOND" ocupa só
            ~19% da altura do canvas, contra ~68% no logo da Procópio) — só definir a mesma
            `height` nos dois deixa o Beyond visualmente minúsculo. Em vez de esticar o height
            (o que deixaria o cabeçalho gigante pra compensar), recorto por CSS: renderiza a
            imagem bem maior e esconde o excesso com overflow:hidden num contêiner do tamanho
            visível desejado, centralizado — medido pixel a pixel direto no PNG. */}
        <div style={{ height: '35px', width: '130px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          <img src="/images/logobeyond_preto.png" alt="Beyond The Club" style={{
            position: 'absolute', top: '50%', left: '50%', height: '135px', width: '135px',
            transform: 'translate(-50%, -50%)',
          }} />
        </div>
        <div style={{ width: '1px', height: '30px', backgroundColor: `${C.textoSuave}55` }} />
        <img src="/images/logoprocopio_preto.png" alt="Procópio" style={{ height: '38px', objectFit: 'contain' }} />
      </div>
      {/* Tarja com espaçamento pequeno entre os segmentos, igual ao papel timbrado de
          referência (PAGINA_LINK.png) — cada cor é um bloco separado, não uma barra contínua. */}
      <div style={{ display: 'flex', gap: '5px' }}>
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: C.salvia }} />
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: C.laranja }} />
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: C.vinho }} />
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: C.marinho }} />
      </div>
    </div>
  )
}

function TelaCentralizada({ children }) {
  return (
    <FundoClube>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {children}
      </div>
    </FundoClube>
  )
}

// Todos os cards têm a mesma estrutura (fundo/borda), lotado ou não — só a cor da bolinha e do
// horário mudam com a disponibilidade. Antes o card inteiro ficava tingido na cor do status, e
// como salvia (bastante vaga) é um tom claro, isso deixava o card com cara de "sem vaga"/apagado
// mesmo tendo vaga de sobra — pedido do cliente pra tirar essa impressão.
function CardSlot({ slot, selecionado, onSelecionar }) {
  const estado = classificarVaga(slot.confirmados, slot.capacidade)
  const cor = COR_VAGA[estado]
  const lotado = estado === 'lotado'
  return (
    <button onClick={() => onSelecionar(slot)} style={{
      textAlign: 'left', cursor: 'pointer', borderRadius: '12px', padding: '12px 14px',
      backgroundColor: selecionado ? C.marinho : C.branco,
      border: selecionado ? `2px solid ${C.tinta}` : `1px solid ${C.textoSuave}33`,
      boxShadow: selecionado ? `0 0 0 3px ${C.marinho}33` : 'none',
      display: 'flex', flexDirection: 'column', gap: '4px', boxSizing: 'border-box',
      transition: 'all 0.12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '15px', fontWeight: '700', color: selecionado ? C.branco : cor }}>{formatarHora(slot.horario)}</span>
        {selecionado ? (
          <span style={{ fontSize: '13px', color: C.branco }}>✓</span>
        ) : (
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cor, flexShrink: 0 }} />
        )}
      </div>
      <span style={{ fontSize: '12px', color: selecionado ? C.branco : C.textoSuave }}>{slot.quadra}</span>
      <span style={{ fontSize: '11px', fontWeight: '700', color: selecionado ? C.branco : cor }}>
        {lotado ? 'Lotado' : `${slot.vagas_restantes} de ${slot.capacidade} vagas`}
      </span>
    </button>
  )
}

function Modal({ children, onFechar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,24,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}>
      <div style={{ backgroundColor: C.branco, border: `1px solid ${C.textoSuave}33`, borderRadius: '16px', padding: '22px', maxWidth: '420px', width: '100%', boxSizing: 'border-box', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: C.textoSuave, fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EventoInscricaoPage() {
  const { slug } = useParams()
  const [form, setForm] = useState(FORM_VAZIO)
  const [slotSelecionado, setSlotSelecionado] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [etapaModal, setEtapaModal] = useState('form') // 'form' | 'confirmar' | 'esgotado'
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // 'confirmado' | 'lista_espera' | null

  const { data: evento, isLoading: carregandoEvento } = useQuery({
    queryKey: ['evento-publico', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('eventos').select('*')
        .eq('slug', slug).eq('ativo', true).maybeSingle()
      return data || null
    },
  })

  // Contagem por slot com atualização a cada 15s — dá uma leitura "quase tempo real" das vagas
  // sem precisar de Supabase Realtime (baixo tráfego de um formulário sazonal não compensa a
  // complexidade extra). A decisão de vaga real sempre é do servidor (lock na RPC), então uma
  // tela com até 15s de atraso não gera overselling, só uma janela pequena de estimativa.
  const { data: slots } = useQuery({
    queryKey: ['vagas-evento', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vagas_evento', { p_slug: slug })
      if (error) throw error
      return data || []
    },
    enabled: !!evento,
    refetchInterval: 15000,
  })

  function abrirModal() {
    if (!slotSelecionado) return
    setErro('')
    setEtapaModal('form')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro('')
  }

  function validarForm() {
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

  function handleContinuar(e) {
    e.preventDefault()
    const msgErro = validarForm()
    if (msgErro) { setErro(msgErro); return }
    setErro('')
    setEtapaModal('confirmar')
  }

  async function inscrever(aceitarEspera) {
    const { data, error } = await supabase.rpc('inscrever_evento', {
      p_slot_id: slotSelecionado.slot_id,
      p_nome_crianca: form.nome_crianca.trim(),
      p_data_nascimento: form.data_nascimento,
      p_nome_responsavel: form.nome_responsavel.trim(),
      p_whatsapp_responsavel: form.whatsapp_responsavel.trim(),
      p_aceitar_espera: aceitarEspera,
    })
    if (error) throw error
    return data?.[0]?.status
  }

  async function handleConfirmar() {
    setErro('')
    setEnviando(true)
    try {
      const status = await inscrever(false)
      if (status === 'esgotado') {
        setEtapaModal('esgotado')
      } else {
        setResultado(status)
        setModalAberto(false)
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
      setModalAberto(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (carregandoEvento) return (
    <TelaCentralizada>
      <div style={{ color: C.textoSuave, fontSize: '14px' }}>Carregando...</div>
    </TelaCentralizada>
  )

  if (!evento) return (
    <TelaCentralizada>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
        <div style={{ color: C.tinta, fontSize: '16px', fontWeight: '700' }}>Link inválido</div>
        <div style={{ color: C.textoSuave, fontSize: '13px', marginTop: '8px' }}>Este evento não existe ou as inscrições foram encerradas.</div>
      </div>
    </TelaCentralizada>
  )

  if (resultado === 'confirmado') return (
    <TelaCentralizada>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ color: C.tinta, fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Inscrição confirmada!</div>
        <div style={{ color: C.textoSuave, fontSize: '13px', lineHeight: '1.6' }}>
          {form.nome_crianca} está inscrito(a) na {evento.nome}, no horário das {formatarHora(slotSelecionado?.horario)} · {slotSelecionado?.quadra}. Qualquer novidade, avisaremos {form.nome_responsavel} por WhatsApp.
        </div>
      </div>
    </TelaCentralizada>
  )

  if (resultado === 'lista_espera') return (
    <TelaCentralizada>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <div style={{ color: C.tinta, fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Você está na lista de espera!</div>
        <div style={{ color: C.textoSuave, fontSize: '13px', lineHeight: '1.6' }}>
          {form.nome_crianca} entrou na lista de espera do horário das {formatarHora(slotSelecionado?.horario)} · {slotSelecionado?.quadra}. Se abrir vaga, avisaremos {form.nome_responsavel} por WhatsApp.
        </div>
      </div>
    </TelaCentralizada>
  )

  return (
    <FundoClube>
      <div style={{ minHeight: '100vh', padding: '24px 16px 40px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <Cabecalho />

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: C.tinta, marginBottom: '6px' }}>{evento.nome}</div>
            <div style={{ fontSize: '13px', color: C.vinho, fontWeight: '600' }}>
              {formatarData(evento.data_evento)} · das {formatarHora(evento.hora_inicio)} às {formatarHora(evento.hora_fim)}
            </div>
          </div>

          <div style={{ ...cardStyle, marginBottom: '14px', fontSize: '13px', color: C.tinta, lineHeight: '1.7' }}>
            Escolha abaixo o dia e horário em que seu filho(a) vai participar. As vagas são limitadas por horário e quadra — se o horário que você quer já estiver lotado, você pode entrar na lista de espera.
          </div>

          <div style={{ ...cardStyle, marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: C.tinta, marginBottom: '8px' }}>Sobre a turma Kids Competitivo</div>
            <div style={{ fontSize: '13px', color: C.textoSuave, lineHeight: '1.7' }}>
              O Kids Competitivo é uma turma específica para um treinamento mais focado em formação desportiva. Por isso, as crianças que entram nesse grupo já precisam ter um nível de jogo consolidado.
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: `${C.laranja}18`, border: `1px solid ${C.laranja}66`, marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: C.laranja, marginBottom: '6px' }}>⚠️ Esta turma não é indicada para iniciantes</div>
            <div style={{ fontSize: '12px', color: C.tinta, lineHeight: '1.6' }}>
              Crianças iniciantes, que ainda não jogam tênis, devem se matricular nas aulas regulares que temos durante a semana, para aprimorar a técnica — e, quem sabe, no futuro, fazer parte dessa turma competitiva.
            </div>
          </div>

          <div>
            <div style={labelStyle}>Dia e horário *</div>
            {!slots ? (
              <div style={{ fontSize: '12px', color: C.textoSuave, padding: '8px 0' }}>Carregando horários...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {slots.map(slot => (
                  <CardSlot key={slot.slot_id} slot={slot} selecionado={slotSelecionado?.slot_id === slot.slot_id} onSelecionar={setSlotSelecionado} />
                ))}
              </div>
            )}
          </div>

          <button onClick={abrirModal} disabled={!slotSelecionado} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            backgroundColor: slotSelecionado ? C.marinho : `${C.textoSuave}33`,
            color: slotSelecionado ? C.branco : C.textoSuave, fontSize: '15px', fontWeight: '700',
            cursor: slotSelecionado ? 'pointer' : 'not-allowed', marginTop: '16px',
          }}>
            Prosseguir
          </button>
        </div>
      </div>

      {modalAberto && (
        <Modal onFechar={fecharModal}>
          {etapaModal === 'form' && (
            <form onSubmit={handleContinuar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: C.tinta, marginBottom: '2px' }}>Dados da inscrição</div>
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
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ ...inputStyle, width: 'auto', flexShrink: 0, color: C.textoSuave, textAlign: 'center' }}>+55</span>
                  <input style={{ ...inputStyle, flex: 1 }} inputMode="numeric" placeholder="(11) 99999-9999"
                    value={mascararTelefoneBR(form.whatsapp_responsavel)}
                    onChange={e => setForm(f => ({ ...f, whatsapp_responsavel: apenasDigitosTelefone(e.target.value) }))} />
                </div>
              </div>

              {erro && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: `${C.vinho}18`, border: `1px solid ${C.vinho}66`, color: C.vinho, fontSize: '12px' }}>
                  {erro}
                </div>
              )}

              <button type="submit" style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                backgroundColor: C.marinho, color: C.branco, fontSize: '15px', fontWeight: '700', cursor: 'pointer',
              }}>
                Continuar
              </button>
            </form>
          )}

          {etapaModal === 'confirmar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: C.tinta, marginBottom: '2px' }}>Confira o agendamento</div>
              <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: `${C.salvia}18`, border: `1px solid ${C.salvia}66`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '13px', color: C.tinta }}><strong>Dia:</strong> {formatarData(evento.data_evento)}</div>
                <div style={{ fontSize: '13px', color: C.tinta }}><strong>Horário:</strong> {formatarHora(slotSelecionado?.horario)}</div>
                <div style={{ fontSize: '13px', color: C.tinta }}><strong>Quadra:</strong> {slotSelecionado?.quadra}</div>
              </div>
              <div style={{ fontSize: '12px', color: C.textoSuave, lineHeight: '1.6' }}>
                {form.nome_crianca} · Responsável: {form.nome_responsavel}
              </div>

              {erro && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: `${C.vinho}18`, border: `1px solid ${C.vinho}66`, color: C.vinho, fontSize: '12px' }}>
                  {erro}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEtapaModal('form')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${C.textoSuave}55`, background: 'none', color: C.textoSuave, fontSize: '13px', cursor: 'pointer' }}>
                  Voltar
                </button>
                <button onClick={handleConfirmar} disabled={enviando} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: C.marinho, color: C.branco, fontSize: '13px', fontWeight: '700', cursor: enviando ? 'not-allowed' : 'pointer' }}>
                  {enviando ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {etapaModal === 'esgotado' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '32px', textAlign: 'center' }}>⏳</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: C.tinta, textAlign: 'center' }}>Esse horário está lotado!</div>
              <div style={{ fontSize: '13px', color: C.textoSuave, lineHeight: '1.6', textAlign: 'center', marginBottom: '10px' }}>
                O horário das {formatarHora(slotSelecionado?.horario)} na {slotSelecionado?.quadra} já foi preenchido. Podemos colocar {form.nome_crianca || 'seu filho(a)'} na lista de espera desse horário — se abrir vaga, avisaremos vocês por WhatsApp.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEtapaModal('confirmar')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${C.textoSuave}55`, background: 'none', color: C.textoSuave, fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleConfirmarListaEspera} disabled={enviando} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: C.marinho, color: C.branco, fontSize: '13px', fontWeight: '700', cursor: enviando ? 'not-allowed' : 'pointer' }}>
                  {enviando ? 'Enviando...' : 'Entrar na lista de espera'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </FundoClube>
  )
}
