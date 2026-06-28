import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MessageCircle, FileText, Star, ChevronRight, Upload, Copy, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BANCOS = [
  'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa Econômica',
  'Nubank', 'Inter', 'C6 Bank', 'BTG', 'Sicredi', 'Sicoob', 'Outro'
]

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '10px', color: '#555', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
}

const FORM_VAZIO = {
  id: null, nome: '', email: '', telefone: '',
  modalidade_id: '', valor_aula: '', ativo: true,
  nascimento: '', cidade_nascimento: '', estado_nascimento: '',
  cpf: '', cep: '', endereco: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado: '', data_inicio: '',
  banco: '', agencia: '', conta: '', tipo_pagamento: 'pix', chave_pix: '',
}

const CRITERIOS_AVALIACAO = [
  { key: 'nota_a', label: 'Qualidade no Atendimento' },
  { key: 'nota_b', label: 'Didática de Aula' },
  { key: 'nota_c', label: 'Pontualidade' },
  { key: 'nota_d', label: 'Comprometimento e Flexibilidade' },
  { key: 'nota_e', label: 'Aparência em Geral' },
]

function StarRating({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => !disabled && onChange(n)}
          style={{ background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '2px' }}>
          <Star size={18}
            fill={n <= value ? '#fcc825' : 'none'}
            color={n <= value ? '#fcc825' : '#333'} />
        </button>
      ))}
    </div>
  )
}

function PixCopiavel({ pix }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(pix)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button onClick={copiar} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(252,200,37,0.3)',
      backgroundColor: 'rgba(252,200,37,0.08)', cursor: 'pointer',
      fontSize: '12px', color: '#fcc825',
    }}>
      {copiado ? <Check size={12} /> : <Copy size={12} />}
      {copiado ? 'Copiado!' : pix}
    </button>
  )
}

async function buscarCep(cep, setForm) {
  const c = cep.replace(/\D/g, '')
  if (c.length !== 8) return
  try {
    const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
    const data = await res.json()
    if (!data.erro) {
      setForm(f => ({
        ...f,
        endereco: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
      }))
    }
  } catch {}
}

export default function ProfessoresPage() {
  const queryClient = useQueryClient()
  const [cardAberto, setCardAberto] = useState(null)
  const [aba, setAba] = useState('dados')
  const [modalCriar, setModalCriar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [novasNotas, setNovasNotas] = useState({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
  const [salvandoAval, setSalvandoAval] = useState(false)
  const [pixCopiado, setPixCopiado] = useState(false)

  const { data: professores = [], isLoading } = useQuery({
    queryKey: ['professores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores').select('*, modalidades(nome)').order('nome')
      if (error) throw error
      return data || []
    },
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modalidades').select('*').order('nome')
      if (error) throw error
      return data || []
    },
  })

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_professor')
        .select('*')
        .eq('professor_id', cardAberto.id)
        .order('data_avaliacao', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const { data: aulasProf = [] } = useQuery({
    queryKey: ['aulas_professor', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select('data_aula, status_aula, paga_professor')
        .eq('professor_executou_id', cardAberto.id)
        .eq('status_aula', 'dada')
        .order('data_aula', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function abrirCard(prof) {
    setCardAberto(prof)
    setAba('dados')
    setNovasNotas({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
  }

  function abrirCriar() {
    setForm({ ...FORM_VAZIO })
    setModalCriar(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(), email: form.email || null,
      telefone: form.telefone || null, modalidade_id: form.modalidade_id || null,
      valor_aula: form.valor_aula ? parseFloat(String(form.valor_aula).replace(',', '.')) : null,
      ativo: form.ativo,
      nascimento: form.nascimento || null,
      cidade_nascimento: form.cidade_nascimento || null,
      estado_nascimento: form.estado_nascimento || null,
      cpf: form.cpf || null, cep: form.cep || null,
      endereco: form.endereco || null, numero: form.numero || null,
      complemento: form.complemento || null, bairro: form.bairro || null,
      cidade: form.cidade || null, estado: form.estado || null,
      data_inicio: form.data_inicio || null,
      banco: form.banco || null, agencia: form.agencia || null,
      conta: form.conta || null, tipo_pagamento: form.tipo_pagamento || 'pix',
      chave_pix: form.chave_pix || null,
    }
    try {
      if (form.id) {
        await supabase.from('professores').update(payload).eq('id', form.id)
        setCardAberto(prev => ({ ...prev, ...payload, id: form.id }))
      } else {
        await supabase.from('professores').insert(payload)
        setModalCriar(false)
      }
      queryClient.invalidateQueries({ queryKey: ['professores'] })
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvando(false) }
  }

  async function handleSalvarAvaliacao() {
    const media = (
      (novasNotas.nota_a + novasNotas.nota_b + novasNotas.nota_c + novasNotas.nota_d + novasNotas.nota_e) / 5
    ).toFixed(2)
    setSalvandoAval(true)
    try {
      await supabase.from('avaliacoes_professor').insert({
        professor_id: cardAberto.id,
        ...novasNotas,
        media: parseFloat(media),
        data_avaliacao: format(new Date(), 'yyyy-MM-dd'),
      })
      queryClient.invalidateQueries({ queryKey: ['avaliacoes', cardAberto.id] })
      setNovasNotas({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvandoAval(false) }
  }

  // Financeiro
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate()
  const diaAtual = hoje.getDate()
  const progressoMes = Math.round((diaAtual / diasNoMes) * 100)

  function calcularGanhosMes(mes, ano, valorAula) {
    return aulasProf.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    }).length * (valorAula || 0)
  }

  const ganhosMesAtual = calcularGanhosMes(mesAtual, anoAtual, cardAberto?.valor_aula)
  const ganhosMesAnterior = calcularGanhosMes(mesAtual === 1 ? 12 : mesAtual - 1, mesAtual === 1 ? anoAtual - 1 : anoAtual, cardAberto?.valor_aula)
  const totalAulas = aulasProf.length

  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

  function abrirWhatsApp(telefone) {
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Professores</h2>
        <button onClick={abrirCriar} style={{
          padding: '8px 16px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        }}>+ Novo</button>
      </div>

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {professores.map(prof => {
            const ultimaAval = avaliacoes?.[0]
            const temAlerta = ultimaAval?.media <= 2
            return (
              <div key={prof.id} onClick={() => abrirCard(prof)} style={{
                backgroundColor: 'rgba(26,26,26,0.92)', borderRadius: '14px',
                border: `1px solid ${temAlerta ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)'}`,
                padding: '14px 16px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: '700', color: 'white',
                  }}>
                    {prof.foto_url
                      ? <img src={prof.foto_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : prof.nome.split(' ').map(p => p[0]).slice(0, 2).join('')
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5' }}>{prof.nome}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                      {prof.modalidades?.nome || '—'} {prof.banco === 'Itaú' && <span style={{ color: '#f97316', marginLeft: '4px' }}>● Itaú</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {prof.telefone && (
                    <button onClick={e => { e.stopPropagation(); abrirWhatsApp(prof.telefone) }} style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      backgroundColor: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                      <MessageCircle size={13} color="#25D166" />
                    </button>
                  )}
                  <ChevronRight size={16} color="#333" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CARD PROFESSOR */}
      {cardAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setCardAberto(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxHeight: '92vh', overflowY: 'auto',
            backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

            {/* Header do card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: '700', color: 'white', overflow: 'hidden',
              }}>
                {cardAberto.foto_url
                  ? <img src={cardAberto.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : cardAberto.nome.split(' ').map(p => p[0]).slice(0, 2).join('')
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5' }}>{cardAberto.nome}</div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                  {cardAberto.modalidades?.nome || '—'} · desde {cardAberto.data_inicio ? format(new Date(cardAberto.data_inicio + 'T12:00'), "MMM/yyyy", { locale: ptBR }) : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#fcc825', fontWeight: '700' }}>{totalAulas}</span>
                  <span style={{ fontSize: '10px', color: '#444' }}>aulas no total</span>
                </div>
              </div>
              {cardAberto.telefone && (
                <button onClick={() => abrirWhatsApp(cardAberto.telefone)} style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  backgroundColor: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <MessageCircle size={16} color="#25D166" />
                </button>
              )}
            </div>

            {/* Financeiro resumo */}
            <div style={{
              backgroundColor: '#111', borderRadius: '14px', padding: '14px 16px',
              border: '1px solid rgba(252,200,37,0.15)', marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {meses[mesAtual - 1]} {anoAtual}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#fcc825' }}>
                    R$ {ganhosMesAtual.toFixed(2).replace('.', ',')}
                  </div>
                </div>
                {ganhosMesAnterior > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {meses[mesAtual === 1 ? 11 : mesAtual - 2]}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#888' }}>
                      R$ {ganhosMesAnterior.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                )}
              </div>
              {/* Barra de progresso do mês */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#222', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px', width: `${progressoMes}%`,
                    background: 'linear-gradient(90deg, #fcc825, #cf1b9b)',
                    transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '4px', textAlign: 'right' }}>
                  Dia {diaAtual} de {diasNoMes} · {progressoMes}% do mês
                </div>
              </div>
            </div>

            {/* Abas */}
            <div style={{
              display: 'flex', gap: '4px', marginBottom: '16px',
              backgroundColor: '#111', borderRadius: '10px', padding: '4px',
            }}>
              {[
                { key: 'dados', label: 'Dados' },
                { key: 'financeiro', label: 'Financeiro' },
                { key: 'avaliacoes', label: 'Avaliações' },
              ].map(a => (
                <button key={a.key} onClick={() => setAba(a.key)} style={{
                  flex: 1, padding: '7px', borderRadius: '7px', border: 'none', fontSize: '12px',
                  fontWeight: '500', cursor: 'pointer',
                  background: aba === a.key ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent',
                  color: aba === a.key ? 'white' : '#555',
                }}>{a.label}</button>
              ))}
            </div>

            {/* ABA DADOS */}
            {aba === 'dados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados Pessoais</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={labelStyle}>Nascimento</div>
                    <input type="date" style={inputStyle} value={form.id === cardAberto.id ? form.nascimento : cardAberto.nascimento || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('nascimento', e.target.value) }} />
                  </div>
                  <div>
                    <div style={labelStyle}>CPF</div>
                    <input style={inputStyle} placeholder="000.000.000-00"
                      value={form.id === cardAberto.id ? form.cpf : cardAberto.cpf || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('cpf', e.target.value) }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={labelStyle}>Cidade Nasc.</div>
                    <input style={inputStyle} placeholder="Cidade"
                      value={form.id === cardAberto.id ? form.cidade_nascimento : cardAberto.cidade_nascimento || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('cidade_nascimento', e.target.value) }} />
                  </div>
                  <div>
                    <div style={labelStyle}>Estado Nasc.</div>
                    <select style={inputStyle}
                      value={form.id === cardAberto.id ? form.estado_nascimento : cardAberto.estado_nascimento || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('estado_nascimento', e.target.value) }}>
                      <option value="">UF</option>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Endereço</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={labelStyle}>CEP</div>
                    <input style={inputStyle} placeholder="00000-000"
                      value={form.id === cardAberto.id ? form.cep : cardAberto.cep || ''}
                      onChange={e => {
                        if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id })
                        set('cep', e.target.value)
                        buscarCep(e.target.value, setForm)
                      }} />
                  </div>
                  <div>
                    <div style={labelStyle}>Número</div>
                    <input style={inputStyle} placeholder="Nº"
                      value={form.id === cardAberto.id ? form.numero : cardAberto.numero || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('numero', e.target.value) }} />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Endereço</div>
                  <input style={inputStyle} placeholder="Rua / Avenida"
                    value={form.id === cardAberto.id ? form.endereco : cardAberto.endereco || ''}
                    onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('endereco', e.target.value) }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={labelStyle}>Bairro</div>
                    <input style={inputStyle} placeholder="Bairro"
                      value={form.id === cardAberto.id ? form.bairro : cardAberto.bairro || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('bairro', e.target.value) }} />
                  </div>
                  <div>
                    <div style={labelStyle}>Complemento</div>
                    <input style={inputStyle} placeholder="Apto, Bloco..."
                      value={form.id === cardAberto.id ? form.complemento : cardAberto.complemento || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('complemento', e.target.value) }} />
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Dados Bancários</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={labelStyle}>Banco</div>
                    <select style={inputStyle}
                      value={form.id === cardAberto.id ? form.banco : cardAberto.banco || ''}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('banco', e.target.value) }}>
                      <option value="">Selecione</option>
                      {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>Tipo Pagamento</div>
                    <select style={inputStyle}
                      value={form.id === cardAberto.id ? form.tipo_pagamento : cardAberto.tipo_pagamento || 'pix'}
                      onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('tipo_pagamento', e.target.value) }}>
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Chave PIX</div>
                  <input style={inputStyle} placeholder="CPF, e-mail, telefone ou chave aleatória"
                    value={form.id === cardAberto.id ? form.chave_pix : cardAberto.chave_pix || ''}
                    onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('chave_pix', e.target.value) }} />
                </div>

                {cardAberto.chave_pix && (
                  <div>
                    <div style={labelStyle}>PIX para copiar</div>
                    <PixCopiavel pix={cardAberto.chave_pix} />
                  </div>
                )}

                {cardAberto.banco === 'Itaú' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                    backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: '8px',
                    border: '1px solid rgba(249,115,22,0.2)',
                  }}>
                    <span style={{ fontSize: '16px' }}>🧡</span>
                    <span style={{ fontSize: '12px', color: '#f97316', fontWeight: '600' }}>Correntista Itaú — pagar via PIX</span>
                  </div>
                )}

                {/* Contrato */}
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Contrato</div>
                {cardAberto.contrato_url ? (
                  <a href={cardAberto.contrato_url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid rgba(252,200,37,0.3)',
                    backgroundColor: 'rgba(252,200,37,0.06)', textDecoration: 'none',
                    color: '#fcc825', fontSize: '13px',
                  }}>
                    <FileText size={14} /> Ver contrato assinado
                  </a>
                ) : (
                  <div style={{ fontSize: '12px', color: '#444', padding: '10px', borderRadius: '10px', border: '1px dashed #2a2a2a', textAlign: 'center' }}>
                    📄 Contrato pendente de upload
                  </div>
                )}

                <button onClick={handleSalvar} disabled={salvando} style={{
                  marginTop: '8px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                }}>
                  {salvando ? 'Salvando...' : '💾 Salvar dados'}
                </button>
              </div>
            )}

            {/* ABA FINANCEIRO */}
            {aba === 'financeiro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Histórico por mês</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {meses.map((m, i) => {
                    const ganho = calcularGanhosMes(i + 1, anoAtual, cardAberto?.valor_aula)
                    const qtdAulas = aulasProf.filter(a => {
                      const d = new Date(a.data_aula + 'T12:00')
                      return d.getMonth() === i && d.getFullYear() === anoAtual
                    }).length
                    return (
                      <div key={m} style={{
                        backgroundColor: '#111', borderRadius: '10px', padding: '10px 8px',
                        border: i + 1 === mesAtual ? '1px solid rgba(252,200,37,0.3)' : '1px solid #1e1e1e',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '10px', color: i + 1 === mesAtual ? '#fcc825' : '#555', fontWeight: '600', marginBottom: '4px' }}>{m}</div>
                        <div style={{ fontSize: '11px', color: '#F0F2F5', fontWeight: '600' }}>
                          {qtdAulas > 0 ? `${qtdAulas}aulas` : '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '2px' }}>
                          {ganho > 0 ? `R$${ganho.toFixed(0)}` : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Valor por aula</div>
                <input type="number" style={inputStyle} placeholder="R$ 0,00"
                  value={form.id === cardAberto.id ? form.valor_aula : cardAberto.valor_aula || ''}
                  onChange={e => { if (form.id !== cardAberto.id) setForm({ ...FORM_VAZIO, ...cardAberto, id: cardAberto.id }); set('valor_aula', e.target.value) }} />
                <button onClick={handleSalvar} disabled={salvando} style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                }}>
                  {salvando ? 'Salvando...' : '💾 Salvar valor'}
                </button>
              </div>
            )}

            {/* ABA AVALIAÇÕES */}
            {aba === 'avaliacoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nova Avaliação</div>
                <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '14px', border: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {CRITERIOS_AVALIACAO.map(c => (
                    <div key={c.key}>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{c.label}</div>
                      <StarRating value={novasNotas[c.key]} onChange={v => setNovasNotas(n => ({ ...n, [c.key]: v }))} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Observação (opcional)</div>
                    <textarea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Pontos fortes, pontos de melhoria..."
                      value={novasNotas.observacao} onChange={e => setNovasNotas(n => ({ ...n, observacao: e.target.value }))} />
                  </div>
                  <button onClick={handleSalvarAvaliacao} disabled={salvandoAval} style={{
                    width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                    color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    {salvandoAval ? 'Salvando...' : '⭐ Salvar Avaliação'}
                  </button>
                </div>

                {avaliacoes.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Histórico</div>
                    {avaliacoes.map(av => {
                      const tomarAcao = av.media <= 2
                      return (
                        <div key={av.id} style={{
                          backgroundColor: '#111', borderRadius: '12px', padding: '14px',
                          border: tomarAcao ? '1px solid rgba(239,68,68,0.4)' : '1px solid #1e1e1e',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#555' }}>
                              {format(new Date(av.data_avaliacao + 'T12:00'), "dd/MM/yyyy")}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Star size={12} fill="#fcc825" color="#fcc825" />
                              <span style={{ fontSize: '13px', fontWeight: '700', color: tomarAcao ? '#EF4444' : '#fcc825' }}>
                                {av.media}
                              </span>
                              {tomarAcao && (
                                <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)' }}>
                                  ⚠️ TOMAR AÇÃO
                                </span>
                              )}
                            </div>
                          </div>
                          {CRITERIOS_AVALIACAO.map(c => (
                            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#555' }}>{c.label}</span>
                              <StarRating value={av[c.key]} disabled />
                            </div>
                          ))}
                          {av.observacao && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid #1e1e1e', paddingTop: '8px' }}>
                              {av.observacao}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CRIAR */}
      {modalCriar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setModalCriar(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', marginBottom: '16px' }}>Novo Professor</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input style={inputStyle} placeholder="Nome completo *" value={form.nome} onChange={e => set('nome', e.target.value)} />
              <input style={inputStyle} placeholder="Telefone (WhatsApp)" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
              <input style={inputStyle} placeholder="E-mail" value={form.email} onChange={e => set('email', e.target.value)} />
              <select style={inputStyle} value={form.modalidade_id} onChange={e => set('modalidade_id', e.target.value)}>
                <option value="">Modalidade</option>
                {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setModalCriar(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a',
                  background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer',
                }}>Cancelar</button>
                <button onClick={handleSalvar} disabled={salvando || !form.nome.trim()} style={{
                  flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                }}>
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}