import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react'
import { useAulas, useConfirmarAulaCoordenador, useGerarAulas } from '../../hooks/useAulas'
import { useTurmas } from '../../hooks/useTurmas'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { AulasCoordenador } from './AulasCoordenador'

export function AulasAdmin() {
  const [tab, setTab] = useState('hoje')
  const [modalGerar, setModalGerar] = useState(false)

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-[#F0F2F5]">Gestão de Aulas</h1>
        <Button size="sm" onClick={() => setModalGerar(true)}>
          <Plus size={14} /> Gerar Aulas
        </Button>
      </div>

      <div className="flex gap-2 mb-5 p-1 bg-[#1A1D27] border border-[#2A2D3E] rounded-xl">
        {[
          { key: 'hoje', label: 'Por Dia' },
          { key: 'divergencias', label: '🔴 Divergências' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-[#00D4AA] text-[#0F1117]' : 'text-[#8B8FA8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hoje' ? <AulasCoordenador /> : <AulasDivergencias />}

      <ModalGerarAulas open={modalGerar} onClose={() => setModalGerar(false)} />
    </div>
  )
}

function AulasDivergencias() {
  const { data: aulas, isLoading } = useAulas({ status: 'divergencia' })

  if (isLoading) return <Loading />
  if (!aulas?.length) return <EmptyState icon="✅" title="Nenhuma divergência" description="Todas as aulas estão com match!" />

  return (
    <div className="flex flex-col gap-3">
      {aulas.map(aula => (
        <Card key={aula.id} className="border-[#EF4444]/40">
          <CardBody>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span>{aula.turmas?.modalidades?.icone_emoji}</span>
                  <span className="font-semibold text-[#F0F2F5]">{aula.turmas?.nome}</span>
                </div>
                <div className="text-xs text-[#8B8FA8]">
                  {format(new Date(aula.data_aula + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })} •
                  Prof: {aula.professores?.nome}
                </div>
              </div>
              <StatusBadge status={aula.status} />
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}

function ModalGerarAulas({ open, onClose }) {
  const { data: turmas } = useTurmas()
  const gerar = useGerarAulas()
  const [form, setForm] = useState({
    turma_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd')
  })
  const [resultado, setResultado] = useState(null)

  async function handleGerar() {
    const n = await gerar.mutateAsync({
      turmaId: form.turma_id,
      dataInicio: form.data_inicio,
      dataFim: form.data_fim
    })
    setResultado(n)
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerar Aulas" size="sm">
      <div className="flex flex-col gap-4">
        {resultado !== null ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-semibold text-[#F0F2F5]">{resultado} aulas geradas!</div>
            <Button className="mt-4 w-full" onClick={() => { onClose(); setResultado(null) }}>Fechar</Button>
          </div>
        ) : (
          <>
            <Select
              label="Turma"
              value={form.turma_id}
              onChange={e => setForm(f => ({ ...f, turma_id: e.target.value }))}
            >
              <option value="">Selecione a turma</option>
              {turmas?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
            <Input
              label="Data Início"
              type="date"
              value={form.data_inicio}
              onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
            />
            <Input
              label="Data Fim"
              type="date"
              value={form.data_fim}
              onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
            />
            <Button
              onClick={handleGerar}
              loading={gerar.isPending}
              disabled={!form.turma_id}
              className="w-full"
            >
              <Calendar size={16} /> Gerar Aulas
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
