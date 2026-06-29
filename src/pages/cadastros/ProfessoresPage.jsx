import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MessageCircle, FileText, Star, Upload, Copy, Check, Camera, X, Plus, Trash2 } from 'lucide-react'
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

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

const CRITERIOS = [
  { key: 'nota_a', label: 'Qualidade no Atendimento' },
  { key: 'nota_b', label: 'Didática de Aula' },
  { key: 'nota_c', label: 'Pontualidade' },
  { key: 'nota_d', label: 'Comprometimento e Flexibilidade' },
  { key: 'nota_e', label: 'Aparência em Geral' },
]

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#111', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '10px', color: '#555', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
}

const FORM_VAZIO = {
  id: null, nome: '', email: '', telefone: '', instagram: '', apelido: '',
  tem_cref: false, numero_cref: '', cref_url: '',
  cnpj: '', razao_social: '',
  modalidade_id: '', valor_aula: '', ativo: true,
  nascimento: '', cidade_nascimento: '', estado_nascimento: '',
  cpf: '', cep: '', endereco: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado: '', data_inicio: '',
  banco: '', agencia: '', conta: '', tipo_pagamento: 'pix', chave_pix: '',
}

function StarRating({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => !disabled && onChange(n)}
          style={{ background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '2px' }}>
          <Star size={20} fill={n <= value ? '#fcc825' : 'none'} color={n <= value ? '#fcc825' : '#333'} />
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
      padding: '8px 14px', borderRadius: '8px',
      border: '1px solid rgba(252,200,37,0.3)',
      backgroundColor: 'rgba(252,200,37,0.08)',
      cursor: 'pointer', fontSize: '12px', color: '#fcc825', width: '100%',
    }}>
      {copiado ? <Check size={13} /> : <Copy size={13} />}
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copiado ? 'Copiado!' : pix}
      </span>
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
  const qc = useQueryClient()
  const [cardAberto, setCardAberto] = useState(null)
  const [aba, setAba] = useState('perfil')
  const [modalCriar, setModalCriar] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [novasNotas, setNovasNotas] = useState({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
  const [salvandoAval, setSalvandoAval] = useState(false)
  const [modalAval, setModalAval] = useState(false)
  const [avaliadores, setAvaliadores] = useState([{ nome: '', cargo: '' }])
  const [dataAvaliacao, setDataAvaliacao] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState(null)
  const [modalExtra, setModalExtra] = useState(false)
  const [formExtra, setFormExtra] = useState({ data_pagamento: format(new Date(), 'yyyy-MM-dd'), descricao: '', valor: '' })
  const [salvandoExtra, setSalvandoExtra] = useState(false)
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const fotoInputRef = useRef()
  const contratoInputRef = useRef()

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate()
  const diaAtual = hoje.getDate()
  const progressoMes = Math.round((diaAtual / diasNoMes) * 100)

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
        .order('data_aula', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const { data: boletos = [] } = useQuery({
    queryKey: ['boletos', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boletos_professor')
        .select('*')
        .eq('professor_id', cardAberto.id)
        .order('ano', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const { data: disponibilidades = [] } = useQuery({
    queryKey: ['disponibilidades', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disponibilidades')
        .select('*')
        .eq('professor_id', cardAberto.id)
      if (error) throw error
      return data || []
    },
  })

  const { data: pagamentosExtras = [] } = useQuery({
    queryKey: ['pagamentos_extras', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_extras')
        .select('*')
        .eq('professor_id', cardAberto.id)
        .order('data_pagamento', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function iniciarEdicao(prof) {
    setForm({
      id: prof.id, nome: prof.nome || '', email: prof.email || '',
      telefone: prof.telefone || '', instagram: prof.instagram || '',
      modalidade_id: prof.modalidade_id || '', valor_aula: prof.valor_aula || '',
      ativo: prof.ativo !== false, nascimento: prof.nascimento || '',
      cidade_nascimento: prof.cidade_nascimento || '',
      estado_nascimento: prof.estado_nascimento || '',
      cpf: prof.cpf || '', cep: prof.cep || '',
      endereco: prof.endereco || '', numero: prof.numero || '',
      complemento: prof.complemento || '', bairro: prof.bairro || '',
      cidade: prof.cidade || '', estado: prof.estado || '',
      data_inicio: prof.data_inicio || '', banco: prof.banco || '',
      agencia: prof.agencia || '', conta: prof.conta || '',
      tipo_pagamento: prof.tipo_pagamento || 'pix', chave_pix: prof.chave_pix || '',
      apelido: prof.apelido || '',
      tem_cref: prof.tem_cref || false,
      numero_cref: prof.numero_cref || '',
      cref_url: prof.cref_url || '',
      cnpj: prof.cnpj || '',
      razao_social: prof.razao_social || '',
    })
  }

  function abrirCard(prof) {
    setCardAberto(prof)
    iniciarEdicao(prof)
    setAba('perfil')
    setMesSelecionado(null)
    setNovasNotas({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(), email: form.email || null,
      telefone: form.telefone || null, instagram: form.instagram || null,
      modalidade_id: form.modalidade_id || null,
      valor_aula: form.valor_aula ? parseFloat(String(form.valor_aula).replace(',', '.')) : null,
      ativo: form.ativo, nascimento: form.nascimento || null,
      cidade_nascimento: form.cidade_nascimento || null,
      estado_nascimento: form.estado_nascimento || null,
      cpf: form.cpf || null, cep: form.cep || null,
      endereco: form.endereco || null, numero: form.numero || null,
      complemento: form.complemento || null, bairro: form.bairro || null,
      cidade: form.cidade || null, estado: form.estado || null,
      data_inicio: form.data_inicio || null, banco: form.banco || null,
      agencia: form.agencia || null, conta: form.conta || null,
      tipo_pagamento: form.tipo_pagamento || 'pix', chave_pix: form.chave_pix || null,
      apelido: form.apelido || null,
      tem_cref: form.tem_cref || false,
      numero_cref: form.numero_cref || null,
      cref_url: form.cref_url || null,
      cnpj: form.cnpj || null,
      razao_social: form.razao_social || null,
    }
    try {
      if (form.id) {
        const { data } = await supabase.from('professores').update(payload).eq('id', form.id).select('*, modalidades(nome)').single()
        setCardAberto(data)
        qc.invalidateQueries({ queryKey: ['professores'] })
        setCardAberto(null)
      } else {
        await supabase.from('professores').insert(payload)
        qc.invalidateQueries({ queryKey: ['professores'] })
        setModalCriar(false)
        setForm(FORM_VAZIO)
      }
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvando(false) }
  }

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    setUploadandoFoto(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `professores/${cardAberto.id}/foto.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('professores').update({ foto_url: publicUrl }).eq('id', cardAberto.id)
      setCardAberto(prev => ({ ...prev, foto_url: publicUrl }))
      qc.invalidateQueries({ queryKey: ['professores'] })
    } catch (err) { alert('Erro upload: ' + err.message) }
    finally { setUploadandoFoto(false) }
  }

  async function handleUploadContrato(e) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    try {
      const path = `professores/${cardAberto.id}/contrato.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('professores').update({ contrato_url: publicUrl }).eq('id', cardAberto.id)
      setCardAberto(prev => ({ ...prev, contrato_url: publicUrl }))
      qc.invalidateQueries({ queryKey: ['professores'] })
    } catch (err) { alert('Erro upload contrato: ' + err.message) }
  }

  async function handleUploadBoleto(e, mes, ano) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    try {
      const path = `professores/${cardAberto.id}/boleto_${ano}_${mes}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('boletos_professor').upsert({
        professor_id: cardAberto.id, mes, ano, boleto_url: publicUrl, status: 'pendente'
      }, { onConflict: 'professor_id,mes,ano' })
      qc.invalidateQueries({ queryKey: ['boletos', cardAberto.id] })
    } catch (err) { alert('Erro upload boleto: ' + err.message) }
  }

  async function handleUploadNF(e, mes, ano) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    try {
      const path = `professores/${cardAberto.id}/nf_${ano}_${mes}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('boletos_professor').upsert({
        professor_id: cardAberto.id, mes, ano, nf_url: publicUrl,
      }, { onConflict: 'professor_id,mes,ano' })
      qc.invalidateQueries({ queryKey: ['boletos', cardAberto.id] })
    } catch (err) { alert('Erro upload NF: ' + err.message) }
  }

  async function handleSalvarAvaliacao() {
    const total = novasNotas.nota_a + novasNotas.nota_b + novasNotas.nota_c + novasNotas.nota_d + novasNotas.nota_e
    if (total === 0) return alert('Preencha pelo menos uma nota')
    const avaliadoresValidos = avaliadores.filter(a => a.nome.trim())
    if (avaliadoresValidos.length === 0) return alert('Adicione pelo menos um avaliador')
    const media = (total / 5).toFixed(2)
    setSalvandoAval(true)
    try {
      await supabase.from('avaliacoes_professor').insert({
        professor_id: cardAberto.id, ...novasNotas,
        media: parseFloat(media),
        data_avaliacao: dataAvaliacao,
        avaliadores: avaliadoresValidos,
      })
      qc.invalidateQueries({ queryKey: ['avaliacoes', cardAberto.id] })
      setNovasNotas({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
      setAvaliadores([{ nome: '', cargo: '' }])
      setDataAvaliacao(format(new Date(), 'yyyy-MM-dd'))
      setModalAval(false)
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvandoAval(false) }
  }

  function calcularGanhosMes(mes, ano) {
    const qtd = aulasProf.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    }).length
    const valorAulas = qtd * (cardAberto?.valor_aula || 0)
    const valorExtras = pagamentosExtras
      .filter(p => p.mes === mes && p.ano === ano)
      .reduce((acc, p) => acc + (p.valor || 0), 0)
    return { qtd, valor: valorAulas + valorExtras, valorAulas, valorExtras }
  }

  async function handleSalvarExtra() {
    if (!formExtra.descricao.trim() || !formExtra.valor) return alert('Preencha todos os campos')
    setSalvandoExtra(true)
    const d = new Date(formExtra.data_pagamento + 'T12:00')
    try {
      await supabase.from('pagamentos_extras').insert({
        professor_id: cardAberto.id,
        data_pagamento: formExtra.data_pagamento,
        descricao: formExtra.descricao,
        valor: parseFloat(String(formExtra.valor).replace(',', '.')),
        mes: d.getMonth() + 1,
        ano: d.getFullYear(),
      })
      qc.invalidateQueries({ queryKey: ['pagamentos_extras', cardAberto.id] })
      setFormExtra({ data_pagamento: format(new Date(), 'yyyy-MM-dd'), descricao: '', valor: '' })
      setModalExtra(false)
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvandoExtra(false) }
  }

  function getAulasDoDia(mes, ano) {
    const diasMap = {}
    aulasProf.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    }).forEach(a => {
      const dia = new Date(a.data_aula + 'T12:00').getDate()
      diasMap[dia] = (diasMap[dia] || 0) + 1
    })
    return diasMap
  }

  const ganhosMesAtual = calcularGanhosMes(mesAtual, anoAtual)
  const ganhosMesAnterior = calcularGanhosMes(mesAtual === 1 ? 12 : mesAtual - 1, mesAtual === 1 ? anoAtual - 1 : anoAtual)
  const totalAulas = aulasProf.length
  const totalGeral = aulasProf.length * (cardAberto?.valor_aula || 0)

  const dadosGrafico = Array.from({ length: 6 }, (_, i) => {
    const m = mesAtual - 5 + i
    const mes = m <= 0 ? m + 12 : m
    const ano = m <= 0 ? anoAtual - 1 : anoAtual
    return { mes, ano, label: MESES[mes - 1], qtd: calcularGanhosMes(mes, ano).qtd }
  })
  const maxGrafico = Math.max(...dadosGrafico.map(d => d.qtd), 1)

  const mesesFinanceiro = Array.from({ length: 12 }, (_, i) => {
    const m = mesAtual - i <= 0 ? mesAtual - i + 12 : mesAtual - i
    const a = mesAtual - i <= 0 ? anoAtual - 1 : anoAtual
    return { mes: m, ano: a }
  })

  const DIAS_SEMANA = ['segunda','terca','quarta','quinta','sexta','sabado','domingo']
  const DIAS_LABEL = ['SEG','TER','QUA','QUI','SEX','SAB','DOM']
  const HORARIOS_GRADE = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)
  const COR_DISP = { disponivel: '#22c55e', indisponivel: '#EF4444', talvez: '#fcc825' }
  const getStatusDisp = (dia, horario) => disponibilidades.find(d => d.dia_semana === dia && d.horario === horario)?.status || null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Professores</h2>
        <button onClick={() => { setForm(FORM_VAZIO); setModalCriar(true) }} style={{
          padding: '8px 16px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        }}>+ Novo</button>
      </div>

      {isLoading ? <p style={{ color: '#555' }}>Carregando...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {professores.map(prof => (
            <div key={prof.id} onClick={() => abrirCard(prof)} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <div style={{
                width: '80px', height: '80px', margin: '0 auto 8px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                padding: '2px', boxSizing: 'border-box',
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  backgroundColor: '#1a1a1a', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {prof.foto_url
                    ? <img src={prof.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '20px', fontWeight: '700', color: '#fcc825' }}>
                        {prof.nome?.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </span>
                  }
                </div>
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#F0F2F5', lineHeight: 1.3 }}>
                {prof.apelido || prof.nome?.split(' ')[0]}
              </div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                {prof.modalidades?.nome?.split(' ')[0] || '—'}
              </div>
              <div style={{ display: 'inline-block', marginTop: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: prof.ativo ? '#22c55e' : '#EF4444' }} />
            </div>
          ))}
        </div>
      )}

      {cardAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setCardAberto(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxHeight: '94vh', overflowY: 'auto',
            backgroundColor: '#151515', borderRadius: '20px 20px 0 0',
            padding: '20px 16px 32px', boxSizing: 'border-box',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 20px' }} />

            <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadFoto} />
            <input ref={contratoInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUploadContrato} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <button onClick={() => setCardAberto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
              <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', padding: '2px', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#1a1a1a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cardAberto.foto_url
                      ? <a href={cardAberto.foto_url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                          <img src={cardAberto.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                      : <span style={{ fontSize: '22px', fontWeight: '700', color: '#fcc825' }}>
                          {cardAberto.nome?.split(' ').map(p => p[0]).slice(0, 2).join('')}
                        </span>
                    }
                  </div>
                </div>
                <button onClick={() => fotoInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', border: 'none', backgroundColor: '#fcc825', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {uploadandoFoto ? '...' : <Camera size={11} color="#110f0f" />}
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#F0F2F5', lineHeight: 1.2 }}>
                  {cardAberto.apelido || cardAberto.nome}
                  {cardAberto.apelido && <div style={{ fontSize: '11px', color: '#555', fontWeight: '400', marginTop: '2px' }}>{cardAberto.nome}</div>}
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                  {cardAberto.nascimento && `${format(new Date(cardAberto.nascimento + 'T12:00'), 'dd/MM/yyyy')} · `}
                  {cardAberto.cidade_nascimento && `${cardAberto.cidade_nascimento}/`}
                  {cardAberto.estado_nascimento} {cardAberto.estado_nascimento && '🇧🇷'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  {cardAberto.telefone && (
                    <button onClick={() => window.open(`https://wa.me/55${cardAberto.telefone.replace(/\D/g,'')}`, '_blank')} style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <MessageCircle size={14} color="#25D166" />
                    </button>
                  )}
                  {cardAberto.instagram && (
                    <button onClick={() => window.open(`https://instagram.com/${cardAberto.instagram.replace('@','').replace(/.*instagram\.com\//,'')}`, '_blank')} style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(207,27,155,0.15)', border: '1px solid rgba(207,27,155,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#555" stroke="none"/>
                      </svg>
                    </button>
                  )}
                  {cardAberto.data_inicio && (
                    <span style={{ fontSize: '10px', color: '#444' }}>desde {format(new Date(cardAberto.data_inicio + 'T12:00'), "MMM/yyyy", { locale: ptBR })}</span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#fcc825', lineHeight: 1 }}>{totalAulas}</div>
                <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>aulas</div>
              </div>
            </div>

            {/* Financeiro resumo topo */}
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(252,200,37,0.15)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{MESES[mesAtual - 1]} {anoAtual} · {ganhosMesAtual.qtd} aulas</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#fcc825' }}>R$ {ganhosMesAtual.valor.toFixed(2).replace('.', ',')}</div>
                  {ganhosMesAtual.valorExtras > 0 && <div style={{ fontSize: '10px', color: '#cf1b9b', marginTop: '2px' }}>+ R$ {ganhosMesAtual.valorExtras.toFixed(2).replace('.', ',')} em extras</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {ganhosMesAnterior.valor > 0 && (
                    <div style={{ textAlign: 'right', opacity: 0.4 }}>
                      <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>{MESES[mesAtual === 1 ? 11 : mesAtual - 2]}</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#888' }}>R$ {ganhosMesAnterior.valor.toFixed(2).replace('.', ',')}</div>
                    </div>
                  )}
                  <button onClick={() => setModalExtra(true)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', backgroundColor: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={14} color="#555" />
                  </button>
                </div>
              </div>
              <div style={{ height: '3px', borderRadius: '2px', backgroundColor: '#222', overflow: 'hidden', marginBottom: '4px' }}>
                <div style={{ height: '100%', width: `${progressoMes}%`, background: 'linear-gradient(90deg, #fcc825, #cf1b9b)', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '10px', color: '#333', textAlign: 'right' }}>Dia {diaAtual} de {diasNoMes} · {progressoMes}% do mês</div>
            </div>

            {/* Modal pagamento extra */}
            {modalExtra && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setModalExtra(false)}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: '#151515', borderRadius: '20px 20px 0 0', padding: '20px 16px', boxSizing: 'border-box' }}>
                  <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', marginBottom: '16px' }}>+ Pagamento Extra</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div><div style={labelStyle}>Data</div>
                      <input type="date" style={inputStyle} value={formExtra.data_pagamento} onChange={e => setFormExtra(f => ({ ...f, data_pagamento: e.target.value }))} /></div>
                    <div><div style={labelStyle}>Descrição</div>
                      <input style={inputStyle} placeholder="Ex: Evento, Diária, Bônus..." value={formExtra.descricao} onChange={e => setFormExtra(f => ({ ...f, descricao: e.target.value }))} /></div>
                    <div><div style={labelStyle}>Valor (R$)</div>
                      <input type="number" style={inputStyle} placeholder="0,00" value={formExtra.valor} onChange={e => setFormExtra(f => ({ ...f, valor: e.target.value }))} /></div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => setModalExtra(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={handleSalvarExtra} disabled={salvandoExtra} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        {salvandoExtra ? 'Salvando...' : '💾 Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gráfico evolução */}
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '14px', padding: '14px 16px', border: '1px solid #222', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Evolução — últimos 6 meses</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '60px' }}>
                {dadosGrafico.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max((d.qtd / maxGrafico) * 48, d.qtd > 0 ? 4 : 0)}px`, background: i === 5 ? 'linear-gradient(180deg, #fcc825, #cf1b9b)' : '#2a2a2a' }} />
                    <div style={{ fontSize: '9px', color: i === 5 ? '#fcc825' : '#444' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid de meses */}
            <div style={{ backgroundColor: '#1a1a1a', borderRadius: '14px', padding: '14px 16px', border: '1px solid #222', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aulas por mês</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[anoAtual - 1, anoAtual].map(a => (
                    <button key={a} onClick={() => setAnoSelecionado(a)} style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', fontSize: '11px', background: anoSelecionado === a ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111', color: anoSelecionado === a ? 'white' : '#555', cursor: 'pointer' }}>{a}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {MESES.map((m, i) => {
                  const { qtd, valor } = calcularGanhosMes(i + 1, anoSelecionado)
                  const isAtual = i + 1 === mesAtual && anoSelecionado === anoAtual
                  const isSelecionado = mesSelecionado?.mes === i + 1 && mesSelecionado?.ano === anoSelecionado
                  return (
                    <button key={m} onClick={() => setMesSelecionado(isSelecionado ? null : { mes: i + 1, ano: anoSelecionado })} style={{ backgroundColor: isAtual ? 'rgba(252,200,37,0.1)' : '#111', borderRadius: '10px', padding: '8px 6px', border: isSelecionado ? '1px solid rgba(207,27,155,0.4)' : isAtual ? '1px solid rgba(252,200,37,0.3)' : '1px solid #1e1e1e', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: isAtual ? '#fcc825' : '#555', fontWeight: '600' }}>{m}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#F0F2F5', margin: '2px 0' }}>{qtd > 0 ? qtd : '—'}</div>
                      {valor > 0 && <div style={{ fontSize: '9px', color: '#22c55e' }}>R${valor.toFixed(0)}</div>}
                    </button>
                  )
                })}
              </div>

{mesSelecionado && (() => {
                  const diasMap = getAulasDoDia(mesSelecionado.mes, mesSelecionado.ano)
                  const diasComAula = Object.keys(diasMap).sort((a, b) => Number(a) - Number(b))
                  const { qtd, valor } = calcularGanhosMes(mesSelecionado.mes, mesSelecionado.ano)
                  const extrasDoMes = pagamentosExtras.filter(p => p.mes === mesSelecionado.mes && p.ano === mesSelecionado.ano)
                  return (
                    <div style={{ marginTop: '12px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '12px', border: '1px solid rgba(207,27,155,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#cf1b9b' }}>{MESES[mesSelecionado.mes - 1]}/{mesSelecionado.ano} · {qtd} aulas · R${valor.toFixed(2).replace('.', ',')}</div>
                        <button onClick={() => setMesSelecionado(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {diasComAula.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', marginBottom: '8px' }}>Nenhuma aula confirmada</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                          {diasComAula.map(dia => (
                            <div key={dia} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#111', borderRadius: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#888' }}>Dia {String(dia).padStart(2, '0')}/{String(mesSelecionado.mes).padStart(2, '0')}</span>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#22c55e' }}>{diasMap[dia]} {diasMap[dia] === 1 ? 'aula' : 'aulas'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {extrasDoMes.length > 0 && (
                        <>
                          <div style={{ fontSize: '10px', color: '#cf1b9b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '8px 0 6px' }}>Extras</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {extrasDoMes.map(ex => (
                              <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'rgba(207,27,155,0.06)', borderRadius: '8px', border: '1px solid rgba(207,27,155,0.15)' }}>
                                <div>
                                  <div style={{ fontSize: '12px', color: '#F0F2F5' }}>{ex.descricao}</div>
                                  <div style={{ fontSize: '10px', color: '#555' }}>{format(new Date(ex.data_pagamento + 'T12:00'), 'dd/MM/yyyy')}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#cf1b9b' }}>R${Number(ex.valor).toFixed(2).replace('.', ',')}</span>
                                  <button onClick={async () => {
                                    if (!confirm('Excluir este extra?')) return
                                    await supabase.from('pagamentos_extras').delete().eq('id', ex.id)
                                    qc.invalidateQueries({ queryKey: ['pagamentos_extras', cardAberto.id] })
                                  }} style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer' }}>
                                    <X size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()} 
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: '#111', borderRadius: '10px', padding: '4px' }}>
              {[
                { key: 'perfil', label: 'Dados' },
                { key: 'financeiro', label: 'Financeiro' },
                { key: 'avaliacoes', label: 'Avaliações' },
                { key: 'disponibilidade', label: 'Grade' },
              ].map(a => (
                <button key={a.key} onClick={() => setAba(a.key)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer', background: aba === a.key ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent', color: aba === a.key ? 'white' : '#555' }}>{a.label}</button>
              ))}
            </div>

            {/* ABA DADOS */}
            {aba === 'perfil' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><div style={labelStyle}>Nome Completo</div><input style={inputStyle} placeholder="Nome completo *" value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contato</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Telefone</div><input style={inputStyle} placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} /></div>
                  <div><div style={labelStyle}>Instagram</div><input style={inputStyle} placeholder="@usuario" value={form.instagram} onChange={e => set('instagram', e.target.value)} /></div>
                </div>
                <div><div style={labelStyle}>E-mail</div><input style={inputStyle} placeholder="email@exemplo.com" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                <div><div style={labelStyle}>Apelido (opcional)</div><input style={inputStyle} placeholder="Ex: Cigano, Borges, Nunes..." value={form.apelido || ''} onChange={e => set('apelido', e.target.value)} /></div>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>CREF</div>
                <button onClick={() => set('tem_cref', !form.tem_cref)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                  borderRadius: '10px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                  background: form.tem_cref ? 'rgba(252,200,37,0.1)' : '#111',
                  outline: form.tem_cref ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
                  color: form.tem_cref ? '#fcc825' : '#555', fontSize: '13px',
                }}>
                  <span>{form.tem_cref ? '✓' : '○'}</span>
                  <span>{form.tem_cref ? 'Possui CREF' : 'Possui CREF ou Liminar?'}</span>
                </button>

                {form.tem_cref && (
                  <>
                    <input style={inputStyle} placeholder="Número do CREF (ex: 123456-G/SP)"
                      value={form.numero_cref} onChange={e => set('numero_cref', e.target.value)} />
                    {cardAberto?.cref_url ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={cardAberto.cref_url} target="_blank" rel="noreferrer" style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                          borderRadius: '10px', border: '1px solid rgba(252,200,37,0.3)',
                          backgroundColor: 'rgba(252,200,37,0.06)', textDecoration: 'none', color: '#fcc825', fontSize: '13px',
                        }}>
                          <FileText size={14} /> Ver CREF
                        </a>
                        <label style={{
                          padding: '10px 14px', borderRadius: '10px', border: '1px solid #2a2a2a',
                          background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}>
                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (!file || !cardAberto?.id) return
                              const path = `professores/${cardAberto.id}/cref.${file.name.split('.').pop()}`
                              const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
                              if (error) return alert('Erro: ' + error.message)
                              const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
                              await supabase.from('professores').update({ cref_url: publicUrl }).eq('id', cardAberto.id)
                              setCardAberto(prev => ({ ...prev, cref_url: publicUrl }))
                            }} />
                          Substituir
                        </label>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '10px', borderRadius: '10px', border: '1px dashed #2a2a2a',
                        background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', width: '100%',
                        boxSizing: 'border-box',
                      }}>
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file || !cardAberto?.id) return
                            const path = `professores/${cardAberto.id}/cref.${file.name.split('.').pop()}`
                            const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
                            if (error) return alert('Erro: ' + error.message)
                            const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
                            await supabase.from('professores').update({ cref_url: publicUrl }).eq('id', cardAberto.id)
                            setCardAberto(prev => ({ ...prev, cref_url: publicUrl }))
                          }} />
                        <Upload size={14} /> Upload do CREF (foto ou PDF)
                      </label>
                    )}
                  </>
                )}

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Dados Pessoais</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Nascimento</div><input type="date" style={inputStyle} value={form.nascimento} onChange={e => set('nascimento', e.target.value)} /></div>
                  <div><div style={labelStyle}>CPF</div><input style={inputStyle} placeholder="000.000.000-00" value={form.cpf} onChange={e => set('cpf', e.target.value)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Cidade Nasc.</div><input style={inputStyle} placeholder="Cidade" value={form.cidade_nascimento} onChange={e => set('cidade_nascimento', e.target.value)} /></div>
                  <div><div style={labelStyle}>Estado Nasc.</div>
                    <select style={inputStyle} value={form.estado_nascimento} onChange={e => set('estado_nascimento', e.target.value)}>
                      <option value="">UF</option>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Início na empresa</div><input type="date" style={inputStyle} value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} /></div>
                  <div><div style={labelStyle}>Modalidade</div>
                    <select style={inputStyle} value={form.modalidade_id} onChange={e => set('modalidade_id', e.target.value)}>
                      <option value="">Selecione</option>
                      {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select></div>
                </div>

<div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Dados do CNPJ</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>CNPJ</div>
                    <input style={inputStyle} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} /></div>
                  <div><div style={labelStyle}>Razão Social</div>
                    <input style={inputStyle} placeholder="Nome da empresa" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} /></div>
                </div>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Endereço</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>CEP</div><input style={inputStyle} placeholder="00000-000" value={form.cep} onChange={e => { set('cep', e.target.value); buscarCep(e.target.value, setForm) }} /></div>
                  <div><div style={labelStyle}>Número</div><input style={inputStyle} placeholder="Nº" value={form.numero} onChange={e => set('numero', e.target.value)} /></div>
                </div>
                <div><div style={labelStyle}>Endereço</div><input style={inputStyle} placeholder="Rua / Avenida" value={form.endereco} onChange={e => set('endereco', e.target.value)} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Bairro</div><input style={inputStyle} placeholder="Bairro" value={form.bairro} onChange={e => set('bairro', e.target.value)} /></div>
                  <div><div style={labelStyle}>Complemento</div><input style={inputStyle} placeholder="Apto..." value={form.complemento} onChange={e => set('complemento', e.target.value)} /></div>
                </div>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Contrato</div>
                {cardAberto.contrato_url ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={cardAberto.contrato_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(252,200,37,0.3)', backgroundColor: 'rgba(252,200,37,0.06)', textDecoration: 'none', color: '#fcc825', fontSize: '13px' }}>
                      <FileText size={14} /> Ver contrato
                    </a>
                    <button onClick={() => contratoInputRef.current?.click()} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>Substituir</button>
                  </div>
                ) : (
                  <button onClick={() => contratoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px', border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', width: '100%' }}>
                    <Upload size={14} /> Upload do contrato (PDF)
                  </button>
                )}

                <button onClick={handleSalvar} disabled={salvando} style={{ marginTop: '8px', width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : '💾 Salvar dados'}
                </button>
              </div>
            )}

            {/* ABA FINANCEIRO */}
            {aba === 'financeiro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados Bancários</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Banco</div>
                    <select style={inputStyle} value={form.banco} onChange={e => set('banco', e.target.value)}>
                      <option value="">Selecione</option>
                      {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select></div>
                  <div><div style={labelStyle}>Tipo Pagamento</div>
                    <select style={inputStyle} value={form.tipo_pagamento} onChange={e => set('tipo_pagamento', e.target.value)}>
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                    </select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Agência</div><input style={inputStyle} placeholder="0000" value={form.agencia} onChange={e => set('agencia', e.target.value)} /></div>
                  <div><div style={labelStyle}>Conta</div><input style={inputStyle} placeholder="00000-0" value={form.conta} onChange={e => set('conta', e.target.value)} /></div>
                </div>
                <div><div style={labelStyle}>Chave PIX</div><input style={inputStyle} placeholder="CPF, e-mail, telefone..." value={form.chave_pix} onChange={e => set('chave_pix', e.target.value)} /></div>
                {cardAberto.chave_pix && <PixCopiavel pix={cardAberto.chave_pix} />}
                {cardAberto.banco === 'Itaú' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <span style={{ fontSize: '16px' }}>🧡</span>
                    <span style={{ fontSize: '12px', color: '#f97316', fontWeight: '600' }}>Correntista Itaú — pagar via PIX</span>
                  </div>
                )}
                <div><div style={labelStyle}>Valor por aula (R$)</div><input type="number" style={inputStyle} placeholder="0,00" value={form.valor_aula} onChange={e => set('valor_aula', e.target.value)} /></div>
                <button onClick={handleSalvar} disabled={salvando} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : '💾 Salvar dados bancários'}
                </button>

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>Histórico de pagamentos</div>

                {mesesFinanceiro.map(({ mes, ano }) => {
                  const { qtd, valor } = calcularGanhosMes(mes, ano)
                  if (qtd === 0) return null
                  const boleto = boletos.find(b => b.mes === mes && b.ano === ano)
                  return (
                    <div key={`${mes}-${ano}`} style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '12px 14px', border: mes === mesAtual && ano === anoAtual ? '1px solid rgba(252,200,37,0.2)' : '1px solid #222' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: mes === mesAtual && ano === anoAtual ? '#fcc825' : '#F0F2F5' }}>{MESES[mes - 1]}/{ano}</div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>R$ {valor.toFixed(2).replace('.', ',')}</div>
                          <div style={{ fontSize: '10px', color: '#555' }}>{qtd} aulas</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <label style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', backgroundColor: boleto?.boleto_url ? 'rgba(34,197,94,0.1)' : '#111', color: boleto?.boleto_url ? '#22c55e' : '#555', outline: boleto?.boleto_url ? '1px solid rgba(34,197,94,0.3)' : '1px dashed #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUploadBoleto(e, mes, ano)} />
                          <Upload size={11} />{boleto?.boleto_url ? 'Boleto ✓' : 'Boleto'}
                        </label>
                        <label style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', backgroundColor: boleto?.nf_url ? 'rgba(34,197,94,0.1)' : '#111', color: boleto?.nf_url ? '#22c55e' : '#555', outline: boleto?.nf_url ? '1px solid rgba(34,197,94,0.3)' : '1px dashed #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUploadNF(e, mes, ano)} />
                          <FileText size={11} />{boleto?.nf_url ? 'NF ✓' : 'NF'}
                        </label>
                      </div>
                    </div>
                  )
                })}

                <div style={{ backgroundColor: 'rgba(252,200,37,0.08)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(252,200,37,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total acumulado ({totalAulas} aulas)</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#fcc825' }}>R$ {totalGeral.toFixed(2).replace('.', ',')}</div>
                </div>
              </div>
            )}

            {/* ABA AVALIAÇÕES */}
            {aba === 'avaliacoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {avaliacoes.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Histórico</div>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {avaliacoes.map((av, i) => {
                        const tomarAcao = av.media <= 2
                        return (
                          <div key={av.id} style={{ flexShrink: 0, width: '72px', textAlign: 'center', backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '10px 8px', border: tomarAcao ? '1px solid rgba(239,68,68,0.5)' : '1px solid #222' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: tomarAcao ? '#EF4444' : '#fcc825' }}>{avaliacoes.length - i}ª</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', margin: '4px 0' }}>
                              <Star size={10} fill="#fcc825" color="#fcc825" />
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#F0F2F5' }}>{av.media}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: '#444' }}>{format(new Date(av.data_avaliacao + 'T12:00'), 'dd/MM/yy')}</div>
                            {tomarAcao && <div style={{ fontSize: '8px', color: '#EF4444', fontWeight: '600', marginTop: '4px' }}>⚠️ AÇÃO</div>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nova Avaliação</div>
                <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '16px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {CRITERIOS.map(c => (
                    <div key={c.key}>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{c.label}</div>
                      <StarRating value={novasNotas[c.key]} onChange={v => setNovasNotas(n => ({ ...n, [c.key]: v }))} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Observação (opcional)</div>
                    <textarea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Pontos fortes, pontos de melhoria..." value={novasNotas.observacao} onChange={e => setNovasNotas(n => ({ ...n, observacao: e.target.value }))} />
                  </div>
                  <button onClick={() => setModalAval(true)} style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    ⭐ Salvar Avaliação
                  </button>

                  {modalAval && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setModalAval(false)}>
                      <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: '#151515', borderRadius: '20px 20px 0 0', padding: '20px 16px', boxSizing: 'border-box', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', marginBottom: '4px' }}>Confirmar avaliação</div>
                        <div style={{ fontSize: '11px', color: '#555', marginBottom: '16px' }}>{cardAberto.nome}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div><div style={labelStyle}>Data da avaliação</div>
                            <input type="date" style={inputStyle} value={dataAvaliacao} onChange={e => setDataAvaliacao(e.target.value)} /></div>
                          <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avaliadores</div>
                          {avaliadores.map((av, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input style={inputStyle} placeholder="Nome do avaliador *" value={av.nome} onChange={e => setAvaliadores(prev => prev.map((a, j) => j === i ? { ...a, nome: e.target.value } : a))} />
                                <input style={inputStyle} placeholder="Cargo (ex: Gestor, Coord. Técnico)" value={av.cargo} onChange={e => setAvaliadores(prev => prev.map((a, j) => j === i ? { ...a, cargo: e.target.value } : a))} />
                              </div>
                              {avaliadores.length > 1 && (
                                <button onClick={() => setAvaliadores(prev => prev.filter((_, j) => j !== i))} style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', marginTop: '2px' }}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => setAvaliadores(prev => [...prev, { nome: '', cargo: '' }])} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>
                            <Plus size={13} /> Adicionar avaliador
                          </button>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button onClick={() => setModalAval(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSalvarAvaliacao} disabled={salvandoAval} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              {salvandoAval ? 'Salvando...' : '⭐ Confirmar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {avaliacoes.map((av, i) => {
                  const tomarAcao = av.media <= 2
                  return (
                    <div key={av.id} style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '14px', border: tomarAcao ? '1px solid rgba(239,68,68,0.4)' : '1px solid #222' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          {avaliacoes.length - i}ª avaliação · {format(new Date(av.data_avaliacao + 'T12:00'), 'dd/MM/yyyy')}
                          {av.avaliadores?.length > 0 && (
                            <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>
                              {av.avaliadores.map(a => `${a.nome}${a.cargo ? ` (${a.cargo})` : ''}`).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Star size={12} fill="#fcc825" color="#fcc825" />
                          <span style={{ fontSize: '13px', fontWeight: '700', color: tomarAcao ? '#EF4444' : '#fcc825' }}>{av.media}</span>
                          {tomarAcao && <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)' }}>⚠️ TOMAR AÇÃO</span>}
                        </div>
                      </div>
                      {CRITERIOS.map(c => (
                        <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#555' }}>{c.label}</span>
                          <StarRating value={av[c.key]} disabled />
                        </div>
                      ))}
                      {av.observacao && <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid #1e1e1e', paddingTop: '8px' }}>{av.observacao}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ABA DISPONIBILIDADE */}
            {aba === 'disponibilidade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grade de disponibilidade</div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', paddingLeft: '36px' }}>
                    {DIAS_LABEL.map(d => (
                      <div key={d} style={{ width: '36px', flexShrink: 0, textAlign: 'center', fontSize: '9px', color: '#555', fontWeight: '600' }}>{d}</div>
                    ))}
                  </div>
                  {HORARIOS_GRADE.map(horario => (
                    <div key={horario} style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
                      <div style={{ width: '32px', flexShrink: 0, fontSize: '9px', color: '#444', textAlign: 'right', paddingRight: '4px' }}>{horario}</div>
                      {DIAS_SEMANA.map(dia => {
                        const status = getStatusDisp(dia, horario)
                        return (
                          <div key={dia} style={{ width: '36px', height: '28px', flexShrink: 0, borderRadius: '6px', backgroundColor: status ? COR_DISP[status] + '25' : '#111', border: `1px solid ${status ? COR_DISP[status] + '60' : '#1e1e1e'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {status && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COR_DISP[status] }} />}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
                  {[['disponivel','#22c55e','Disponível'],['talvez','#fcc825','Talvez'],['indisponivel','#EF4444','Indisponível']].map(([s,c,l]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c }} />
                      <span style={{ fontSize: '10px', color: '#555' }}>{l}</span>
                    </div>
                  ))}
                </div>
                {disponibilidades.length === 0 && (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: '#444', padding: '20px' }}>
                    Professor ainda não preencheu a disponibilidade
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CRIAR */}
      {modalCriar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setModalCriar(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: '#151515', borderRadius: '20px 20px 0 0', padding: '20px 16px', boxSizing: 'border-box', maxHeight: '70vh', overflowY: 'auto' }}>
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
                <button onClick={() => setModalCriar(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSalvar} disabled={salvando || !form.nome.trim()} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
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