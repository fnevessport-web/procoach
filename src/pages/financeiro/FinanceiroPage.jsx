import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, X, Upload, Copy, Check, Plus, Trash2, FileText, ExternalLink, Lock, LockOpen, Hash, Search, Ban } from 'lucide-react'
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
  useRemoverAnexoBoleto,
  dadosPagamentoEmpresa,
} from '../../hooks/useFinanceiro'
import { confirmarAulasElegiveis } from '../../hooks/useAulas'
import { calcularValorAula, aulaComTodosAusentes, calcularMargensTenis } from '../../constants/modalidades'
import { useEmpresaVinculada } from '../../hooks/useProfessores'
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
    cor: 'var(--color-action-primary)',
    corBg: 'rgba(165,76,46,0.08)',
    corBorda: 'rgba(165,76,46,0.25)',
    logo: '/images/logoprocopio.png',
  },
  beach_arena: {
    id: 'beach_arena',
    nome: 'Beach Arena',
    cor: 'var(--color-state-info)',
    corBg: 'rgba(61,107,122,0.08)',
    corBorda: 'rgba(61,107,122,0.25)',
    logo: '/images/logobeacharena.png',
  },
}

const toastStyle = {
  background: 'var(--color-surface-dark-raised)', color: 'var(--color-text-dark-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-dark-overlay)', border: '1px solid var(--color-border-dark)',
  color: 'var(--color-text-dark-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
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

// Um pagamento_extra "pertence" à empresa que está marcada nele (e.empresa).
// Lançamentos antigos (de antes dessa coluna existir) não têm essa marcação —
// pra esses, cai no mesmo critério que já era usado: Beach Arena só se o
// colaborador trabalha lá, Procópio pra todo o resto.
function extraPertenceAEmpresa(extraEmpresa, prof, empresaAlvo) {
  if (extraEmpresa) return extraEmpresa === empresaAlvo
  if (empresaAlvo === 'beach_arena') return !!prof?.trabalha_beach
  return !(prof?.trabalha_beach === true && prof?.trabalha_procopio === false)
}

// ──────────────────────────────────────────────────────────────────────
// Sub-componentes pequenos
// ──────────────────────────────────────────────────────────────────────

function Avatar({ src, nome, size = 44, borderColor }) {
  const [imgError, setImgError] = useState(false)
  const iniciais = (nome || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const border = borderColor ? `2.5px solid ${borderColor}` : '2px solid var(--color-border-dark)'
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
      background: 'var(--color-action-primary)',
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
      border: '1px solid rgba(165,76,46,0.3)',
      backgroundColor: 'rgba(165,76,46,0.06)',
      cursor: 'pointer', width: '100%', boxSizing: 'border-box',
    }}>
      {copiado ? <Check size={14} color="var(--color-state-success)" /> : <Copy size={14} color="var(--color-action-primary)" />}
      <span style={{ flex: 1, textAlign: 'left', fontSize: '12px', color: copiado ? 'var(--color-state-success)' : 'var(--color-action-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copiado ? 'Copiado!' : chave}
      </span>
    </button>
  )
}

// Um campo de anexo/visualização de NF — usado 1x pra professor de empresa só, 2x (uma por
// empresa) pra quem trabalha em ambas.
function CampoNF({ titulo, boleto, onUpload, onExcluir }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--color-action-primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
        {titulo}
      </div>
      {boleto?.nf_url ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href={boleto.nf_url} target="_blank" rel="noreferrer" style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid rgba(165,76,46,0.3)', backgroundColor: 'rgba(165,76,46,0.06)',
            color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600', textDecoration: 'none',
          }}>
            <FileText size={14} /> Ver Nota Fiscal
            <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
          </a>
          <label style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border-dark)', cursor: 'pointer', color: 'var(--color-text-dark-secondary)',
          }}>
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={onUpload} />
            <Upload size={14} />
          </label>
          {onExcluir && (
            <button onClick={onExcluir} title="Excluir Nota Fiscal" style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px', borderRadius: '10px', border: '1px solid rgba(180,71,47,0.3)', background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer',
            }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '10px', borderRadius: '10px',
          border: '1px dashed rgba(165,76,46,0.15)',
          color: 'var(--color-text-dark-secondary)', fontSize: '12px', cursor: 'pointer',
        }}>
          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={onUpload} />
          <Upload size={13} /> Anexar NF
        </label>
      )}
    </div>
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

  // Via portal pro <body>: sem isso, o WebKit mobile prende esse position:fixed dentro do
  // .app-main (que tem overflow-y+scroll-touch) e o modal fica cortado, sem cobrir a tela toda.
  return createPortal((
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '20px 20px 0 0', padding: '20px 28px 44px', width: '100%', maxWidth: '400px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-text-dark-muted)', margin: '0 auto 20px' }} />

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Hash size={22} color="var(--color-action-primary)" style={{ marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{LABELS[mode]}</div>
          {erro && <div style={{ fontSize: '12px', color: 'var(--color-state-danger)', marginTop: '8px' }}>{erro}</div>}
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginBottom: '32px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '14px', height: '14px', borderRadius: '50%',
              backgroundColor: digits.length > i ? 'var(--color-action-primary)' : 'var(--color-text-dark-muted)',
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
                  backgroundColor: isDel ? 'transparent' : 'var(--color-surface-dark-overlay)',
                  color: isDel ? 'var(--color-text-dark-muted)' : 'var(--color-text-dark-primary)',
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
  ), document.body)
}

// ──────────────────────────────────────────────────────────────────────
// DetalhesDiaModal — aulas de um dia específico do professor
// ──────────────────────────────────────────────────────────────────────

function DetalhesDiaModal({ dataStr, professorId, professor, empresaId, totalAulas, valorUnitario, onClose, financeiroState }) {
  const dataFmt = format(parseISO(dataStr + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
  const navigate = useNavigate()

  const { data: aulas = [], isLoading } = useQuery({
    queryKey: ['fin_detalhe_dia', professorId, dataStr],
    queryFn: async () => {
      await confirmarAulasElegiveis({ professorId, dataInicio: dataStr, dataFim: dataStr })
      // 1) busca aulas do dia
      const { data: aulasData, error: e1 } = await supabase
        .from('aulas')
        .select('id, turma_id, observacoes, data_aula, turmas(nome, horario_inicio, quadras(nome), niveis(nome), modalidades(nome))')
        .eq('professor_executou_id', professorId)
        .eq('data_aula', dataStr)
        .eq('status_aula', 'dada')
        .eq('paga_professor', true)
        .order('id')
      if (e1) throw e1
      const lista = aulasData || []
      if (!lista.length) return []

      // 2) busca presenças (sem join — só aula_id e aluno_id)
      const ids = lista.map(a => a.id)
      const { data: presData } = await supabase
        .from('presencas')
        .select('aula_id, status_presenca, aluno_id, tipo_participacao')
        .in('aula_id', ids)

      // 3) busca nomes dos alunos separadamente
      const alunoIds = [...new Set((presData || []).map(p => p.aluno_id).filter(Boolean))]
      let alunoNomes = {}
      if (alunoIds.length > 0) {
        const { data: aData } = await supabase
          .from('alunos').select('id, nome').in('id', alunoIds)
        alunoNomes = Object.fromEntries((aData || []).map(a => [a.id, a.nome]))
      }

      // 4) monta mapa e anexa às aulas
      const mapa = {}
      ;(presData || []).forEach(p => {
        if (!mapa[p.aula_id]) mapa[p.aula_id] = []
        mapa[p.aula_id].push({ ...p, nomeAluno: alunoNomes[p.aluno_id] || null })
      })
      const aulasComPresenca = lista.map(a => ({ ...a, presencas: mapa[a.id] || [] }))
      // Margem líquida por aula (receita da mensalidade − repasse 10% clube − custo do
      // professor) — só pra visão do coordenador, nunca aparece pro professor. Restrito a
      // Tênis/Procópio (calcularMargensTenis retorna undefined pra aula fora desse escopo).
      const { porAula: margemPorAula } = professor ? calcularMargensTenis(aulasComPresenca, professor, empresaId) : { porAula: {} }
      return aulasComPresenca.map(a => ({
        ...a,
        valor: professor ? calcularValorAula(a, professor, empresaId) : valorUnitario,
        margem: margemPorAula[a.id],
      }))
    },
    enabled: !!professorId && !!dataStr,
    staleTime: 30000,
  })

  function getInfo(a) {
    if (a.turma_id && a.turmas) {
      return { nome: a.turmas.nome, horario: a.turmas.horario_inicio?.slice(0,5) || '', quadra: a.turmas.quadras?.nome || '' }
    }
    const partes = (a.observacoes || '').split('·').map(s => s.trim())
    return { nome: 'Avulsa', horario: partes[2] || '', quadra: partes[1] || '' }
  }

  const contagem = aulas.length || totalAulas
  const totalDia = aulas.length ? aulas.reduce((s, a) => s + (a.valor ?? valorUnitario), 0) : contagem * valorUnitario
  const aulasComMargem = aulas.filter(a => a.margem != null)
  const margemDia = aulasComMargem.reduce((s, a) => s + a.margem, 0)

  return createPortal((
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', width: '100%', maxWidth: '480px', maxHeight: '78dvh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-text-dark-muted)', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-dark-primary)', textTransform: 'capitalize' }}>{dataFmt}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>{contagem} aula{contagem !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={16} color="var(--color-state-danger)" />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-dark-secondary)', fontSize: '13px' }}>Carregando...</div>
          ) : aulas.map((a, i) => {
            const info = getInfo(a)
            const presencas = a.presencas || []
            const presentes = presencas.filter(p => p.status_presenca === 'presente').length
            const ausentes = presencas.filter(p => p.status_presenca !== 'presente').length
            return (
              <div
                key={a.id || i}
                onClick={() => navigate('/aulas', { state: { data: dataStr, horario: info.horario, from: '/financeiro', financeiroState } })}
                style={{ backgroundColor: 'var(--color-surface-dark-overlay)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: presencas.length > 0 ? '8px' : 0 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0, backgroundColor: 'rgba(165,76,46,0.08)', border: '1px solid rgba(165,76,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--color-action-primary)', textAlign: 'center', lineHeight: 1.2 }}>
                    {info.horario || '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', fontWeight: '600' }}>{info.nome}</div>
                    {info.quadra && <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '1px' }}>{info.quadra}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{fmtBRL(a.valor ?? valorUnitario)}</div>
                    {/* Margem líquida da aula (receita da mensalidade − repasse clube − custo
                        professor) — só visão do coordenador, o professor nunca vê isso em
                        lugar nenhum. Tom minimalista de propósito (fonte pequena, cor âmbar
                        neutra) pra não virar um selo de "boa/má aula" gritante — é só um
                        número de apoio pra decisão de precificação. */}
                    {a.margem != null && (
                      <div style={{ fontSize: '9px', color: 'var(--color-state-warning)', marginTop: '1px', opacity: 0.85 }}>
                        margem {a.margem >= 0 ? '+' : '−'}{fmtBRL(Math.abs(a.margem))}
                      </div>
                    )}
                    {presencas.length > 0 && (
                      <div style={{ fontSize: '10px', marginTop: '2px' }}>
                        <span style={{ color: 'var(--color-state-success)' }}>✓{presentes}</span>{' '}
                        {ausentes > 0 && <span style={{ color: 'var(--color-state-danger)' }}>✗{ausentes}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {presencas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                    {presencas.map((p, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 0', borderTop: '1px solid var(--color-surface-dark-raised)' }}>
                        {p.status_presenca === 'presente'
                          ? <span style={{ color: 'var(--color-state-success)', fontSize: '13px', fontWeight: '700', lineHeight: 1, flexShrink: 0 }}>✓</span>
                          : <span style={{ color: 'var(--color-state-danger)', fontSize: '13px', fontWeight: '700', lineHeight: 1, flexShrink: 0 }}>✗</span>
                        }
                        <span style={{ fontSize: '12px', color: p.status_presenca === 'presente' ? 'var(--color-text-dark-secondary)' : 'var(--color-text-dark-secondary)' }}>{p.nomeAluno || '—'}</span>
                        {p.status_presenca === 'falta_justificada' && <span style={{ fontSize: '9px', color: 'var(--color-state-warning)', marginLeft: 'auto' }}>just.</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)' }}>Total do dia</span>
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{fmtBRL(totalDia)}</span>
        </div>
        {aulasComMargem.length > 0 && (
          <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-dark-muted)' }}>Margem do dia (só Tênis)</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-state-warning)', opacity: 0.85 }}>
              {margemDia >= 0 ? '+' : '−'}{fmtBRL(Math.abs(margemDia))}
            </span>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}

// ──────────────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────────────

export function FinanceiroPage() {
  const now = new Date()
  const qc = useQueryClient()
  const location = useLocation()
  const savedFin = location.state?.financeiroState
  // Conta vinculada a uma única empresa (ex: "Beach Arena - Financeiro") não pode ver nem
  // acessar por navegação direta os dados financeiros da outra — ver useEmpresaVinculada.
  const empresaVinculada = useEmpresaVinculada()

  const [view, setView] = useState(savedFin?.view || 'empresas') // 'empresas' | 'empresa' | 'professor'
  const [empresaId, setEmpresaId] = useState(savedFin?.empresaId || null)
  const [mesSel, setMesSel] = useState(savedFin?.mesSel ?? now.getMonth())   // 0-11
  const [anoSel, setAnoSel] = useState(savedFin?.anoSel ?? now.getFullYear())
  const [dataInicio, setDataInicio] = useState(inicioMes(savedFin?.mesSel ?? now.getMonth(), savedFin?.anoSel ?? now.getFullYear()))
  const [dataFim, setDataFim] = useState(fimMes(savedFin?.mesSel ?? now.getMonth(), savedFin?.anoSel ?? now.getFullYear()))
  const [professorSel, setProfessorSel] = useState(savedFin?.professorSel || null)
  const [pinModal, setPinModal] = useState(null)   // { professorId, initialMode }
  const [detalhesDia, setDetalhesDia] = useState(null) // { dataStr, aulas }
  const [buscaProf, setBuscaProf] = useState('')
  const [filtroValorAula, setFiltroValorAula] = useState(null) // null = todas; ou um valor específico (120, 100, ...)
  const [filtroSoFalta100, setFiltroSoFalta100] = useState(false) // true = só aulas com 100% de falta na turma

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
    professorId: professorSel?.id, professor: professorSel, empresa: empresaId, dataInicio, dataFim: dataFimEfetivo,
  })
  const { data: boletos = [] } = useBoletosProfessor(professorSel?.id)

  // Extras do professor selecionado (detalhe)
  const { data: extrasProf = [] } = useQuery({
    queryKey: ['pagamentos_extras_fin', professorSel?.id, mes, anoSel],
    queryFn: async () => {
      if (!professorSel?.id) return []
      const { data, error } = await supabase
        .from('pagamentos_extras')
        .select('id, descricao, valor, data_pagamento, empresa')
        .eq('professor_id', professorSel.id)
        .eq('mes', mes)
        .eq('ano', anoSel)
      if (error) return []
      return data || []
    },
    enabled: !!professorSel?.id,
    staleTime: 30000,
  })
  // Só conta os extras da empresa que está sendo vista agora — quem trabalha nas
  // duas empresas (ex: Fernando, Michel) tem lançamentos separados por empresa.
  const extrasProfDaEmpresa = extrasProf.filter(e => extraPertenceAEmpresa(e.empresa, professorSel, empresaId))

  // Extras de todos os professores do mês (para a lista principal)
  const { data: todoExtras = [], isFetched: todoExtrasCarregou } = useQuery({
    queryKey: ['pagamentos_extras_todos_fin', mes, anoSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_extras')
        .select('professor_id, valor, descricao, empresa, professores(id, nome, foto_url, valor_aula, valor_hora_aula, valor_aula_beach, trabalha_procopio, trabalha_beach, salario_fixo_procopio, salario_fixo_beach, ativo, chave_pix, banco, agencia, conta, tipo_conta, tipo_pagamento, nome_titular, cpf_titular, chave_pix_beach, banco_beach, agencia_beach, conta_beach, tipo_conta_beach, tipo_pagamento_beach, nome_titular_beach, cpf_titular_beach)')
        .eq('mes', mes)
        .eq('ano', anoSel)
      if (error) return []
      return data || []
    },
    staleTime: 30000,
  })
  // Boleto/NF de todos os professores do mês (para o indicador visual na lista principal) —
  // antes só dava pra saber se tinha NF anexada abrindo o card de cada professor um por um;
  // o gestor via "professor falou que anexou" e não achava, porque tinha que clicar em todo
  // mundo pra descobrir quem realmente já tinha.
  const { data: todosBoletos = [] } = useQuery({
    queryKey: ['boletos_todos_fin', mes, anoSel, empresaId],
    queryFn: async () => {
      if (!empresaId) return []
      const { data, error } = await supabase
        .from('boletos_professor')
        .select('professor_id, boleto_url, nf_url')
        .eq('mes', mes).eq('ano', anoSel).eq('empresa', empresaId)
      if (error) return []
      return data || []
    },
    enabled: !!empresaId,
    staleTime: 30000,
  })
  const boletosMapGeral = todosBoletos.reduce((acc, b) => {
    acc[b.professor_id] = { temNF: !!b.nf_url, temBoleto: !!b.boleto_url }
    return acc
  }, {})

  // Extras desta empresa (a que está sendo visualizada agora), pra não somar no
  // total da Procópio um lançamento que é da Beach Arena e vice-versa.
  const todoExtrasDaEmpresa = todoExtras.filter(e => extraPertenceAEmpresa(e.empresa, e.professores, empresaId))
  const extrasMapGeral = todoExtrasDaEmpresa.reduce((acc, e) => {
    acc[e.professor_id] = (acc[e.professor_id] || 0) + Number(e.valor || 0)
    return acc
  }, {})

  // Professores que têm só extras (sem aulas no período) — ex: salários manuais
  const custoProfIds = new Set(custosProf.map(p => p.id))
  const extrasOnlyMap = {}
  todoExtrasDaEmpresa.forEach(e => {
    if (!e.professores || custoProfIds.has(e.professor_id)) return
    if (!extrasOnlyMap[e.professor_id]) {
      extrasOnlyMap[e.professor_id] = { ...e.professores, valorUnitario: 0, totalAulas: 0, totalValor: 0 }
    }
  })
  const extrasOnlyProfs = Object.values(extrasOnlyMap)
  const allProfs = [...custosProf, ...extrasOnlyProfs]

  // Gera automaticamente o lançamento de "Salário fixo" do mês (por empresa) pra
  // quem tem esse valor configurado no cadastro e ainda não tem o lançamento —
  // evita ter que criar manualmente todo mês pra quem ganha fixo (ex: Fernando, Michel).
  const { data: colabsSalarioFixo = [], isFetched: colabsSalarioFixoCarregou } = useQuery({
    queryKey: ['colaboradores_salario_fixo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('id, nome, ativo, trabalha_procopio, trabalha_beach, salario_fixo_procopio, salario_fixo_beach')
        .or('salario_fixo_procopio.not.is.null,salario_fixo_beach.not.is.null')
      if (error) return []
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })
  useEffect(() => {
    // Só decide o que "falta lançar" depois que as duas queries acima realmente
    // carregaram — antes disso `todoExtras`/`colabsSalarioFixo` caem no default []
    // (não é "ainda não tem lançamento", é "ainda não sei"), e rodar o insert nesse
    // meio-tempo duplicava o Salário fixo a cada vez que a página montava.
    if (!empresaId || !todoExtrasCarregou || !colabsSalarioFixoCarregou) return
    const jaTem = new Set(
      todoExtras
        .filter(e => e.descricao === 'Salário fixo' && e.empresa === empresaId)
        .map(e => e.professor_id)
    )
    const faltando = colabsSalarioFixo.filter(c => {
      if (c.ativo === false || jaTem.has(c.id)) return false
      const valor = empresaId === 'beach_arena' ? c.salario_fixo_beach : c.salario_fixo_procopio
      return valor > 0
    })
    if (faltando.length === 0) return
    ;(async () => {
      await supabase.from('pagamentos_extras').insert(faltando.map(c => ({
        professor_id: c.id,
        data_pagamento: dataInicio,
        descricao: 'Salário fixo',
        valor: empresaId === 'beach_arena' ? c.salario_fixo_beach : c.salario_fixo_procopio,
        mes, ano: anoSel, empresa: empresaId,
      })))
      qc.invalidateQueries({ queryKey: ['pagamentos_extras_todos_fin', mes, anoSel] })
      qc.invalidateQueries({ queryKey: ['pagamentos_extras_fin'] })
    })()
  }, [empresaId, mes, anoSel, todoExtras, todoExtrasCarregou, colabsSalarioFixo, colabsSalarioFixoCarregou, dataInicio, qc])

  const salvarLancamento = useSalvarLancamento()
  const removerLancamento = useRemoverLancamento()
  const confirmarPagamento = useConfirmarPagamento()
  const desfazerPagamento = useDesfazerPagamento()
  const removerAnexo = useRemoverAnexoBoleto()
  const { data: pagamentosConfirmados = new Set() } = usePagamentosConfirmados({ mes, ano: anoSel, empresa: empresaId })
  const { data: liberacoes = new Set() } = useLiberacoesPagamento({ mes, ano: anoSel })
  const desautorizar = useDesautorizar()

  // Derived
  const receitaRecord = lancamentos.find(l => l.tipo === 'receita')
  const outrosCustos = lancamentos.filter(l => l.tipo === 'custo_extra')
  const totalProfessores = allProfs.reduce((s, p) => s + p.totalValor + (extrasMapGeral[p.id] || 0), 0)
  const totalOutros = outrosCustos.reduce((s, c) => s + Number(c.valor), 0)
  const totalCustos = totalProfessores + totalOutros
  const maxValorProf = Math.max(...allProfs.map(p => p.totalValor + (extrasMapGeral[p.id] || 0)), 1)
  // boletos_professor é único por (professor, mês, ano, EMPRESA) — quem trabalha nas duas
  // (ex: Fernando, Michel) tem uma linha por empresa no mesmo mês. `boletoDoMes` busca a linha
  // de uma empresa específica; a seção de Boleto/NF abaixo só usa a da empresa vista agora
  // (empresaId), nunca mistura com a outra.
  const boletoDoMes = empresa => boletos.find(b => b.mes === mes && b.ano === anoSel && b.empresa === empresa)
  const totalAulasProf = aulasProf.length
  const valorUnitarioProf = empresaId === 'beach_arena' && professorSel?.valor_aula_beach
    ? Number(professorSel.valor_aula_beach)
    : Number(professorSel?.valor_aula || professorSel?.valor_hora_aula || 0)
  // Cada aula pode valer diferente do valorUnitario "cheio" — turma de Tênis em grupo
  // com só 1 aluno pagante a partir de 1/8/2026 vale R$100 fixo (ver calcularValorAula).
  const somaAulasProf = aulasProf.reduce((s, a) => s + (a.valor ?? valorUnitarioProf), 0)
  const temAulaComDesconto = aulasProf.some(a => a.valor != null && a.valor !== valorUnitarioProf)
  const totalExtrasProf = extrasProfDaEmpresa.reduce((s, e) => s + Number(e.valor || 0), 0)
  const totalPagarProf = somaAulasProf + totalExtrasProf
  // Margem líquida (só Tênis/Procópio) das aulas desse professor no período — visão do
  // coordenador, nunca exposta ao professor. Ver calcularMargensTenis em modalidades.js.
  const { porAula: margemPorAulaProf, total: margemTotalProf } = calcularMargensTenis(aulasProf, professorSel, empresaId)
  const temAulaComMargem = Object.keys(margemPorAulaProf).length > 0
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
        style: { ...toastStyle, border: '1px solid rgba(180,71,47,0.4)' },
        duration: 4000,
      })
      return
    }
    try {
      await confirmarPagamento.mutateAsync({ professorId: professorSel.id, mes, ano: anoSel, empresa: empresaId })
      toast.success('Pagamento confirmado!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleDesfazerPagamento() {
    if (!professorSel) return
    try {
      await desfazerPagamento.mutateAsync({ professorId: professorSel.id, mes, ano: anoSel, empresa: empresaId })
      toast.success('Pagamento desmarcado', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  // Gestor anexando direto por aqui — alguns professores têm dificuldade de subir o
  // arquivo, então o gestor pode fazer por eles sem precisar ir em Cadastros. `empresaAlvo`
  // (mesmo padrão de handleUploadNF) deixa anexar o boleto da OUTRA empresa sem sair da tela,
  // pra quem trabalha nas duas.
  async function handleUploadBoleto(e, empresaAlvo = empresaId) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !professorSel?.id) return
    try {
      const path = `professores/${professorSel.id}/boleto_${empresaAlvo}_${anoSel}_${mes}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('boletos_professor').upsert({
        professor_id: professorSel.id, mes, ano: anoSel, empresa: empresaAlvo, boleto_url: publicUrl, status: 'pendente',
      }, { onConflict: 'professor_id,mes,ano,empresa' })
      qc.invalidateQueries({ queryKey: ['boletos', professorSel.id] })
      toast.success('Boleto anexado!', { style: toastStyle })
    } catch (err) { toast.error('Erro ao anexar boleto: ' + err.message, { style: toastStyle }) }
  }

  // `empresaAlvo` deixa anexar a NF da OUTRA empresa (pra quem trabalha nas duas) sem sair
  // dessa tela — por padrão é a empresa que já está sendo vista.
  async function handleUploadNF(e, empresaAlvo = empresaId) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !professorSel?.id) return
    try {
      const path = `professores/${professorSel.id}/nf_${empresaAlvo}_${anoSel}_${mes}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('boletos_professor').upsert({
        professor_id: professorSel.id, mes, ano: anoSel, empresa: empresaAlvo, nf_url: publicUrl,
      }, { onConflict: 'professor_id,mes,ano,empresa' })
      qc.invalidateQueries({ queryKey: ['boletos', professorSel.id] })
      toast.success('NF anexada!', { style: toastStyle })
    } catch (err) { toast.error('Erro ao anexar NF: ' + err.message, { style: toastStyle }) }
  }

  // Corrige anexo enviado no mês/empresa errada (ex: NF de julho subida na janela de agosto)
  // sem precisar mexer direto no banco.
  async function handleExcluirAnexo(tipo, empresaAlvo = empresaId) {
    if (!professorSel?.id) return
    try {
      const campo = tipo === 'boleto' ? 'boleto_url' : 'nf_url'
      await removerAnexo.mutateAsync({ professorId: professorSel.id, mes, ano: anoSel, empresa: empresaAlvo, campo })
      toast.success(`${tipo === 'boleto' ? 'Boleto' : 'NF'} excluído(a).`, { style: toastStyle })
    } catch (err) { toast.error('Erro ao excluir: ' + err.message, { style: toastStyle }) }
  }

  function navegarEmpresa(id) {
    // Defesa contra bypass (estado restaurado de location.state, ou navegação direta) —
    // uma conta travada numa empresa nunca consegue entrar na outra por aqui.
    if (empresaVinculada && id !== empresaVinculada) return
    setEmpresaId(id)
    setView('empresa')
  }

  // Conta travada numa empresa nunca vê a tela de escolha — entra direto na única que
  // pode ver. Também corrige na hora se o estado restaurado (savedFin) apontava pra outra.
  useEffect(() => {
    if (!empresaVinculada) return
    if (empresaId && empresaId !== empresaVinculada) {
      setEmpresaId(empresaVinculada)
      setView('empresa')
    } else if (view === 'empresas') {
      navegarEmpresa(empresaVinculada)
    }
  }, [empresaVinculada])

  function navegarProfessor(prof) {
    setProfessorSel(prof)
    setFiltroValorAula(null)
    setFiltroSoFalta100(false)
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
                background: ativo ? 'var(--color-action-primary)' : 'var(--color-surface-dark-raised)',
                color: ativo ? 'white' : 'var(--color-text-dark-secondary)',
                outline: ativo ? 'none' : '1px solid var(--color-border-dark)',
              }}>{m}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', flexShrink: 0 }}>De</span>
          <input type="date" value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px', flex: 1 }} />
          <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', flexShrink: 0 }}>Até</span>
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
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: 0 }}>
            Financeiro
          </h1>
          <button
            onClick={() => setPinModal({ professorId: null, initialMode: 'config1' })}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 12px', borderRadius: '9px',
              border: temPin ? '1px solid rgba(165,76,46,0.3)' : '1px solid var(--color-border-dark)',
              background: temPin ? 'rgba(165,76,46,0.06)' : 'var(--color-surface-dark-raised)',
              color: temPin ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)',
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
          {Object.values(EMPRESAS).filter(emp => !empresaVinculada || emp.id === empresaVinculada).map(emp => (
            <button key={emp.id} onClick={() => navegarEmpresa(emp.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '24px 16px',
              backgroundColor: 'var(--color-surface-dark-raised)',
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
    // Banco/PIX/boleto/titular são por empresa agora (ver dadosPagamentoEmpresa) — um
    // colaborador pode receber Boleto na Procópio e PIX na Beach Arena, por exemplo. `pag`
    // sempre reflete a empresa que está sendo vista agora (empresaId).
    const pag = dadosPagamentoEmpresa(professorSel, empresaId)
    const temPix = pag.tipo_pagamento === 'pix' || (pag.banco === 'Itaú' && pag.chave_pix)
    const temBoleto = pag.tipo_pagamento === 'boleto'
    const temDadosConta = !temBoleto && !pag.chave_pix && pag.banco && pag.conta
    // Boleto/NF mostram só a empresa que está sendo vista agora (empresaId) — ao entrar em
    // Beach Arena só aparece o documento da Beach Arena, ao entrar em Procópio só o da Procópio,
    // mesmo pra quem trabalha nas duas.
    const empresasParaExibir = [EMPRESAS[empresaId]]
    const contaFormatada = `${pag.agencia ? `Ag ${pag.agencia} · ` : ''}Conta ${pag.conta}${pag.tipo_conta ? ` (${pag.tipo_conta === 'poupanca' ? 'Poupança' : 'Corrente'})` : ''}`

    // Quebra por valor pago (ex.: R$120 valor cheio x R$100 turma-grupo-1-aluno) —
    // conta quantas aulas caíram em cada valor pra auditoria do fechamento. Agrupa pelo
    // valor de fato calculado (a.valor), não hardcoded, pra funcionar com qualquer
    // valor_aula configurado no cadastro do professor.
    const valoresMap = {}
    aulasProf.forEach(a => {
      const v = a.valor ?? valorUnitarioProf
      valoresMap[v] = (valoresMap[v] || 0) + 1
    })
    const breakdownValores = Object.entries(valoresMap)
      .map(([valor, qtd]) => ({ valor: Number(valor), qtd }))
      .sort((a, b) => b.valor - a.valor)

    // Aulas em que NENHUM aluno da turma compareceu (100% de falta) e mesmo assim o
    // professor foi pago — se só 1 faltou mas outro veio, a aula não entra aqui. Serve pra
    // auditar quanto tá sendo pago por aulas onde o professor efetivamente não deu aula
    // pra ninguém.
    const aulasSemComparecimento = aulasProf.filter(aulaComTodosAusentes)
    const valorSemComparecimento = aulasSemComparecimento.reduce((s, a) => s + (a.valor ?? valorUnitarioProf), 0)

    // Agrupa aulas por dia — respeitando os filtros selecionados acima (servem só pra essa
    // lista de auditoria; o Total a pagar continua somando tudo, filtrado ou não).
    const aulasParaLista = aulasProf
      .filter(a => filtroValorAula == null || (a.valor ?? valorUnitarioProf) === filtroValorAula)
      .filter(a => !filtroSoFalta100 || aulaComTodosAusentes(a))
    const porDia = {}
    aulasParaLista.forEach(a => {
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
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dark-secondary)', fontSize: '13px', padding: 0,
          }}>
            <ChevronLeft size={16} /> {empresa?.nome}
          </button>
          <button onClick={voltarEmpresa} style={{
            width: '32px', height: '32px', borderRadius: '8px',
            border: '1px solid var(--color-border-dark)', background: 'var(--color-surface-dark-raised)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color="var(--color-text-dark-secondary)" />
          </button>
        </div>

        {/* Header professor */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
          border: pagamentoConfirmado ? '1px solid rgba(75,139,106,0.4)' : '1px solid rgba(255,255,255,0.06)',
          padding: '16px', marginBottom: '14px',
        }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={professorSel.foto_url} nome={professorSel.nome} size={56}
              borderColor={pagamentoConfirmado ? 'var(--color-state-success)' : undefined} />
            {pagamentoConfirmado && (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '18px', height: '18px', borderRadius: '50%',
                backgroundColor: 'var(--color-state-success)', border: '2px solid var(--color-surface-dark-raised)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={10} color="white" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>
              {professorSel.nome}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              {pag.banco && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>{pag.banco}</span>
              )}
              {temBoleto && (
                <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(61,107,122,0.15)', color: 'var(--color-state-info)', fontSize: '10px', fontWeight: '600' }}>Boleto</span>
              )}
              {pagamentoAutorizado
                ? <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(75,139,106,0.12)', color: 'var(--color-state-success)', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <LockOpen size={9} /> Autorizado
                  </span>
                : <span
                    onClick={e => handleAbrirPin(professorSel.id, e)}
                    style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--color-text-dark-secondary)', fontSize: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Lock size={9} /> Aguardando coord.
                  </span>
              }
              {pagamentoConfirmado && (
                <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(75,139,106,0.15)', color: 'var(--color-state-success)', fontSize: '10px', fontWeight: '600' }}>✓ Pago</span>
              )}
            </div>
          </div>
        </div>

        {/* Total */}
        <div style={{
          backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
          border: '1px solid rgba(165,76,46,0.2)', padding: '16px',
          marginBottom: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total a pagar — {MESES_ABREV[mesSel]}/{anoSel}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--color-action-primary)' }}>
            {fmtBRL(totalPagarProf)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', marginTop: '4px' }}>
            {temAulaComDesconto
              ? <>{totalAulasProf} aulas — {fmtBRL(somaAulasProf)} <span style={{ color: 'var(--color-state-warning)' }}>(com turma a R$100)</span></>
              : <>{totalAulasProf} aulas × {fmtBRL(valorUnitarioProf)}</>
            }
            {totalExtrasProf > 0 && (
              <span style={{ color: 'var(--color-state-info)', marginLeft: '6px' }}>
                + {fmtBRL(totalExtrasProf)} extra{extrasProfDaEmpresa.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Margem líquida (receita da mensalidade − 10% clube − custo do professor), só
              pra aulas de Tênis/Procópio — visão exclusiva do coordenador, o professor não
              tem acesso a esse número em lugar nenhum do app. */}
          {temAulaComMargem && (
            <div style={{ fontSize: '10px', color: 'var(--color-state-warning)', opacity: 0.85, marginTop: '6px' }}>
              margem do período (só Tênis): {margemTotalProf >= 0 ? '+' : '−'}{fmtBRL(Math.abs(margemTotalProf))}
            </div>
          )}
        </div>

        {/* Filtro por valor da aula — auditoria de quantas aulas caíram em cada valor
            (ex.: R$120 valor cheio x R$100 turma em grupo com só 1 aluno pagante).
            Só aparece quando há mais de um valor no período, senão é ruído. */}
        {breakdownValores.length > 1 && (
          <div style={{
            display: 'flex', gap: '6px', flexWrap: 'wrap',
            marginBottom: '8px',
          }}>
            <button onClick={() => setFiltroValorAula(null)} style={{
              padding: '7px 12px', borderRadius: '9px', cursor: 'pointer',
              border: filtroValorAula == null ? 'none' : '1px solid var(--color-border-dark)',
              background: filtroValorAula == null ? 'var(--color-action-primary)' : 'var(--color-surface-dark-raised)',
              color: filtroValorAula == null ? 'white' : 'var(--color-text-dark-secondary)',
              fontSize: '11px', fontWeight: '700',
            }}>
              Todas ({aulasProf.length})
            </button>
            {breakdownValores.map(({ valor, qtd }) => {
              const ativo = filtroValorAula === valor
              return (
                <button key={valor} onClick={() => setFiltroValorAula(ativo ? null : valor)} style={{
                  padding: '7px 12px', borderRadius: '9px', cursor: 'pointer',
                  border: ativo ? 'none' : '1px solid var(--color-border-dark)',
                  background: ativo ? 'var(--color-action-primary)' : 'var(--color-surface-dark-raised)',
                  color: ativo ? 'white' : 'var(--color-text-dark-secondary)',
                  fontSize: '11px', fontWeight: '700',
                }}>
                  {fmtBRL(valor)} ({qtd})
                </button>
              )
            })}
          </div>
        )}

        {/* Filtro: aulas onde 100% da turma faltou e mesmo assim o professor foi pago.
            Só aparece quando existe pelo menos 1 caso, senão vira ruído em todo professor. */}
        {aulasSemComparecimento.length > 0 && (
          <button onClick={() => setFiltroSoFalta100(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', width: '100%',
            marginBottom: '14px', boxSizing: 'border-box', textAlign: 'left',
            border: filtroSoFalta100 ? '1px solid rgba(180,71,47,0.5)' : '1px solid rgba(180,71,47,0.25)',
            background: filtroSoFalta100 ? 'var(--color-state-danger)' : 'rgba(180,71,47,0.08)',
          }}>
            <Ban size={13} color={filtroSoFalta100 ? 'white' : 'var(--color-state-danger)'} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: filtroSoFalta100 ? 'white' : 'var(--color-state-danger)', flex: 1 }}>
              {aulasSemComparecimento.length} aula{aulasSemComparecimento.length !== 1 ? 's' : ''} com 100% de falta — {fmtBRL(valorSemComparecimento)} pago{valorSemComparecimento !== 1 ? 's' : ''} sem ninguém comparecer
            </span>
          </button>
        )}

        {/* PIX ITAÚ */}
        {temPix && pag.chave_pix && (
          <div style={{
            backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px',
            border: '1px solid rgba(201,138,60,0.25)', padding: '14px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--color-state-warning)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
              PIX ITAÚ
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (!pagamentoAutorizado) return
                  navigator.clipboard.writeText(pag.chave_pix)
                  toast.success('PIX copiado!', { style: toastStyle })
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '10px',
                  border: pagamentoAutorizado ? '1px solid rgba(201,138,60,0.3)' : '1px solid var(--color-border-dark)',
                  backgroundColor: pagamentoAutorizado ? 'rgba(201,138,60,0.06)' : 'var(--color-surface-dark-overlay)',
                  cursor: pagamentoAutorizado ? 'pointer' : 'default',
                }}
              >
                {pagamentoAutorizado
                  ? <Copy size={14} color="var(--color-state-warning)" />
                  : <Lock size={14} color="var(--color-text-dark-muted)" />
                }
                <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: pagamentoAutorizado ? 'normal' : '3px', color: pagamentoAutorizado ? 'var(--color-state-warning)' : 'var(--color-text-dark-muted)' }}>
                  {pagamentoAutorizado ? pag.chave_pix : '●●●●●●●●●●●●'}
                </span>
              </button>
              {!pagamentoConfirmado ? (
                <button onClick={handleConfirmarPagamento} disabled={confirmarPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none',
                  backgroundColor: pagamentoAutorizado ? 'var(--color-state-success)' : 'var(--color-border-dark)',
                  color: pagamentoAutorizado ? 'white' : 'var(--color-text-dark-secondary)',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  {pagamentoAutorizado ? <Check size={14} /> : <Lock size={14} />}
                  Pago
                </button>
              ) : (
                <button onClick={handleDesfazerPagamento} disabled={desfazerPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px',
                  backgroundColor: 'rgba(75,139,106,0.1)', border: '1px solid rgba(75,139,106,0.4)',
                  fontSize: '12px', fontWeight: '700', color: 'var(--color-state-success)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Check size={14} /> Confirmado
                </button>
              )}
            </div>
            {/* Titular da conta */}
            {(pag.nome_titular || pag.cpf_titular) && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-dark-muted)', paddingLeft: '2px' }}>
                {pag.nome_titular && <span>{pag.nome_titular}</span>}
                {pag.nome_titular && pag.cpf_titular && <span style={{ color: 'var(--color-text-dark-muted)', margin: '0 5px' }}>·</span>}
                {pag.cpf_titular && <span>CPF {pag.cpf_titular}</span>}
              </div>
            )}
          </div>
        )}

        {/* Dados bancários para transferência (sem chave PIX cadastrada) */}
        {temDadosConta && (
          <div style={{
            backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px',
            border: '1px solid rgba(201,138,60,0.25)', padding: '14px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--color-state-warning)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
              {pag.banco === 'Itaú' ? 'Transferência Itaú' : 'Dados Bancários'}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (!pagamentoAutorizado) return
                  navigator.clipboard.writeText(contaFormatada)
                  toast.success('Dados copiados!', { style: toastStyle })
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '10px',
                  border: pagamentoAutorizado ? '1px solid rgba(201,138,60,0.3)' : '1px solid var(--color-border-dark)',
                  backgroundColor: pagamentoAutorizado ? 'rgba(201,138,60,0.06)' : 'var(--color-surface-dark-overlay)',
                  cursor: pagamentoAutorizado ? 'pointer' : 'default',
                }}
              >
                {pagamentoAutorizado
                  ? <Copy size={14} color="var(--color-state-warning)" />
                  : <Lock size={14} color="var(--color-text-dark-muted)" />
                }
                <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: pagamentoAutorizado ? 'normal' : '3px', color: pagamentoAutorizado ? 'var(--color-state-warning)' : 'var(--color-text-dark-muted)' }}>
                  {pagamentoAutorizado ? contaFormatada : '●●●●●●●●●●●●'}
                </span>
              </button>
              {!pagamentoConfirmado ? (
                <button onClick={handleConfirmarPagamento} disabled={confirmarPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none',
                  backgroundColor: pagamentoAutorizado ? 'var(--color-state-success)' : 'var(--color-border-dark)',
                  color: pagamentoAutorizado ? 'white' : 'var(--color-text-dark-secondary)',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  {pagamentoAutorizado ? <Check size={14} /> : <Lock size={14} />}
                  Pago
                </button>
              ) : (
                <button onClick={handleDesfazerPagamento} disabled={desfazerPagamento.isPending} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: '10px',
                  backgroundColor: 'rgba(75,139,106,0.1)', border: '1px solid rgba(75,139,106,0.4)',
                  fontSize: '12px', fontWeight: '700', color: 'var(--color-state-success)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Check size={14} /> Confirmado
                </button>
              )}
            </div>
            {/* Titular da conta */}
            {(pag.nome_titular || pag.cpf_titular) && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-dark-muted)', paddingLeft: '2px' }}>
                {pag.nome_titular && <span>{pag.nome_titular}</span>}
                {pag.nome_titular && pag.cpf_titular && <span style={{ color: 'var(--color-text-dark-muted)', margin: '0 5px' }}>·</span>}
                {pag.cpf_titular && <span>CPF {pag.cpf_titular}</span>}
              </div>
            )}
          </div>
        )}

        {/* Boleto (só aparece se esse professor de fato recebe via boleto na empresa vista
            agora — ex: Kelly recebe Boleto na Procópio e PIX na Beach Arena). */}
        {empresasParaExibir.filter(emp => dadosPagamentoEmpresa(professorSel, emp.id).tipo_pagamento === 'boleto').map(emp => {
          const boletoEmp = boletoDoMes(emp.id)
          const ehEmpresaAtual = emp.id === empresaId
          return (
            <div key={`boleto-${emp.id}`} style={{
              backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px',
              border: '1px solid rgba(61,107,122,0.2)', padding: '14px',
              marginBottom: '14px',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--color-state-info)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                Boleto{empresasParaExibir.length > 1 ? ` — ${emp.nome}` : ''} — {MESES_ABREV[mesSel]}/{anoSel}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {boletoEmp?.boleto_url ? (
                  <>
                    <a href={boletoEmp.boleto_url} target="_blank" rel="noreferrer" style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '10px', borderRadius: '10px',
                      border: '1px solid rgba(61,107,122,0.3)', backgroundColor: 'rgba(61,107,122,0.06)',
                      color: 'var(--color-state-info)', fontSize: '12px', fontWeight: '600', textDecoration: 'none',
                    }}>
                      <FileText size={14} /> Ver boleto
                    </a>
                    <label style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border-dark)', cursor: 'pointer', color: 'var(--color-text-dark-secondary)',
                    }}>
                      <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUploadBoleto(e, emp.id)} />
                      <Upload size={14} />
                    </label>
                    <button onClick={() => handleExcluirAnexo('boleto', emp.id)} title="Excluir boleto" style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '10px', borderRadius: '10px', border: '1px solid rgba(180,71,47,0.3)', background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer',
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <label style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '10px', border: '1px dashed var(--color-border-dark)',
                    color: 'var(--color-text-dark-secondary)', fontSize: '12px', cursor: 'pointer',
                  }}>
                    <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUploadBoleto(e, emp.id)} />
                    <Upload size={13} /> Anexar boleto
                  </label>
                )}
                {ehEmpresaAtual && (!pagamentoConfirmado ? (
                  <button onClick={handleConfirmarPagamento} disabled={confirmarPagamento.isPending} style={{
                    flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none',
                    backgroundColor: pagamentoAutorizado ? 'var(--color-state-success)' : 'var(--color-border-dark)',
                    color: pagamentoAutorizado ? 'white' : 'var(--color-text-dark-secondary)',
                    fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}>
                    {pagamentoAutorizado ? <Check size={14} /> : <Lock size={14} />}
                    Pago
                  </button>
                ) : (
                  <button onClick={handleDesfazerPagamento} disabled={desfazerPagamento.isPending} style={{
                    flexShrink: 0, padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: 'rgba(75,139,106,0.1)', border: '1px solid rgba(75,139,106,0.4)',
                    fontSize: '12px', fontWeight: '700', color: 'var(--color-state-success)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}>
                    <Check size={14} /> Confirmado
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {/* NF — só a da empresa vista agora (empresaId), nunca a da outra. */}
        {empresasParaExibir.map(emp => (
          <div key={`nf-${emp.id}`} style={{
            backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px',
            border: '1px solid rgba(165,76,46,0.15)', padding: '14px',
            marginBottom: '14px',
          }}>
            <CampoNF
              titulo={`NF${empresasParaExibir.length > 1 ? ` — ${emp.nome}` : ''} — ${MESES_ABREV[mesSel]}/${anoSel}`}
              boleto={boletoDoMes(emp.id)}
              onUpload={e => handleUploadNF(e, emp.id)}
              onExcluir={() => handleExcluirAnexo('nf', emp.id)}
            />
          </div>
        ))}

        {/* Resumo por dia */}
        <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Aulas no período
          {filtroValorAula != null ? ` — filtrado por ${fmtBRL(filtroValorAula)}` : ''}
          {filtroSoFalta100 ? ' — só 100% de falta' : ''}
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
            professorId={professorSel.id}
            professor={professorSel}
            empresaId={empresaId}
            totalAulas={detalhesDia.aulas.length}
            valorUnitario={valorUnitarioProf}
            onClose={() => setDetalhesDia(null)}
            financeiroState={{ view, empresaId, mesSel, anoSel, professorSel }}
          />
        )}

        {loadingAulasProf ? <Loading /> : diasOrdenados.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', padding: '24px' }}>
            {filtroValorAula != null || filtroSoFalta100 ? 'Nenhuma aula encontrada com esse filtro' : 'Nenhuma aula encontrada'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {diasOrdenados.map(([dataStr, aulasNoDia]) => {
              const dataFmt = format(parseISO(dataStr + 'T12:00:00'), "dd/MM · EEEE", { locale: ptBR })
              const totalDia = aulasNoDia.reduce((s, a) => s + (a.valor ?? valorUnitarioProf), 0)
              const pct = Math.round((aulasNoDia.length / Math.max(...diasOrdenados.map(([,a]) => a.length), 1)) * 100)
              return (
                <button
                  key={dataStr}
                  onClick={() => setDetalhesDia({ dataStr, aulas: aulasNoDia })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px',
                    backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid rgba(255,255,255,0.04)',
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: '90px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)', fontWeight: '600', textTransform: 'capitalize' }}>
                      {dataFmt}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <div style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: 'var(--color-border-dark)', overflow: 'hidden', width: '60px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: 'var(--color-action-primary)' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
                      {aulasNoDia.length} {aulasNoDia.length === 1 ? 'aula' : 'aulas'}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-action-primary)', fontWeight: '700' }}>
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
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dark-secondary)', fontSize: '13px', padding: 0,
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
        backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
        border: '1px solid rgba(75,139,106,0.15)', padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-state-success)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ↑ Receita
          </div>
          {receitaRecord && (
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-state-success)' }}>
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
          border: '1px dashed var(--color-border-dark)', background: 'none', cursor: 'pointer',
          color: 'var(--color-text-dark-secondary)', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box',
        }}>
          <Upload size={14} />
          {uploadingReceita ? 'Enviando...' : receitaRecord?.arquivo_nome ? receitaRecord.arquivo_nome : 'Anexar relatório do clube'}
          {receitaRecord?.arquivo_url && (
            <a href={receitaRecord.arquivo_url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ marginLeft: 'auto', color: 'var(--color-text-dark-secondary)' }}>
              <ExternalLink size={13} />
            </a>
          )}
        </button>

        {/* Input valor */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '12px', color: 'var(--color-text-dark-secondary)', pointerEvents: 'none',
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
            background: 'var(--color-state-success)',
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
        backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
        border: '1px solid rgba(180,71,47,0.15)', padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-state-danger)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ↓ Custo Professores
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-state-danger)' }}>
            {fmtBRL(totalProfessores)}
          </div>
        </div>

        {/* Campo de busca */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Buscar professor..."
            value={buscaProf}
            onChange={e => setBuscaProf(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: 'var(--color-surface-dark-overlay)', border: '1px solid var(--color-border-dark)',
              borderRadius: '10px', padding: '9px 12px 9px 34px',
              color: 'var(--color-text-dark-primary)', fontSize: '13px', outline: 'none',
            }}
          />
          <Search size={13} color="var(--color-text-dark-secondary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          {buscaProf && (
            <button onClick={() => setBuscaProf('')} style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dark-secondary)', fontSize: '14px', lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {loadingCustos ? <Loading /> : allProfs.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma aula confirmada no período
          </div>
        ) : (
          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '2px' }}>
            {allProfs.filter(p => p.nome.toLowerCase().includes(buscaProf.toLowerCase())).map(prof => {
              const extras = extrasMapGeral[prof.id] || 0
              const totalComExtras = prof.totalValor + extras
              const pct = Math.round((totalComExtras / maxValorProf) * 100)
              const pago = pagamentosConfirmados.has(prof.id)
              const autorizado = liberacoes.has(prof.id)
              const temNF = !!boletosMapGeral[prof.id]?.temNF
              return (
                <button key={prof.id} onClick={() => navegarProfessor(prof)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  textAlign: 'left', width: '100%',
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {/* Contorno da foto: verde = pagamento confirmado, saibro = NF já anexada,
                        cinza (padrão do Avatar) = ainda sem NF — dá pra ver quem falta cobrar
                        NF só olhando a lista, sem clicar professor por professor. */}
                    <Avatar src={prof.foto_url} nome={prof.nome} size={40}
                      borderColor={pago ? 'var(--color-state-success)' : temNF ? 'var(--color-action-primary)' : undefined} />
                    {pago && (
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: '14px', height: '14px', borderRadius: '50%',
                        backgroundColor: 'var(--color-state-success)', border: '2px solid var(--color-surface-dark-raised)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={8} color="white" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: pago ? 'var(--color-state-success)' : 'var(--color-text-dark-primary)' }}>{prof.nome}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: pago ? 'var(--color-state-success)' : 'var(--color-state-danger)' }}>
                          {fmtBRL(totalComExtras)}
                        </span>
                        {extras > 0 && <span style={{ fontSize: '9px', color: 'var(--color-state-info)', fontWeight: '600' }}>+E</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-border-dark)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: '2px',
                          background: pago ? 'var(--color-state-success)' : 'var(--color-state-danger)',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', minWidth: '28px', textAlign: 'right' }}>
                        {prof.totalAulas}×
                      </span>
                    </div>
                  </div>
                  {/* Cadeado — autorização do coordenador pra pagar. Maior e com fundo
                      colorido (não só o ícone pequeno de antes) pra dar pra bater o olho
                      na lista inteira e ver quem já está liberado, sem precisar clicar em
                      cada professor — pedido explícito do time de Financeiro. */}
                  <div
                    onClick={autorizado
                      ? e => handleDesautorizar(prof.id, e)
                      : e => handleAbrirPin(prof.id, e)
                    }
                    style={{
                      flexShrink: 0, padding: '9px', borderRadius: '10px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                      backgroundColor: autorizado ? 'rgba(75,139,106,0.18)' : 'var(--color-surface-dark-overlay)',
                      border: autorizado ? '1.5px solid var(--color-state-success)' : '1px solid var(--color-border-dark)',
                    }}
                  >
                    {autorizado
                      ? <LockOpen size={20} color="var(--color-state-success)" />
                      : <Lock size={20} color="var(--color-text-dark-muted)" />
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
        backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ↓ Outros Custos
          </div>
          {outrosCustos.length > 0 && (
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-dark-secondary)' }}>
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
                backgroundColor: 'var(--color-surface-dark-overlay)', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', marginBottom: '1px' }}>{c.descricao}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', fontWeight: '600' }}>{fmtBRL(c.valor)}</div>
                </div>
                {c.arquivo_url && (
                  <a href={c.arquivo_url} target="_blank" rel="noreferrer" style={{
                    padding: '6px', borderRadius: '8px',
                    backgroundColor: 'rgba(165,76,46,0.08)', border: '1px solid rgba(165,76,46,0.2)',
                    color: 'var(--color-action-primary)', display: 'flex',
                  }}>
                    <FileText size={13} />
                  </a>
                )}
                <button onClick={() => handleRemoverCusto(c.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(180,71,47,0.08)', color: 'var(--color-state-danger)', cursor: 'pointer', display: 'flex',
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
            backgroundColor: 'var(--color-surface-dark-overlay)', border: '1px solid rgba(255,255,255,0.08)',
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
                fontSize: '12px', color: 'var(--color-text-dark-secondary)', pointerEvents: 'none',
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
              border: '1px dashed var(--color-border-dark)', background: 'none', cursor: 'pointer',
              color: custoArqPendente ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)', fontSize: '12px',
            }}>
              <Upload size={13} />
              {uploadingCusto ? 'Enviando...' : custoArqPendente ? custoArqPendente.nome : 'Anexar NF (opcional)'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowFormCusto(false); setFormCusto({ descricao: '', valor: '' }); setCustoArqPendente(null) }}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid var(--color-border-dark)', background: 'none', color: 'var(--color-text-dark-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSalvarCusto} disabled={salvarLancamento.isPending} style={{
                flex: 2, padding: '9px', borderRadius: '9px', border: 'none',
                background: 'var(--color-action-primary)',
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
            border: '1px dashed var(--color-border-dark)', background: 'none',
            color: 'var(--color-text-dark-secondary)', fontSize: '12px', cursor: 'pointer', boxSizing: 'border-box',
          }}>
            <Plus size={14} /> Adicionar custo
          </button>
        )}
      </div>

      {/* ── RESUMO TOTAL ──────────────────────────────────────────── */}
      {(receitaRecord || totalCustos > 0) && (
        <div style={{
          backgroundColor: 'var(--color-surface-dark-overlay)', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Resumo — {MESES_ABREV[mesSel]}/{anoSel}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {receitaRecord && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)' }}>Receita (repasse)</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-state-success)' }}>{fmtBRL(receitaRecord.valor)}</span>
              </div>
            )}
            {totalProfessores > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)' }}>Custo professores</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-state-danger)' }}>- {fmtBRL(totalProfessores)}</span>
              </div>
            )}
            {totalOutros > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)' }}>Outros custos</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-state-danger)' }}>- {fmtBRL(totalOutros)}</span>
              </div>
            )}
            {receitaRecord && totalCustos > 0 && (
              <>
                <div style={{ height: '1px', backgroundColor: 'var(--color-border-dark)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', fontWeight: '600' }}>Resultado</span>
                  {(() => {
                    const resultado = Number(receitaRecord.valor) - totalCustos
                    return (
                      <span style={{ fontSize: '16px', fontWeight: '700', color: resultado >= 0 ? 'var(--color-state-success)' : 'var(--color-state-danger)' }}>
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
