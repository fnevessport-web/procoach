import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAulas, useConfirmarAulaCoordenador } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'
import { StatusBadge } from '../../components/ui/Badge'
import { Loading, EmptyState } from '../../components/ui/Loading'

export function AulasCoordenador() {
  const { modalidadeSelecionada } = useAppStore()
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loadingId, setLoadingId] = useState(null)

  const { data: aulas, isLoading } = useAulas({
    data,
    modalidadeId: modalidadeSelecionada?.id
  })
  const confirmar = useConfirmarAulaCoordenador()

  const dataObj = new Date(data + 'T12:00:00')
  const label = format(dataObj, "EEEE, d 'de' MMMM", { locale: ptBR })
  const isHoje = data === format(new Date(), 'yyyy-MM-dd')

  function navData(dir) {
    const d = dir > 0 ? addDays(dataObj, 1) : subDays(dataObj, 1)
    setData(format(d, 'yyyy-MM-dd'))
  }

  async function handleConfirmar(aulaId, confirmada) {
    setLoadingId(aulaId)
    try {
      await confirmar.mutateAsync({ aulaId, confirmada })
    } finally {
      setLoadingId(null)
    }
  }

  const aulasFiltradas = modalidadeSelecionada
    ? aulas?.filter(a => a.turmas?.modalidades?.nome === modalidadeSelecionada.nome)
    : aulas

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          Confirmação de Aulas
        </h2>
        {modalidadeSelecionada && (
          <span style={{ fontSize: '13px', color: '#fcc825' }}>
            {modalidadeSelecionada.icone_emoji} {modalidadeSelecionada.nome}
          </span>
        )}
      </div>

      {/* Navegador de data */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
      }}>
        <button onClick={() => navData(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px',
        }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', textTransform: 'capitalize' }}>
            {label}
          </div>
          <button onClick={() => setData(format(new Date(), 'yyyy-MM-dd'))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: isHoje ? '#fcc825' : '#555', marginTop: '2px',
          }}>
            {isHoje ? 'Hoje' : 'Ir para hoje'}
          </button>
        </div>
        <button onClick={() => navData(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px',
        }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {isLoading ? <Loading /> : !aulasFiltradas?.length ? (
        <EmptyState icon="📅" title="Nenhuma aula encontrada" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {aulasFiltradas.map(aula => {
            const podeConfirmar = !['match', 'nao_dada'].includes(aula.status)
            const carregando = loadingId === aula.id
            const isDivergencia = aula.status === 'divergencia'

            return (
              <div key={aula.id} style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '14px',
                border: isDivergencia
                  ? '1px solid rgba(239,68,68,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span>{aula.turmas?.modalidades?.icone_emoji}</span>
                      <span style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '14px' }}>
                        {aula.turmas?.nome}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      Prof: {aula.professores?.nome} • {aula.turmas?.horario_inicio?.slice(0, 5)}–{aula.turmas?.horario_fim?.slice(0, 5)}
                    </div>
                  </div>
                  <StatusBadge status={aula.status} />
                </div>

                {isDivergencia && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(239,68,68,0.1)', marginBottom: '10px',
                  }}>
                    <AlertTriangle size={14} color="#EF4444" />
                    <span style={{ fontSize: '12px', color: '#EF4444' }}>
                      Divergência detectada — requer atenção
                    </span>
                  </div>
                )}

                {podeConfirmar && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleConfirmar(aula.id, true)}
                      disabled={carregando}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                        color: 'white', fontSize: '13px', fontWeight: '600',
                        cursor: carregando ? 'not-allowed' : 'pointer',
                        opacity: carregando ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      <CheckCircle size={14} />
                      {carregando ? 'Aguarde...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => handleConfirmar(aula.id, false)}
                      disabled={carregando}
                      style={{
                        padding: '10px 14px', borderRadius: '10px', border: 'none',
                        backgroundColor: 'rgba(239,68,68,0.15)',
                        color: '#EF4444', fontSize: '13px', fontWeight: '600',
                        cursor: carregando ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <AlertTriangle size={14} />
                      Divergência
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}