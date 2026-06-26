import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Calendar } from 'lucide-react'
import { useAulas, useGerarAulas } from '../../hooks/useAulas'
import { useTurmas } from '../../hooks/useTurmas'
import { useProfessores } from '../../hooks/useProfessores'
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          Gestão de Aulas
        </h1>
        <button
          onClick={() => setModalGerar(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Gerar Aulas
        </button>
      </div>

      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        padding: '4px', backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
      }}>
        {[
          { key: 'hoje', label: 'Por Dia' },
          { key: 'divergencias', label: '🔴 Divergências' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            background: tab === t.key ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent',
            color: tab === t.key ? 'white' : '#555', transition: 'all 0.2s',
          }}>{t.label}</button>
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
  if (!aulas?.length) return (
    <EmptyState icon="✅" title="Nenhuma divergência" description="Todas as aulas estão com match!" />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {aulas.map(aula => (
        <div key={aula.id} style={{
          backgroundColor: '#1a1a1a', borderRadius: '12px',
          border: '1px solid rgba(239,68,68,0.3)', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span>{aula.turmas?.modalidades?.icone_emoji}</span>
                <span style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '14px' }}>{aula.turmas?.nome}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#555' }}>
                {format(new Date(aula.data_aula + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })} •
                Prof: {aula.professores?.nome}
              </div>
            </div>
            <StatusBadge status={aula.status} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ModalGerarAulas({ open, onClose }) {
  const { data: turmas } = useTurmas()
  const gerar = useGerarAulas()

  const [form, setForm] = useState({
    turma_id: '',
    professor_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })
  const [resultado, setResultado] = useState(null)

  // Busca professor da turma selecionada
  const turmaSelecionada = turmas?.find(t => t.id === form.turma_id)
  const { professores } = useProfessores(turmaSelecionada?.modalidade_id)

  function handleTurmaChange(turma_id) {
    const turma = turmas?.find(t => t.id === turma_id)
    setForm(f => ({
      ...f,
      turma_id,
      professor_id: turma?.professor_titular_id || '',
    }))
  }

  async function handleGerar() {
    try {
      const n = await gerar.mutateAsync({
        turmaId: form.turma_id,
        dataInicio: form.data_inicio,
        dataFim: form.data_fim,
        professorOverrideId: form.professor_id || null,
      })
      setResultado(n)
    } catch (err) {
      // erro já tratado no hook
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerar Aulas" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: '600', color: '#F0F2F5' }}>{resultado} aulas geradas!</div>
            <button
              onClick={() => { onClose(); setResultado(null) }}
              style={{
                marginTop: '16px', width: '100%', padding: '12px',
                borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}
            >Fechar</button>
          </div>
        ) : (
          <>
            <Select label="Turma" value={form.turma_id}
              onChange={e => handleTurmaChange(e.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>

            {/* Professor — pré-preenchido com titular, editável */}
            <Select
              label="Professor (opcional — substitui o titular)"
              value={form.professor_id}
              onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}
            >
              <option value="">Professor titular da turma</option>
              {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>

            <Input label="Data Início" type="date" value={form.data_inicio}
              onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            <Input label="Data Fim" type="date" value={form.data_fim}
              onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />

            <button
              onClick={handleGerar}
              disabled={gerar.isPending || !form.turma_id}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '14px', fontWeight: '600',
                cursor: !form.turma_id ? 'not-allowed' : 'pointer',
                opacity: !form.turma_id ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <Calendar size={16} />
              {gerar.isPending ? 'Gerando...' : 'Gerar Aulas'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}