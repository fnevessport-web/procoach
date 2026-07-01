import { useState, useRef, useEffect } from 'react'
import { format, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, X, Upload, Copy, Check, Plus, Trash2, FileText, ExternalLink, Lock, LockOpen, Hash } from 'lucide-react'
import {
  useCustoProfessores,
  useAulasProfessorFinanceiro,
  useLancamentosFinanceiro,
  useSalvarLancamento,
  useRemoverLancamento,
  useBoletosProfessor,
  usePagamentosConfirmados,
  useConfirmarPagamento,
  useDesfazerPagamento,
  useLiberacoesPagamento,
  useLiberar,
  useDesautorizar,
} from '../../hooks/useFinanceiro'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

// ──────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────

const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

const PIN_KEY = 'procoach_pin_fin'

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

function Avatar({ src, nome, size = 44, borderColor }) {
  const [imgError, setImgError] = useState(false)
  const iniciais = (nome || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const border = borderColor ? `2.5px solid ${borderColor}` : '2px solid #2a2a2a'
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={nome}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0, border,
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
      fontSize: size * 0.33, fontWeight: '700', color: 'white', border,
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
// PinModal — bottom sheet com teclado numérico
// ──────────────────────────────────────────────────────────────────────

function PinModal({ initialMode, professorId, mes, ano, onClose, onAutorizado }) {
  const [mode, setMode] = useState(initialMode)
  const [digits, setDigits] = useState([])
  const [firstPin, setFirstPin] = useState('')
  const [erro, setErro] = useState('')
  const liberar = useLiberar()

  async function handleSubmit(pin) {
    if (mode === 'config1') {
      setFirstPin(pin)
      setDigits([])
      setMode('config2')
      return
    }

    if (mode === 'config2') {
      if (pin !== firstPin) {
        setErro('PINs não coincidem. Tente novamente.')
        setDigits([])
        setFirstPin('')
        setMode('config1')
        return
      }
      localStorage.setItem(PIN_KEY, pin)
      if (professorId) {
        try {
          await liberar.mutateAsync({ professorId, mes, ano })
          onAutorizado()
          onClose()
        } catch (err) {
          setErro('Erro ao salvar: ' + (err.message || 'tente novamente'))
          setDigits([])
        }
      } else {
        onClose()
      }
      return
    }

    // mode === 'verificar'
    const saved = localStorage.getItem(PIN_KEY)
    if (!saved) { setDigits([]); setMode('config1'); return }
    if (pin !== saved) { setErro('PIN incorreto'); setDigits([]); return }
    try {
      await liberar.mutateAsync({ professorId, mes, ano })
      onAutorizado()
      onClose()
    } catch (err) {
      setErro('Erro ao autorizar: ' + (err.message || 'tente novamente'))
      setDigits([])
    }
  }

  function appendDigit(d) {
    if (digits.length >= 4) return
    const next = [...digits, d]
    setDigits(next)
    setErro('')
    if (next.length === 4) handleSubmit(next.join(''))
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') appendDigit(e.key)
      else if (e.key === 'Backspace') setDigits(d => { setErro(''); return d.slice(0, -1) })
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [digits, mode, firstPin])

  const LABELS = {
    config1: 'Crie seu PIN de autorização',
    config2: 'Confirme o PIN',
    verificar: 'Digite o PIN para autorizar',
  }

  const PAD = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del']

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0', padding: '20px 28px 44px', width: '100%', maxWidth: '400px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#333', margin: '0 auto 20px' }} />

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Hash size={22} color="#fcc825" style={{ marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>{LABELS[mode]}</div>
          {erro && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>{erro}</div>}
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginBottom: '32px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '14px', height: '14px', borderRadius: '50%',
              backgroundColor: digits.length > i ? '#fcc825' : '#333',
              transition: 'background-color 0.12s',
            }} />
          ))}
        </div>

        {/* Number pad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {PAD.map((n, i) => {
            if (n === null) return <div key={i} />
            const isDel = n === 'del'
            return (
              <button
                key={i}
                onClick={() => isDel ? setDigits(d => d.slice(0, -1)) : appendDigit(String(n))}
                disabled={liberar.isPending}
                style={{
                  padding: '18px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  backgroundColor: isDel ? 'transparent' : '#252525',
                  color: isDel ? '#777' : '#F0F2F5',
                  fontSize: isDel ? '18px' : '22px', fontWeight: '500',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isDel ? '⌫' : n}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// DetalhesDiaModal — aulas de um dia específico do professor
// ──────────────────────────────────────────────────────────────────────

function DetalhesDiaModal({ dataStr, aulas, valorUnitario, onClose }) {
  const dataFmt = format(parseISO(dataStr + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })

  function getInfo(a) {
    if (a.turma_id && a.turmas) {
      return {
        nome: a.turmas.nome,
        horario: a.turmas.horario_inicio,
        quadra: a.turmas.quadras?.nome || '',
      }
    }
    const partes = (a.observacoes || '').split('·').map(s => s.trim())
    return { nome: 'Avulsa', horario: partes[2] || '', quadra: partes[1] || '' }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 900, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', width: '100%', maxWidth: '480px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#333', margin: '0 auto 16px' }} />

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#F0F2F5', textTransform: 'capitalize' }}>{dataFmt}</div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{aulas.length} aula{aulas.length !== 1 ? 's' : ''}</div>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {aulas.map((a, i) => {
            const info = getInfo(a)
            return (
              <div key={a.id || i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderRadius: '10px',
                backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                  backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '700', color: '#fcc825', textAlign: 'center', lineHeight: 1.2,
                }}>
                  {info.horario || '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>{info.nome}</div>
                  {info.quadra && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{info.quadra}</div>}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825', flexShrink: 0 }}>
                  {fmtBRL(valorUnitario)}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#555' }}>Total do dia</span>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#fcc825' }}>{fmtBRL(aulas.length * valorUnitario)}</span>
        </div>
      </div>
    </div>
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
  const [pinModal, setPinModal] = useState(null)   // { professorId, initialMode }
  const [detalhesDia, setDetalhesDia] = useState(null) // { dataStr, aulas }

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

  // Cap em hoje para não contar aulas futuras
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const dataFimEfetivo = dataFim > hoje ? hoje : dataFim

  // Hooks de dados
  const { data: custosProf = [], isLoading: loadingCustos } = useCustoProfessores({
    empresa: empresaId, dataInicio, dataFim: dataFimEfetivo,
  })
  const { data: lancamentos = [] } = useLancamentosFinanceiro({
    empresa: empresaId, mes, ano: anoSel,
  })
  const { data: aulasProf = [], isLoading: loadingAulasProf } = useAulasProfessorFinanceiro({
    professorId: professorSel?.id, empresa: empresaId, dataInicio, dataFim: dataFimEfetivo,
  })
  const { data: boletos = [] } = useBoletosProfessor(professorSel?.id)

  const salvarLancamento = useSalvarLancamento()
  const removerLancamento = useRemoverLancamento()
  const confirmarPagamento = useConfirmarPagamento()
  const desfazerPagamento = useDesfazerPagamento()
  const { data: pagamentosConfirmados = new Set() } = usePagamentosConfirmados({ mes, ano: anoSel })
  const { data: liberacoes = new Set() } = useLiberacoesPagamento({ mes, ano: anoSel })
  const desautorizar = useDesautorizar()

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
  const pagamentoConfirmado = professorSel ? pagamentosConfirmados.has(professorSel.id) : false
  const pagamentoAutorizado = professorSel ? liberacoes.has(professorSel.id) : false

  function handleAbrirPin(professorId, e) {
    if (e) e.stopPropagation()
    const hasPin = !!localStorage.getItem(PIN_KEY)
    setPinModal({ professorId, initialMode: hasPin ? 'verificar' : 'config1' })
  }

  async function handleDesautorizar(professorId, e) {
    if (e) e.stopPropagation()
    try {
      await desautorizar.mutateAsync({ professorId, mes, ano: anoSel })
      toast.success('Autorização removida', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleConfirmarPagamento() {
    if (!professorSel) return
    if (!pagamentoAutorizado) {
      toast.error('Aguarde a liberação da Coordenação para prosseguir com o pagamento.', {
        style: { ...toastStyle, border: '1px solid rgba(239,68,68,0.4)' },
        duration: 4000,
      })
      return
    }
    try {
      await confirmarPagamento.mutateAsync({ professorId: professorSel.id, mes, ano: anoSel })
      toast.success('✅ Pagamento confirmado!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleDesfazerPagamento() {
    if (!professorSel) return
    try {
      await desfazerPagamento.mutateAsync({ professorId: professorSel.id, mes, ano: anoSel })
      toast.success('Pagamento desmarcado', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

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
    const temPin = !!localStorage.getItem(PIN_KEY)
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
            Financeiro
          </h1>
          <button
            onClick={() => setPinModal({ professorId: null, initialMode: 'config1' })}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 12px', borderRadius: '9px',
              border: temPin ? '1px solid rgba(252,200,37,0.3)' : '1px solid #2a2a2a',
              background: temPin ? 'rgba(252,200,37,0.06)' : '#1a1a1a',
              color: temPin ? '#fcc825' : '#555',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <Hash size={11} />
            {temPin ? 'Alterar PIN' : 'Criar PIN'}
          </button>
        </div>

        {pinModal && (
          <PinModal
            initialMode={pinModal.initialMode}
            professorId={pinModal.professorId}
            mes={mes}
            ano={anoSel}
            onClose={() => setPinModal(null)}
            onAutorizado={() => toast.success('Pagamento autorizado!', { style: toastStyle })}
          />
        )}

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

    // Agrupa aulas por dia
    const porDia = {}
    aulasProf.forEach(a => {
      if (!porDia[a.data_aula]) porDia[a.data_aula] = []
      porDia[a.data_aula].push(a)
    })
    const diasOrdenados = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))

    return (
      <div className="fade-in">
        {/* Breadcrumb + X */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button onClick={voltarEmpresa} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '13px', padding: 0,
          }}>
            <ChevronLeft size={16} /> {empresa?.nome}
          </button>
          <button onClick={voltarEmpresa} style={{
            width: '32px', height: '32px', borderRadius: '8px',
            border: '1px solid #2a2a2a', background: '#1a1a1a',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color="#555" />
          </button>
        </div>

        {/* Header professor */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          backgroundColor: '#1a1a1a', borderRadius: '14px',
          border: pagamentoConfirmado ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.06)',
          padding: '16px', marginBottom: '14px',
        }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={professorSel.foto_url} nome={professorSel.nome} size={56}
              borderColor={pagamentoConfirmado ? '#22c55e' : undefined} />
            {pagamentoConfirmado && (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '18px', height: '18px', borderRadius: '50%',
                backgroundColor: '#22c55e', border: '2px solid #1a1a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={10} color="white" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5' }}>
              {professorSel.nome}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              {professorSel.banco && (
                <span style={{ fontSize: '11px', color: '#555' }}>{professorSel.banco}</span>
              )}
              {temBoleto && (
                <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: '10px', fontWeight: '600' }}>Boleto</span>
              )}
              {pagamentoAutorizado
                ? <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <LockOpen size={9} /> Autorizado
                  </span>
                : <span
                    onClick={e => handleAbrirPin(professorSel.id, e)}
                    style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#555', fontSize: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Lock size={9} /> Aguardando coord.
                  </span>
              }
              {pagamentoConfirmado && (
                <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '10px', fontWeight: '600' }}>✓ Pago</span>
              )}
            </div>
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

        {/* PIX ITAÚ */}
        {temPix && professorSel.chave_pix && (
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: '12px',
            border: '1px solid rgba(249,115,22,0.25)', padding: '14px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '10px', color: '#f97316', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
              PIX ITAÚ
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => {
                navigator.clipboard.writeText(professorSel.chave_pix)
                toast.success('PIX copiado!', { style: toastStyle })
              }} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                border: '1px solid rgba(249,115,22,0.3)',
                backgroundColor: 'rgba(249,115,22,0.06)',
                cursor: 'pointer',
              }}>
                <Copy size={14} color="#f97316" />
                <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', color: '#f97316', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {professorSel.chave_pix}
                </span>
              </button>
              {!pagamentoConfirmado ? (
                <button onClick={handleConfirmarPagamento} disabled={confirmarPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none',
                  backgroundColor: pagamentoAutorizado ? '#22c55e' : '#2a2a2a',
                  color: pagamentoAutorizado ? 'white' : '#555',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  {pagamentoAutorizado ? <Check size={14} /> : <Lock size={14} />}
                  Pago
                </button>
              ) : (
                <button onClick={handleDesfazerPagamento} disabled={desfazerPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px',
                  backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)',
                  fontSize: '12px', fontWeight: '700', color: '#22c55e', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Check size={14} /> Confirmado
                </button>
              )}
            </div>
            {/* Titular da conta */}
            {(professorSel.nome_titular || professorSel.cpf_titular) && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#444', paddingLeft: '2px' }}>
                {professorSel.nome_titular && <span>{professorSel.nome_titular}</span>}
                {professorSel.nome_titular && professorSel.cpf_titular && <span style={{ color: '#333', margin: '0 5px' }}>·</span>}
                {professorSel.cpf_titular && <span>CPF {professorSel.cpf_titular}</span>}
              </div>
            )}
          </div>
        )}

        {/* Boleto (apenas para quem paga via boleto) */}
        {temBoleto && (
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: '12px',
            border: '1px solid rgba(96,165,250,0.2)', padding: '14px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
              Boleto — {MESES_ABREV[mesSel]}/{anoSel}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {boletoMes?.boleto_url ? (
                <a href={boletoMes.boleto_url} target="_blank" rel="noreferrer" style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '10px',
                  border: '1px solid rgba(96,165,250,0.3)', backgroundColor: 'rgba(96,165,250,0.06)',
                  color: '#60a5fa', fontSize: '12px', fontWeight: '600', textDecoration: 'none',
                }}>
                  <FileText size={14} /> Ver boleto
                </a>
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '10px', borderRadius: '10px', border: '1px dashed #2a2a2a',
                  color: '#555', fontSize: '12px',
                }}>
                  Sem boleto
                </div>
              )}
              {!pagamentoConfirmado ? (
                <button onClick={handleConfirmarPagamento} disabled={confirmarPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none',
                  backgroundColor: pagamentoAutorizado ? '#22c55e' : '#2a2a2a',
                  color: pagamentoAutorizado ? 'white' : '#555',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  {pagamentoAutorizado ? <Check size={14} /> : <Lock size={14} />}
                  Pago
                </button>
              ) : (
                <button onClick={handleDesfazerPagamento} disabled={desfazerPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px',
                  backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)',
                  fontSize: '12px', fontWeight: '700', color: '#22c55e', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Check size={14} /> Confirmado
                </button>
              )}
            </div>
          </div>
        )}

        {/* NF — universal para todos os professores */}
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: '12px',
          border: '1px solid rgba(252,200,37,0.15)', padding: '14px',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '10px', color: '#fcc825', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            NF — {MESES_ABREV[mesSel]}/{anoSel}
          </div>
          {boletoMes?.nf_url ? (
            <a href={boletoMes.nf_url} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '10px',
              border: '1px solid rgba(252,200,37,0.3)', backgroundColor: 'rgba(252,200,37,0.06)',
              color: '#fcc825', fontSize: '12px', fontWeight: '600', textDecoration: 'none',
            }}>
              <FileText size={14} /> Ver Nota Fiscal
              <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
            </a>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px', borderRadius: '10px',
              border: '1px dashed rgba(252,200,37,0.15)',
              color: '#444', fontSize: '12px',
            }}>
              Nenhuma NF enviada
            </div>
          )}
        </div>

        {/* Resumo por dia */}
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Aulas no período
        </div>

        {/* PIN modal */}
        {pinModal && (
          <PinModal
            initialMode={pinModal.initialMode}
            professorId={pinModal.professorId}
            mes={mes}
            ano={anoSel}
            onClose={() => setPinModal(null)}
            onAutorizado={() => toast.success('Pagamento autorizado!', { style: toastStyle })}
          />
        )}

        {/* Detalhes dia modal */}
        {detalhesDia && (
          <DetalhesDiaModal
            dataStr={detalhesDia.dataStr}
            aulas={detalhesDia.aulas}
            valorUnitario={valorUnitarioProf}
            onClose={() => setDetalhesDia(null)}
          />
        )}

        {loadingAulasProf ? <Loading /> : diasOrdenados.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#555', textAlign: 'center', padding: '24px' }}>
            Nenhuma aula encontrada
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {diasOrdenados.map(([dataStr, aulasNoDia]) => {
              const dataFmt = format(parseISO(dataStr + 'T12:00:00'), "dd/MM · EEEE", { locale: ptBR })
              const totalDia = aulasNoDia.length * valorUnitarioProf
              const pct = Math.round((aulasNoDia.length / Math.max(...diasOrdenados.map(([,a]) => a.length), 1)) * 100)
              return (
                <button
                  key={dataStr}
                  onClick={() => setDetalhesDia({ dataStr, aulas: aulasNoDia })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px',
                    backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.04)',
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: '90px' }}>
                    <div style={{ fontSize: '12px', color: '#F0F2F5', fontWeight: '600', textTransform: 'capitalize' }}>
                      {dataFmt}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <div style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: '#222', overflow: 'hidden', width: '60px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, #fcc825, #cf1b9b)' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '11px', color: '#555' }}>
                      {aulasNoDia.length} {aulasNoDia.length === 1 ? 'aula' : 'aulas'}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: '#fcc825', fontWeight: '700' }}>
                    {fmtBRL(totalDia)}
                  </span>
                </button>
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

      {/* PIN modal (can be opened from professor list) */}
      {pinModal && (
        <PinModal
          initialMode={pinModal.initialMode}
          professorId={pinModal.professorId}
          mes={mes}
          ano={anoSel}
          onClose={() => setPinModal(null)}
          onAutorizado={() => toast.success('Pagamento autorizado!', { style: toastStyle })}
        />
      )}

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
              const pago = pagamentosConfirmados.has(prof.id)
              const autorizado = liberacoes.has(prof.id)
              return (
                <button key={prof.id} onClick={() => navegarProfessor(prof)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  textAlign: 'left', width: '100%',
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar src={prof.foto_url} nome={prof.nome} size={40}
                      borderColor={pago ? '#22c55e' : undefined} />
                    {pago && (
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: '14px', height: '14px', borderRadius: '50%',
                        backgroundColor: '#22c55e', border: '2px solid #1a1a1a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={8} color="white" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: pago ? '#22c55e' : '#F0F2F5' }}>{prof.nome}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: pago ? '#22c55e' : '#EF4444', flexShrink: 0, marginLeft: '8px' }}>
                        {fmtBRL(prof.totalValor)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: '#222', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: '2px',
                          background: pago ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #ef4444, #dc2626)',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '10px', color: '#555', minWidth: '28px', textAlign: 'right' }}>
                        {prof.totalAulas}×
                      </span>
                    </div>
                  </div>
                  {/* Lock icon — coordinator authorization */}
                  <div
                    onClick={autorizado
                      ? e => handleDesautorizar(prof.id, e)
                      : e => handleAbrirPin(prof.id, e)
                    }
                    style={{ flexShrink: 0, padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {autorizado
                      ? <LockOpen size={16} color="#22c55e" />
                      : <Lock size={16} color="#3a3a3a" />
                    }
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
