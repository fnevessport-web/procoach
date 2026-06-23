import { useState } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calculator, DollarSign, CheckCircle, FileText } from 'lucide-react'
import { useProfessores } from '../../hooks/useProfessores'
import {
  useFechamentos, useCalcularFechamento, useCriarFechamento, useAtualizarFechamento
} from '../../hooks/useFinanceiro'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select, Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

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
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleCriarFechamento() {
    if (!calculo) return
    try {
      await criar.mutateAsync({
        professor_id: professorId,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        total_aulas: calculo.totalAulas,
        valor_hora: calculo.valorHora,
        total_bruto: calculo.totalBruto,
        status: 'aberto'
      })
      toast.success('Fechamento criado!')
      setCalculo(null)
      setTab('historico')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleMarcarPago(id) {
    try {
      await atualizar.mutateAsync({ id, status: 'pago' })
      toast.success('Marcado como pago!')
    } catch (err) {
      toast.error(err.message)
    }
  }

  function exportarPDF(fechamento) {
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>Fechamento ProCoach</title>
      <style>body{font-family:Arial;padding:40px;} h1{color:#00D4AA;} table{width:100%;border-collapse:collapse;} td,th{padding:8px;border:1px solid #ddd;} .total{font-size:1.5em;font-weight:bold;color:#00D4AA;}</style>
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
      <h1 className="text-xl font-bold text-[#F0F2F5] mb-5">Financeiro</h1>

      <div className="flex gap-2 mb-5 p-1 bg-[#1A1D27] border border-[#2A2D3E] rounded-xl">
        {[
          { key: 'novo', label: '🧮 Novo Fechamento' },
          { key: 'historico', label: '📋 Histórico' }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-[#00D4AA] text-[#0F1117]' : 'text-[#8B8FA8]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'novo' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><span className="text-base font-semibold text-[#F0F2F5]">Calcular Período</span></CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Select label="Professor" value={professorId} onChange={e => { setProfessorId(e.target.value); setCalculo(null) }}>
                <option value="">Selecione o professor</option>
                {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Data Início" type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
                <Input label="Data Fim" type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
              </div>
              <Button onClick={handleCalcular} loading={calcular.isPending} disabled={!professorId} className="w-full">
                <Calculator size={16} /> Calcular
              </Button>
            </CardBody>
          </Card>

          {calculo && (
            <Card className="border-[#00D4AA]/30">
              <CardBody>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-[#00D4AA]">
                    R$ {calculo.totalBruto.toFixed(2)}
                  </div>
                  <div className="text-sm text-[#8B8FA8] mt-1">Total a pagar</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-[#0F1117] border border-[#2A2D3E] text-center">
                    <div className="text-xl font-bold text-[#F0F2F5]">{calculo.totalAulas}</div>
                    <div className="text-xs text-[#8B8FA8]">Aulas com match</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0F1117] border border-[#2A2D3E] text-center">
                    <div className="text-xl font-bold text-[#F0F2F5]">R$ {Number(calculo.valorHora).toFixed(2)}</div>
                    <div className="text-xs text-[#8B8FA8]">Por aula</div>
                  </div>
                </div>

                {professorSelecionado?.pix && (
                  <div className="p-3 rounded-xl bg-[#1E2235] border border-[#2A2D3E] mb-4">
                    <div className="text-xs text-[#8B8FA8] mb-1">Dados bancários</div>
                    <div className="text-sm text-[#F0F2F5]">{professorSelecionado.banco}</div>
                    <div className="text-xs text-[#8B8FA8]">PIX: {professorSelecionado.pix}</div>
                  </div>
                )}

                <Button onClick={handleCriarFechamento} loading={criar.isPending} className="w-full">
                  <FileText size={16} /> Gerar Fechamento
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <>
          {loadingFechamentos ? <Loading /> : !fechamentos?.length ? (
            <EmptyState icon="💰" title="Nenhum fechamento" description="Crie seu primeiro fechamento na aba ao lado" />
          ) : (
            <div className="flex flex-col gap-3">
              {fechamentos.map(f => {
                const { variant, label } = statusMap[f.status] || {}
                return (
                  <Card key={f.id}>
                    <CardBody>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-[#F0F2F5]">{f.professores?.nome}</div>
                          <div className="text-xs text-[#8B8FA8] mt-0.5">
                            {format(new Date(f.periodo_inicio + 'T12:00'), 'dd/MM')} –{' '}
                            {format(new Date(f.periodo_fim + 'T12:00'), 'dd/MM/yyyy')}
                          </div>
                        </div>
                        <Badge variant={variant}>{label}</Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold text-[#00D4AA]">R$ {Number(f.total_bruto).toFixed(2)}</div>
                          <div className="text-xs text-[#8B8FA8]">{f.total_aulas} aulas × R$ {Number(f.valor_hora).toFixed(2)}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => exportarPDF(f)}>
                            <FileText size={14} />
                          </Button>
                          {f.status !== 'pago' && (
                            <Button size="sm" variant="secondary" onClick={() => handleMarcarPago(f.id)}>
                              <CheckCircle size={14} /> Pago
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
