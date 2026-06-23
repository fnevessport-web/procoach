import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAulas, useConfirmarAulaCoordenador } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
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
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-[#F0F2F5]">Confirmação de Aulas</h1>
        {modalidadeSelecionada && (
          <span className="text-sm text-[#00D4AA]">{modalidadeSelecionada.icone_emoji} {modalidadeSelecionada.nome}</span>
        )}
      </div>

      <div className="flex items-center justify-between bg-[#1A1D27] border border-[#2A2D3E] rounded-xl px-4 py-3 mb-5">
        <button onClick={() => navData(-1)} className="p-1 text-[#8B8FA8] hover:text-[#F0F2F5]">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-[#F0F2F5] capitalize">{label}</div>
          <button onClick={() => setData(format(new Date(), 'yyyy-MM-dd'))} className="text-xs text-[#00D4AA]">
            Hoje
          </button>
        </div>
        <button onClick={() => navData(1)} className="p-1 text-[#8B8FA8] hover:text-[#F0F2F5]">
          <ChevronRight size={20} />
        </button>
      </div>

      {isLoading ? <Loading /> : !aulasFiltradas?.length ? (
        <EmptyState icon="📅" title="Nenhuma aula encontrada" />
      ) : (
        <div className="flex flex-col gap-3">
          {aulasFiltradas.map(aula => {
            const podeConfirmar = !['match', 'nao_dada'].includes(aula.status)
            const isLoading = loadingId === aula.id

            return (
              <Card key={aula.id} className={aula.status === 'divergencia' ? 'border-[#EF4444]/50' : ''}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{aula.turmas?.modalidades?.icone_emoji}</span>
                        <span className="font-semibold text-[#F0F2F5]">{aula.turmas?.nome}</span>
                      </div>
                      <div className="text-xs text-[#8B8FA8]">
                        Prof: {aula.professores?.nome} • {aula.turmas?.horario_inicio?.slice(0, 5)}–{aula.turmas?.horario_fim?.slice(0, 5)}
                      </div>
                    </div>
                    <StatusBadge status={aula.status} />
                  </div>

                  {aula.status === 'divergencia' && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#EF4444]/10 mb-3">
                      <AlertTriangle size={14} className="text-[#EF4444]" />
                      <span className="text-xs text-[#EF4444]">Divergência detectada — requer atenção</span>
                    </div>
                  )}

                  {podeConfirmar && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleConfirmar(aula.id, true)}
                        loading={isLoading}
                        className="flex-1"
                      >
                        <CheckCircle size={14} /> Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleConfirmar(aula.id, false)}
                        loading={isLoading}
                      >
                        <AlertTriangle size={14} /> Divergência
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
