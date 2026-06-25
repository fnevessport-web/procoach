import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useKPIs } from '../../hooks/useKPIs'
import { useModalidades } from '../../hooks/useModalidades'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'

const KPI_ICONS = {
  totalAulas:    '/images/totaldeaulas.png',
  comMatch:      '/images/commatch.png',
  divergencias:  '/images/divergencia.png',
  taxaPresenca:  '/images/taxadepresença.png',
  naoDadas:      '/images/naodadas.png',
  substituicoes: '/images/substituição.png',
}

export function KPIsPage() {
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [modalidadeId, setModalidadeId] = useState('')
  const { data: modalidades } = useModalidades()
  const { data: kpis, isLoading } = useKPIs({ periodoInicio, periodoFim, modalidadeId: modalidadeId || null })

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', marginBottom: '20px' }}>
        Dashboard KPIs
      </h1>

      {/* Filtros — todos em coluna */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <Input type="date" label="De" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
        <Input type="date" label="Até" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
        <Select label="Modalidade" value={modalidadeId} onChange={e => setModalidadeId(e.target.value)}>
          <option value="">Todas</option>
          {modalidades?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Select>
      </div>

      {isLoading ? <Loading /> : kpis ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KpiCard icon={KPI_ICONS.totalAulas} label="Total de Aulas" value={kpis.totalAulas} dot="#fcc825" />
            <KpiCard icon={KPI_ICONS.comMatch} label="Com Match" value={kpis.totalMatch} dot="#22c55e" />
            <KpiCard icon={KPI_ICONS.divergencias} label="Divergências" value={kpis.totalDivergencias} dot="#EF4444" />
            <KpiCard icon={KPI_ICONS.taxaPresenca} label="Taxa Presença" value={`${kpis.taxaPresenca}%`} dot="#cf1b9b" />
            <KpiCard icon={KPI_ICONS.naoDadas} label="Não Dadas" value={kpis.totalNaoDadas} dot="#d28c3c" />
            <KpiCard icon={KPI_ICONS.substituicoes} label="Substituições" value={kpis.totalSubs} dot="#7c3aed" />
          </div>

          {kpis.variacaoPerc !== null && (
            <div style={{
              padding: '16px', borderRadius: '16px',
              backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#555' }}>Comparativo vs. mês anterior</div>
                  <div style={{ fontSize: '13px', color: '#F0F2F5', marginTop: '4px' }}>
                    {kpis.matchAtual} aulas vs {kpis.matchAnterior} anterior
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '18px', fontWeight: '700',
                  color: kpis.variacaoPerc >= 0 ? '#22c55e' : '#EF4444'
                }}>
                  {kpis.variacaoPerc >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  {kpis.variacaoPerc > 0 ? '+' : ''}{kpis.variacaoPerc}%
                </div>
              </div>
            </div>
          )}

          {kpis.profsMaisAulas?.length > 0 && (
            <div style={{
              padding: '16px', borderRadius: '16px',
              backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5', marginBottom: '12px' }}>
                🏆 Professores por Aulas
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={kpis.profsMaisAulas} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="nome" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={v => v?.split(' ')[0]} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 8 }}
                    labelStyle={{ color: '#F0F2F5' }}
                    itemStyle={{ color: '#fcc825' }}
                  />
                  <Bar dataKey="total" fill="#fcc825" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {kpis.porModalidade?.length > 0 && (
            <div style={{
              padding: '16px', borderRadius: '16px',
              backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5', marginBottom: '12px' }}>
                📊 Frequência por Modalidade
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {kpis.porModalidade.map(m => (
                  <div key={m.nome} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', width: '20px', flexShrink: 0 }}>{m.icone}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#F0F2F5' }}>{m.nome}</span>
                        <span style={{ fontSize: '11px', color: '#555' }}>{m.match}/{m.total}</span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#222' }}>
                        <div style={{
                          height: '100%', borderRadius: '2px',
                          width: `${m.total > 0 ? (m.match / m.total) * 100 : 0}%`,
                          background: 'linear-gradient(90deg, #fcc825, #cf1b9b)',
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function KpiCard({ icon, label, value, dot }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '16px',
      backgroundColor: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <img src={icon} alt={label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }} />
      </div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: '#F0F2F5' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#555' }}>{label}</div>
    </div>
  )
}