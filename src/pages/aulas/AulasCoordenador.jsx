import { useState } from 'react'
import { format, addDays, subDays, isAfter, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, UserPlus, Pencil, Check, X, AlertTriangle, FileText, Zap } from 'lucide-react'
import { useAulas, useAtualizarStatusAula, useSalvarPresencas } from '../../hooks/useAulas'
import { useAlunos, useSalvarAluno } from '../../hooks/useAlunos'
import { useProfessores } from '../../hooks/useProfessores'
import { useQuadras } from '../../hooks/useQuadras'
import { useNiveis } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const STATUS_AULA = [
  { value: 'dada', label: '✅ Confirmada', paga: true },
  { value: 'nao_dada', label: '❌ Sem Aula', paga: true },
  { value: 'cancelada', label: '🌧️ Cancelada', paga: false },
]

const STATUS_PRESENCA = [
  { value: 'presente', label: 'Presente', color: '#22c55e' },
  { value: 'falta', label: 'Falta', color: '#EF4444' },
  { value: 'falta_justificada', label: 'Falta Just.', color: '#f97316' },
]

const TIPO_PARTICIPACAO = [
  { value: 'mensalista', label: 'Mensalista' },
  { value: 'avulso', label: 'Avulso' },
  { value: 'cortesia', label: 'Cortesia' },
  { value: 'reposicao', label: 'Reposição' },
]

const NIVEIS_ALUNO = [
  'Iniciante 1', 'Iniciante 2', 'Intermediário 1', 'Intermediário 2',
  'Avançado', 'Kids Iniciante', 'Kids Intermediário', 'Kids Avançado',
]

const COR_REPOSICAO = '#3b82f6'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: '8px',
  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
}

function parseObservacoes(obs) {
  if (!obs) return { quadra: '', horario: '', nivel: '' }
  const partes = obs.split('·').map(s => s.trim())
  return { quadra: partes[1] || '', horario: partes[2] || '', nivel: partes[3] || '' }
}

function getQuadraNome(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).quadra
  return aula.turmas?.quadras?.nome || ''
}

function getHorario(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).horario
  return aula.turmas?.horario_inicio?.slice(0, 5) || ''
}

function getNivel(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).nivel
  return aula.turmas?.niveis?.nome || ''
}

function isAulaFutura(dataAula) {
  const hoje = startOfDay(new Date())
  const diaAula = startOfDay(new Date(dataAula + 'T12:00:00'))
  return isAfter(diaAula, hoje)
}

export function AulasCoordenador({ onCelulaVazia }) {
  const { modalidadeSelecionada } = useAppStore()
  const qc = useQueryClient()
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aulaModal, setAulaModal] = useState(null)
  const [presencasLocal, setPresencasLocal] = useState({})
  const [adicionandoAluno, setAdicionandoAluno] = useState(null)
  const [buscaAdicionando, setBuscaAdicionando] = useState('')
  const [editandoAula, setEditandoAula] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [statusLocal, setStatusLocal] = useState({})
  const [alertaNivel, setAlertaNivel] = useState({})
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [notasLocal, setNotasLocal] = useState({})
  const [editandoNotas, setEditandoNotas] = useState(false)
  const [novoAlunoModal, setNovoAlunoModal] = useState({
    show: false, nome: '', telefone: '', nivel: '',
    menor_idade: false, nome_responsavel: '',
  })

  const [modalMassa, setModalMassa] = useState(null)
  const [acaoMassa, setAcaoMassa] = useState(null)
  const [executandoMassa, setExecutandoMassa] = useState(false)

  async function handleAcaoMassa() {
    if (!acaoMassa) return
    setExecutandoMassa(true)
    try {
      for (const a of aulasFiltradas) {
        const statusAula = acaoMassa === 'confirmar' ? 'dada' : acaoMassa === 'sem_aula' ? 'nao_dada' : 'cancelada'
        const pagaProfessor = acaoMassa !== 'cancelar'
        const statusPresenca = acaoMassa === 'confirmar' ? 'presente' : acaoMassa === 'sem_aula' ? 'falta' : 'falta_justificada'

        await supabase.from('aulas').update({ status_aula: statusAula, paga_professor: pagaProfessor }).eq('id', a.id)

        if (a.presencas && a.presencas.length > 0) {
          await supabase.from('presencas').update({ status_presenca: statusPresenca, presente: acaoMassa === 'confirmar' }).eq('aula_id', a.id)
        }
      }
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success(
        acaoMassa === 'confirmar' ? '✅ Todas as aulas confirmadas!' :
        acaoMassa === 'sem_aula' ? '❌ Todas marcadas como Sem Aula!' :
        '🌧️ Todas as aulas canceladas!',
        { style: toastStyle }
      )
      setModalMassa(null)
      setAcaoMassa(null)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setExecutandoMassa(false)
    }
  }

  const { data: aulas, isLoading } = useAulas({ data, modalidadeId: modalidadeSelecionada?.id })
  const { data: todosAlunos, refetch: refetchAlunos } = useAlunos()
  const { professores: todoProfessores } = useProfessores(null)
  const { data: todasQuadras } = useQuadras(null)
  const { data: todosNiveis } = useNiveis(null)
  const { data: modalidades } = useModalidades()
  const salvarAluno = useSalvarAluno()
  const atualizarStatus = useAtualizarStatusAula()
  const salvarPresencas = useSalvarPresencas()

  const dataObj = new Date(data + 'T12:00:00')
  const label = format(dataObj, "EEEE, d 'de' MMMM", { locale: ptBR })
  const isHoje = data === format(new Date(), 'yyyy-MM-dd')
  const horarios = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)
  const isFuturo = isAulaFutura(data)

  function navData(dir) {
    const d = dir > 0 ? addDays(dataObj, 1) : subDays(dataObj, 1)
    setData(format(d, 'yyyy-MM-dd'))
    setStatusLocal({})
  }

  function abrirAula(aula) {
    setAulaModal(aula)
    setNotasLocal(prev => ({ ...prev, [aula.id]: aula.notas || '' }))
    setEditandoNotas(false)
    const inicial = {}
    aula.presencas?.forEach(p => {
      const alertaPresenca = p.alerta_nivel ?? p.alunos?.alerta_nivel ?? false
      const nivelPresenca = p.nivel_avaliado_prof || p.alunos?.nivel_avaliado_prof || ''
      const obsPresenca = p.obs_nivel_prof || p.alunos?.obs_nivel_prof || ''
      inicial[p.aluno_id] = {
        aluno_id: p.aluno_id,
        nome: p.alunos?.nome,
        status_presenca: p.status_presenca || (p.presente ? 'presente' : 'falta'),
        tipo_participacao: p.tipo_participacao || 'mensalista',
        alerta_nivel: alertaPresenca,
        nivel_avaliado_prof: nivelPresenca,
        obs_nivel_prof: obsPresenca,
      }
    })
    setPresencasLocal(prev => ({ ...prev, [aula.id]: inicial }))
  }

  function fecharModal() {
    setAulaModal(null)
    setEditandoAula(null)
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
    setAlertaNivel({})
    setConfirmandoExclusao(false)
    setEditandoNotas(false)
    setNovoAlunoModal({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '' })
  }

  function updatePresenca(aulaId, alunoId, campo, valor) {
    setPresencasLocal(prev => ({
      ...prev,
      [aulaId]: { ...prev[aulaId], [alunoId]: { ...prev[aulaId]?.[alunoId], [campo]: valor } }
    }))
  }

  function adicionarAlunoNaLista(aulaId, aluno) {
    setPresencasLocal(prev => ({
      ...prev,
      [aulaId]: {
        ...prev[aulaId],
        [aluno.id]: { aluno_id: aluno.id, nome: aluno.nome, status_presenca: 'presente', tipo_participacao: 'avulso', alerta_nivel: false, nivel_avaliado_prof: '', obs_nivel_prof: '' }
      }
    }))
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
  }

  function toggleAlertaNivel(alunoId, alunoData) {
    setAlertaNivel(prev => ({
      ...prev,
      [alunoId]: prev[alunoId]
        ? null
        : { nivel: alunoData.nivel_avaliado_prof || '', obs: alunoData.obs_nivel_prof || '' }
    }))
  }

  async function handleSalvarNotas(aulaId) {
    try {
      const { error } = await supabase
        .from('aulas')
        .update({ notas: notasLocal[aulaId] || null })
        .eq('id', aulaId)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['aulas'] })
      setEditandoNotas(false)
      toast.success('📋 Observação salva!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleSalvarAlertaNivel(aulaId, alunoId) {
    const alerta = alertaNivel[alunoId]
    if (!alerta) return
    try {
      const { error: errAluno } = await supabase
        .from('alunos')
        .update({ alerta_nivel: true, nivel_avaliado_prof: alerta.nivel, obs_nivel_prof: alerta.obs })
        .eq('id', alunoId)
      if (errAluno) throw errAluno
      const { error: errPresenca } = await supabase
        .from('presencas')
        .update({ alerta_nivel: true, nivel_avaliado_prof: alerta.nivel, obs_nivel_prof: alerta.obs })
        .eq('aula_id', aulaId)
        .eq('aluno_id', alunoId)
      if (errPresenca) throw errPresenca
      updatePresenca(aulaId, alunoId, 'alerta_nivel', true)
      updatePresenca(aulaId, alunoId, 'nivel_avaliado_prof', alerta.nivel)
      updatePresenca(aulaId, alunoId, 'obs_nivel_prof', alerta.obs)
      setAlertaNivel(prev => ({ ...prev, [alunoId]: null }))
      toast.success('⚠️ Alerta de nível salvo!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleRemoverAlertaNivel(aulaId, alunoId) {
    try {
      const { error } = await supabase
        .from('alunos')
        .update({ alerta_nivel: false, nivel_avaliado_prof: null, obs_nivel_prof: null })
        .eq('id', alunoId)
      if (error) throw error
      updatePresenca(aulaId, alunoId, 'alerta_nivel', false)
      updatePresenca(aulaId, alunoId, 'nivel_avaliado_prof', '')
      updatePresenca(aulaId, alunoId, 'obs_nivel_prof', '')
      setAlertaNivel(prev => ({ ...prev, [alunoId]: null }))
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Alerta removido do aluno. Histórico das aulas preservado!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleSalvarPresencas(aulaId) {
    const lista = Object.values(presencasLocal[aulaId] || {})
    try {
      const { data: presencasAnteriores } = await supabase
        .from('presencas').select('aluno_id').eq('aula_id', aulaId)
      const idsAnteriores = presencasAnteriores?.map(p => p.aluno_id) || []
      const idsAtuais = lista.map(p => p.aluno_id)
      const idsRemovidos = idsAnteriores.filter(id => !idsAtuais.includes(id))
      if (idsRemovidos.length > 0) {
        await supabase.from('presencas').delete().eq('aula_id', aulaId).in('aluno_id', idsRemovidos)
      }
      if (lista.length > 0) {
        await salvarPresencas.mutateAsync({ aulaId, presencas: lista })
      }
      toast.success('✅ Presenças salvas!', { style: toastStyle })
      fecharModal()
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleStatusAula(aulaId, statusAula) {
    if (isFuturo) return toast.error('Aula futura — aguarde o dia da aula', { style: toastStyle })
    const pagaProfessor = STATUS_AULA.find(s => s.value === statusAula)?.paga ?? true
    setStatusLocal(prev => ({ ...prev, [aulaId]: statusAula }))
    try {
      await atualizarStatus.mutateAsync({ aulaId, statusAula, pagaProfessor })
      toast.success('Status atualizado!', { style: toastStyle })
    } catch (err) {
      setStatusLocal(prev => ({ ...prev, [aulaId]: undefined }))
      toast.error(err.message, { style: toastStyle })
    }
  }

  function iniciarEdicao(aula) {
    const parsed = parseObservacoes(aula.observacoes)
    setEditandoAula(aula.id)
    setEditForm({
      professor_id: aula.professor_executou_id || '',
      quadra_nome: parsed.quadra,
      horario: parsed.horario,
      nivel: parsed.nivel,
      data_aula: aula.data_aula,
    })
  }

  async function handleSalvarEdicao(aula) {
    try {
      const novaObs = `⚡ Avulsa · ${editForm.quadra_nome} · ${editForm.horario}${editForm.nivel ? ' · ' + editForm.nivel : ''}`
      const { error } = await supabase.from('aulas').update({
        professor_executou_id: editForm.professor_id || null,
        data_aula: editForm.data_aula,
        observacoes: novaObs,
      }).eq('id', aula.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula atualizada!', { style: toastStyle })
      setEditandoAula(null)
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleExcluirAula(aulaId) {
    try {
      await supabase.from('presencas').delete().eq('aula_id', aulaId)
      await supabase.from('reposicoes').delete().eq('aula_origem_id', aulaId)
      const { error } = await supabase.from('aulas').delete().eq('id', aulaId)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula excluída!', { style: toastStyle })
      fecharModal()
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleCadastrarNovoAluno(aulaId) {
    if (!novoAlunoModal.nome.trim()) return toast.error('Nome obrigatório', { style: toastStyle })
    try {
      const result = await salvarAluno.mutateAsync({
        nome: novoAlunoModal.nome, telefone: novoAlunoModal.telefone,
        nivel: novoAlunoModal.nivel || null, menor_idade: novoAlunoModal.menor_idade,
        nome_responsavel: novoAlunoModal.menor_idade ? novoAlunoModal.nome_responsavel : null,
        ativo: true,
      })
      await refetchAlunos()
      adicionarAlunoNaLista(aulaId, { id: result.id, nome: result.nome })
      setNovoAlunoModal({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '' })
      toast.success('Aluno cadastrado e adicionado!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  const aulasFiltradas = aulas?.filter(a => {
    if (!modalidadeSelecionada) return true
    if (!a.turma_id) return true
    return a.turmas?.modalidades?.nome === modalidadeSelecionada.nome
  }) || []

  const [filtroModalidadeGrade, setFiltroModalidadeGrade] = useState('todas')
  const [filtroGradeAberto, setFiltroGradeAberto] = useState(false)

  const GRUPOS_EMPRESA = [
    {
      empresa: 'PROCOPIO',
      cor: '#fcc825',
      quadras: ['Quadra 4', 'Quadra 3', 'Quadra 2', 'Quadra 1', 'Quadra de Padel'],
    },
    {
      empresa: 'BEACH ARENA',
      cor: '#3b82f6',
      quadras: ['Quadra 1 Areia', 'Quadra 3 Areia', 'Quadra 5 Areia'],
    },
  ]

  const todasQuadrasNomes = (todasQuadras?.map(q => q.nome) || [])

  const quadrasFiltradasPorModalidade = filtroModalidadeGrade === 'todas'
    ? todasQuadrasNomes
    : (() => {
        const mod = todasQuadras?.find(q => {
          const aula = aulasFiltradas.find(a => getQuadraNome(a) === q.nome)
          return aula?.turmas?.modalidades?.nome === filtroModalidadeGrade ||
            parseObservacoes(aula?.observacoes)?.nivel === filtroModalidadeGrade
        })
        const quadrasDasMod = aulasFiltradas
          .filter(a => {
            const nomeMod = a.turmas?.modalidades?.nome || ''
            return nomeMod === filtroModalidadeGrade
          })
          .map(a => getQuadraNome(a))
        return [...new Set(quadrasDasMod)]
      })()

  const gruposParaGrade = GRUPOS_EMPRESA.map(g => ({
    ...g,
    quadras: g.quadras.filter(q => todasQuadrasNomes.includes(q) &&
      (filtroModalidadeGrade === 'todas' || quadrasFiltradasPorModalidade.includes(q)))
  })).filter(g => g.quadras.length > 0)

  const quadrasParaGrade = gruposParaGrade.flatMap(g => g.quadras)

  const modalidadesNaGrade = [...new Set(
    aulasFiltradas.map(a => a.turmas?.modalidades?.nome).filter(Boolean)
  )]

  const horariosGrade = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  const totalAulas = aulasFiltradas.length
  const aulasDadas = aulasFiltradas.filter(a => !isAulaFutura(a.data_aula) && (statusLocal[a.id] || a.status_aula || 'dada') === 'dada').length
  const aulasNaoDadas = aulasFiltradas.filter(a => (statusLocal[a.id] || a.status_aula) === 'nao_dada').length
  const aulasCanceladas = aulasFiltradas.filter(a => (statusLocal[a.id] || a.status_aula) === 'cancelada').length
  let totalPresentes = 0, totalFaltas = 0
  aulasFiltradas.forEach(aula => {
    aula.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) totalPresentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') totalFaltas++
    })
  })

  const aula = aulaModal
  const presencas = aula ? (presencasLocal[aula.id] || {}) : {}
  const alunosNaAula = Object.values(presencas)
  const idsNaAula = Object.keys(presencas)
  const aulaFutura = aula ? isAulaFutura(aula.data_aula) : false
  const statusAtual = aula ? (aulaFutura ? 'futura' : (statusLocal[aula.id] || aula.status_aula || 'dada')) : 'dada'
  const isAvulsa = aula ? !aula.turma_id : false
  const estaEditando = aula ? editandoAula === aula.id : false
  const notasAula = aula ? (notasLocal[aula.id] ?? aula.notas ?? '') : ''
  const alunosBusca = buscaAdicionando.length >= 1
    ? todosAlunos?.filter(a => a.nome.toLowerCase().includes(buscaAdicionando.toLowerCase()) && !idsNaAula.includes(a.id))
    : []

  function temAlertaNivel(aulaCelula) {
    return aulaCelula.presencas?.some(p => p.alerta_nivel ?? p.alunos?.alerta_nivel)
  }

  function temReposicao(aulaCelula) {
    return aulaCelula.presencas?.some(p => p.tipo_participacao === 'reposicao')
  }

  return (
    <div className="fade-in">

      {/* Navegador de data */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '12px',
        boxSizing: 'border-box', width: '100%',
      }}>
        <button onClick={() => navData(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div
            onClick={() => document.getElementById('datepicker-grade').showPicker()}
            style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', textTransform: 'capitalize', cursor: 'pointer' }}
          >
            {label} <span style={{ fontSize: '11px', color: '#444' }}>📅</span>
          </div>
          <input
            id="datepicker-grade"
            type="date"
            value={data}
            onChange={e => { setData(e.target.value); setStatusLocal({}) }}
            style={{
              position: 'absolute', opacity: 0, pointerEvents: 'none',
              width: '1px', height: '1px', top: 0, left: '50%',
            }}
          />
          <button onClick={() => setData(format(new Date(), 'yyyy-MM-dd'))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: isHoje ? '#fcc825' : '#555', marginTop: '2px',
          }}>
            {isHoje ? 'Hoje' : 'Ir para hoje'}
          </button>
        </div>
        <button onClick={() => navData(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Botões filtro modalidade + ação em massa */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        {/* Filtro modalidade */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setFiltroGradeAberto(!filtroGradeAberto)} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: filtroModalidadeGrade !== 'todas' ? 'rgba(252,200,37,0.1)' : '#1a1a1a',
            outline: filtroModalidadeGrade !== 'todas' ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
            color: filtroModalidadeGrade !== 'todas' ? '#fcc825' : '#555', fontSize: '11px',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {filtroModalidadeGrade === 'todas' ? 'Modalidade' : filtroModalidadeGrade}
          </button>
          {filtroGradeAberto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setFiltroGradeAberto(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: '10px', padding: '8px', zIndex: 40,
                minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {['todas', ...modalidadesNaGrade].map(m => (
                  <button key={m} onClick={() => { setFiltroModalidadeGrade(m); setFiltroGradeAberto(false) }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                    background: filtroModalidadeGrade === m ? 'rgba(252,200,37,0.1)' : 'transparent',
                    color: filtroModalidadeGrade === m ? '#fcc825' : '#888',
                  }}>
                    {m === 'todas' ? 'Todas' : m}
                    {filtroModalidadeGrade === m && <span>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Ação em massa */}
        {totalAulas > 0 && !isFuturo && (
          <button
            onClick={() => setModalMassa('menu')}
            title="Ação em massa"
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #2a2a2a',
              backgroundColor: '#1a1a1a', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(252,200,37,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
          >
            <Zap size={14} color="#555" />
          </button>
        )}
      </div>

      {/* Modal ação em massa */}
      {modalMassa && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => { setModalMassa(null); setAcaoMassa(null) }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

            {modalMassa === 'menu' ? (
              <>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#888', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aplicar para todas as aulas do dia
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { key: 'confirmar', emoji: '✅', label: 'Confirmar todas as aulas', sub: 'Todos os alunos marcados como Presente', color: '#22c55e' },
                    { key: 'sem_aula', emoji: '❌', label: 'Sem Aula', sub: 'Todos os alunos marcados como Falta', color: '#EF4444' },
                    { key: 'cancelar', emoji: '🌧️', label: 'Cancelar todas', sub: 'Todos os alunos com Falta Justificada', color: '#3b82f6' },
                  ].map(op => (
                    <button key={op.key} onClick={() => { setAcaoMassa(op.key); setModalMassa('confirmar') }} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 16px', borderRadius: '12px', border: `1px solid #2a2a2a`,
                      backgroundColor: '#111', cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = op.color + '50'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                    >
                      <span style={{ fontSize: '20px' }}>{op.emoji}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5' }}>{op.label}</div>
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{op.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setModalMassa(null)} style={{
                  marginTop: '12px', width: '100%', padding: '10px', borderRadius: '10px',
                  border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer',
                }}>Cancelar</button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                    {acaoMassa === 'confirmar' ? '✅' : acaoMassa === 'sem_aula' ? '❌' : '🌧️'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', marginBottom: '6px' }}>
                    {acaoMassa === 'confirmar' ? 'Confirmar todas as aulas?' : acaoMassa === 'sem_aula' ? 'Marcar todas como Sem Aula?' : 'Cancelar todas as aulas?'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#555' }}>
                    {aulasFiltradas.length} aulas · {aulasFiltradas.reduce((acc, a) => acc + (a.presencas?.length || 0), 0)} alunos serão atualizados
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setModalMassa('menu')} style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a',
                    background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer',
                  }}>Voltar</button>
                  <button onClick={handleAcaoMassa} disabled={executandoMassa} style={{
                    flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                    color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    {executandoMassa ? 'Aplicando...' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Aviso dia futuro */}
      {isFuturo && (
        <div style={{
          backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)',
          borderRadius: '10px', padding: '8px 14px', marginBottom: '12px',
          fontSize: '12px', color: '#fcc825', textAlign: 'center',
        }}>
          📅 Aulas futuras — status bloqueado até o dia da aula
        </div>
      )}

      {/* Resumo do dia */}
      {totalAulas > 0 && (
        <div style={{
          backgroundColor: '#151515', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '10px', padding: '8px 14px', marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '10px',
          flexWrap: 'nowrap', overflow: 'hidden',
        }}>
          {/* Aulas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#555' }}>Aulas</span>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{totalAulas}</span>
            <span style={{ fontSize: '11px', color: '#333' }}>·</span>
            <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>{aulasDadas}</span>
            <span style={{ fontSize: '11px', color: '#555' }}>/</span>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{aulasNaoDadas + aulasCanceladas}</span>
          </div>

          <span style={{ fontSize: '11px', color: '#2a2a2a', flexShrink: 0 }}>·</span>

          {/* Alunos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#555' }}>Alunos</span>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{totalPresentes + totalFaltas}</span>
            <span style={{ fontSize: '11px', color: '#333' }}>·</span>
            <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>{totalPresentes}</span>
            <span style={{ fontSize: '11px', color: '#555' }}>/</span>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{totalFaltas}</span>
          </div>

          {/* Canceladas */}
          {aulasCanceladas > 0 && (
            <>
              <span style={{ fontSize: '11px', color: '#2a2a2a', flexShrink: 0 }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px' }}>🌧️</span>
                <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600' }}>{aulasCanceladas}</span>
              </div>
            </>
          )}

          {/* Barra de ocupação — empurrada para direita, tamanho fixo */}
          {(() => {
            const total = totalPresentes + totalFaltas
            const pct = total > 0 ? Math.round((totalPresentes / total) * 100) : 0
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
                <div style={{ width: '44px', height: '3px', borderRadius: '2px', backgroundColor: '#222', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: '2px',
                    background: pct >= 75
                      ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                      : pct >= 50
                      ? 'linear-gradient(90deg, #fcc825, #f59e0b)'
                      : 'linear-gradient(90deg, #ef4444, #dc2626)',
                  }} />
                </div>
                <span style={{ fontSize: '10px', color: '#555', fontWeight: '600', minWidth: '26px', textAlign: 'right' }}>{pct}%</span>
              </div>
            )
          })()}
        </div>
      )}

      {isLoading ? <Loading /> : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: `${50 + quadrasParaGrade.length * 140}px` }}>

            {/* Cabeçalho com grupos por empresa */}
            <div style={{ display: 'flex', marginBottom: '2px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#110f0f', paddingTop: '4px', paddingBottom: '4px' }}>
              <div style={{ width: '50px', flexShrink: 0 }} />
              {gruposParaGrade.map((grupo, gi) => (
                <div key={grupo.empresa} style={{ display: 'flex', alignItems: 'center' }}>
                  {gi > 0 && (
                    <div style={{ width: '1px', backgroundColor: '#2a2a2a', margin: '0 6px', height: '28px', alignSelf: 'center' }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '9px', color: grupo.cor, fontWeight: '700', letterSpacing: '1px', paddingLeft: '4px', opacity: 0.8 }}>
                      {grupo.empresa}
                    </div>
                    <div style={{ display: 'flex' }}>
                      {grupo.quadras.map(q => (
                        <div key={q} style={{
                          width: '140px', flexShrink: 0, textAlign: 'center',
                          fontSize: '10px', fontWeight: '700', color: grupo.cor,
                          letterSpacing: '0.5px', textTransform: 'uppercase',
                          padding: '5px 4px', backgroundColor: '#151515',
                          borderRadius: '8px', marginRight: '4px',
                        }}>{q}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grade */}
            {horariosGrade.map(horario => (
              <div key={horario} style={{ display: 'flex', marginBottom: '4px', alignItems: 'stretch' }}>
                <div style={{
                  width: '50px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '600', color: '#555',
                  backgroundColor: '#151515', borderRadius: '8px', marginRight: '4px',
                }}>{horario}</div>

                {quadrasParaGrade.map(quadra => {
                  const aulaCelula = aulasFiltradas.find(a =>
                    getHorario(a) === horario && getQuadraNome(a) === quadra
                  )

                  if (!aulaCelula) {
                    return (
                      <button key={quadra}
                        onClick={() => onCelulaVazia?.({ horario, quadraNome: quadra, data })}
                        style={{
                          width: '140px', flexShrink: 0, marginRight: '4px',
                          backgroundColor: '#111', borderRadius: '10px',
                          border: '1px solid #1e1e1e', minHeight: '72px',
                          cursor: onCelulaVazia ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={e => {
                          if (!onCelulaVazia) return
                          e.currentTarget.style.borderColor = 'rgba(252,200,37,0.2)'
                          e.currentTarget.style.backgroundColor = '#151515'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#1e1e1e'
                          e.currentTarget.style.backgroundColor = '#111'
                        }}
                      >
                        {onCelulaVazia && <span style={{ fontSize: '20px', color: '#2a2a2a' }}>+</span>}
                      </button>
                    )
                  }

                  const aulaEhFutura = isAulaFutura(aulaCelula.data_aula)
                  const st = aulaEhFutura ? 'futura' : (statusLocal[aulaCelula.id] || aulaCelula.status_aula || 'dada')
                  const nivel = getNivel(aulaCelula)
                  const qtdTotal = aulaCelula.presencas?.length || 0
                  const qtdP = aulaCelula.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
                  const qtdF = aulaCelula.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
                  const isAv = !aulaCelula.turma_id
                  const hasAlerta = temAlertaNivel(aulaCelula)
                  const hasReposicao = temReposicao(aulaCelula)
                  const hasNotas = !!(aulaCelula.notas && aulaCelula.notas.trim())

                  const borderColor = st === 'futura' ? 'rgba(255,255,255,0.06)'
                    : st === 'dada' ? 'rgba(34,197,94,0.3)'
                    : st === 'nao_dada' ? 'rgba(239,68,68,0.3)'
                    : 'rgba(59,130,246,0.3)'
                  const dotColor = st === 'futura' ? '#333'
                    : st === 'dada' ? '#22c55e'
                    : st === 'nao_dada' ? '#EF4444'
                    : '#3b82f6'

                  return (
                    <button key={quadra} onClick={() => abrirAula(aulaCelula)} style={{
                      width: '140px', flexShrink: 0, marginRight: '4px',
                      backgroundColor: aulaEhFutura ? '#131313' : '#1a1a1a',
                      borderRadius: '10px', border: `1px solid ${borderColor}`,
                      padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                      minHeight: '72px', boxSizing: 'border-box',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {isAv
                          ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825' }}>avulsa</span>
                          : <span />
                        }
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                          {hasAlerta && <span style={{ fontSize: '9px' }}>⚠️</span>}
                          {hasReposicao && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COR_REPOSICAO, flexShrink: 0 }} />}
                          {hasNotas && <FileText size={8} color="#444" />}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: aulaEhFutura ? '#444' : '#F0F2F5', lineHeight: '1.3', marginBottom: '4px' }}>
                        {nivel || (isAv ? 'Avulsa' : aulaCelula.turmas?.nome || '—')}
                      </div>
                      <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {aulaCelula.professores?.nome?.split(' ')[0]}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {aulaEhFutura
                          ? <span style={{ fontSize: '10px', color: '#333' }}>📅 agendada</span>
                          : <>
                            <span style={{ fontSize: '10px', color: '#888' }}><b>T</b>{qtdTotal}</span>
                            {qtdP > 0 && <span style={{ fontSize: '10px', color: '#22c55e' }}>✓{qtdP}</span>}
                            {qtdF > 0 && <span style={{ fontSize: '10px', color: '#EF4444' }}>✗{qtdF}</span>}
                          </>
                        }
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {aulaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={fecharModal}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxHeight: '90vh', overflowY: 'auto',
            backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>
                  {getNivel(aula) || (isAvulsa ? 'Aula Avulsa' : aula.turmas?.nome)}
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                  {getQuadraNome(aula)} · {getHorario(aula)} · Prof: {aula.professores?.nome}
                </div>
              </div>
              <button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {aulaFutura && (
              <div style={{
                backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '14px',
                fontSize: '12px', color: '#fcc825',
              }}>
                📅 Aula agendada para o futuro — status e presenças disponíveis no dia da aula.
              </div>
            )}

            {isAvulsa && !aulaFutura && (
              <div style={{ marginBottom: '12px' }}>
                {estaEditando ? (
                  <div style={{
                    backgroundColor: '#111', borderRadius: '12px',
                    border: '1px solid rgba(252,200,37,0.2)', padding: '12px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}>
                    <div style={{ fontSize: '12px', color: '#fcc825', fontWeight: '600' }}>✏️ Editar Aula</div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Data</div>
                      <input type="date" value={editForm.data_aula} onChange={e => setEditForm(f => ({ ...f, data_aula: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Horário</div>
                      <select value={editForm.horario} onChange={e => setEditForm(f => ({ ...f, horario: e.target.value }))} style={inputStyle}>
                        {horarios.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Quadra</div>
                      <select value={editForm.quadra_nome} onChange={e => setEditForm(f => ({ ...f, quadra_nome: e.target.value }))} style={inputStyle}>
                        <option value="">Selecione...</option>
                        {todasQuadras?.map(q => <option key={q.id} value={q.nome}>{q.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Nível</div>
                      <select value={editForm.nivel} onChange={e => setEditForm(f => ({ ...f, nivel: e.target.value }))} style={inputStyle}>
                        <option value="">Sem nível</option>
                        {todosNiveis?.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Professor</div>
                      <select value={editForm.professor_id} onChange={e => setEditForm(f => ({ ...f, professor_id: e.target.value }))} style={inputStyle}>
                        <option value="">Selecione...</option>
                        {todoProfessores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditandoAula(null)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => handleSalvarEdicao(aula)} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={13} /> Salvar edição
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => iniciarEdicao(aula)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                      <Pencil size={12} /> Editar aula
                    </button>
                    {!confirmandoExclusao ? (
                      <button onClick={() => setConfirmandoExclusao(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}>
                        🗑️ Excluir
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <span style={{ fontSize: '11px', color: '#EF4444' }}>Confirmar?</span>
                        <button onClick={() => handleExcluirAula(aula.id)} style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', backgroundColor: '#EF4444', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Sim</button>
                        <button onClick={() => setConfirmandoExclusao(false)} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Não</button>
                      </div>
                    )}
                    <button onClick={() => setEditandoNotas(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: notasAula ? '1px solid rgba(255,255,255,0.15)' : '1px solid #2a2a2a', background: 'none', color: notasAula ? '#aaa' : '#555', fontSize: '12px', cursor: 'pointer' }}>
                      <FileText size={12} /> {notasAula ? 'Ver nota' : 'Observação'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isAvulsa && !aulaFutura && (
              <div style={{ marginBottom: '12px' }}>
                <button onClick={() => setEditandoNotas(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: notasAula ? '1px solid rgba(255,255,255,0.15)' : '1px solid #2a2a2a', background: 'none', color: notasAula ? '#aaa' : '#555', fontSize: '12px', cursor: 'pointer' }}>
                  <FileText size={12} /> {notasAula ? 'Ver nota' : 'Observação'}
                </button>
              </div>
            )}

            {editandoNotas && (
              <div style={{
                backgroundColor: '#111', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)', padding: '12px',
                marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={12} color="#555" />
                  <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observação da Aula</span>
                </div>
                <textarea
                  placeholder="Ex: Prof faltou, aula cancelada por chuva, aluno lesionado..."
                  value={notasAula}
                  onChange={e => setNotasLocal(prev => ({ ...prev, [aula.id]: e.target.value }))}
                  rows={3}
                  autoFocus
                  style={{ ...inputStyle, resize: 'none', fontSize: '13px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditandoNotas(false)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => handleSalvarNotas(aula.id)} style={{ flex: 2, padding: '7px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                    💾 Salvar observação
                  </button>
                </div>
              </div>
            )}

            {!editandoNotas && notasAula && (
              <div style={{
                backgroundColor: '#111', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px',
                marginBottom: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <FileText size={11} color="#444" />
                  <span style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observação</span>
                </div>
                <p style={{ fontSize: '12px', color: '#888', margin: 0, lineHeight: '1.5' }}>{notasAula}</p>
              </div>
            )}

            {!aulaFutura && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status da Aula</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {STATUS_AULA.map(s => (
                    <button key={s.value} onClick={() => handleStatusAula(aula.id, s.value)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                      fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                      background: statusAtual === s.value ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                      color: statusAtual === s.value ? 'white' : '#555',
                      boxSizing: 'border-box', transition: 'all 0.15s',
                    }}>{s.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '6px' }}>
                  💰 Professor: <span style={{ color: aula.paga_professor ? '#22c55e' : '#EF4444' }}>
                    {aula.paga_professor ? 'Aula paga' : 'Aula não paga'}
                  </span>
                </div>
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Presenças ({alunosNaAula.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alunosNaAula.map(aluno => {
                const temAlerta = aluno.alerta_nivel
                const alertaAberto = alertaNivel[aluno.aluno_id]
                const isReposicao = aluno.tipo_participacao === 'reposicao'
                return (
                  <div key={aluno.aluno_id} style={{
                    borderRadius: '10px', padding: '10px 12px', boxSizing: 'border-box',
                    border: isReposicao ? `1px solid rgba(59,130,246,0.3)` : temAlerta ? '1px solid rgba(252,200,37,0.25)' : '1px solid transparent',
                    backgroundColor: isReposicao ? 'rgba(59,130,246,0.05)' : '#111',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: '13px', fontWeight: '500', color: '#F0F2F5',
                          backgroundColor: temAlerta ? 'rgba(252,200,37,0.12)' : 'transparent',
                          borderRadius: '4px', padding: temAlerta ? '1px 6px' : '0',
                          textDecoration: temAlerta ? 'underline' : 'none',
                          textDecorationColor: '#fcc825', textDecorationStyle: 'dotted',
                        }}>{aluno.nome}</span>
                        {temAlerta && <span style={{ fontSize: '11px' }}>⚠️</span>}
                        {isReposicao && (
                          <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.15)', color: COR_REPOSICAO, fontWeight: '600' }}>reposição</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => toggleAlertaNivel(aluno.aluno_id, aluno)} title="Alerta de nível" style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: temAlerta ? 'rgba(252,200,37,0.15)' : '#1a1a1a', color: temAlerta ? '#fcc825' : '#555' }}>
                          <AlertTriangle size={12} />
                        </button>
                        <select value={aluno.tipo_participacao} onChange={e => updatePresenca(aula.id, aluno.aluno_id, 'tipo_participacao', e.target.value)}
                          style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: isReposicao ? COR_REPOSICAO : '#888', cursor: 'pointer', outline: 'none' }}>
                          {TIPO_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <button onClick={() => {
                          setPresencasLocal(prev => {
                            const novo = { ...prev[aula.id] }
                            delete novo[aluno.aluno_id]
                            return { ...prev, [aula.id]: novo }
                          })
                        }} title="Remover da lista" style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                          <X size={11} />
                        </button>
                      </div>
                    </div>

                    {alertaAberto && (
                      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid rgba(252,200,37,0.2)', padding: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#fcc825', fontWeight: '600' }}>⚠️ Avaliação de Nível pelo Professor</div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Nível real avaliado</div>
                          <select value={alertaAberto.nivel} onChange={e => setAlertaNivel(prev => ({ ...prev, [aluno.aluno_id]: { ...prev[aluno.aluno_id], nivel: e.target.value } }))} style={{ ...inputStyle, fontSize: '12px' }}>
                            <option value="">Selecione o nível real...</option>
                            {todosNiveis?.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Observação do professor</div>
                          <textarea placeholder="Ex: Aluno está abaixo do nível da turma..." value={alertaAberto.obs} onChange={e => setAlertaNivel(prev => ({ ...prev, [aluno.aluno_id]: { ...prev[aluno.aluno_id], obs: e.target.value } }))} rows={3} style={{ ...inputStyle, resize: 'none', fontSize: '12px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {temAlerta && (
                            <button onClick={() => handleRemoverAlertaNivel(aula.id, aluno.aluno_id)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'none', color: '#EF4444', fontSize: '11px', cursor: 'pointer' }}>Remover alerta</button>
                          )}
                          <button onClick={() => setAlertaNivel(prev => ({ ...prev, [aluno.aluno_id]: null }))} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={() => handleSalvarAlertaNivel(aula.id, aluno.aluno_id)} style={{ flex: 2, padding: '7px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Salvar alerta</button>
                        </div>
                      </div>
                    )}

                    {temAlerta && !alertaAberto && aluno.obs_nivel_prof && (
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px', fontStyle: 'italic' }}>
                        📝 {aluno.nivel_avaliado_prof && <span style={{ color: '#fcc825' }}>{aluno.nivel_avaliado_prof} · </span>}
                        {aluno.obs_nivel_prof}
                      </div>
                    )}

                    {!aulaFutura && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {STATUS_PRESENCA.map(sp => (
                          <button key={sp.value} onClick={() => updatePresenca(aula.id, aluno.aluno_id, 'status_presenca', sp.value)} style={{
                            flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                            backgroundColor: aluno.status_presenca === sp.value ? sp.color + '30' : '#1a1a1a',
                            color: aluno.status_presenca === sp.value ? sp.color : '#444',
                            boxSizing: 'border-box',
                            outline: aluno.status_presenca === sp.value ? `1px solid ${sp.color}` : 'none',
                          }}>{sp.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {adicionandoAluno === aula.id ? (
              <div style={{ marginTop: '10px' }}>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <input placeholder="Buscar aluno cadastrado..." value={buscaAdicionando}
                    onChange={e => setBuscaAdicionando(e.target.value)} autoFocus
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#111', border: '1px solid #fcc825', color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  {alunosBusca.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                      {alunosBusca.map(a => (
                        <button key={a.id} onClick={() => adicionarAlunoNaLista(aula.id, a)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >{a.nome}</button>
                      ))}
                    </div>
                  )}
                </div>
                {!novoAlunoModal.show ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setNovoAlunoModal(n => ({ ...n, show: true }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <UserPlus size={13} /> Cadastrar novo aluno
                    </button>
                    <button onClick={() => { setAdicionandoAluno(null); setBuscaAdicionando('') }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                ) : (
                  <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#111', border: '1px solid rgba(252,200,37,0.2)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#fcc825', fontWeight: '600' }}>👤 Novo Aluno</div>
                    <div style={{ position: 'relative' }}>
                      <input placeholder="Nome completo *" value={novoAlunoModal.nome} onChange={e => setNovoAlunoModal(n => ({ ...n, nome: e.target.value }))} style={inputStyle} />
                      {(() => {
                        const sugestoes = novoAlunoModal.nome.length >= 2
                          ? todosAlunos?.filter(a =>
                              a.nome.toLowerCase().includes(novoAlunoModal.nome.toLowerCase()) &&
                              !idsNaAula.includes(a.id)
                            ) || []
                          : []
                        return sugestoes.length > 0 ? (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, backgroundColor: '#1a1a1a', border: '1px solid rgba(252,200,37,0.4)', borderRadius: '10px', marginTop: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '10px', color: '#fcc825', padding: '6px 12px 4px', borderBottom: '1px solid #2a2a2a' }}>⚠️ Já cadastrado — clique para adicionar direto</div>
                            {sugestoes.map(a => (
                              <button key={a.id} onClick={() => { adicionarAlunoNaLista(aula.id, a); setNovoAlunoModal({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '' }) }}
                                style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <span>{a.nome}</span>
                                {a.nivel && <span style={{ fontSize: '10px', color: '#cf1b9b' }}>{a.nivel}</span>}
                              </button>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                    <input placeholder="Telefone (WhatsApp)" value={novoAlunoModal.telefone} onChange={e => setNovoAlunoModal(n => ({ ...n, telefone: e.target.value }))} style={inputStyle} />
                    <div>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>Nível (opcional)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {NIVEIS_ALUNO.map(n => (
                          <button key={n} onClick={() => setNovoAlunoModal(na => ({ ...na, nivel: na.nivel === n ? '' : n }))} style={{
                            padding: '3px 8px', borderRadius: '6px', border: 'none', fontSize: '10px',
                            background: novoAlunoModal.nivel === n ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                            outline: novoAlunoModal.nivel === n ? 'none' : '1px solid #2a2a2a',
                            color: novoAlunoModal.nivel === n ? 'white' : '#888', cursor: 'pointer',
                          }}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setNovoAlunoModal(n => ({ ...n, menor_idade: !n.menor_idade }))} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', border: 'none', background: novoAlunoModal.menor_idade ? 'rgba(252,200,37,0.1)' : '#1a1a1a', outline: novoAlunoModal.menor_idade ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a', color: novoAlunoModal.menor_idade ? '#fcc825' : '#888', cursor: 'pointer', fontSize: '11px' }}>
                      <span>{novoAlunoModal.menor_idade ? '✓' : '○'}</span> Menor de idade
                    </button>
                    {novoAlunoModal.menor_idade && (
                      <input placeholder="Nome do responsável *" value={novoAlunoModal.nome_responsavel} onChange={e => setNovoAlunoModal(n => ({ ...n, nome_responsavel: e.target.value }))} style={inputStyle} />
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setNovoAlunoModal(n => ({ ...n, show: false }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => handleCadastrarNovoAluno(aula.id)} disabled={salvarAluno.isPending} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                        {salvarAluno.isPending ? 'Salvando...' : '✓ Cadastrar e Adicionar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setAdicionandoAluno(aula.id)} style={{
                marginTop: '10px', width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '12px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box',
              }}>
                <UserPlus size={13} /> Adicionar aluno
              </button>
            )}

            {!aulaFutura && (
              <button onClick={() => handleSalvarPresencas(aula.id)} disabled={salvarPresencas.isPending} style={{
                marginTop: '12px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box',
              }}>
                {salvarPresencas.isPending ? 'Salvando...' : '💾 Salvar Presenças'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}