import { useState, useRef } from 'react'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, Upload, Copy, Check, Plus, Trash2, FileText, ExternalLink } from 'lucide-react'
import {
  useCustoProfessores,
  useAulasProfessorFinanceiro,
  useLancamentosFinanceiro,
  useSalvarLancamento,
  useRemoverLancamento,
  useBoletosProfessor,
} from '../../hooks/useFinanceiro'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

// ──────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────

const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

const EMPRESAS = {
  procopio: {
    id: 'procopio',
    nome: 'Procopio',
    cor: '#fcc825',
    corBg: 'rgba(252,200,37,0.08)',
    corBorda: 'rgba(252,200,37,0.25)',
    logo: '/images/logoprocopio.png',
  },
  beach_arena: {
    id: 'beach_arena',
    nome: 'Beach Arena',
    cor: '#cf1b9b',
    corBg: 'rgba(207,27,155,0.08)',
    corBorda: 'rgba(207,27,155,0.25)',
    logo: '/images/logobeacharena.png',
  },
}

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#111', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function inicioMes(mes, ano) {
  return format(new Date(ano, mes, 1), 'yyyy-MM-dd')
}

function fimMes(mes, ano) {
  return format(endOfMonth(new Date(ano, mes, 1)), 'yyyy-MM-dd')
}

// ──────────────────────────────────────────────────────────────────────
// Sub-componentes pequenos
// ──────────────────────────────────────────────────────────────────────

function Avatar({ src, nome, size = 44 }) {
  const [imgError, setImgError] = useState(false)
  const iniciais = (nome || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={nome}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '2px solid #2a2a2a',
        }}
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: '700', color: 'white',
    }}>
      {iniciais}
    </div>
  )
}

function PixButton({ chave }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(chave)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button onClick={copiar} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 14px', borderRadius: '10px',
      border: '1px solid rgba(252,200,37,0.3)',
      backgroundColor: 'rgba(252,200,37,0.06)',
      cursor: 'pointer', width: '100%', boxSizing: 'border-box',
    }}>
      {copiado ? <Check size={14} color="#22c55e" /> : <Copy size={14} color="#fcc825" />}
      <span style={{ flex: 1, textAlign: 'left', fontSize: '12px', color: copiado ? '#22c55e' : '#fcc825', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copiado ? 'Copiado!' : chave}
      </span>
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────────────

export function FinanceiroPage() {
  const now = new Date()
  const [view, setView] = useState('empresas') // 'empresas' | 'empresa' | 'professor'
  const [empresaId, setEmpresaId] = useState(null)
  const [mesSel, setMesSel] = useState(now.getMonth())   // 0-11
  const [anoSel, setAnoSel] = useState(now.getFullYear())
  const [dataInicio, setDataInicio] = useState(inicioMes(now.getMonth(), now.getFullYear()))
  const [dataFim, setDataFim] = useState(fimMes(now.getMonth(), now.getFullYear()))
  const [professorSel, setProfessorSel] = useState(null)

  // Form: receita
  const [valorReceitaInput, setValorReceitaInput] = useState('')
  const [uploadingReceita, setUploadingReceita] = useState(false)
  const receitaFileRef = useRef()

  // Form: outros custos
  const [showFormCusto, setShowFormCusto] = useState(false)
  const [formCusto, setFormCusto] = useState({ descricao: '', valor: '' })
  const [uploadingCusto, setUploadingCusto] = useState(false)
  const custoFileRef = useRef()
  const [custoArqPendente, setCustoArqPendente] = useState(null) // { url, nome }

  const empresa = EMPRESAS[empresaId]
  const mes = mesSel + 1 // 1-12

  // Hooks de dados
  const { data: custosProf = [], isLoading: loadingCustos } = useCustoProfessores({
    empresa: empresaId, dataInicio, dataFim,
  })
  const { data: lancamentos = [] } = useLancamentosFinanceiro({
    empresa: empresaId, mes, ano: anoSel,
  })
  const { data: aulasProf = [], isLoading: loadingAulasProf } = useAulasProfessorFinanceiro({
    professorId: professorSel?.id, empresa: empresaId, dataInicio, dataFim,
  })
  const { data: boletos = [] } = useBoletosProfessor(professorSel?.id)

  const salvarLancamento = useSalvarLancamento()
  const removerLancamento = useRemoverLancamento()

  // Derived
  const receitaRecord = lancamentos.find(l => l.tipo === 'receita')
  const outrosCustos = lancamentos.filter(l => l.tipo === 'custo_extra')
  const totalProfessores = custosProf.reduce((s, p) => s + p.totalValor, 0)
  const totalOutros = outrosCustos.reduce((s, c) => s + Number(c.valor), 0)
  const totalCustos = totalProfessores + totalOutros
  const maxValorProf = Math.max(...custosProf.map(p => p.totalValor), 1)
  const boletoMes = boletos.find(b => b.mes === mes && b.ano === anoSel)
  const totalAulasProf = aulasProf.length
  const valorUnitarioProf = Number(professorSel?.valor_aula || professorSel?.valor_hora_aula || 0)
  const totalPagarProf = totalAulasProf * valorUnitarioProf

  function navegarEmpresa(id) {
    setEmpresaId(id)
    setView('empresa')
  }

  function navegarProfessor(prof) {
    setProfessorSel(prof)
    setView('professor')
  }

  function voltarEmpresa() {
    setProfessorSel(null)
    setView('empresa')
  }

  function voltarEmpresas() {
    setEmpresaId(null)
    setProfessorSel(null)
    setView('empresas')
  }

  function selecionarMes(idx) {
    setMesSel(idx)
    setDataInicio(inicioMes(idx, anoSel))
    setDataFim(fimMes(idx, anoSel))
  }

  async function handleSalvarReceita() {
    if (!valorReceitaInput) return toast.error('Informe o valor do repasse', { style: toastStyle })
    const valor = parseFloat(valorReceitaInput.replace(',', '.'))
    if (isNaN(valor)) return toast.error('Valor inválido', { style: toastStyle })
    try {
      const payload = {
        empresa: empresaId, tipo: 'receita',
        descricao: 'Repasse do clube',
        valor, mes, ano: anoSel,
        ...(receitaRecord?.id ? {} : {}),
      }
      if (receitaRecord?.id) payload.id = receitaRecord.id
      await salvarLancamento.mutateAsync(payload)
      setValorReceitaInput('')
      toast.success('Receita salva!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleUploadRelatorio(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingReceita(true)
    try {
      const path = `financeiro/${empresaId}/receita_${anoSel}_${mes}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      const payload = {
        empresa: empresaId, tipo: 'receita',
        descricao: 'Repasse do clube',
        valor: receitaRecord?.valor || 0,
        mes, ano: anoSel,
        arquivo_url: publicUrl,
        arquivo_nome: file.name,
      }
      if (receitaRecord?.id) payload.id = receitaRecord.id
      await salvarLancamento.mutateAsync(payload)
      toast.success('Relatório anexado!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
    finally { setUploadingReceita(false) }
  }

  async function handleUploadNFCusto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCusto(true)
    try {
      const path = `financeiro/${empresaId}/nf_${Date.now()}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      setCustoArqPendente({ url: publicUrl, nome: file.name })
      toast.success('NF anexada!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
    finally { setUploadingCusto(false) }
  }

  async function handleSalvarCusto() {
    if (!formCusto.descricao.trim() || !formCusto.valor) return toast.error('Preencha descrição e valor', { style: toastStyle })
    const valor = parseFloat(formCusto.valor.replace(',', '.'))
    if (isNaN(valor)) return toast.error('Valor inválido', { style: toastStyle })
    try {
      await salvarLancamento.mutateAsync({
        empresa: empresaId, tipo: 'custo_extra',
        descricao: formCusto.descricao,
        valor, mes, ano: anoSel,
        arquivo_url: custoArqPendente?.url || null,
        arquivo_nome: custoArqPendente?.nome || null,
      })
      setFormCusto({ descricao: '', valor: '' })
      setCustoArqPendente(null)
      setShowFormCusto(false)
      toast.success('Custo adicionado!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleRemoverCusto(id) {
    try {
      await removerLancamento.mutateAsync(id)
      toast.success('Removido!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  // ── Filtro de mês (barra horizontal compacta) ──────────────────────
  function FiltroMes() {
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
          {MESES_ABREV.map((m, idx) => {
            const ativo = idx === mesSel
            return (
              <button key={m} onClick={() => selecionarMes(idx)} style={{
                flexShrink: 0, padding: '6px 10px', borderRadius: '8px', border: 'none',
                fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                background: ativo ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                color: ativo ? 'white' : '#555',
                outline: ativo ? 'none' : '1px solid #2a2a2a',
              }}>{m}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>De</span>
          <input type="date" value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', flex: 1 }} />
          <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>Até</span>
          <input type="date" value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', flex: 1 }} />
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW: seleção de empresa
  // ══════════════════════════════════════════════════════════════════════
  if (view === 'empresas') {
    return (
      <div className="fade-in">
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', marginBottom: '20px' }}>
          Financeiro
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {Object.values(EMPRESAS).map(emp => (
            <button key={emp.id} onClick={() => navegarEmpresa(emp.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '24px 16px',
              backgroundColor: '#1a1a1a',
              border: `1px solid ${emp.corBorda}`,
              borderRadius: '16px', cursor: 'pointer',
              background: emp.corBg,
              minHeight: '130px',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = emp.cor}
              onMouseLeave={e => e.currentTarget.style.borderColor = emp.corBorda}
            >
              <img src={emp.logo} alt={emp.nome}
                style={{ maxWidth: '90px', maxHeight: '44px', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div style={{ fontSize: '12px', fontWeight: '600', color: emp.cor, letterSpacing: '0.5px' }}>
                {emp.nome}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW: detalhe do professor
  // ══════════════════════════════════════════════════════════════════════
  if (view === 'professor' && professorSel) {
    const temPix = professorSel.tipo_pagamento === 'pix' || (professorSel.banco === 'Itaú' && professorSel.chave_pix)
    const temBoleto = professorSel.tipo_pagamento === 'boleto'

    return (
      <div className="fade-in">
        {/* Breadcrumb */}
        <button onClick={voltarEmpresa} style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px',
          background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '13px', padding: 0,
        }}>
          <ChevronLeft size={16} /> {empresa?.nome}
        </button>

        {/* Header professor */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          backgroundColor: '#1a1a1a', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
          marginBottom: '14px',
        }}>
          <Avatar src={professorSel.foto_url} nome={professorSel.nome} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5' }}>
              {professorSel.nome}
            </div>
            {professorSel.banco && (
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                {professorSel.banco}
                {professorSel.tipo_pagamento === 'boleto' && (
                  <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: '10px' }}>Boleto</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Total */}
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: '14px',
          border: '1px solid rgba(252,200,37,0.2)', padding: '16px',
          marginBottom: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total a pagar — {MESES_ABREV[mesSel]}/{anoSel}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#fcc825' }}>
            {fmtBRL(totalPagarProf)}
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
            {totalAulasProf} aulas × {fmtBRL(valorUnitarioProf)}
          </div>
        </div>

        {/* PIX */}
        {temPix && professorSel.chave_pix && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chave PIX</div>
            <PixButton chave={professorSel.chave_pix} />
          </div>
        )}

        {/* Boleto */}
        {temBoleto && (
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: '12px',
            border: '1px solid rgba(59,130,246,0.2)', padding: '14px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '600', marginBottom: '8px' }}>
              📄 Boleto — {MESES_ABREV[mesSel]}/{anoSel}
            </div>
            {boletoMes?.boleto_url ? (
              <a href={boletoMes.boleto_url} target="_blank" rel="noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                border: '1px solid rgba(59,130,246,0.3)',
                backgroundColor: 'rgba(59,130,246,0.06)',
                color: '#60a5fa', fontSize: '12px', textDecoration: 'none',
              }}>
                <ExternalLink size={14} /> Ver boleto
              </a>
            ) : (
              <div style={{ fontSize: '12px', color: '#555' }}>
                Nenhum boleto enviado para {MESES_ABREV[mesSel]}/{anoSel}
              </div>
            )}
          </div>
        )}

        {/* Aulas do período */}
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Aulas no período
        </div>

        {loadingAulasProf ? <Loading /> : aulasProf.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#555', textAlign: 'center', padding: '24px' }}>
            Nenhuma aula encontrada
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {aulasProf.map(a => {
              const dataFmt = format(parseISO(a.data_aula + 'T12:00:00'), "dd/MM", { locale: ptBR })
              const nomeTurma = a.turma_id ? (a.turmas?.nome || 'Turma') : 'Avulsa'
              const horario = a.turma_id ? (a.turmas?.horario_inicio?.slice(0, 5) || '') : ''
              const quadra = a.turma_id ? (a.turmas?.quadras?.nome || '') : ''
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '10px',
                  backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#888', fontWeight: '600', minWidth: '36px' }}>{dataFmt}</span>
                    <div>
                      <div style={{ fontSize: '12px', color: '#F0F2F5' }}>{nomeTurma}</div>
                      {(horario || quadra) && (
                        <div style={{ fontSize: '10px', color: '#555' }}>
                          {[horario, quadra].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#fcc825', fontWeight: '600' }}>
                    {fmtBRL(valorUnitarioProf)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW: financeiro da empresa
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <button onClick={voltarEmpresas} style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px',
        background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '13px', padding: 0,
      }}>
        <ChevronLeft size={16} /> Financeiro
      </button>

      {/* Logo + nome empresa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <img src={empresa?.logo} alt={empresa?.nome}
          style={{ height: '28px', objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none' }}
        />
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: empresa?.cor, margin: 0 }}>
          {empresa?.nome}
        </h2>
      </div>

      {/* Filtro mês */}
      <FiltroMes />

      {/* ── RECEITA ───────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#1a1a1a', borderRadius: '14px',
        border: '1px solid rgba(34,197,94,0.15)', padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ↑ Receita
          </div>
          {receitaRecord && (
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>
              {fmtBRL(receitaRecord.valor)}
            </div>
          )}
        </div>

        {/* Upload relatório */}
        <input type="file" ref={receitaFileRef} style={{ display: 'none' }}
          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg"
          onChange={handleUploadRelatorio}
        />
        <button onClick={() => receitaFileRef.current?.click()} disabled={uploadingReceita} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', padding: '10px 14px', borderRadius: '10px',
          border: '1px dashed #2a2a2a', background: 'none', cursor: 'pointer',
          color: '#555', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box',
        }}>
          <Upload size={14} />
          {uploadingReceita ? 'Enviando...' : receitaRecord?.arquivo_nome ? `📄 ${receitaRecord.arquivo_nome}` : 'Anexar relatório do clube'}
          {receitaRecord?.arquivo_url && (
            <a href={receitaRecord.arquivo_url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ marginLeft: 'auto', color: '#555' }}>
              <ExternalLink size={13} />
            </a>
          )}
        </button>

        {/* Input valor */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '12px', color: '#555', pointerEvents: 'none',
            }}>R$</span>
            <input
              type="text"
              placeholder="0,00"
              value={valorReceitaInput}
              onChange={e => setValorReceitaInput(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '32px' }}
            />
          </div>
          <button onClick={handleSalvarReceita} disabled={salvarLancamento.isPending} style={{
            padding: '10px 18px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', flexShrink: 0,
          }}>
            Salvar
          </button>
        </div>
      </div>

      {/* ── CUSTOS PROFESSORES ────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#1a1a1a', borderRadius: '14px',
        border: '1px solid rgba(239,68,68,0.15)', padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ↓ Custo Professores
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#EF4444' }}>
            {fmtBRL(totalProfessores)}
          </div>
        </div>

        {loadingCustos ? <Loading /> : custosProf.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#555', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma aula confirmada no período
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {custosProf.map(prof => {
              const pct = Math.round((prof.totalValor / maxValorProf) * 100)
              return (
                <button key={prof.id} onClick={() => navegarProfessor(prof)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  textAlign: 'left', width: '100%',
                }}>
                  <Avatar src={prof.foto_url} nome={prof.nome} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5' }}>{prof.nome}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444', flexShrink: 0, marginLeft: '8px' }}>
                        {fmtBRL(prof.totalValor)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: '#222', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: '2px',
                          background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '10px', color: '#555', minWidth: '28px', textAlign: 'right' }}>
                        {prof.totalAulas}×
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── OUTROS CUSTOS ─────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#1a1a1a', borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ↓ Outros Custos
          </div>
          {outrosCustos.length > 0 && (
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#888' }}>
              {fmtBRL(totalOutros)}
            </div>
          )}
        </div>

        {outrosCustos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {outrosCustos.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px',
                backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#F0F2F5', marginBottom: '1px' }}>{c.descricao}</div>
                  <div style={{ fontSize: '12px', color: '#888', fontWeight: '600' }}>{fmtBRL(c.valor)}</div>
                </div>
                {c.arquivo_url && (
                  <a href={c.arquivo_url} target="_blank" rel="noreferrer" style={{
                    padding: '6px', borderRadius: '8px',
                    backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)',
                    color: '#fcc825', display: 'flex',
                  }}>
                    <FileText size={13} />
                  </a>
                )}
                <button onClick={() => handleRemoverCusto(c.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer', display: 'flex',
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário adicionar custo */}
        {showFormCusto ? (
          <div style={{
            padding: '12px', borderRadius: '12px',
            backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <input
              placeholder="Descrição (ex: Uniforme, Manutenção...)"
              value={formCusto.descricao}
              onChange={e => setFormCusto(f => ({ ...f, descricao: e.target.value }))}
              style={inputStyle}
            />
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '12px', color: '#555', pointerEvents: 'none',
              }}>R$</span>
              <input
                type="text"
                placeholder="0,00"
                value={formCusto.valor}
                onChange={e => setFormCusto(f => ({ ...f, valor: e.target.value }))}
                style={{ ...inputStyle, paddingLeft: '32px' }}
              />
            </div>

            <input type="file" ref={custoFileRef} style={{ display: 'none' }}
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleUploadNFCusto}
            />
            <button onClick={() => custoFileRef.current?.click()} disabled={uploadingCusto} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', borderRadius: '8px',
              border: '1px dashed #2a2a2a', background: 'none', cursor: 'pointer',
              color: custoArqPendente ? '#fcc825' : '#555', fontSize: '12px',
            }}>
              <Upload size={13} />
              {uploadingCusto ? 'Enviando...' : custoArqPendente ? `📄 ${custoArqPendente.nome}` : 'Anexar NF (opcional)'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowFormCusto(false); setFormCusto({ descricao: '', valor: '' }); setCustoArqPendente(null) }}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSalvarCusto} disabled={salvarLancamento.isPending} style={{
                flex: 2, padding: '9px', borderRadius: '9px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>
                {salvarLancamento.isPending ? 'Salvando...' : '+ Adicionar'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowFormCusto(true)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', padding: '10px', borderRadius: '10px',
            border: '1px dashed #2a2a2a', background: 'none',
            color: '#555', fontSize: '12px', cursor: 'pointer', boxSizing: 'border-box',
          }}>
            <Plus size={14} /> Adicionar custo
          </button>
        )}
      </div>

      {/* ── RESUMO TOTAL ──────────────────────────────────────────── */}
      {(receitaRecord || totalCustos > 0) && (
        <div style={{
          backgroundColor: '#151515', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Resumo — {MESES_ABREV[mesSel]}/{anoSel}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {receitaRecord && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#888' }}>Receita (repasse)</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>{fmtBRL(receitaRecord.valor)}</span>
              </div>
            )}
            {totalProfessores > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#888' }}>Custo professores</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#EF4444' }}>- {fmtBRL(totalProfessores)}</span>
              </div>
            )}
            {totalOutros > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#888' }}>Outros custos</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#EF4444' }}>- {fmtBRL(totalOutros)}</span>
              </div>
            )}
            {receitaRecord && totalCustos > 0 && (
              <>
                <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontWeight: '600' }}>Resultado</span>
                  {(() => {
                    const resultado = Number(receitaRecord.valor) - totalCustos
                    return (
                      <span style={{ fontSize: '16px', fontWeight: '700', color: resultado >= 0 ? '#22c55e' : '#EF4444' }}>
                        {resultado >= 0 ? '+' : ''}{fmtBRL(resultado)}
                      </span>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
