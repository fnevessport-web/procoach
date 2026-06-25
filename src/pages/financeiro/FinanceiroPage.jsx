import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Calculator, FileText, CheckCircle } from 'lucide-react'
import { useProfessores } from '../../hooks/useProfessores'
import {
  useFechamentos, useCalcularFechamento, useCriarFechamento, useAtualizarFechamento
} from '../../hooks/useFinanceiro'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { Badge } from '../../components/ui/Badge'
import { Select, Input } from '../../components/ui/Input'
import toast from 'react-hot-toast'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

export function FinanceiroPage() {
  const [tab, setTab] = useState('novo')
  const [professorId, setProfessorId] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [calculo, setCalculo] = useState(null)

  const { data: professores } = useProfessores()
  const { data: fechamentos, isLoading: loadingFechamentos } = useFechamentos()
  const calcular = useCalcularFechamento()
  const criar = useCriarFechamento()
  const atualizar = useAtualizarFechamento()

  const professorSelecionado = professores?.find(p => p.id === professorId)

  async function handleCalcular() {
    if (!professorId) return toast.error('Selecione um professor')
    try {
      const resultado = await calcular.mutateAsync({ professorId, periodoInicio, periodoFim })
      setCalculo(resultado)
    } catch (err) { toast.error(err.message) }
  }

  async function handleCriarFechamento() {
    if (!calculo) return
    try {
      await criar.mutateAsync({
        professor_id: professorId, periodo_inicio: periodoInicio, periodo_fim: periodoFim,
        total_aulas: calculo.totalAulas, valor_hora: calculo.valorHora,
        total_bruto: calculo.totalBruto, status: 'aberto'
      })
      toast.success('Fechamento criado!')
      setCalculo(null); setTab('historico')
    } catch (err) { toast.error(err.message) }
  }

  async function handleMarcarPago(id) {
    try {
      await atualizar.mutateAsync({ id, status: 'pago' })
      toast.success('Marcado como pago!')
    } catch (err) { toast.error(err.message) }
  }

  function exportarPDF(fechamento) {
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>Fechamento ProCoach</title>
      <style>body{font-family:Arial;padding:40px;} h1{color:#fcc825;} table{width:100%;border-collapse:collapse;} td,th{padding:8px;border:1px solid #ddd;} .total{font-size:1.5em;font-weight:bold;color:#fcc825;}</style>
      </head><body>
      <h1>🏆 ProCoach — Fechamento</h1>
      <h2>${fechamento.professores?.nome}</h2>
      <p>Período: ${format(new Date(fechamento.periodo_inicio + 'T12:00'), 'dd/MM/yyyy')} a ${format(new Date(fechamento.periodo_fim + 'T12:00'), 'dd/MM/yyyy')}</p>
      <hr/>
      <table>
        <tr><th>Item</th><th>Valor</th></tr>
        <tr><td>Total de aulas (match)</td><td>${fechamento.total_aulas}</td></tr>
        <tr><td>Valor por aula</td><td>R$ ${Number(fechamento.valor_hora).toFixed(2)}</td></tr>
        <tr><td class="total">Total a pagar</td><td class="total">R$ ${Number(fechamento.total_bruto).toFixed(2)}</td></tr>
      </table>
      <h3>Dados Bancários</h3>
      <p>Banco: ${fechamento.professores?.banco || '-'}</p>
      <p>Agência: ${fechamento.professores?.agencia || '-'} | Conta: ${fechamento.professores?.conta || '-'} (${fechamento.professores?.tipo_conta || '-'})</p>
      <p>PIX: ${fechamento.professores?.pix || '-'}</p>
      </body></html>
    `)
    w.print()
  }

  const statusMap = {
    aberto: { variant: 'warning', label: 'Aberto' },
    fechado: { variant: 'info', label: 'Fechado' },
    pago: { variant: 'success', label: 'Pago' }
  }

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', marginBottom: '20px' }}>
        Financeiro
      </h1>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        padding: '4px', backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
      }}>
        {[
          { key: 'novo', label: '🧮 Novo Fechamento' },
          { key: 'historico', label: '📋 Histórico' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            background: tab === t.key ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent',
            color: tab === t.key ? 'white' : '#555', transition: 'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'novo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card Calcular */}
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.06)', padding: '16px',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '14px' }}>
              Calcular Período
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Select
                label="Professor"
                value={professorId}
                onChange={e => { setProfessorId(e.target.value); setCalculo(null) }}
              >
                <option value="">Selecione o professor</option>
                {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>

              <Input
                label="Data Início"
                type="date"
                value={periodoInicio}
                onChange={e => setPeriodoInicio(e.target.value)}
              />
              <Input
                label="Data Fim"
                type="date"
                value={periodoFim}
                onChange={e => setPeriodoFim(e.target.value)}
              />

              <button
                onClick={handleCalcular}
                disabled={calcular.isPending || !professorId}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '14px', fontWeight: '600',
                  cursor: !professorId ? 'not-allowed' : 'pointer',
                  opacity: !professorId ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Calculator size={16} />
                {calcular.isPending ? 'Calculando...' : 'Calcular'}
              </button>
            </div>
          </div>

          {/* Resultado */}
          {calculo && (
            <div style={{
              backgroundColor: '#1a1a1a', borderRadius: '16px',
              border: '1px solid rgba(252,200,37,0.2)', padding: '16px',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#fcc825' }}>
                  R$ {calculo.totalBruto.toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>Total a pagar</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{
                  padding: '12px', borderRadius: '10px',
                  backgroundColor: '#110f0f', border: '1px solid #2a2a2a', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5' }}>{calculo.totalAulas}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>Aulas com match</div>
                </div>
                <div style={{
                  padding: '12px', borderRadius: '10px',
                  backgroundColor: '#110f0f', border: '1px solid #2a2a2a', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5' }}>
                    R$ {Number(calculo.valorHora).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#555' }}>Por aula</div>
                </div>
              </div>

              {professorSelecionado?.pix && (
                <div style={{
                  padding: '12px', borderRadius: '10px',
                  backgroundColor: '#110f0f', border: '1px solid #2a2a2a', marginBottom: '14px',
                }}>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Dados bancários</div>
                  <div style={{ fontSize: '13px', color: '#F0F2F5' }}>{professorSelecionado.banco}</div>
                  <div style={{ fontSize: '12px', color: '#555' }}>PIX: {professorSelecionado.pix}</div>
                </div>
              )}

              <button
                onClick={handleCriarFechamento}
                disabled={criar.isPending}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', opacity: criar.isPending ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <FileText size={16} />
                {criar.isPending ? 'Gerando...' : 'Gerar Fechamento'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <>
          {loadingFechamentos ? <Loading /> : !fechamentos?.length ? (
            <EmptyState icon="💰" title="Nenhum fechamento" description="Crie seu primeiro fechamento na aba ao lado" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {fechamentos.map(f => {
                const { variant, label } = statusMap[f.status] || {}
                return (
                  <div key={f.id} style={{
                    backgroundColor: '#1a1a1a', borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '14px' }}>
                          {f.professores?.nome}
                        </div>
                        <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                          {format(new Date(f.periodo_inicio + 'T12:00'), 'dd/MM')} –{' '}
                          {format(new Date(f.periodo_fim + 'T12:00'), 'dd/MM/yyyy')}
                        </div>
                      </div>
                      <Badge variant={variant}>{label}</Badge>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#fcc825' }}>
                          R$ {Number(f.total_bruto).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          {f.total_aulas} aulas × R$ {Number(f.valor_hora).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => exportarPDF(f)}
                          style={{
                            padding: '8px', borderRadius: '8px', border: 'none',
                            backgroundColor: 'rgba(255,255,255,0.05)', color: '#888',
                            cursor: 'pointer',
                          }}
                        >
                          <FileText size={14} />
                        </button>
                        {f.status !== 'pago' && (
                          <button
                            onClick={() => handleMarcarPago(f.id)}
                            style={{
                              padding: '8px 12px', borderRadius: '8px', border: 'none',
                              backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e',
                              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                          >
                            <CheckCircle size={13} /> Pago
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}