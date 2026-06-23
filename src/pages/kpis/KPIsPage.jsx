import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { BarChart3, TrendingUp, TrendingDown, Users, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useKPIs } from '../../hooks/useKPIs'
import { useModalidades } from '../../hooks/useModalidades'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'

export function KPIsPage() {
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [modalidadeId, setModalidadeId] = useState('')
  const { data: modalidades } = useModalidades()
  const { data: kpis, isLoading } = useKPIs({ periodoInicio, periodoFim, modalidadeId: modalidadeId || null })

  return (
    <div className="fade-in">
      <h1 className="text-xl font-bold text-[#F0F2F5] mb-5">Dashboard KPIs</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
        <div className="col-span-2 sm:col-span-1">
          <Input type="date" label="De" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
        </div>
        <div>
          <Input type="date" label="Até" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
        </div>
        <div>
          <Select label="Modalidade" value={modalidadeId} onChange={e => setModalidadeId(e.target.value)}>
            <option value="">Todas</option>
            {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
          </Select>
        </div>
      </div>

      {isLoading ? <Loading /> : kpis ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon="📅" label="Total de Aulas" value={kpis.totalAulas} color="#3B82F6" />
            <KpiCard icon="✅" label="Com Match" value={kpis.totalMatch} color="#10B981" />
            <KpiCard icon="🔴" label="Divergências" value={kpis.totalDivergencias} color="#EF4444" />
            <KpiCard icon="👥" label="Taxa Presença" value={`${kpis.taxaPresenca}%`} color="#00D4AA" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <KpiCard icon="❌" label="Não Dadas" value={kpis.totalNaoDadas} color="#F59E0B" />
            <KpiCard icon="🔄" label="Substituições" value={kpis.totalSubs} color="#8B5CF6" />
          </div>

          {kpis.variacaoPerc !== null && (
            <Card className="border-[#00D4AA]/20">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[#8B8FA8]">Comparativo vs. mês anterior</div>
                    <div className="text-sm font-medium text-[#F0F2F5] mt-1">
                      {kpis.matchAtual} aulas com match vs {kpis.matchAnterior} anterior
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-lg font-bold ${kpis.variacaoPerc >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {kpis.variacaoPerc >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {kpis.variacaoPerc > 0 ? '+' : ''}{kpis.variacaoPerc}%
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {kpis.profsMaisAulas?.length > 0 && (
            <Card>
              <CardHeader>
                <span className="text-sm font-semibold text-[#F0F2F5]">🏆 Professores por Aulas (Match)</span>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={kpis.profsMaisAulas} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="nome" tick={{ fill: '#8B8FA8', fontSize: 11 }} tickFormatter={v => v?.split(' ')[0]} />
                    <YAxis tick={{ fill: '#8B8FA8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1A1D27', border: '1px solid #2A2D3E', borderRadius: 8 }}
                      labelStyle={{ color: '#F0F2F5' }}
                      itemStyle={{ color: '#00D4AA' }}
                    />
                    <Bar dataKey="total" fill="#00D4AA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          )}

          {kpis.porModalidade?.length > 0 && (
            <Card>
              <CardHeader>
                <span className="text-sm font-semibold text-[#F0F2F5]">📊 Frequência por Modalidade</span>
              </CardHeader>
              <CardBody>
                <div className="flex flex-col gap-2">
                  {kpis.porModalidade.map(m => (
                    <div key={m.nome} className="flex items-center gap-3">
                      <span className="text-base w-6 flex-shrink-0">{m.icone}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[#F0F2F5]">{m.nome}</span>
                          <span className="text-xs text-[#8B8FA8]">{m.match}/{m.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#2A2D3E] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${m.total > 0 ? (m.match / m.total) * 100 : 0}%`,
                              backgroundColor: m.cor || '#00D4AA'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  )
}

function KpiCard({ icon, label, value, color }) {
  return (
    <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-[#8B8FA8] mt-0.5">{label}</div>
    </div>
  )
}
