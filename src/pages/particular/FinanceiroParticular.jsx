import { useState, useRef } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, Upload, ExternalLink, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import useAppStore from '../../store/useAppStore'
import { useAlunos } from '../../hooks/useAlunos'
import { useContratantes } from '../../hooks/useContratantes'
import { useValoresParticular } from '../../hooks/useValoresParticular'
import { usePagamentosAlunos, usePagamentosContratantes, useSalvarPagamentoParticular } from '../../hooks/useFinanceiroParticular'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/ui/Loading'

const MESES_LABEL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Combina o registro em pagamentos_alunos/pagamentos_contratantes (se já existir) com o valor
// calculado pelo mês via useValoresParticular (que já sabe distinguir fixo-uma-vez de
// por_aula×quantidade) — cai pro cadastro cru só quando o aluno/contratante ainda não teve
// nenhuma aula gerada no mês (fixo ainda conta, por_aula sem aula dá zero).
function valorRegistro(grupo, cadastro, campoFixo) {
  if (grupo) return { valor: grupo.valorEstimado, detalhe: grupo.tipoCobranca === 'fixo' ? 'Mensalidade' : `${grupo.totalAulas} aula${grupo.totalAulas === 1 ? '' : 's'}` }
  const fixo = cadastro.tipo_cobranca === 'fixo'
  return { valor: fixo ? Number(cadastro[campoFixo] || 0) : 0, detalhe: fixo ? 'Mensalidade' : 'Sem aula no mês' }
}

function estaVencido(status, diaVencimento, mes, ano) {
  if (status === 'pago' || !diaVencimento) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(ano, mes - 1, diaVencimento) < hoje
}

export function FinanceiroParticular() {
  const { empresaSelecionada } = useAppStore()
  const empresaId = empresaSelecionada?.id
  const [dataRef, setDataRef] = useState(new Date())
  const mes = dataRef.getMonth() + 1
  const ano = dataRef.getFullYear()

  const { data: alunos = [], isLoading: carregandoAlunos } = useAlunos(null, empresaId)
  const { data: contratantes = [], isLoading: carregandoContratantes } = useContratantes(empresaId)
  const { data: valores } = useValoresParticular({ empresaId, mes, ano })
  const { data: pagamentosAlunos = [], isLoading: carregandoPagAlunos } = usePagamentosAlunos({ empresaId, mes, ano })
  const { data: pagamentosContratantes = [], isLoading: carregandoPagContratantes } = usePagamentosContratantes({ empresaId, mes, ano })

  if (carregandoAlunos || carregandoContratantes || carregandoPagAlunos || carregandoPagContratantes) return <Loading />

  const contratantesTerceiro = contratantes.filter(c => c.tipo === 'terceiro')
  const valoresMap = {}
  ;(valores?.porGrupo || []).forEach(g => { valoresMap[g.chave] = g })

  const registros = [
    ...alunos.map(a => {
      const pag = pagamentosAlunos.find(p => p.aluno_id === a.id)
      const { valor, detalhe } = valorRegistro(valoresMap[`aluno:${a.id}`], a, 'valor_fixo')
      return {
        tipo: 'aluno', id: a.id, nome: a.nome, valor, detalhe, diaVencimento: a.dia_vencimento,
        status: pag?.status || 'pendente', comprovanteUrl: pag?.comprovante_url, comprovanteNome: pag?.comprovante_nome,
      }
    }),
    ...contratantesTerceiro.map(c => {
      const pag = pagamentosContratantes.find(p => p.contratante_id === c.id)
      const { valor, detalhe } = valorRegistro(valoresMap[`contratante:${c.id}`], c, 'valor_fixo')
      return {
        tipo: 'contratante', id: c.id, nome: c.nome, valor, detalhe, diaVencimento: null,
        status: pag?.status || 'pendente', comprovanteUrl: pag?.comprovante_url, comprovanteNome: pag?.comprovante_nome,
      }
    }),
  ]

  const pagos = registros.filter(r => r.status === 'pago')
  const pendentes = registros.filter(r => r.status !== 'pago')
  const vencidos = registros.filter(r => estaVencido(r.status, r.diaVencimento, mes, ano))
  const totalPago = pagos.reduce((s, r) => s + r.valor, 0)
  const totalPendente = pendentes.reduce((s, r) => s + r.valor, 0)
  const chegando = alunos
    .filter(a => a.dia_vencimento && !estaVencido('pendente', a.dia_vencimento, mes, ano) && registros.find(r => r.tipo === 'aluno' && r.id === a.id)?.status !== 'pago')
    .sort((a, b) => a.dia_vencimento - b.dia_vencimento)
    .slice(0, 5)

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: '0 0 6px' }}>Financeiro</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', margin: '0 0 20px' }}>
        Adimplência, comprovantes e vencimentos da sua prática particular.
      </p>

      <SeletorMes dataRef={dataRef} setDataRef={setDataRef} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', margin: '16px 0' }}>
        <CardStat label="Recebido" valor={fmtBRL(totalPago)} cor="var(--color-state-success)" />
        <CardStat label="A receber" valor={fmtBRL(totalPendente)} cor="var(--color-state-warning)" />
        <CardStat label="Pendentes" valor={pendentes.length} cor="var(--color-state-warning)" />
        <CardStat label="Vencidos" valor={vencidos.length} cor="var(--color-state-danger)" />
      </div>

      <div style={{
        backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '16px',
        border: '1px solid rgba(165,76,46,0.2)', padding: '18px', marginBottom: '14px',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '12px' }}>
          Adimplência do mês
        </div>
        <BarraAdimplencia pagos={pagos.length} pendentes={pendentes.length} />
      </div>

      {chegando.length > 0 && (
        <div style={{
          backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '16px',
          border: '1px solid rgba(165,76,46,0.2)', padding: '18px', marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '12px' }}>
            <CalendarClock size={13} /> Cobrança chegando
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {chegando.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-dark-primary)' }}>
                <span>{a.nome}</span>
                <span style={{ color: 'var(--color-text-dark-secondary)' }}>Dia {a.dia_vencimento}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {registros.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--color-text-dark-muted)', textAlign: 'center', padding: '24px' }}>
            Nenhum aluno ou contratante cadastrado ainda.
          </div>
        ) : registros.map(r => (
          <LinhaRegistro key={`${r.tipo}:${r.id}`} registro={r} mes={mes} ano={ano} empresaId={empresaId}
            vencido={estaVencido(r.status, r.diaVencimento, mes, ano)} />
        ))}
      </div>
    </div>
  )
}

function SeletorMes({ dataRef, setDataRef }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
      <button onClick={() => setDataRef(d => subMonths(d, 1))} style={botaoNavStyle}><ChevronLeft size={16} /></button>
      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>
        {MESES_LABEL[dataRef.getMonth()]} {dataRef.getFullYear()}
      </div>
      <button onClick={() => setDataRef(d => addMonths(d, 1))} style={botaoNavStyle}><ChevronRight size={16} /></button>
    </div>
  )
}

const botaoNavStyle = {
  width: '32px', height: '32px', borderRadius: '9px', border: '1px solid var(--color-border-dark)',
  background: 'var(--color-surface-dark-raised)', color: 'var(--color-text-dark-primary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}

function CardStat({ label, valor, cor }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
      border: '1px solid rgba(165,76,46,0.2)', padding: '14px',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: cor }}>{valor}</div>
    </div>
  )
}

// Barra empilhada simples (2 categorias de status: pago/pendente) em vez de puxar recharts pra
// algo tão pequeno — rótulo direto quando o segmento é largo o bastante, legenda sempre visível
// (skill dataviz: ≥2 séries sempre com legenda), cores reservadas de status (nunca reusadas em
// outro contexto), gap de 2px entre segmentos.
function BarraAdimplencia({ pagos, pendentes }) {
  const total = pagos + pendentes || 1
  const pctPago = (pagos / total) * 100
  const pctPendente = 100 - pctPago
  return (
    <div>
      <div style={{ display: 'flex', height: '28px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--color-surface-dark-overlay)' }}>
        {pagos > 0 && (
          <div style={{
            width: `${pctPago}%`, backgroundColor: 'var(--color-state-success)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRight: pendentes > 0 ? '2px solid var(--color-surface-dark-overlay)' : 'none',
          }}>
            {pctPago > 12 && <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>{pagos}</span>}
          </div>
        )}
        {pendentes > 0 && (
          <div style={{ width: `${pctPendente}%`, backgroundColor: 'var(--color-state-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pctPendente > 12 && <span style={{ fontSize: '11px', fontWeight: '700', color: '#1E2B24' }}>{pendentes}</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
        <LegendaItem cor="var(--color-state-success)" label={`Pago (${pagos})`} />
        <LegendaItem cor="var(--color-state-warning)" label={`Pendente (${pendentes})`} />
      </div>
    </div>
  )
}

function LegendaItem({ cor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: cor, flexShrink: 0 }} />
      {label}
    </div>
  )
}

function LinhaRegistro({ registro, mes, ano, empresaId, vencido }) {
  const salvar = useSalvarPagamentoParticular(registro.tipo)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef(null)
  const pago = registro.status === 'pago'
  const cor = pago ? 'var(--color-state-success)' : vencido ? 'var(--color-state-danger)' : 'var(--color-state-warning)'
  const Icone = pago ? CheckCircle2 : vencido ? AlertTriangle : Clock
  const label = pago ? 'Pago' : vencido ? 'Vencido' : 'Pendente'

  function basePayload(status) {
    const chave = registro.tipo === 'aluno' ? { aluno_id: registro.id } : { contratante_id: registro.id }
    return { empresa_id: empresaId, ...chave, mes, ano, status, data_pagamento: status === 'pago' ? format(new Date(), 'yyyy-MM-dd') : null }
  }

  async function alternarStatus() {
    try {
      await salvar.mutateAsync(basePayload(pago ? 'pendente' : 'pago'))
      toast.success(pago ? 'Marcado como pendente' : 'Marcado como pago')
    } catch (err) { toast.error(err.message) }
  }

  async function handleUpload(file) {
    if (!file) return
    setEnviando(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `particular/${registro.tipo}/${registro.id}/comprovante_${ano}_${mes}.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await salvar.mutateAsync({ ...basePayload('pago'), comprovante_url: publicUrl, comprovante_nome: file.name })
      toast.success('Comprovante anexado!')
    } catch (err) { toast.error(err.message) }
    finally { setEnviando(false) }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '12px',
      backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${vencido ? 'rgba(180,71,47,0.4)' : 'rgba(165,76,46,0.2)'}`,
    }}>
      <Icone size={16} color={cor} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-dark-primary)' }}>{registro.nome}</div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>
          {registro.tipo === 'contratante' ? 'Contratante · ' : ''}{registro.detalhe} · {fmtBRL(registro.valor)}
        </div>
      </div>
      <span style={{ fontSize: '10px', fontWeight: '700', color: cor, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
      {registro.comprovanteUrl && (
        <a href={registro.comprovanteUrl} target="_blank" rel="noreferrer" title={registro.comprovanteNome || 'Comprovante'}
          style={{ color: 'var(--color-text-dark-secondary)', display: 'flex' }}>
          <ExternalLink size={14} />
        </a>
      )}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
        onChange={e => handleUpload(e.target.files?.[0])} />
      <button onClick={() => inputRef.current?.click()} disabled={enviando} title="Anexar comprovante" style={{
        width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--color-border-dark)',
        background: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
      }}><Upload size={13} /></button>
      <button onClick={alternarStatus} disabled={salvar.isPending} style={{
        padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
        background: pago ? 'var(--color-surface-dark-overlay)' : 'var(--color-state-success)',
        color: pago ? 'var(--color-text-dark-secondary)' : '#fff', flexShrink: 0,
      }}>{pago ? 'Marcar pendente' : 'Marcar pago'}</button>
    </div>
  )
}
