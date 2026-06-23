import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, UserCheck } from 'lucide-react'
import { useAulas, useConfirmarAulaProfessor, useMarcarNaoDada } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { Textarea } from '../../components/ui/Input'

export function AulasProfessor() {
  const { user } = useAppStore()
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aulaAtiva, setAulaAtiva] = useState(null)
  const [modalTipo, setModalTipo] = useState(null)

  const { data: aulas, isLoading } = useAulas({ data, professorId: user?.id })
  const confirmar = useConfirmarAulaProfessor()
  const marcarNaoDada = useMarcarNaoDada()

  const dataObj = new Date(data + 'T12:00:00')
  const label = format(dataObj, "EEEE, d 'de' MMMM", { locale: ptBR })

  function navData(dir) {
    const d = dir > 0 ? addDays(dataObj, 1) : subDays(dataObj, 1)
    setData(format(d, 'yyyy-MM-dd'))
  }

  function abrirModal(aula, tipo) {
    setAulaAtiva(aula)
    setModalTipo(tipo)
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-[#F0F2F5]">Minhas Aulas</h1>
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

      {isLoading ? <Loading /> : !aulas?.length ? (
        <EmptyState icon="📅" title="Nenhuma aula hoje" description="Aproveite o dia de folga!" />
      ) : (
        <div className="flex flex-col gap-3">
          {aulas.map(aula => (
            <AulaCardProfessor
              key={aula.id}
              aula={aula}
              onConfirmar={() => abrirModal(aula, 'confirmar')}
              onNaoDada={() => abrirModal(aula, 'naodada')}
            />
          ))}
        </div>
      )}

      <ModalConfirmarAula
        open={modalTipo === 'confirmar'}
        aula={aulaAtiva}
        onClose={() => { setAulaAtiva(null); setModalTipo(null) }}
        onConfirmar={async (dados) => {
          await confirmar.mutateAsync({ aulaId: aulaAtiva.id, ...dados })
          setAulaAtiva(null)
          setModalTipo(null)
        }}
        loading={confirmar.isPending}
      />

      <ModalNaoDada
        open={modalTipo === 'naodada'}
        aula={aulaAtiva}
        onClose={() => { setAulaAtiva(null); setModalTipo(null) }}
        onConfirmar={async (motivo) => {
          await marcarNaoDada.mutateAsync({ aulaId: aulaAtiva.id, motivo })
          setAulaAtiva(null)
          setModalTipo(null)
        }}
        loading={marcarNaoDada.isPending}
      />
    </div>
  )
}

function AulaCardProfessor({ aula, onConfirmar, onNaoDada }) {
  const cor = aula.turmas?.modalidades?.cor_hex || '#00D4AA'
  const podeConfirmar = !['match', 'nao_dada', 'confirmada_professor'].includes(aula.status)

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{aula.turmas?.modalidades?.icone_emoji}</span>
              <span className="font-semibold text-[#F0F2F5]">{aula.turmas?.nome}</span>
            </div>
            <div className="text-sm text-[#8B8FA8]">
              {aula.turmas?.horario_inicio?.slice(0, 5)} – {aula.turmas?.horario_fim?.slice(0, 5)}
            </div>
          </div>
          <StatusBadge status={aula.status} />
        </div>

        <div
          className="h-0.5 rounded-full mb-3 opacity-30"
          style={{ backgroundColor: cor }}
        />

        <div className="flex items-center gap-2 mb-3">
          <UserCheck size={14} className="text-[#8B8FA8]" />
          <span className="text-xs text-[#8B8FA8]">
            {aula.presencas?.length || 0} aluno{(aula.presencas?.length || 0) !== 1 ? 's' : ''}
            {aula.presencas?.length > 0
              ? ` — ${aula.presencas.filter(p => p.presente).length} presentes`
              : ''}
          </span>
        </div>

        {podeConfirmar && (
          <div className="flex gap-2">
            <Button size="sm" onClick={onConfirmar} className="flex-1">
              <CheckCircle size={14} /> Aula Dada
            </Button>
            <Button size="sm" variant="danger" onClick={onNaoDada}>
              <XCircle size={14} /> Não Dada
            </Button>
          </div>
        )}

        {aula.observacoes && (
          <p className="text-xs text-[#8B8FA8] mt-2 italic">{aula.observacoes}</p>
        )}
      </CardBody>
    </Card>
  )
}

function ModalConfirmarAula({ open, aula, onClose, onConfirmar, loading }) {
  const [presencas, setPresencas] = useState([])
  const [ehSub, setEhSub] = useState(false)
  const [obs, setObs] = useState('')

  useState(() => {
    if (aula?.presencas) {
      setPresencas(aula.presencas.map(p => ({ aluno_id: p.aluno_id, presente: true })))
    }
  }, [aula])

  function togglePresenca(alunoId) {
    setPresencas(prev => {
      const exists = prev.find(p => p.aluno_id === alunoId)
      if (exists) return prev.map(p => p.aluno_id === alunoId ? { ...p, presente: !p.presente } : p)
      return [...prev, { aluno_id: alunoId, presente: true }]
    })
  }

  const alunos = aula?.presencas?.map(p => p.alunos) || []
  const isPresente = (alunoId) => {
    const p = presencas.find(p => p.aluno_id === alunoId)
    return p ? p.presente : true
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirmar Aula" size="md">
      {aula && (
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-[#0F1117] border border-[#2A2D3E]">
            <div className="font-semibold text-[#F0F2F5]">{aula.turmas?.nome}</div>
            <div className="text-sm text-[#8B8FA8]">
              {aula.turmas?.horario_inicio?.slice(0, 5)} – {aula.turmas?.horario_fim?.slice(0, 5)}
            </div>
          </div>

          {alunos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#F0F2F5] mb-2">Presença dos alunos</h3>
              <div className="flex flex-col gap-2">
                {alunos.map(aluno => (
                  <button
                    key={aluno?.id}
                    onClick={() => togglePresenca(aluno?.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      isPresente(aluno?.id)
                        ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444]'
                    }`}
                  >
                    <span className="text-sm font-medium">{aluno?.nome}</span>
                    <span className="text-lg">{isPresente(aluno?.id) ? '✅' : '❌'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#0F1117] border border-[#2A2D3E] cursor-pointer">
            <input
              type="checkbox"
              checked={ehSub}
              onChange={e => setEhSub(e.target.checked)}
              className="w-4 h-4 accent-[#00D4AA]"
            />
            <span className="text-sm text-[#F0F2F5]">Sou substituto nesta aula</span>
          </label>

          <Textarea
            label="Observações (opcional)"
            placeholder="Alguma observação sobre a aula..."
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={2}
          />

          <Button
            onClick={() => onConfirmar({
              presencas,
              ehSubstituicao: ehSub,
              observacoes: obs
            })}
            loading={loading}
            size="lg"
            className="w-full"
          >
            <CheckCircle size={18} /> Confirmar Aula
          </Button>
        </div>
      )}
    </Modal>
  )
}

function ModalNaoDada({ open, aula, onClose, onConfirmar, loading }) {
  const [motivo, setMotivo] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="Aula Não Dada" size="sm">
      {aula && (
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30">
            <div className="font-semibold text-[#F0F2F5]">{aula.turmas?.nome}</div>
          </div>

          <Textarea
            label="Motivo (obrigatório)"
            placeholder="Por que a aula não foi dada?"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
          />

          <Button
            variant="danger"
            onClick={() => onConfirmar(motivo)}
            loading={loading}
            disabled={!motivo.trim()}
            size="lg"
            className="w-full"
          >
            Registrar Falta
          </Button>
        </div>
      )}
    </Modal>
  )
}
