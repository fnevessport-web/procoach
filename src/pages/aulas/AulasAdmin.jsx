import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Calendar, UserPlus, X, ChevronRight, Copy } from 'lucide-react'
import { useAulas, useGerarAulas, useReposicoes, useAulasDisponiveisReposicao, useAgendarReposicao } from '../../hooks/useAulas'
import { useTurmas } from '../../hooks/useTurmas'
import { useProfessores } from '../../hooks/useProfessores'
import { useAlunos, useSalvarAluno } from '../../hooks/useAlunos'
import { useQuadras } from '../../hooks/useQuadras'
import { useNiveis } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import { StatusBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { AulasCoordenador } from './AulasCoordenador'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const TIPOS_PARTICIPACAO = [
  { value: 'mensalista', label: 'Mensalista', color: '#22c55e' },
  { value: 'avulso', label: 'Avulso', color: '#fcc825' },
  { value: 'cortesia', label: 'Cortesia', color: '#cf1b9b' },
  { value: 'reposicao', label: 'Reposição', color: '#3b82f6' },
]

const NIVEIS_ALUNO = [
  'Iniciante 1', 'Iniciante 2',
  'Intermediário 1', 'Intermediário 2',
  'Avançado',
  'Kids Iniciante', 'Kids Intermediário', 'Kids Avançado',
]

const inputInline = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

export function AulasAdmin() {
  const [tab, setTab] = useState('hoje')
  const [modalGerar, setModalGerar] = useState(null)
  const [atalho, setAtalho] = useState(null)
  const { data: reposicoesPendentes } = useReposicoes()
  const totalReposicoes = reposicoesPendentes?.length || 0

  function handleCelulaVazia({ horario, quadraNome, data }) {
    setAtalho({ horario, quadraNome, data })
    setModalGerar('menu_atalho')
  }

  function fecharTudo() {
    setModalGerar(null)
    setAtalho(null)
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          Gestão de Aulas
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setModalGerar('copiar')} title="Copiar Grade" style={{
            padding: '8px', borderRadius: '10px', border: 'none',
            background: 'none', color: '#333', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Copy size={18} />
          </button>
          <button onClick={() => setModalGerar('menu')} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>
            <Calendar size={14} /> Gerar Aulas
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '3px', marginBottom: '20px',
        padding: '4px', backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
      }}>
        {[
          { key: 'hoje', label: 'Por Dia' },
          { key: 'divergencias', label: '🔴 Diverg.' },
          { key: 'reposicoes', label: '↩ Reposição', count: totalReposicoes },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '7px 4px', borderRadius: '8px', border: 'none',
            fontSize: '12px', fontWeight: '500', cursor: 'pointer',
            background: tab === t.key ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent',
            color: tab === t.key ? 'white' : '#555', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                minWidth: '16px', height: '16px', borderRadius: '8px', fontSize: '10px', fontWeight: '700',
                backgroundColor: tab === t.key ? 'rgba(255,255,255,0.3)' : 'rgba(59,130,246,0.25)',
                color: tab === t.key ? 'white' : '#3b82f6',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'hoje'
        ? <AulasCoordenador onCelulaVazia={handleCelulaVazia} />
        : tab === 'reposicoes'
        ? <AulasReposicoes />
        : <AulasDivergencias />
      }

      {/* Menu normal */}
      <Modal open={modalGerar === 'menu'} onClose={() => setModalGerar(null)} title="Gerar Aulas" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => setModalGerar('avulsa')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: '#110f0f', outline: '1px solid #2a2a2a',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '4px' }}>⚡ Aula Avulsa</div>
              <div style={{ fontSize: '12px', color: '#555' }}>Uma única aula — sem data de término</div>
            </div>
            <ChevronRight size={16} color="#555" />
          </button>
          <button onClick={() => setModalGerar('mensal')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: '#110f0f', outline: '1px solid #2a2a2a',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '4px' }}>📅 Aula Mensal / Recorrente</div>
              <div style={{ fontSize: '12px', color: '#555' }}>Gera aulas de uma turma por período</div>
            </div>
            <ChevronRight size={16} color="#555" />
          </button>
        </div>
      </Modal>

      {/* Menu atalho */}
      <Modal open={modalGerar === 'menu_atalho'} onClose={fecharTudo} title="Nova Aula" size="sm">
        <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: '#111', borderRadius: '10px', border: '1px solid rgba(252,200,37,0.2)' }}>
          <div style={{ fontSize: '11px', color: '#fcc825', marginBottom: '4px' }}>⚡ Atalho selecionado</div>
          <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>
            {atalho?.quadraNome} · {atalho?.horario}
          </div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
            {atalho?.data && format(new Date(atalho.data + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => setModalGerar('avulsa_atalho')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: '#110f0f', outline: '1px solid #2a2a2a',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '4px' }}>⚡ Aula Avulsa</div>
              <div style={{ fontSize: '12px', color: '#555' }}>Quadra e horário já preenchidos</div>
            </div>
            <ChevronRight size={16} color="#555" />
          </button>
          <button onClick={() => setModalGerar('mensal')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: '#110f0f', outline: '1px solid #2a2a2a',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '4px' }}>📅 Aula Mensal / Recorrente</div>
              <div style={{ fontSize: '12px', color: '#555' }}>Gera aulas de uma turma por período</div>
            </div>
            <ChevronRight size={16} color="#555" />
          </button>
        </div>
      </Modal>

      <ModalCopiarGrade open={modalGerar === 'copiar'} onClose={fecharTudo} />
      <ModalGerarAulas open={modalGerar === 'mensal'} onClose={fecharTudo} />
      <ModalAulaAvulsa
        open={modalGerar === 'avulsa' || modalGerar === 'avulsa_atalho'}
        onClose={fecharTudo}
        atalho={modalGerar === 'avulsa_atalho' ? atalho : null}
      />
    </div>
  )
}

function ModalCopiarGrade({ open, onClose }) {
  const qc = useQueryClient()
  const [dataOrigem, setDataOrigem] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataDestino, setDataDestino] = useState('')
  const [copiando, setCopiando] = useState(false)
  const [resultado, setResultado] = useState(null)

  function resetar() {
    setDataOrigem(format(new Date(), 'yyyy-MM-dd'))
    setDataDestino('')
    setResultado(null)
  }

  async function handleCopiar() {
    if (!dataDestino) return toast.error('Selecione o dia de destino', { style: toastStyle })
    if (dataOrigem === dataDestino) return toast.error('Origem e destino não podem ser iguais', { style: toastStyle })
    setCopiando(true)
    try {
      // Busca aulas avulsas do dia origem
      const { data: aulasOrigem, error: errBusca } = await supabase
        .from('aulas')
        .select('*')
        .eq('data_aula', dataOrigem)
        .not('observacoes', 'is', null)
        .ilike('observacoes', '⚡ Avulsa%')

      if (errBusca) throw errBusca
      if (!aulasOrigem || aulasOrigem.length === 0) {
        toast.error('Nenhuma aula avulsa encontrada no dia de origem', { style: toastStyle })
        setCopiando(false)
        return
      }

      // Verifica quais já existem no destino (por observacoes com mesma quadra+horario)
      const { data: aulasDestino } = await supabase
        .from('aulas')
        .select('observacoes')
        .eq('data_aula', dataDestino)

      const obsDestino = aulasDestino?.map(a => a.observacoes) || []

      // Filtra aulas que ainda não existem no destino
      const aulasParaCopiar = aulasOrigem.filter(a => {
        // Extrai quadra+horário da observação
        const partes = (a.observacoes || '').split('·').map(s => s.trim())
        const quadra = partes[1] || ''
        const horario = partes[2] || ''
        // Verifica se já existe no destino
        return !obsDestino.some(obs => obs?.includes(quadra) && obs?.includes(horario))
      })

      if (aulasParaCopiar.length === 0) {
        toast.error('Todas as aulas já existem no dia de destino', { style: toastStyle })
        setCopiando(false)
        return
      }

      // Busca as presenças das aulas de origem (apenas alunos, sem status)
      const idsOrigem = aulasParaCopiar.map(a => a.id)
      const { data: presencasOrigem } = await supabase
        .from('presencas')
        .select('aula_id, aluno_id, tipo_participacao')
        .in('aula_id', idsOrigem)

      // Cria as aulas no destino
      const novasAulas = aulasParaCopiar.map(a => ({
        professor_executou_id: a.professor_executou_id,
        data_aula: dataDestino,
        status: 'confirmada_coord',
        status_aula: 'dada',
        paga_professor: true,
        eh_substituicao: false,
        observacoes: a.observacoes,
      }))

      const { data: aulasCriadas, error: errInsert } = await supabase
        .from('aulas')
        .insert(novasAulas)
        .select('id, observacoes')
      if (errInsert) throw errInsert

      // Copia as presenças (sem marcar presente/falta — status neutro)
      if (presencasOrigem && presencasOrigem.length > 0 && aulasCriadas) {
        const presencasNovas = []
        for (const aulaOrigemId of idsOrigem) {
          // Acha a aula origem e a aula nova correspondente pela observação
          const aulaOrig = aulasParaCopiar.find(a => a.id === aulaOrigemId)
          const aulaNova = aulasCriadas.find(a => a.observacoes === aulaOrig?.observacoes)
          if (!aulaNova) continue
          const presencasDaAula = presencasOrigem.filter(p => p.aula_id === aulaOrigemId)
          for (const p of presencasDaAula) {
            presencasNovas.push({
              aula_id: aulaNova.id,
              aluno_id: p.aluno_id,
              presente: false,
              status_presenca: 'falta',
              tipo_participacao: p.tipo_participacao || 'mensalista',
            })
          }
        }
        if (presencasNovas.length > 0) {
          await supabase.from('presencas').insert(presencasNovas)
        }
      }

      qc.invalidateQueries({ queryKey: ['aulas'] })
      setResultado(aulasParaCopiar.length)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setCopiando(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { resetar(); onClose() }} title="📋 Copiar Grade" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: '600', color: '#F0F2F5', marginBottom: '6px' }}>{resultado} aulas copiadas!</div>
            <div style={{ fontSize: '12px', color: '#555' }}>
              Grade de {format(new Date(dataOrigem + 'T12:00'), "dd/MM", { locale: ptBR })} → {format(new Date(dataDestino + 'T12:00'), "dd/MM", { locale: ptBR })}
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
              As aulas foram criadas sem presenças. Adicione os alunos clicando em cada aula.
            </div>
            <button onClick={() => { resetar(); onClose() }} style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>Fechar</button>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px', backgroundColor: '#111', borderRadius: '10px', border: '1px solid #2a2a2a', fontSize: '12px', color: '#555' }}>
              💡 Copia a estrutura das aulas avulsas (quadra, horário, professor, nível) sem as presenças.
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Dia de origem (copiar DE)</div>
              <input type="date" value={dataOrigem} onChange={e => setDataOrigem(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                backgroundColor: '#111', border: '1px solid #2a2a2a',
                color: '#F0F2F5', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }} />
              {dataOrigem && (
                <div style={{ fontSize: '11px', color: '#fcc825', marginTop: '4px', textTransform: 'capitalize' }}>
                  {format(new Date(dataOrigem + 'T12:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', color: '#333' }}>↓</span>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Dia de destino (colar EM)</div>
              <input type="date" value={dataDestino} onChange={e => setDataDestino(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                backgroundColor: '#111', border: '1px solid rgba(252,200,37,0.3)',
                color: '#F0F2F5', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }} />
              {dataDestino && (
                <div style={{ fontSize: '11px', color: '#fcc825', marginTop: '4px', textTransform: 'capitalize' }}>
                  {format(new Date(dataDestino + 'T12:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </div>
              )}
            </div>

            <button onClick={handleCopiar} disabled={copiando || !dataDestino} style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: !dataDestino ? '#1a1a1a' : 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: !dataDestino ? '#555' : 'white',
              fontSize: '14px', fontWeight: '600',
              cursor: !dataDestino || copiando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              outline: !dataDestino ? '1px solid #2a2a2a' : 'none',
            }}>
              <Copy size={16} />
              {copiando ? 'Copiando...' : 'Copiar Grade'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function AulasDivergencias() {
  const { data: aulas, isLoading } = useAulas({ status: 'divergencia' })
  if (isLoading) return <Loading />
  if (!aulas?.length) return <EmptyState icon="✅" title="Nenhuma divergência" description="Todas as aulas estão com match!" />
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
                {format(new Date(aula.data_aula + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })} • Prof: {aula.professores?.nome}
              </div>
            </div>
            <StatusBadge status={aula.status} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AulasReposicoes() {
  const { data: reposicoes, isLoading } = useReposicoes()
  const [alunoSel, setAlunoSel] = useState(null)

  if (isLoading) return <Loading />

  const porAluno = {}
  reposicoes?.forEach(r => {
    const a = r.alunos
    if (!a) return
    if (!porAluno[a.id]) porAluno[a.id] = { ...a, itens: [] }
    porAluno[a.id].itens.push(r)
  })

  const lista = Object.values(porAluno).sort((a, b) => b.itens.length - a.itens.length)

  if (!lista.length) return (
    <EmptyState icon="🎉" title="Nenhuma reposição pendente" description="Todos os alunos estão em dia!" />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lista.map(aluno => {
        const nivel = aluno.nivel_avaliado_prof
        const primeiraAula = aluno.itens[0]?.aulas
        const ehGrupo = !!primeiraAula?.turma_id
        const turmaNome = primeiraAula?.turmas?.nome || 'Aula Avulsa'

        return (
          <button key={aluno.id} onClick={() => setAlunoSel({ ...aluno, itens: [...aluno.itens] })} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            backgroundColor: '#151515', border: '1px solid #2a2a2a', borderRadius: '12px',
            padding: '14px', cursor: 'pointer', textAlign: 'left', width: '100%',
          }}>
            <div style={{
              minWidth: '34px', height: '34px', borderRadius: '50%',
              backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '700', color: '#3b82f6', flexShrink: 0,
            }}>
              {aluno.itens.length}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', marginBottom: '3px' }}>
                {aluno.nome}
              </div>
              <div style={{ fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{ehGrupo ? turmaNome : '👤 Individual'}</span>
                {nivel && <><span>·</span><span>{nivel}</span></>}
              </div>
            </div>
            <span style={{ fontSize: '18px', opacity: nivel ? 1 : 0.2, flexShrink: 0 }}>🏆</span>
          </button>
        )
      })}

      {alunoSel && (
        <ModalReposicao aluno={alunoSel} onClose={() => setAlunoSel(null)} />
      )}
    </div>
  )
}

function ModalReposicao({ aluno, onClose }) {
  const { data: aulasDisp, isLoading: loadingDisp } = useAulasDisponiveisReposicao()
  const agendar = useAgendarReposicao()
  const [itensLocais, setItensLocais] = useState(aluno.itens)
  const [reposicaoSel, setReposicaoSel] = useState(aluno.itens[0])
  const [slotSel, setSlotSel] = useState(null)

  const slotsDisponiveis = (aulasDisp || []).filter(a =>
    !a.presencas?.some(p => p.aluno_id === aluno.id)
  )

  async function handleConfirmar() {
    if (!slotSel || !reposicaoSel) return
    try {
      await agendar.mutateAsync({ reposicaoId: reposicaoSel.id, aulaId: slotSel.id, alunoId: aluno.id })
      toast.success(
        `✅ ${aluno.nome} agendado para ${format(new Date(slotSel.data_aula + 'T12:00'), 'dd/MM', { locale: ptBR })}!`,
        { style: toastStyle }
      )
      const restantes = itensLocais.filter(i => i.id !== reposicaoSel.id)
      if (restantes.length === 0) {
        onClose()
      } else {
        setItensLocais(restantes)
        setReposicaoSel(restantes[0])
        setSlotSel(null)
      }
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <Modal open onClose={onClose} title={aluno.nome} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Aulas perdidas */}
        <div>
          <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Aulas a repor ({itensLocais.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {itensLocais.map(item => {
              const isSel = reposicaoSel?.id === item.id
              const dataAula = item.aulas?.data_aula
              const turmaNome = item.aulas?.turma_id ? (item.aulas?.turmas?.nome || 'Turma') : 'Aula Avulsa'
              return (
                <button key={item.id} onClick={() => setReposicaoSel(item)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  backgroundColor: isSel ? 'rgba(59,130,246,0.08)' : '#111',
                  outline: `1px solid ${isSel ? 'rgba(59,130,246,0.4)' : '#2a2a2a'}`,
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSel ? '#3b82f6' : '#333', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: isSel ? '600' : '400' }}>
                      {dataAula ? format(new Date(dataAula + 'T12:00'), "dd/MM/yyyy · EEEE", { locale: ptBR }) : 'Data desconhecida'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{turmaNome}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Slots disponíveis */}
        <div>
          <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Escolher horário para encaixar
          </div>
          {loadingDisp ? (
            <Loading />
          ) : slotsDisponiveis.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#444' }}>
              Nenhum horário disponível nas próximas aulas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {slotsDisponiveis.slice(0, 30).map(a => {
                const isSel = slotSel?.id === a.id
                const vagas = 4 - (a.presencas?.length || 0)
                return (
                  <button key={a.id} onClick={() => setSlotSel(a)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                    backgroundColor: isSel ? 'rgba(252,200,37,0.08)' : '#111',
                    outline: `1px solid ${isSel ? 'rgba(252,200,37,0.4)' : '#2a2a2a'}`,
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: isSel ? '600' : '400' }}>
                        {format(new Date(a.data_aula + 'T12:00'), 'EEE dd/MM', { locale: ptBR })} · {a.turmas?.horario_inicio?.slice(0, 5)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>
                        {a.turmas?.nome} · {a.turmas?.quadras?.nome}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: '600', flexShrink: 0,
                      backgroundColor: vagas >= 3 ? 'rgba(34,197,94,0.1)' : vagas === 2 ? 'rgba(252,200,37,0.1)' : 'rgba(239,68,68,0.1)',
                      color: vagas >= 3 ? '#22c55e' : vagas === 2 ? '#fcc825' : '#ef4444',
                    }}>
                      {vagas} vaga{vagas !== 1 ? 's' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Confirmar */}
        <button onClick={handleConfirmar} disabled={!slotSel || !reposicaoSel || agendar.isPending} style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          background: slotSel && reposicaoSel ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
          outline: slotSel && reposicaoSel ? 'none' : '1px solid #2a2a2a',
          color: slotSel && reposicaoSel ? 'white' : '#333',
          fontSize: '14px', fontWeight: '600', cursor: slotSel && reposicaoSel ? 'pointer' : 'default',
        }}>
          {agendar.isPending ? 'Agendando...' : '✓ Confirmar Reposição'}
        </button>
      </div>
    </Modal>
  )
}

function ModalGerarAulas({ open, onClose }) {
  const { data: turmas } = useTurmas()
  const gerar = useGerarAulas()
  const [form, setForm] = useState({
    turma_id: '', professor_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })
  const [resultado, setResultado] = useState(null)
  const turmaSelecionada = turmas?.find(t => t.id === form.turma_id)
  const { professores } = useProfessores(turmaSelecionada?.modalidade_id)

  function handleTurmaChange(turma_id) {
    const turma = turmas?.find(t => t.id === turma_id)
    setForm(f => ({ ...f, turma_id, professor_id: turma?.professor_titular_id || '' }))
  }

  async function handleGerar() {
    try {
      const n = await gerar.mutateAsync({
        turmaId: form.turma_id, dataInicio: form.data_inicio,
        dataFim: form.data_fim, professorOverrideId: form.professor_id || null,
      })
      setResultado(n)
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={open} onClose={onClose} title="📅 Aula Mensal / Recorrente" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: '600', color: '#F0F2F5' }}>{resultado} aulas geradas!</div>
            <button onClick={() => { onClose(); setResultado(null) }} style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>Fechar</button>
          </div>
        ) : (
          <>
            <Select label="Turma" value={form.turma_id} onChange={e => handleTurmaChange(e.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
            <Select label="Professor (opcional — substitui o titular)" value={form.professor_id}
              onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
              <option value="">Professor titular da turma</option>
              {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            <Input label="Data Início" type="date" value={form.data_inicio}
              onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            <Input label="Data Fim" type="date" value={form.data_fim}
              onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            <button onClick={handleGerar} disabled={gerar.isPending || !form.turma_id} style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600',
              cursor: !form.turma_id ? 'not-allowed' : 'pointer',
              opacity: !form.turma_id ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <Calendar size={16} />
              {gerar.isPending ? 'Gerando...' : 'Gerar Aulas'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function ModalAulaAvulsa({ open, onClose, atalho }) {
  const qc = useQueryClient()
  const { data: modalidades } = useModalidades()
  const { data: todosAlunos, refetch: refetchAlunos } = useAlunos()
  const salvarAluno = useSalvarAluno()
  const { data: todasQuadras } = useQuadras(null)

  const [modalidadeId, setModalidadeId] = useState('')
  const { professores } = useProfessores(modalidadeId || null)
  const { data: quadras } = useQuadras(modalidadeId || null)
  const { data: niveis } = useNiveis(null)

  const quadraIdAtalho = atalho?.quadraNome
    ? todasQuadras?.find(q => q.nome === atalho.quadraNome)?.id || ''
    : ''

  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '',
  })

  useState(() => {
    if (atalho) {
      setForm(f => ({
        ...f,
        data: atalho.data || format(new Date(), 'yyyy-MM-dd'),
        horario: atalho.horario || '07:00',
        quadra_id: quadraIdAtalho,
      }))
    }
  })

  const [alunos, setAlunos] = useState([])
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novoAluno, setNovoAluno] = useState({
    show: false, nome: '', telefone: '', nivel: '',
    menor_idade: false, nome_responsavel: '', modalidades_ids: [],
  })

  const horarios = Array.from({ length: 18 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  const alunosFiltrados = buscaAluno.length >= 1
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      )
    : []

  const sugestoesNome = novoAluno.nome.length >= 2
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(novoAluno.nome.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      ) || []
    : []

  function adicionarAluno(aluno, tipo = 'avulso') {
    setAlunos(prev => [...prev, { aluno_id: aluno.id, nome: aluno.nome, tipo }])
    setBuscaAluno('')
  }

  function removerAluno(alunoId) {
    setAlunos(prev => prev.filter(a => a.aluno_id !== alunoId))
  }

  function updateTipoAluno(alunoId, tipo) {
    setAlunos(prev => prev.map(a => a.aluno_id === alunoId ? { ...a, tipo } : a))
  }

  function toggleModalidadeNovoAluno(id) {
    setNovoAluno(n => ({
      ...n,
      modalidades_ids: n.modalidades_ids.includes(id)
        ? n.modalidades_ids.filter(m => m !== id)
        : [...n.modalidades_ids, id]
    }))
  }

  function resetNovoAluno() {
    setNovoAluno({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '', modalidades_ids: [] })
  }

  function resetForm() {
    setAlunos([])
    setModalidadeId('')
    setBuscaAluno('')
    setForm({ data: format(new Date(), 'yyyy-MM-dd'), horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '' })
    resetNovoAluno()
  }

  const quadraIdResolvida = atalho?.quadraNome
    ? todasQuadras?.find(q => q.nome === atalho.quadraNome)?.id || ''
    : ''

  if (open && atalho && (form.horario !== atalho.horario || form.data !== atalho.data)) {
    setForm(f => ({
      ...f,
      data: atalho.data || f.data,
      horario: atalho.horario || f.horario,
      quadra_id: quadraIdResolvida || f.quadra_id,
    }))
  }

  async function handleCadastrarAluno() {
    if (!novoAluno.nome.trim()) return toast.error('Nome obrigatório')
    if (novoAluno.menor_idade && !novoAluno.nome_responsavel.trim()) return toast.error('Nome do responsável obrigatório')
    try {
      const result = await salvarAluno.mutateAsync({
        nome: novoAluno.nome, telefone: novoAluno.telefone,
        nivel: novoAluno.nivel || null, menor_idade: novoAluno.menor_idade,
        nome_responsavel: novoAluno.menor_idade ? novoAluno.nome_responsavel : null,
        modalidade_id: novoAluno.modalidades_ids[0] || modalidadeId || null, ativo: true,
      })
      if (result?.id && novoAluno.modalidades_ids.length > 0) {
        await supabase.from('alunos_modalidades').insert(
          novoAluno.modalidades_ids.map(mid => ({ aluno_id: result.id, modalidade_id: mid }))
        )
      }
      await refetchAlunos()
      adicionarAluno({ id: result.id, nome: result.nome }, 'avulso')
      resetNovoAluno()
      toast.success('Aluno cadastrado e adicionado!')
    } catch (err) { toast.error(err.message) }
  }

  async function handleSalvar() {
    if (!form.professor_id) return toast.error('Selecione um professor')
    if (!form.quadra_id) return toast.error('Selecione uma quadra')
    if (!form.data) return toast.error('Selecione uma data')
    setSalvando(true)
    try {
      const quadraNome = quadras?.find(q => q.id === form.quadra_id)?.nome
        || todasQuadras?.find(q => q.id === form.quadra_id)?.nome || ''

      const { data: aulasExistentes } = await supabase
        .from('aulas').select('id').eq('data_aula', form.data)
        .ilike('observacoes', `%${quadraNome}%`).ilike('observacoes', `%${form.horario}%`)

      if (aulasExistentes && aulasExistentes.length > 0) {
        toast.error(`⚠️ Já existe uma aula em ${quadraNome} às ${form.horario} neste dia!`)
        setSalvando(false)
        return
      }

      const nivelNome = niveis?.find(n => n.id === form.nivel_id)?.nome || ''

      const { data: aulaData, error: aulaError } = await supabase.from('aulas').insert({
        professor_executou_id: form.professor_id,
        data_aula: form.data, status: 'confirmada_coord', status_aula: 'dada',
        paga_professor: true, eh_substituicao: false,
        observacoes: `⚡ Avulsa · ${quadraNome} · ${form.horario}${nivelNome ? ' · ' + nivelNome : ''}`,
      }).select().single()
      if (aulaError) throw aulaError

      if (alunos.length > 0) {
        await supabase.from('presencas').insert(
          alunos.map(al => ({
            aula_id: aulaData.id, aluno_id: al.aluno_id,
            presente: true, status_presenca: 'presente', tipo_participacao: al.tipo,
          }))
        )
      }
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula avulsa criada!')
      resetForm()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { resetForm(); onClose() }} title="⚡ Aula Avulsa" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {atalho && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)', borderRadius: '8px', fontSize: '12px', color: '#fcc825' }}>
            ⚡ Atalho: <strong>{atalho.quadraNome}</strong> · <strong>{atalho.horario}</strong>
          </div>
        )}

        <Select label="Modalidade" value={modalidadeId} onChange={e => { setModalidadeId(e.target.value); setForm(f => ({ ...f, professor_id: '', nivel_id: '' })) }}>
          <option value="">Selecione...</option>
          {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
        </Select>

        <Input label="Data da Aula" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />

        <Select label="Horário" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}>
          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
        </Select>

        <Select label="Quadra" value={form.quadra_id} onChange={e => setForm(f => ({ ...f, quadra_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {(todasQuadras || quadras)?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </Select>

        <Select label="Professor" value={form.professor_id} onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>

        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Nível da Aula (opcional)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {niveis?.map(n => (
              <button key={n.id} onClick={() => setForm(f => ({ ...f, nivel_id: f.nivel_id === n.id ? '' : n.id }))} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '12px',
                background: form.nivel_id === n.id ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#110f0f',
                outline: form.nivel_id === n.id ? 'none' : '1px solid #2a2a2a',
                color: form.nivel_id === n.id ? 'white' : '#888', cursor: 'pointer',
              }}>{n.nome}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Alunos ({alunos.length})</div>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {alunos.map(al => (
                <div key={al.aluno_id} style={{ backgroundColor: '#110f0f', borderRadius: '10px', padding: '10px 12px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#F0F2F5', flex: 1 }}>{al.nome}</span>
                  <select value={al.tipo} onChange={e => updateTipoAluno(al.aluno_id, e.target.value)} style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: TIPOS_PARTICIPACAO.find(t => t.value === al.tipo)?.color || '#888', cursor: 'pointer', outline: 'none' }}>
                    {TIPOS_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button onClick={() => removerAluno(al.aluno_id)} style={{ padding: '4px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer' }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <input placeholder="Buscar aluno para adicionar..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#110f0f', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#fcc825'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
            {alunosFiltrados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                {alunosFiltrados.map(a => (
                  <button key={a.id} onClick={() => adicionarAluno(a)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >{a.nome}</button>
                ))}
              </div>
            )}
          </div>

          {!novoAluno.show ? (
            <button onClick={() => setNovoAluno(n => ({ ...n, show: true }))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <UserPlus size={13} /> Cadastrar novo aluno
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#110f0f', border: '1px solid rgba(252,200,37,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fcc825' }}>👤 Novo Aluno</div>
              <div style={{ position: 'relative' }}>
                <input placeholder="Nome completo *" value={novoAluno.nome} onChange={e => setNovoAluno(n => ({ ...n, nome: e.target.value }))} style={inputInline} />
                {sugestoesNome.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, backgroundColor: '#1a1a1a', border: '1px solid rgba(252,200,37,0.4)', borderRadius: '10px', marginTop: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '10px', color: '#fcc825', padding: '6px 12px 4px', borderBottom: '1px solid #2a2a2a' }}>⚠️ Já cadastrado — clique para adicionar direto</div>
                    {sugestoesNome.map(a => (
                      <button key={a.id} onClick={() => { adicionarAluno(a, 'avulso'); resetNovoAluno() }} style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <span>{a.nome}</span>
                        {a.nivel && <span style={{ fontSize: '10px', color: '#cf1b9b' }}>{a.nivel}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input placeholder="Telefone (WhatsApp)" value={novoAluno.telefone} onChange={e => setNovoAluno(n => ({ ...n, telefone: e.target.value }))} style={inputInline} />
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Nível do Aluno (opcional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {NIVEIS_ALUNO.map(n => (
                    <button key={n} onClick={() => setNovoAluno(na => ({ ...na, nivel: na.nivel === n ? '' : n }))} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', background: novoAluno.nivel === n ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a', outline: novoAluno.nivel === n ? 'none' : '1px solid #2a2a2a', color: novoAluno.nivel === n ? 'white' : '#888', cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setNovoAluno(n => ({ ...n, menor_idade: !n.menor_idade }))} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: novoAluno.menor_idade ? 'rgba(252,200,37,0.1)' : '#1a1a1a', outline: novoAluno.menor_idade ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a', color: novoAluno.menor_idade ? '#fcc825' : '#888', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '12px' }}>
                <span>{novoAluno.menor_idade ? '✓' : '○'}</span><span>Menor de idade</span>
              </button>
              {novoAluno.menor_idade && (
                <input placeholder="Nome do responsável *" value={novoAluno.nome_responsavel} onChange={e => setNovoAluno(n => ({ ...n, nome_responsavel: e.target.value }))} style={inputInline} />
              )}
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Modalidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {modalidades?.map(m => (
                    <button key={m.id} onClick={() => toggleModalidadeNovoAluno(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', border: 'none', background: novoAluno.modalidades_ids.includes(m.id) ? 'rgba(252,200,37,0.1)' : '#1a1a1a', outline: novoAluno.modalidades_ids.includes(m.id) ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a', color: novoAluno.modalidades_ids.includes(m.id) ? '#fcc825' : '#888', cursor: 'pointer', fontSize: '12px', width: '100%' }}>
                      <span>{m.icone_emoji} {m.nome}</span>
                      <span>{novoAluno.modalidades_ids.includes(m.id) ? '✓' : '+'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={resetNovoAluno} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCadastrarAluno} disabled={salvarAluno.isPending} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvarAluno.isPending ? 'Salvando...' : '✓ Cadastrar e Adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSalvar} disabled={salvando} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Plus size={16} />
          {salvando ? 'Salvando...' : 'Criar Aula Avulsa'}
        </button>
      </div>
    </Modal>
  )
}