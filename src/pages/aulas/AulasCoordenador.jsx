import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, UserPlus, Pencil, Check, X, AlertTriangle, FileText, Zap, MessageCircle, Download, Clock, Crown } from 'lucide-react'
import { horarioParaMinutos } from '../../constants/modalidades'
import { getFeriado } from '../../constants/feriados'
import { useAulas, useAtualizarStatusAula, useSalvarPresencas, confirmarAulasElegiveis, gerarReposicoesPorCancelamento, useAvisarFalta } from '../../hooks/useAulas'
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight'
import { useAlunos, useSalvarAluno } from '../../hooks/useAlunos'
import { useProfessores } from '../../hooks/useProfessores'
import { useQuadras } from '../../hooks/useQuadras'
import { useNiveis } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import { QUADRAS_EMPRESA } from '../../hooks/useFinanceiro'
import { useAbrirConversaDaAula } from '../../hooks/useMensagens'
import { useLocation, useNavigate } from 'react-router-dom'
import useAppStore from '../../store/useAppStore'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { criarAlerta } from '../../hooks/useAlertas'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const STATUS_AULA = [
  { value: 'dada', label: '✅ Confirmada', paga: true },
  { value: 'nao_dada', label: '❌ Sem Aula', paga: true },
  { value: 'cancelada', label: '🌧️ Cancelada', paga: false },
]

const MOTIVOS_CANCELAMENTO = ['Chuva', 'Falta do professor', 'Manutenção da quadra', 'Outro']

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

// Avulsa não tem horario_fim salvo — assume 1h de duração, igual ao resto do app
function getHorarioFim(aula) {
  if (aula.turma_id) return aula.turmas?.horario_fim?.slice(0, 5) || ''
  const inicio = getHorario(aula)
  if (!inicio) return ''
  const [h, m] = inicio.split(':').map(Number)
  const fim = h * 60 + m + 60
  return `${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`
}

// Avulsas sempre contam como ativas (já nascem com aluno) — turma só conta se tiver aluno ativo matriculado
function turmaAtiva(aula) {
  if (!aula.turma_id) return true
  return !!aula.turmas?.turmas_alunos?.some(ta => ta.ativo)
}

function isAulaFutura(dataAula, horarioInicio) {
  const agora = new Date()
  const hoje = format(agora, 'yyyy-MM-dd')
  if (dataAula > hoje) return true
  if (dataAula < hoje) return false
  // mesma data: checar horário com 10 min de antecedência
  if (!horarioInicio) return false
  const [h, m] = horarioInicio.split(':').map(Number)
  const inicioAula = new Date()
  inicioAula.setHours(h, m - 10, 0, 0)
  return agora < inicioAula
}

// professorProprioId: modo "Minhas Aulas" do professor — mesmo layout/modal do gestor, mas só
// mostra as próprias aulas e esconde ações de gestor (editar aula, excluir, editar turma, ação em
// massa). O professor continua podendo confirmar status, discutir a aula e mexer nos alunos.
export function AulasCoordenador({ onCelulaVazia, somenteLeitura = false, professorProprioId = null }) {
  const { modalidadeSelecionada, setOrigemAulas, user, setNavRecolhida } = useAppStore()
  const alturaVisivel = useVisualViewportHeight()
  const qc = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const abrirConversaDaAula = useAbrirConversaDaAula()
  const [data, setData] = useState(() => location.state?.data || format(new Date(), 'yyyy-MM-dd'))
  const feriado = getFeriado(data)
  const [highlightedAulaId, setHighlightedAulaId] = useState(null)
  const highlightAulaId = location.state?.highlightAulaId
  const fromHome = location.state?.fromHome

  // Segurança: se sair da tela sem fechar o modal (ex: "Discutir esta aula" navega direto
  // pra Mensagens), garante que o rodapé volte a aparecer normalmente na próxima tela.
  useEffect(() => {
    return () => setNavRecolhida(false)
  }, [])

  useEffect(() => {
    if (location.state?.horario) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`hora-${location.state.horario}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [])

  const [aulaModal, setAulaModal] = useState(null)
  const [presencasLocal, setPresencasLocal] = useState({})
  const [alunosOriginais, setAlunosOriginais] = useState(new Set())
  const [alunoRecemAdicionado, setAlunoRecemAdicionado] = useState(null)
  const [adicionandoAluno, setAdicionandoAluno] = useState(null)
  const [buscaAdicionando, setBuscaAdicionando] = useState('')
  const [editandoAula, setEditandoAula] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [statusLocal, setStatusLocal] = useState({})
  const [alertaNivel, setAlertaNivel] = useState({})
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(null)
  const [editandoNivelTurma, setEditandoNivelTurma] = useState(false)
  const [novoNivelId, setNovoNivelId] = useState('')
  const [novoProfessorTurmaId, setNovoProfessorTurmaId] = useState('')
  const [salvandoNivelTurma, setSalvandoNivelTurma] = useState(false)
  const [editandoHorarioAula, setEditandoHorarioAula] = useState(false)
  const [novoHorarioMover, setNovoHorarioMover] = useState('')
  const [novaQuadraMoverId, setNovaQuadraMoverId] = useState('')
  const [salvandoHorarioAula, setSalvandoHorarioAula] = useState(false)
  const [modalExportarPDF, setModalExportarPDF] = useState(false)
  const [pdfSomenteComAluno, setPdfSomenteComAluno] = useState(true)
  const [pdfQuadras, setPdfQuadras] = useState(() => [...QUADRAS_EMPRESA.procopio, ...QUADRAS_EMPRESA.beach_arena])

  function toggleQuadraPdf(quadra) {
    setPdfQuadras(prev => prev.includes(quadra) ? prev.filter(q => q !== quadra) : [...prev, quadra])
  }
  const [notasLocal, setNotasLocal] = useState({})
  const [editandoNotas, setEditandoNotas] = useState(false)
  const [mostrarMotivoCancelamento, setMostrarMotivoCancelamento] = useState(false)
  const [motivoCancelamentoMassa, setMotivoCancelamentoMassa] = useState('')
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

        await supabase.from('aulas').update({
          status_aula: statusAula,
          paga_professor: pagaProfessor,
          motivo_cancelamento: acaoMassa === 'cancelar' ? (motivoCancelamentoMassa || null) : null,
        }).eq('id', a.id)

        if (a.presencas && a.presencas.length > 0) {
          await supabase.from('presencas').update({ status_presenca: statusPresenca, presente: acaoMassa === 'confirmar' }).eq('aula_id', a.id)
        }

        if (acaoMassa === 'cancelar') {
          await gerarReposicoesPorCancelamento(a.id, motivoCancelamentoMassa)
        }
      }
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
      toast.success(
        acaoMassa === 'confirmar' ? '✅ Todas as aulas confirmadas!' :
        acaoMassa === 'sem_aula' ? '❌ Todas marcadas como Sem Aula!' :
        '🌧️ Todas as aulas canceladas!',
        { style: toastStyle }
      )
      setModalMassa(null)
      setAcaoMassa(null)
      setMotivoCancelamentoMassa('')
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setExecutandoMassa(false)
    }
  }

  const { data: aulas, isLoading } = useAulas(
    professorProprioId
      ? { data, professorId: professorProprioId }
      : { data, modalidadeId: modalidadeSelecionada?.id }
  )
  const { data: todosAlunos, refetch: refetchAlunos } = useAlunos()

  // Sem isso, uma aula com aluno e horário já passado ficava mostrando "Confirmada" ticada
  // (status_aula já nasce assim) mas "Aula não paga" embaixo — incoerente, porque a confirmação
  // de pagamento só rodava nas telas financeiras. Roda aqui também, sempre que troca de dia.
  useEffect(() => {
    confirmarAulasElegiveis({ professorId: professorProprioId, dataInicio: data, dataFim: data })
      .then(() => qc.invalidateQueries({ queryKey: ['aulas'] }))
  }, [data, professorProprioId])
  const { professores: todoProfessores } = useProfessores(null)
  const { data: todasQuadras } = useQuadras(null)
  const { data: todosNiveis } = useNiveis(null)

  // Minhas Aulas do professor só mostra as quadras das modalidades dele — não faz sentido
  // um professor de Tênis ver colunas de Padel ou da Beach Arena.
  const { data: modalidadesDoProfessor = [] } = useQuery({
    queryKey: ['modalidades_do_professor', professorProprioId],
    enabled: !!professorProprioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores').select('modalidade_id, modalidades_ids').eq('id', professorProprioId).maybeSingle()
      if (error) throw error
      return data?.modalidades_ids?.length ? data.modalidades_ids : (data?.modalidade_id ? [data.modalidade_id] : [])
    },
  })
  const { data: modalidades } = useModalidades()
  const salvarAluno = useSalvarAluno()
  const atualizarStatus = useAtualizarStatusAula()
  const salvarPresencas = useSalvarPresencas()
  const avisarFalta = useAvisarFalta()

  async function handleAvisarFalta(aulaId, alunoId, nomeAluno) {
    try {
      await avisarFalta.mutateAsync({ aulaId, alunoId })
      toast.success(`🗣️ Falta de ${nomeAluno} avisada — vaga aberta pra aula avulsa`, { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  // Pra mostrar um ícone discreto de mensagem no card de aulas que já têm uma conversa aberta
  const idsAulasDoDia = (aulas || []).map(a => a.id)
  const { data: aulasComConversa = [] } = useQuery({
    queryKey: ['aulas_com_conversa', idsAulasDoDia],
    enabled: idsAulasDoDia.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('conversas').select('aula_id').in('aula_id', idsAulasDoDia)
      if (error) throw error
      return (data || []).map(c => c.aula_id)
    },
  })
  const idsComConversa = new Set(aulasComConversa)

  // Só usado no modo do professor: lista de todo mundo cadastrado pra escolher com quem discutir
  // a aula (pode ser mais de uma pessoa) — ordenada por nome, sem contar o próprio professor.
  const [escolhendoDestinatario, setEscolhendoDestinatario] = useState(null)
  const [buscaDestinatario, setBuscaDestinatario] = useState('')
  const [destinatariosSelecionados, setDestinatariosSelecionados] = useState([])
  const { data: gestores = [] } = useQuery({
    queryKey: ['gestores_para_discutir', user?.id],
    enabled: !!professorProprioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis_usuario').select('user_id, nome').order('nome')
      if (error) throw error
      return (data || []).filter(g => g.user_id !== user?.id)
    },
  })

  useEffect(() => {
    if (!highlightAulaId || !aulas?.length) return
    const aulaAlvo = aulas.find(a => a.id === highlightAulaId)
    if (!aulaAlvo) return
    const timer = setTimeout(() => {
      document.getElementById(`aula-cel-${highlightAulaId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedAulaId(highlightAulaId)
      if (fromHome) setOrigemAulas({ data, aulaId: highlightAulaId })
      setTimeout(() => setHighlightedAulaId(null), 2000)
    }, 400)
    return () => clearTimeout(timer)
  }, [aulas?.length, highlightAulaId])

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

  async function exportarPDF(somenteComAluno, quadrasSelecionadas) {
    const toastId = toast.loading('Gerando PDF...', { style: toastStyle })
    try {
      const { jsPDF } = await import('jspdf')
      const { autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

      // Tela dark igual ao app — feito pra ver no celular/computador, não pra imprimir
      const COR_FUNDO = [17, 15, 15]
      const COR_CARD = [26, 26, 26]
      const COR_LINHA = [42, 42, 42]
      const COR_TEXTO = [230, 232, 235]
      const COR_TEXTO_SUAVE = [150, 150, 150]

      const paginasPintadas = new Set()
      function pintarFundo() {
        const pagAtual = doc.internal.getCurrentPageInfo().pageNumber
        if (paginasPintadas.has(pagAtual)) return
        paginasPintadas.add(pagAtual)
        doc.setFillColor(...COR_FUNDO)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
      }

      pintarFundo()

      try {
        const resp = await fetch('/images/logoprocoach.png')
        const blob = await resp.blob()
        const logoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        doc.addImage(logoBase64, 'PNG', 40, 20, 100, 30)
      } catch {}

      doc.setFontSize(17)
      doc.setTextColor(...COR_TEXTO)
      doc.text('Grade de Aulas', pageWidth / 2, 38, { align: 'center' })
      doc.setFontSize(11)
      doc.setTextColor(...COR_TEXTO_SUAVE)
      doc.text(label.charAt(0).toUpperCase() + label.slice(1), pageWidth / 2, 56, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`Gerado em ${geradoEm}`, pageWidth - 40, 26, { align: 'right' })

      let cursorY = 82
      const SECOES = [
        { chave: 'procopio', titulo: 'PROCOPIO', cor: [252, 200, 37], corTexto: [30, 30, 30], quadras: QUADRAS_EMPRESA.procopio },
        { chave: 'beach_arena', titulo: 'BEACH ARENA', cor: [207, 27, 155], corTexto: [255, 255, 255], quadras: QUADRAS_EMPRESA.beach_arena },
      ]

      let algumaSecaoImpressa = false

      for (const secao of SECOES) {
        const quadrasIncluidas = secao.quadras.filter(q => quadrasSelecionadas.includes(q))
        if (quadrasIncluidas.length === 0) continue

        let aulasSecao = (aulas || []).filter(a => quadrasIncluidas.includes(getQuadraNome(a)))
        if (somenteComAluno) {
          aulasSecao = aulasSecao.filter(a => (a.presencas || []).some(p => p.alunos))
        }
        if (aulasSecao.length === 0) continue
        algumaSecaoImpressa = true

        doc.setFillColor(...secao.cor)
        doc.rect(40, cursorY, pageWidth - 80, 3, 'F')
        cursorY += 18
        doc.setFontSize(13)
        doc.setTextColor(...secao.cor)
        doc.text(secao.titulo, 40, cursorY)
        cursorY += 8

        const horariosOcupados = [...new Set(aulasSecao.map(a => getHorario(a)).filter(Boolean))].sort()

        const head = [['Horário', ...quadrasIncluidas]]
        const body = horariosOcupados.map(h => {
          const aulaParaFim = aulasSecao.find(a => getHorario(a) === h)
          const linha = [`${h} – ${getHorarioFim(aulaParaFim)}`]
          quadrasIncluidas.forEach(q => {
            const aula = aulasSecao.find(a => getHorario(a) === h && getQuadraNome(a) === q)
            if (!aula) { linha.push(''); return }
            const nivel = getNivel(aula) || (aula.turma_id ? aula.turmas?.nome : 'Avulsa')
            const professor = aula.professores?.nome || 'Sem professor'
            const alunos = (aula.presencas || []).filter(p => p.alunos).map(p => p.alunos.nome)
            linha.push(alunos.length > 0
              ? `${nivel}\nProf: ${professor}\n\n${alunos.join('\n')}`
              : `${nivel}\nProf: ${professor}\n\nSem aluno`)
          })
          return linha
        })

        autoTable(doc, {
          startY: cursorY,
          head, body,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 5, valign: 'top', lineColor: COR_LINHA, lineWidth: 0.5, textColor: COR_TEXTO, fillColor: COR_CARD },
          headStyles: { fillColor: secao.cor, textColor: secao.corTexto, fontStyle: 'bold', fontSize: 9 },
          columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: COR_TEXTO, fillColor: COR_CARD } },
          alternateRowStyles: { fillColor: COR_CARD },
          margin: { left: 40, right: 40 },
          willDrawPage: pintarFundo,
          didParseCell: cellData => {
            if (cellData.section === 'body' && cellData.column.index > 0) {
              const raw = String(cellData.cell.raw || '')
              if (!raw || raw.includes('Sem aluno')) {
                cellData.cell.styles.fillColor = [21, 21, 21]
                cellData.cell.styles.textColor = [90, 90, 90]
              }
            }
          },
        })
        cursorY = doc.lastAutoTable.finalY + 26
      }

      if (!algumaSecaoImpressa) {
        doc.setFontSize(12)
        doc.setTextColor(...COR_TEXTO_SUAVE)
        doc.text(
          somenteComAluno ? 'Nenhuma turma com aluno matriculado nesse dia.' : 'Nenhuma aula agendada nesse dia.',
          pageWidth / 2, cursorY + 20, { align: 'center' }
        )
      }

      const totalPaginas = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(...COR_TEXTO_SUAVE)
        doc.text(`Gerado pelo ProCoach em ${geradoEm}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
      }

      doc.save(`grade-aulas-${format(dataObj, 'dd-MM-yyyy')}.pdf`)
      toast.success('PDF gerado!', { id: toastId, style: toastStyle })
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + err.message, { id: toastId, style: toastStyle })
    }
  }

  function abrirAula(aula) {
    setAulaModal(aula)
    setNavRecolhida(true)
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
        status_presenca: p.status_presenca || 'presente',
        tipo_participacao: p.tipo_participacao || 'mensalista',
        alerta_nivel: alertaPresenca,
        nivel_avaliado_prof: nivelPresenca,
        obs_nivel_prof: obsPresenca,
      }
    })
    setPresencasLocal(prev => ({ ...prev, [aula.id]: inicial }))
    setAlunosOriginais(new Set(Object.keys(inicial)))
    setAlunoRecemAdicionado(null)
  }

  function fecharModal() {
    setAulaModal(null)
    setNavRecolhida(false)
    setEditandoAula(null)
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
    setAlertaNivel({})
    setConfirmandoExclusao(false)
    setConfirmandoRemocao(null)
    setEditandoNivelTurma(false)
    setNovoNivelId('')
    setEditandoHorarioAula(false)
    setNovoHorarioMover('')
    setNovaQuadraMoverId('')
    setEditandoNotas(false)
    setNovoAlunoModal({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '' })
    setEscolhendoDestinatario(null)
    setDestinatariosSelecionados([])
    setBuscaDestinatario('')
    setMostrarMotivoCancelamento(false)
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
        [aluno.id]: { aluno_id: aluno.id, nome: aluno.nome, status_presenca: 'presente', tipo_participacao: 'mensalista', alerta_nivel: false, nivel_avaliado_prof: '', obs_nivel_prof: '' }
      }
    }))
    setAlunoRecemAdicionado(aluno.id)
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
  }

  function removerAlunoDaListaLocal(aulaId, alunoId) {
    setPresencasLocal(prev => {
      const novo = { ...prev[aulaId] }
      delete novo[alunoId]
      return { ...prev, [aulaId]: novo }
    })
  }

  // Mensalista é matrícula duradoura — pergunta se é só dessa aula ou de todas as futuras
  // dessa turma antes de remover. Avulso/cortesia/reposição (ou aula sem turma) some direto.
  function iniciarRemocaoAluno(aula, alunoId) {
    const presenca = presencasLocal[aula.id]?.[alunoId]
    if (aula.turma_id && presenca?.tipo_participacao === 'mensalista') {
      setConfirmandoRemocao({ aulaId: aula.id, turmaId: aula.turma_id, dataAula: aula.data_aula, alunoId, nome: presenca.nome })
    } else {
      removerAlunoDaListaLocal(aula.id, alunoId)
    }
  }

  async function handleRemoverSomenteEstaAula() {
    const { aulaId, alunoId } = confirmandoRemocao
    try {
      await supabase.from('presencas').delete().eq('aula_id', aulaId).eq('aluno_id', alunoId)
      removerAlunoDaListaLocal(aulaId, alunoId)
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aluno removido dessa aula.', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setConfirmandoRemocao(null)
    }
  }

  async function handleRemoverTodasFuturas() {
    const { aulaId, turmaId, dataAula, alunoId } = confirmandoRemocao
    try {
      await supabase.from('turmas_alunos').update({ ativo: false }).eq('turma_id', turmaId).eq('aluno_id', alunoId)
      const { data: aulasFuturas } = await supabase
        .from('aulas').select('id').eq('turma_id', turmaId).gte('data_aula', dataAula)
      const idsAulas = (aulasFuturas || []).map(a => a.id)
      if (idsAulas.length > 0) {
        await supabase.from('presencas').delete().eq('aluno_id', alunoId).in('aula_id', idsAulas)
      }
      removerAlunoDaListaLocal(aulaId, alunoId)
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aluno removido dessa aula e de todas as futuras da turma.', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setConfirmandoRemocao(null)
    }
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

  async function handleDiscutirAula(aulaAlvo) {
    if (!aulaAlvo.professores?.id) return
    const { data: perfilProfessor } = await supabase
      .from('perfis_usuario')
      .select('user_id')
      .eq('professor_id', aulaAlvo.professores.id)
      .maybeSingle()
    if (!perfilProfessor?.user_id || perfilProfessor.user_id === user?.id) {
      toast.error('Não foi possível abrir a conversa com esse professor.', { style: toastStyle })
      return
    }
    try {
      const conversaId = await abrirConversaDaAula.mutateAsync({ aulaId: aulaAlvo.id, outroUserId: perfilProfessor.user_id })
      navigate('/mensagens', { state: { conversaId } })
    } catch {
      toast.error('Mensagens por aula ainda não disponível — falta rodar uma migração no banco.', { style: toastStyle })
    }
  }

  // Professor discutindo a própria aula: pode escolher mais de uma pessoa — abre uma conversa
  // direta com cada uma (o modelo de conversa hoje é sempre 1 pra 1) e navega pra primeira.
  async function handleDiscutirComGestor(aulaAlvo, destinatarioIds) {
    if (destinatarioIds.length === 0) return
    try {
      let primeiraConversaId = null
      for (const destinatarioId of destinatarioIds) {
        const conversaId = await abrirConversaDaAula.mutateAsync({ aulaId: aulaAlvo.id, outroUserId: destinatarioId })
        if (!primeiraConversaId) primeiraConversaId = conversaId
      }
      if (destinatarioIds.length > 1) toast.success(`Conversa iniciada com ${destinatarioIds.length} pessoas!`, { style: toastStyle })
      navigate('/mensagens', { state: { conversaId: primeiraConversaId } })
    } catch {
      toast.error('Mensagens por aula ainda não disponível — falta rodar uma migração no banco.', { style: toastStyle })
    } finally {
      setEscolhendoDestinatario(null)
      setDestinatariosSelecionados([])
      setBuscaDestinatario('')
    }
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

  // Mensalista = matrícula duradoura: além de salvar a presença nessa aula, vincula o aluno
  // à turma (turmas_alunos) e completa a presença nas aulas futuras já geradas dessa mesma
  // turma (que foram criadas antes dessa matrícula, então nunca tiveram esse aluno).
  async function vincularMensalistasNaTurma(aula, mensalistas) {
    if (!aula.turma_id || mensalistas.length === 0) return
    const alunoIds = mensalistas.map(p => p.aluno_id)

    await supabase.from('turmas_alunos').upsert(
      alunoIds.map(aluno_id => ({ turma_id: aula.turma_id, aluno_id, ativo: true })),
      { onConflict: 'turma_id,aluno_id' }
    )

    const { data: aulasFuturas } = await supabase
      .from('aulas').select('id')
      .eq('turma_id', aula.turma_id)
      .gte('data_aula', aula.data_aula)
      .lte('data_aula', '2026-12-31')
    const idsAulasFuturas = (aulasFuturas || []).map(a => a.id)
    if (idsAulasFuturas.length === 0) return

    const { data: presencasExistentes } = await supabase
      .from('presencas').select('aula_id, aluno_id')
      .in('aula_id', idsAulasFuturas).in('aluno_id', alunoIds)
    const jaTem = new Set((presencasExistentes || []).map(p => `${p.aula_id}_${p.aluno_id}`))

    const faltantes = []
    for (const aulaFuturaId of idsAulasFuturas) {
      for (const alunoId of alunoIds) {
        if (!jaTem.has(`${aulaFuturaId}_${alunoId}`)) {
          faltantes.push({ aula_id: aulaFuturaId, aluno_id: alunoId, presente: false, status_presenca: 'presente', tipo_participacao: 'mensalista' })
        }
      }
    }
    if (faltantes.length > 0) {
      await supabase.from('presencas').insert(faltantes)
    }
  }

  async function handleSalvarPresencas(aulaId) {
    const lista = Object.values(presencasLocal[aulaId] || {})
    const aula = aulas?.find(a => a.id === aulaId)
    try {
      const { data: presencasAnteriores } = await supabase
        .from('presencas').select('aluno_id').eq('aula_id', aulaId)
      const idsAnteriores = presencasAnteriores?.map(p => p.aluno_id) || []
      const idsAtuais = lista.map(p => p.aluno_id)
      const idsRemovidos = idsAnteriores.filter(id => !idsAtuais.includes(id))
      if (idsRemovidos.length > 0) {
        await supabase.from('presencas').delete().eq('aula_id', aulaId).in('aluno_id', idsRemovidos)
      }
      let reposicoesBaixadas = []
      if (lista.length > 0) {
        const resultado = await salvarPresencas.mutateAsync({ aulaId, presencas: lista })
        reposicoesBaixadas = resultado?.reposicoesBaixadas || []
      }
      const mensalistas = lista.filter(p => p.tipo_participacao === 'mensalista')
      if (aula && mensalistas.length > 0) {
        await vincularMensalistasNaTurma(aula, mensalistas)
      }

      const idsAdicionados = idsAtuais.filter(id => !idsAnteriores.includes(id))
      if (idsAdicionados.length > 0 || idsRemovidos.length > 0) {
        const nomesAdicionados = lista.filter(p => idsAdicionados.includes(p.aluno_id)).map(p => p.nome)
        const nomesRemovidos = (aula?.presencas || [])
          .filter(p => idsRemovidos.includes(p.aluno_id))
          .map(p => p.alunos?.nome)
          .filter(Boolean)
        await logAudit('aulas', aulaId, 'UPDATE',
          { turma: getNivel(aula) || aula?.turmas?.nome, horario: getHorario(aula), data: aula?.data_aula },
          { adicionados: nomesAdicionados, removidos: nomesRemovidos }
        )

        // Gestor mexendo na turma de outra pessoa: avisa o professor dono da aula (sino +
        // realtime). Se o próprio professor mexeu na aula dele, não faz sentido avisar ele mesmo.
        if (nomesAdicionados.length > 0 && aula?.professores?.id && !professorProprioId) {
          const { data: perfilProfessor } = await supabase
            .from('perfis_usuario').select('user_id').eq('professor_id', aula.professores.id).maybeSingle()
          if (perfilProfessor?.user_id && perfilProfessor.user_id !== user?.id) {
            await criarAlerta({
              usuarioId: perfilProfessor.user_id,
              tipo: 'aluno_adicionado',
              referenciaId: aulaId,
              prioridade: 'baixa',
              mensagem: `${nomesAdicionados.join(', ')} foi incluído na sua aula de ${getHorario(aula)} (${getNivel(aula) || aula?.turmas?.nome || 'avulsa'}).`,
            })
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('✅ Presenças salvas!', { style: toastStyle })
      reposicoesBaixadas.forEach(r => {
        if (!r.dataFaltaResolvida) return
        toast.success(
          `↩ Reposição baixou a falta de ${format(new Date(r.dataFaltaResolvida + 'T12:00'), 'dd/MM', { locale: ptBR })}`,
          { style: toastStyle }
        )
      })
      fecharModal()
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleStatusAula(aulaId, statusAula, motivoCancelamento) {
    if (isFuturo) return toast.error('Aula futura — aguarde o dia da aula', { style: toastStyle })
    const pagaProfessor = STATUS_AULA.find(s => s.value === statusAula)?.paga ?? true
    setStatusLocal(prev => ({ ...prev, [aulaId]: statusAula }))
    setMostrarMotivoCancelamento(false)
    try {
      await atualizarStatus.mutateAsync({ aulaId, statusAula, pagaProfessor, motivoCancelamento })
      if (statusAula !== 'dada') {
        const aula = aulas?.find(a => a.id === aulaId)
        await logAudit('aulas', aulaId, 'UPDATE',
          { turma: getNivel(aula) || aula?.turmas?.nome, horario: getHorario(aula), data: aula?.data_aula },
          { status_aula: statusAula, motivo_cancelamento: statusAula === 'cancelada' ? motivoCancelamento : undefined }
        )
      }
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

  // O nível (e o professor titular) é um campo da turma, compartilhado por todas as ocorrências —
  // não dá pra trocar só de uma aula sem separar ela de alguma forma. Por isso, tanto "só essa"
  // quanto "essa e as futuras" clonam a turma com o nível/professor novos (mesmo horário/quadra/
  // alunos) e só repontam o turma_id das aulas do escopo escolhido — as aulas de fora do escopo
  // (passadas, ou futuras se for "só essa") continuam na turma original, preservando o histórico.
  async function handleEditarNivelTurma(aula, todasFuturas) {
    if (!novoNivelId && !novoProfessorTurmaId) return toast.error('Selecione o nível novo ou o professor novo', { style: toastStyle })
    setSalvandoNivelTurma(true)
    try {
      const { data: turmaOriginal, error: erroTurma } = await supabase
        .from('turmas').select('*').eq('id', aula.turma_id).single()
      if (erroTurma) throw erroTurma

      const nivelIdFinal = novoNivelId || turmaOriginal.nivel_id
      const professorIdFinal = novoProfessorTurmaId || turmaOriginal.professor_titular_id
      const nomeNivelNovo = todosNiveis?.find(n => n.id === nivelIdFinal)?.nome || ''
      const partesNome = (turmaOriginal.nome || '').split('·').map(s => s.trim())
      const novoNome = partesNome.length >= 3
        ? `${partesNome[0]} · ${partesNome[1]} · ${partesNome[2]} · ${nomeNivelNovo}`
        : `${turmaOriginal.nome} · ${nomeNivelNovo}`

      const { data: turmaNova, error: erroNovaTurma } = await supabase.from('turmas').insert({
        modalidade_id: turmaOriginal.modalidade_id,
        horario_dia_semana: turmaOriginal.horario_dia_semana,
        horario_inicio: turmaOriginal.horario_inicio,
        horario_fim: turmaOriginal.horario_fim,
        quadra_id: turmaOriginal.quadra_id,
        professor_titular_id: professorIdFinal,
        nivel_id: nivelIdFinal,
        nome: novoNome,
        ativo: true,
      }).select().single()
      if (erroNovaTurma) throw erroNovaTurma

      const { data: alunosAtivos } = await supabase
        .from('turmas_alunos').select('aluno_id').eq('turma_id', aula.turma_id).eq('ativo', true)
      if (alunosAtivos?.length > 0) {
        await supabase.from('turmas_alunos').insert(
          alunosAtivos.map(a => ({ turma_id: turmaNova.id, aluno_id: a.aluno_id, ativo: true }))
        )
      }

      let query = supabase.from('aulas').update({ turma_id: turmaNova.id })
      query = todasFuturas
        ? query.eq('turma_id', aula.turma_id).gte('data_aula', aula.data_aula)
        : query.eq('id', aula.id)
      const { error: erroAulas } = await query
      if (erroAulas) throw erroAulas

      // Trocar o professor titular da turma não preenche sozinho quem vai dar as aulas já
      // geradas sem professor — sem isso o aviso "sem professor" e a grade continuam vazios
      // mesmo depois de escolher alguém aqui. Só entra nas que ainda não têm ninguém, pra não
      // sobrescrever uma substituição específica que já tenha sido atribuída numa data.
      if (novoProfessorTurmaId) {
        const { error: erroProfExecutou } = await supabase
          .from('aulas')
          .update({ professor_executou_id: professorIdFinal })
          .eq('turma_id', turmaNova.id)
          .is('professor_executou_id', null)
        if (erroProfExecutou) throw erroProfExecutou
      }

      const nomeProfessorNovo = todoProfessores?.find(p => p.id === professorIdFinal)?.nome || ''
      const nomeProfessorAntigo = todoProfessores?.find(p => p.id === turmaOriginal.professor_titular_id)?.nome || ''
      await logAudit('turmas', turmaOriginal.id, 'UPDATE',
        { nivel: turmaOriginal.nome, professor: nomeProfessorAntigo },
        { nivel: nomeNivelNovo, professor: nomeProfessorNovo, escopo: todasFuturas ? 'essa e as futuras' : 'só essa aula', data: aula.data_aula }
      )

      qc.invalidateQueries({ queryKey: ['aulas'] })
      const mudancas = []
      if (novoNivelId && novoNivelId !== turmaOriginal.nivel_id) mudancas.push(`nível pra ${nomeNivelNovo}`)
      if (novoProfessorTurmaId && novoProfessorTurmaId !== turmaOriginal.professor_titular_id) mudancas.push(`professor pra ${nomeProfessorNovo}`)
      toast.success(mudancas.length > 0 ? `Turma atualizada: ${mudancas.join(' e ')}!` : 'Turma atualizada!', { style: toastStyle })
      fecharModal()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setSalvandoNivelTurma(false)
    }
  }

  // Mesmo mecanismo de handleEditarNivelTurma (clona a turma trocando o campo que muda e reaponta
  // aulas.turma_id no escopo escolhido), só que aqui o campo que muda é o horário (e opcionalmente
  // a quadra) em vez do nível. "Sempre" não precisa clonar — atualiza a turma original direto, já
  // que não há necessidade de preservar duas versões (diferente do nível, que fica no histórico).
  async function handleMoverHorarioAula(aula, todasFuturas) {
    if (!novoHorarioMover) return toast.error('Selecione o novo horário', { style: toastStyle })
    setSalvandoHorarioAula(true)
    try {
      const { data: turmaOriginal, error: erroTurma } = await supabase
        .from('turmas').select('*').eq('id', aula.turma_id).single()
      if (erroTurma) throw erroTurma

      const quadraDestinoId = novaQuadraMoverId || turmaOriginal.quadra_id
      const quadraDestinoNome = todasQuadras?.find(q => q.id === quadraDestinoId)?.nome || getQuadraNome(aula)

      const conflito = aulas?.find(a =>
        a.id !== aula.id && a.data_aula === aula.data_aula &&
        getHorario(a) === novoHorarioMover && getQuadraNome(a) === quadraDestinoNome
      )
      if (conflito) return toast.error(`Já tem aula nesse horário na ${quadraDestinoNome}`, { style: toastStyle })

      const duracaoMin = horarioParaMinutos(turmaOriginal.horario_fim) - horarioParaMinutos(turmaOriginal.horario_inicio)
      const inicioMin = horarioParaMinutos(novoHorarioMover)
      const fimMin = inicioMin + duracaoMin
      const novoHorarioFim = `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`

      if (todasFuturas) {
        const { error } = await supabase.from('turmas').update({
          horario_inicio: `${novoHorarioMover}:00`, horario_fim: `${novoHorarioFim}:00`, quadra_id: quadraDestinoId,
        }).eq('id', turmaOriginal.id)
        if (error) throw error
      } else {
        const { data: turmaNova, error: erroNovaTurma } = await supabase.from('turmas').insert({
          modalidade_id: turmaOriginal.modalidade_id,
          horario_dia_semana: turmaOriginal.horario_dia_semana,
          horario_inicio: `${novoHorarioMover}:00`,
          horario_fim: `${novoHorarioFim}:00`,
          quadra_id: quadraDestinoId,
          professor_titular_id: turmaOriginal.professor_titular_id,
          nivel_id: turmaOriginal.nivel_id,
          nome: turmaOriginal.nome,
          ativo: true,
        }).select().single()
        if (erroNovaTurma) throw erroNovaTurma

        const { data: alunosAtivos } = await supabase
          .from('turmas_alunos').select('aluno_id').eq('turma_id', aula.turma_id).eq('ativo', true)
        if (alunosAtivos?.length > 0) {
          await supabase.from('turmas_alunos').insert(
            alunosAtivos.map(a => ({ turma_id: turmaNova.id, aluno_id: a.aluno_id, ativo: true }))
          )
        }

        const { error: erroAula } = await supabase.from('aulas').update({ turma_id: turmaNova.id }).eq('id', aula.id)
        if (erroAula) throw erroAula
      }

      await logAudit('turmas', turmaOriginal.id, 'UPDATE',
        { horario: turmaOriginal.horario_inicio?.slice(0, 5), quadra: getQuadraNome(aula) },
        { horario: novoHorarioMover, quadra: quadraDestinoNome, escopo: todasFuturas ? 'sempre' : 'só essa aula', data: aula.data_aula }
      )

      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success(`Aula movida pra ${novoHorarioMover}!`, { style: toastStyle })
      fecharModal()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setSalvandoHorarioAula(false)
    }
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
      cor: '#cf1b9b',
      quadras: ['Quadra 1 Areia', 'Quadra 3 Areia', 'Quadra 5 Areia'],
    },
  ]

  const todasQuadrasNomes = (todasQuadras?.map(q => q.nome) || [])

  function quadraCombinaComModalidade(q, nomeModalidade) {
    if (nomeModalidade === 'Tênis') return ['Quadra 1', 'Quadra 2', 'Quadra 3', 'Quadra 4'].includes(q)
    if (nomeModalidade === 'Padel') return q === 'Quadra de Padel'
    if (nomeModalidade === 'Beach Tênis') return q === 'Quadra 1 Areia'
    if (nomeModalidade === 'Futevôlei') return q === 'Quadra 3 Areia'
    if (nomeModalidade === 'Vôlei de Praia') return q === 'Quadra 5 Areia'
    return false
  }

  const quadrasFiltradasPorModalidade = filtroModalidadeGrade === 'todas'
    ? todasQuadrasNomes
    : todasQuadrasNomes.filter(q => quadraCombinaComModalidade(q, filtroModalidadeGrade))

  // No modo "Minhas Aulas" do professor, só entram as quadras das modalidades dele
  const nomesModalidadesProfessor = professorProprioId
    ? modalidadesDoProfessor.map(id => modalidades?.find(m => m.id === id)?.nome).filter(Boolean)
    : null
  const quadrasDoProfessor = nomesModalidadesProfessor
    ? todasQuadrasNomes.filter(q => nomesModalidadesProfessor.some(nome => quadraCombinaComModalidade(q, nome)))
    : null

  const gruposParaGrade = GRUPOS_EMPRESA.map(g => ({
    ...g,
    quadras: g.quadras.filter(q => todasQuadrasNomes.includes(q) &&
      (filtroModalidadeGrade === 'todas' || quadrasFiltradasPorModalidade.includes(q)) &&
      (!quadrasDoProfessor || quadrasDoProfessor.includes(q)))
  })).filter(g => g.quadras.length > 0)

  const quadrasParaGrade = gruposParaGrade.flatMap(g => g.quadras)

  const modalidadesNaGrade = [...new Set(
    GRUPOS_EMPRESA.flatMap(g => g.quadras)
      .filter(q => todasQuadrasNomes.includes(q))
      .map(q => {
        if (['Quadra 1', 'Quadra 2', 'Quadra 3', 'Quadra 4'].includes(q)) return 'Tênis'
        if (q === 'Quadra de Padel') return 'Padel'
        if (q === 'Quadra 1 Areia') return 'Beach Tênis'
        if (q === 'Quadra 3 Areia') return 'Futevôlei'
        if (q === 'Quadra 5 Areia') return 'Vôlei de Praia'
        return null
      })
      .filter(Boolean)
  )]

  const horariosGrade = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  // Turmas sem aluno matriculado não contam nas estatísticas do dia (só aparecem cinza na grade)
  const aulasAtivas = aulasFiltradas.filter(turmaAtiva)

  const totalAulas = aulasAtivas.length
  const aulasDadas = aulasAtivas.filter(a => !isAulaFutura(a.data_aula, getHorario(a)) && (statusLocal[a.id] || a.status_aula || 'dada') === 'dada').length
  const aulasNaoDadas = aulasAtivas.filter(a => (statusLocal[a.id] || a.status_aula) === 'nao_dada').length
  const aulasCanceladas = aulasAtivas.filter(a => (statusLocal[a.id] || a.status_aula) === 'cancelada').length
  let totalPresentes = 0, totalFaltas = 0
  aulasAtivas.forEach(aula => {
    if (isAulaFutura(aula.data_aula, getHorario(aula))) return
    aula.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) totalPresentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') totalFaltas++
    })
  })

  const aula = aulaModal
  const presencas = aula ? (presencasLocal[aula.id] || {}) : {}
  const alunosNaAula = Object.values(presencas)
  const idsNaAula = Object.keys(presencas)
  const aulaFutura = aula ? isAulaFutura(aula.data_aula, getHorario(aula)) : false
  const statusAtual = aula ? (aulaFutura ? 'futura' : (statusLocal[aula.id] || aula.status_aula || 'dada')) : 'dada'
  const isAvulsa = aula ? !aula.turma_id : false
  // Professor titular daquela turma específica pode mexer no horário mesmo estando no modo
  // "Minhas Aulas" (professorProprioId) — gestor sempre pode, independente de titularidade.
  const ehTitularDaTurma = aula ? aula.turmas?.professor_titular_id === professorProprioId : false
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

      {feriado && (
        <div style={{
          backgroundColor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
          fontSize: '12px', color: '#a855f7',
        }}>
          🎉 Feriado — {feriado}: não teremos aula hoje.
        </div>
      )}

      {/* Botões filtro modalidade + ação em massa */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <button onClick={() => setModalExportarPDF(true)} style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '6px 10px', borderRadius: '8px', border: '1px solid #2a2a2a', cursor: 'pointer',
          background: '#1a1a1a', color: '#555', fontSize: '11px',
        }}>
          <Download size={12} /> PDF
        </button>
        {/* Filtro modalidade — no modo do professor já filtra automático pelas modalidades dele */}
        {!professorProprioId && (
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
        )}

        {/* Ação em massa */}
        {!somenteLeitura && !professorProprioId && totalAulas > 0 && !isFuturo && (
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

      {/* Modal exportar PDF */}
      {modalExportarPDF && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setModalExportarPDF(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1a1a1a', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '20px', width: '100%', maxWidth: '360px', maxHeight: `${Math.round(alturaVisivel * 0.85)}px`, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', marginBottom: '14px' }}>Exportar grade em PDF</div>
            <button onClick={() => setPdfSomenteComAluno(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '10px',
              border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
              background: pdfSomenteComAluno ? 'rgba(252,200,37,0.1)' : '#111',
              outline: pdfSomenteComAluno ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
              color: pdfSomenteComAluno ? '#fcc825' : '#888',
            }}>
              <span style={{ fontSize: '16px' }}>{pdfSomenteComAluno ? '✓' : '○'}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>Só aulas com aluno</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Oculta turmas vazias, pra não confundir os professores</div>
              </div>
            </button>

            <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '16px 0 8px' }}>Quadras</div>
            {[
              { titulo: 'Procopio', quadras: QUADRAS_EMPRESA.procopio },
              { titulo: 'Beach Arena', quadras: QUADRAS_EMPRESA.beach_arena },
            ].map(grupo => (
              <div key={grupo.titulo} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>{grupo.titulo}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {grupo.quadras.map(q => {
                    const selecionada = pdfQuadras.includes(q)
                    return (
                      <button key={q} onClick={() => toggleQuadraPdf(q)} style={{
                        padding: '7px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: selecionada ? '#fcc825' : '#111',
                        outline: selecionada ? 'none' : '1px solid #2a2a2a',
                        color: selecionada ? '#110f0f' : '#555',
                        fontSize: '11px', fontWeight: selecionada ? '700' : '400', textAlign: 'left',
                      }}>
                        {q}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => setModalExportarPDF(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { setModalExportarPDF(false); exportarPDF(pdfSomenteComAluno, pdfQuadras) }} disabled={pdfQuadras.length === 0} style={{
                flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '600',
                cursor: pdfQuadras.length === 0 ? 'not-allowed' : 'pointer', opacity: pdfQuadras.length === 0 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                <Download size={14} /> Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMassa && (
        <div className="sheet-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex' }}
          onClick={() => { setModalMassa(null); setAcaoMassa(null) }}>
          <div className="sheet-content" onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box',
          }}>
            <div className="sheet-handle" style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

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
                {acaoMassa === 'cancelar' && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Motivo do cancelamento</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {MOTIVOS_CANCELAMENTO.map(m => (
                        <button key={m} onClick={() => setMotivoCancelamentoMassa(m)} style={{
                          padding: '8px 10px', borderRadius: '8px', border: 'none',
                          fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                          background: motivoCancelamentoMassa === m ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                          color: motivoCancelamentoMassa === m ? 'white' : '#555',
                        }}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setModalMassa('menu')} style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a',
                    background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer',
                  }}>Voltar</button>
                  <button onClick={handleAcaoMassa} disabled={executandoMassa || (acaoMassa === 'cancelar' && !motivoCancelamentoMassa)} style={{
                    flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                    color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    opacity: (acaoMassa === 'cancelar' && !motivoCancelamentoMassa) ? 0.5 : 1,
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
            <div style={{ minWidth: `${50 + quadrasParaGrade.length * 140}px`, position: 'relative' }}>

            {/* Cabeçalho com grupos por empresa */}
            <div style={{ display: 'flex', marginBottom: '2px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#110f0f', paddingTop: '4px', paddingBottom: '4px', marginLeft: 0 }}>
              <div style={{ width: '50px', flexShrink: 0, marginRight: '4px' }} />
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
              <div key={horario} id={`hora-${horario}`} style={{ display: 'flex', marginBottom: '4px', alignItems: 'stretch' }}>
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

                  const aulaEhFutura = isAulaFutura(aulaCelula.data_aula, getHorario(aulaCelula))
                  const st = aulaEhFutura ? 'futura' : (statusLocal[aulaCelula.id] || aulaCelula.status_aula || 'dada')
                  const nivel = getNivel(aulaCelula)
                  const qtdTotal = aulaCelula.presencas?.length || 0
                  const qtdP = aulaCelula.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
                  const qtdF = aulaCelula.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
                  const isAv = !aulaCelula.turma_id
                  const hasAlerta = temAlertaNivel(aulaCelula)
                  const hasReposicao = temReposicao(aulaCelula)
                  const hasNotas = !!(aulaCelula.notas && aulaCelula.notas.trim())
                  // O destaque do card é por ocorrência, não pela turma como um todo — a matrícula
                  // de um mensalista (turmas_alunos) vale pra turma inteira "pra sempre", mas a
                  // presença só é preenchida a partir da data em que ele começou. Por isso o sinal
                  // certo aqui é sempre a presença desse dia específico (qtdTotal), nunca o
                  // turmaAtiva (que ignora data e acendia até aulas anteriores ao início do aluno).
                  const semAluno = qtdTotal === 0
                  const semProfessor = !isAv && !aulaCelula.professores

                  // Futura + já tem aluno matriculado: destaca com uma cor que não é usada em
                  // mais nada na grade (verde/vermelho/azul/amarelo já têm outro significado),
                  // só pra bater o olho e ver rápido onde já foi matriculado alguém.
                  // Sem aluno nenhum: sempre neutro, independente do status_aula — esse campo
                  // nasce 'dada' por padrão no banco mesmo sem ninguém ter confirmado nada.
                  // Feriado com aluno: cor própria (roxo) — já conta como paga, mas ninguém vai
                  // dar aula de verdade, então não faz sentido misturar com o verde de "dada".
                  const ehFeriadoComAluno = !!feriado && !semAluno
                  const borderColor = ehFeriadoComAluno ? 'rgba(168,85,247,0.4)'
                    : semAluno ? 'rgba(255,255,255,0.06)'
                    : st === 'futura' ? 'rgba(34,211,238,0.3)'
                    : st === 'dada' ? 'rgba(34,197,94,0.3)'
                    : st === 'nao_dada' ? 'rgba(239,68,68,0.3)'
                    : 'rgba(59,130,246,0.3)'
                  const dotColor = ehFeriadoComAluno ? '#a855f7'
                    : semAluno ? '#333'
                    : st === 'futura' ? '#22d3ee'
                    : st === 'dada' ? '#22c55e'
                    : st === 'nao_dada' ? '#EF4444'
                    : '#3b82f6'

                  const isHighlighted = highlightedAulaId === aulaCelula.id

                  return (
                    <button key={quadra} id={`aula-cel-${aulaCelula.id}`} onClick={() => abrirAula(aulaCelula)} style={{
                      width: '140px', flexShrink: 0, marginRight: '4px',
                      backgroundColor: isHighlighted ? 'rgba(252,200,37,0.15)' : (aulaEhFutura ? '#131313' : '#1a1a1a'),
                      borderRadius: '10px', border: `1px solid ${isHighlighted ? '#fcc825' : borderColor}`,
                      padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                      minHeight: '72px', boxSizing: 'border-box',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      opacity: semAluno ? 0.45 : 1,
                      transition: 'background-color 0.3s ease, border-color 0.3s ease',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {isAv
                          ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825' }}>avulsa</span>
                          : semAluno
                          ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#666' }}>sem aluno</span>
                          : <span />
                        }
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                          {hasAlerta && <span style={{ fontSize: '9px' }}>⚠️</span>}
                          {hasReposicao && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COR_REPOSICAO, flexShrink: 0 }} />}
                          {hasNotas && <FileText size={8} color="#444" />}
                          {idsComConversa.has(aulaCelula.id) && <MessageCircle size={8} color="#3b82f6" />}
                          {!semAluno && aulaCelula.status_aula === 'dada' && aulaCelula.paga_professor === true && (
                            <Crown size={9} color="#fcc825" title="Validada e confirmada pro pagamento" />
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: aulaEhFutura ? '#444' : '#F0F2F5', lineHeight: '1.3', marginBottom: '4px' }}>
                        {nivel || (isAv ? 'Avulsa' : aulaCelula.turmas?.nome || '—')}
                      </div>
                      <div style={{ fontSize: '10px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: semProfessor ? '#e0a856' : '#555' }}>
                        {semProfessor ? '⚠️ sem professor' : aulaCelula.professores?.nome?.split(' ')[0]}
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

      {/* Modal — via portal pro <body>: escapa do contêiner com overflow-y+scroll-touch
          do .app-main, que no WebKit mobile "prende" filhos position:fixed dentro dele
          em vez de cobrir a tela toda (bug clássico do Safari/WebKit) */}
      {aulaModal && createPortal(
        <div className="sheet-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
        }} onClick={fecharModal}>
          <div className="sheet-content" onClick={e => e.stopPropagation()} style={{
            maxHeight: `${Math.round(alturaVisivel * 0.9)}px`, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain', touchAction: 'pan-y',
            backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box',
          }}>
            <div className="sheet-handle" style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#fcc825', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                  {aula.data_aula && format(new Date(aula.data_aula + 'T12:00'), "dd/MM · EEEE", { locale: ptBR })}
                </div>
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

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: editandoNivelTurma ? '10px' : '14px' }}>
              {!somenteLeitura && !professorProprioId && aula.professores?.id && (
                <button onClick={() => handleDiscutirAula(aula)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none',
                  color: '#888', fontSize: '12px', cursor: 'pointer',
                }}>
                  <MessageCircle size={12} /> Discutir esta aula
                </button>
              )}
              {!somenteLeitura && professorProprioId && (
                <button onClick={() => setEscolhendoDestinatario(v => v === aula.id ? null : aula.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none',
                  color: '#888', fontSize: '12px', cursor: 'pointer',
                }}>
                  <MessageCircle size={12} /> Discutir esta aula
                </button>
              )}
              {!somenteLeitura && !professorProprioId && !isAvulsa && !editandoNivelTurma && (
                <button onClick={() => { setEditandoNivelTurma(true); setNovoNivelId(''); setNovoProfessorTurmaId('') }} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none',
                  color: '#888', fontSize: '12px', cursor: 'pointer',
                }}>
                  <Pencil size={12} /> Editar turma
                </button>
              )}
              {!somenteLeitura && (!professorProprioId || ehTitularDaTurma) && !isAvulsa && !editandoHorarioAula && (
                <button onClick={() => { setEditandoHorarioAula(true); setNovoHorarioMover(''); setNovaQuadraMoverId('') }} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none',
                  color: '#888', fontSize: '12px', cursor: 'pointer',
                }}>
                  <Clock size={12} /> Mover horário
                </button>
              )}
            </div>

            {escolhendoDestinatario === aula.id && (
              <div style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #2a2a2a', padding: '10px', marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Falar sobre essa aula com quem?</div>
                {gestores.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#555' }}>Nenhum outro usuário cadastrado.</div>
                ) : (
                  <>
                    <input
                      placeholder="Buscar pessoa..." value={buscaDestinatario}
                      onChange={e => setBuscaDestinatario(e.target.value)}
                      style={{ ...inputStyle, marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                      {gestores
                        .filter(g => g.nome.toLowerCase().includes(buscaDestinatario.toLowerCase()))
                        .map(g => {
                          const selecionado = destinatariosSelecionados.includes(g.user_id)
                          return (
                            <button key={g.user_id} onClick={() => setDestinatariosSelecionados(prev =>
                              selecionado ? prev.filter(id => id !== g.user_id) : [...prev, g.user_id]
                            )} style={{
                              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px',
                              border: selecionado ? '1px solid rgba(252,200,37,0.4)' : '1px solid transparent',
                              background: selecionado ? 'rgba(252,200,37,0.1)' : '#1a1a1a',
                              color: '#F0F2F5', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                            }}>
                              <span style={{
                                width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                                border: selecionado ? 'none' : '1px solid #444',
                                background: selecionado ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {selecionado && <Check size={11} color="white" />}
                              </span>
                              {g.nome}
                            </button>
                          )
                        })}
                    </div>
                    <button
                      onClick={() => handleDiscutirComGestor(aula, destinatariosSelecionados)}
                      disabled={destinatariosSelecionados.length === 0}
                      style={{
                        width: '100%', marginTop: '8px', padding: '9px', borderRadius: '8px', border: 'none',
                        background: destinatariosSelecionados.length ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                        color: destinatariosSelecionados.length ? 'white' : '#555', fontSize: '12px', fontWeight: '600',
                        cursor: destinatariosSelecionados.length ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      <MessageCircle size={13} />
                      {destinatariosSelecionados.length > 1 ? `Enviar para ${destinatariosSelecionados.length} pessoas` : 'Enviar'}
                    </button>
                  </>
                )}
              </div>
            )}

            {editandoNivelTurma && (
              <div style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #2a2a2a', padding: '12px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nível da turma</div>
                <select value={novoNivelId} onChange={e => setNovoNivelId(e.target.value)} style={inputStyle}>
                  <option value="">{getNivel(aula) || 'Sem nível'} (manter)</option>
                  {todosNiveis?.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
                </select>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Professor</div>
                <select value={novoProfessorTurmaId} onChange={e => setNovoProfessorTurmaId(e.target.value)} style={inputStyle}>
                  <option value="">{aula.turmas?.professor_titular_id ? (todoProfessores?.find(p => p.id === aula.turmas.professor_titular_id)?.nome || 'Professor atual') : 'Selecione...'} (manter)</option>
                  {todoProfessores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleEditarNivelTurma(aula, false)} disabled={salvandoNivelTurma} style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(252,200,37,0.4)',
                    background: 'rgba(252,200,37,0.1)', color: '#fcc825', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    Só essa aula
                  </button>
                  <button onClick={() => handleEditarNivelTurma(aula, true)} disabled={salvandoNivelTurma} style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    Essa e as futuras
                  </button>
                  <button onClick={() => setEditandoNivelTurma(false)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {editandoHorarioAula && (
              <div style={{ backgroundColor: '#111', borderRadius: '10px', border: '1px solid #2a2a2a', padding: '12px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Novo horário</div>
                <select value={novoHorarioMover} onChange={e => setNovoHorarioMover(e.target.value)} style={inputStyle}>
                  <option value="">Selecione...</option>
                  {horariosGrade.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quadra (opcional — deixa igual se não mudar)</div>
                <select value={novaQuadraMoverId} onChange={e => setNovaQuadraMoverId(e.target.value)} style={inputStyle}>
                  <option value="">{getQuadraNome(aula)} (mesma quadra)</option>
                  {todasQuadras?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleMoverHorarioAula(aula, false)} disabled={salvandoHorarioAula} style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(252,200,37,0.4)',
                    background: 'rgba(252,200,37,0.1)', color: '#fcc825', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    Só essa aula
                  </button>
                  <button onClick={() => handleMoverHorarioAula(aula, true)} disabled={salvandoHorarioAula} style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    Sempre
                  </button>
                  <button onClick={() => setEditandoHorarioAula(false)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {aulaFutura && (
              <div style={{
                backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '14px',
                fontSize: '12px', color: '#fcc825',
              }}>
                📅 Aula agendada para o futuro — status e presenças disponíveis no dia da aula.
              </div>
            )}

            {isAvulsa && !somenteLeitura && !professorProprioId && (
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

            {!isAvulsa && !somenteLeitura && (!professorProprioId || ehTitularDaTurma) && (
              <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!aulaFutura && (
                  <button onClick={() => setEditandoNotas(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: notasAula ? '1px solid rgba(255,255,255,0.15)' : '1px solid #2a2a2a', background: 'none', color: notasAula ? '#aaa' : '#555', fontSize: '12px', cursor: 'pointer' }}>
                    <FileText size={12} /> {notasAula ? 'Ver nota' : 'Observação'}
                  </button>
                )}
                {!confirmandoExclusao ? (
                  <button onClick={() => setConfirmandoExclusao(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}>
                    🗑️ Excluir aula
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <span style={{ fontSize: '11px', color: '#EF4444' }}>Confirmar?</span>
                    <button onClick={() => handleExcluirAula(aula.id)} style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', backgroundColor: '#EF4444', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Sim</button>
                    <button onClick={() => setConfirmandoExclusao(false)} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Não</button>
                  </div>
                )}
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

            {!aulaFutura && !somenteLeitura && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status da Aula</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {STATUS_AULA.map(s => (
                    <button key={s.value} onClick={() => {
                      if (s.value === 'cancelada') setMostrarMotivoCancelamento(true)
                      else { setMostrarMotivoCancelamento(false); handleStatusAula(aula.id, s.value) }
                    }} style={{
                      flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                      fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                      background: statusAtual === s.value ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                      color: statusAtual === s.value ? 'white' : '#555',
                      boxSizing: 'border-box', transition: 'all 0.15s',
                    }}>{s.label}</button>
                  ))}
                </div>
                {mostrarMotivoCancelamento && (
                  <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', backgroundColor: '#111', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Motivo do cancelamento:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {MOTIVOS_CANCELAMENTO.map(m => (
                        <button key={m} onClick={() => handleStatusAula(aula.id, 'cancelada', m)} style={{
                          padding: '8px 10px', borderRadius: '8px', border: 'none',
                          fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                          background: '#1a1a1a', color: '#F0F2F5',
                        }}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#555', marginTop: '6px' }}>
                  💰 Professor: <span style={{ color: aula.paga_professor ? '#22c55e' : '#EF4444' }}>
                    {aula.paga_professor ? 'Aula paga' : 'Aula não paga'}
                  </span>
                  {statusAtual === 'cancelada' && aula.motivo_cancelamento && (
                    <span> · Motivo: {aula.motivo_cancelamento}</span>
                  )}
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
                const ehNovo = alunoRecemAdicionado === aluno.aluno_id && !alunosOriginais.has(String(aluno.aluno_id))
                return (
                  <div key={aluno.aluno_id} style={{
                    borderRadius: '10px', padding: '10px 12px', boxSizing: 'border-box',
                    border: ehNovo ? '1px solid rgba(252,200,37,0.5)' : isReposicao ? `1px solid rgba(59,130,246,0.3)` : temAlerta ? '1px solid rgba(252,200,37,0.25)' : '1px solid transparent',
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
                      {!somenteLeitura && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button onClick={() => toggleAlertaNivel(aluno.aluno_id, aluno)} title="Alerta de nível" style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: temAlerta ? 'rgba(252,200,37,0.15)' : '#1a1a1a', color: temAlerta ? '#fcc825' : '#555' }}>
                            <AlertTriangle size={12} />
                          </button>
                          <select value={aluno.tipo_participacao} onChange={e => updatePresenca(aula.id, aluno.aluno_id, 'tipo_participacao', e.target.value)}
                            style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: isReposicao ? COR_REPOSICAO : '#888', cursor: 'pointer', outline: 'none' }}>
                            {TIPO_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          {aulaFutura && aluno.status_presenca !== 'falta_justificada' && (
                            <button onClick={() => handleAvisarFalta(aula.id, aluno.aluno_id, aluno.nome)} title="Avisar falta — abre vaga avulsa" disabled={avisarFalta.isPending} style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', fontSize: '13px' }}>
                              🗣️
                            </button>
                          )}
                          <button onClick={() => iniciarRemocaoAluno(aula, aluno.aluno_id)} title="Remover" style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                            <X size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {ehNovo && !somenteLeitura && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#fcc825', fontWeight: '600', marginBottom: '6px' }}>
                          Novo aluno — como é a participação dele(a)?
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {TIPO_PARTICIPACAO.filter(t => t.value !== 'cortesia').map(t => (
                            <button key={t.value} onClick={() => updatePresenca(aula.id, aluno.aluno_id, 'tipo_participacao', t.value)} style={{
                              flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                              backgroundColor: aluno.tipo_participacao === t.value ? 'rgba(252,200,37,0.15)' : '#1a1a1a',
                              color: aluno.tipo_participacao === t.value ? '#fcc825' : '#888',
                              outline: aluno.tipo_participacao === t.value ? '1px solid #fcc825' : 'none',
                              boxSizing: 'border-box',
                            }}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {confirmandoRemocao?.aulaId === aula.id && confirmandoRemocao?.alunoId === aluno.aluno_id && (
                      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', padding: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#F0F2F5' }}>
                          {aluno.nome} é mensalista dessa turma — remover só dessa aula ou de todas as futuras?
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={handleRemoverSomenteEstaAula} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '11px', cursor: 'pointer' }}>
                            Só essa aula
                          </button>
                          <button onClick={handleRemoverTodasFuturas} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', background: '#EF4444', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                            Essa e as futuras
                          </button>
                          <button onClick={() => setConfirmandoRemocao(null)} style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

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

                    {!aulaFutura && !somenteLeitura && (
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

            {!somenteLeitura && (adicionandoAluno === aula.id ? (
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
            ))}

            {!somenteLeitura && (
              <button onClick={() => handleSalvarPresencas(aula.id)} disabled={salvarPresencas.isPending} style={{
                marginTop: '12px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box',
              }}>
                {salvarPresencas.isPending ? 'Salvando...' : aulaFutura ? '💾 Salvar alunos da turma' : '💾 Salvar Presenças'}
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}