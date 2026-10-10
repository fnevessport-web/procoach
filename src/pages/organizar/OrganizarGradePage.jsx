import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarRange, Check, FileDown, ChevronLeft, ChevronRight, CloudOff, Eraser, Hand, Pencil, Plus, RotateCcw, Trash2, UserMinus, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { addDays, endOfMonth, format, parseISO, previousMonday, isMonday, startOfWeek } from 'date-fns'
import { useModalidadeTenisId } from '../../hooks/useModalidadeTenisId'
import { useQuadras } from '../../hooks/useQuadras'
import { useHorariosGrade } from '../../hooks/useHorariosGrade'
import { useNiveis } from '../../hooks/useNiveis'
import {
  CENARIO_VAZIO, useAlunosDaSemana, useCenarioGrade, useProfessoresOrganizacao, useSalvarCenarioGrade, useTurmasTenisGrade,
} from '../../hooks/useCenarioGrade'
import { PALETA_PROFESSORES_SUAVE as PALETA } from '../../constants/paletaProfessores'
import { VAGAS_GRUPO, VAGAS_INDIVIDUAL } from '../../constants/modalidades'
import { nomeCurto } from '../../lib/nomes'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { gerarPdfOrganizarGrade } from '../../lib/organizarGradePdf'
import { aplicarAjustesAlunos, NOMES_PROFESSOR_GRADE } from '../../constants/ajustesOrganizarGrade'

// Organizar Grade: tabuleiro da grade de Tênis (seg a sáb) pra planejar a distribuição dos
// professores — arrastar (ou "pincel": toca no professor e depois nas turmas) o nome pra turma,
// tirar professor da grade, reservar vaga pra professor novo. É só rascunho: parte da grade
// oficial (turmas.professor_titular_id) e grava o cenário à parte (useCenarioGrade), nunca em
// turmas. Contexto Claro (tela de operação/cadastro).

const DIAS = [
  { chave: 'segunda', curto: 'SEG', longo: 'Segunda' }, { chave: 'terca', curto: 'TER', longo: 'Terça' },
  { chave: 'quarta', curto: 'QUA', longo: 'Quarta' }, { chave: 'quinta', curto: 'QUI', longo: 'Quinta' },
  { chave: 'sexta', curto: 'SEX', longo: 'Sexta' }, { chave: 'sabado', curto: 'SÁB', longo: 'Sábado' },
]
const VAZIO = '__vazio__' // "sem professor" como alvo de arrastar/pincel
const COR_SEM_PROF = 'var(--color-text-light-muted)'

const cartao = {
  backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
  borderRadius: '12px', boxSizing: 'border-box',
}
const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid var(--color-border-light)', borderRadius: '10px', fontSize: '13px',
}

const hora = t => (t.horario_inicio || '').slice(0, 5)
const quadraCurta = q => (q || '').replace(/^Quadra\s*/i, 'Q')
const capacidade = t => (t.niveis?.nome === 'Individual' ? VAGAS_INDIVIDUAL : VAGAS_GRUPO)
// Alunos na lista da aula dessa turma na semana de referência (ver useAlunosDaSemana).
const ocupacao = t => t.semana?.alunos.length || 0

// Padrão: a última semana do mês atual (segunda da última semana até o sábado).
function ultimaSemanaDoMes(hoje = new Date()) {
  const segundaFinal = ref => { const fim = endOfMonth(ref); return isMonday(fim) ? fim : previousMonday(fim) }
  let seg = segundaFinal(hoje)
  // Ainda não começou: usa a semana atual (no sábado/domingo, a próxima), que já tem as aulas
  // geradas com as matrículas mais recentes. Antes caía na última semana do mês anterior, que
  // ficava desatualizada depois de uma sincronização com o clube.
  if (seg > hoje) seg = addDays(startOfWeek(hoje, { weekStartsOn: 1 }), hoje.getDay() === 6 || hoje.getDay() === 0 ? 7 : 0)
  return format(seg, 'yyyy-MM-dd')
}
const fmtDia = d => format(parseISO(d), 'dd/MM')
const ehTenis = (p, tenisId) => p.modalidade_id === tenisId || (p.modalidades_ids || []).includes(tenisId)
const tem = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k)

function useDesktop() {
  const consulta = '(min-width: 1024px)'
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const ouvir = e => setDesktop(e.matches)
    mq.addEventListener('change', ouvir)
    return () => mq.removeEventListener('change', ouvir)
  }, [])
  return desktop
}

// ---------------------------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------------------------

function Chip({ ativo, onClick, children, cor = 'var(--color-action-primary)' }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${ativo ? cor : 'var(--color-border-light)'}`,
      backgroundColor: ativo ? cor : 'var(--color-surface-light-raised)',
      color: ativo ? 'var(--color-action-on-primary)' : 'var(--color-text-light-secondary)',
    }}>{children}</button>
  )
}

// Nome arrastável do professor (paleta e card). `chave` = id do professor, id de "novo" ou VAZIO.
// Visual discreto: bolinha na cor do professor + nome, fundo quase neutro.
function Etiqueta({ chave, nome, cor, pequena }) {
  const vazio = chave === VAZIO
  return (
    <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', chave); e.dataTransfer.effectAllowed = 'copy' }}
      title="Arraste para uma turma"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', cursor: 'grab', boxSizing: 'border-box',
        padding: pequena ? '1px 8px 1px 6px' : '3px 10px 3px 8px', borderRadius: '999px', fontSize: pequena ? '11px' : '12px', fontWeight: 600,
        backgroundColor: vazio ? 'transparent' : `color-mix(in srgb, ${cor} 14%, var(--color-surface-light-overlay))`,
        border: vazio ? '1px dashed var(--color-border-light)' : `1px solid color-mix(in srgb, ${cor} 40%, transparent)`,
        color: vazio ? COR_SEM_PROF : 'var(--color-text-light-primary)',
      }}>
      {!vazio && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: cor, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
    </span>
  )
}

function ItemPaleta({ chave, nome, cor, qtd, qtdAntes, ativo, onPincel, acoes }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', borderRadius: '10px',
      backgroundColor: ativo ? `color-mix(in srgb, ${cor} 12%, var(--color-surface-light-overlay))` : 'transparent',
      outline: ativo ? `1.5px solid color-mix(in srgb, ${cor} 70%, transparent)` : 'none',
    }}>
      <button type="button" onClick={onPincel} title="Tocar para colocar nas turmas (ou arraste o nome)"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <Etiqueta chave={chave} nome={nome} cor={cor} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-light-primary)', whiteSpace: 'nowrap' }}>{qtd}</span>
        {qtdAntes !== undefined && qtdAntes !== qtd && (
          <span style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', whiteSpace: 'nowrap' }}>era {qtdAntes}</span>
        )}
      </button>
      {acoes}
    </div>
  )
}

function BotaoIcone({ onClick, titulo, children, cor = 'var(--color-text-light-muted)' }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: cor, flexShrink: 0 }}>
      {children}
    </button>
  )
}

// Saibro translúcido: vaga que TEM aula (turma com aluno, ou Livre com nível planejado) e ficou sem
// professor — ou com o marcador "SEM PROFESSOR" criado como professor novo. Livre sem nível fica neutra.
const SAIBRO_SUAVE = 'color-mix(in srgb, var(--color-action-primary) 9%, var(--color-surface-light-overlay))'
const SAIBRO_BORDA = 'color-mix(in srgb, var(--color-action-primary) 38%, transparent)'

function CardTurma({ turma, prof, alterado, antes, conflito, apagado, destacado, pincelAtivo, onDrop, onClick }) {
  const [sobre, setSobre] = useState(false)
  const temAula = !turma.livre || turma.nivelPlanejado
  const faltaProf = temAula && (!prof || /sem\s*prof/i.test(prof.nome))
  const cor = faltaProf ? null : prof?.cor
  const ocup = ocupacao(turma)
  const cap = capacidade(turma)
  const titulo = [turma.nome, alterado ? `Na grade oficial: ${antes}` : null, conflito ? 'Professor em duas turmas no mesmo horário' : null].filter(Boolean).join('\n')
  return (
    <div role="button" tabIndex={0} title={titulo} onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!sobre) setSobre(true) }}
      onDragLeave={() => setSobre(false)}
      onDrop={e => { e.preventDefault(); setSobre(false); const k = e.dataTransfer.getData('text/plain'); if (k) onDrop(k) }}
      style={{
        position: 'relative', padding: '5px 6px 6px', borderRadius: '8px', boxSizing: 'border-box', cursor: pincelAtivo ? 'copy' : 'pointer',
        backgroundColor: faltaProf ? SAIBRO_SUAVE : cor ? 'var(--color-surface-light-overlay)' : 'transparent',
        border: `1px ${cor || faltaProf ? 'solid' : 'dashed'} ${conflito ? 'color-mix(in srgb, var(--color-state-danger) 55%, transparent)' : faltaProf ? SAIBRO_BORDA : 'var(--color-border-light)'}`,
        borderLeft: faltaProf ? '3px solid var(--color-action-primary)' : cor ? `3px solid ${cor}` : '1px dashed var(--color-border-light)',
        opacity: apagado ? 0.25 : 1,
        outline: sobre ? '2px solid var(--color-action-primary)' : destacado ? `1.5px solid ${cor}` : 'none',
        outlineOffset: '1px', transition: 'opacity 0.15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', fontSize: '10px', lineHeight: 1.3 }}>
        <strong style={{ color: 'var(--color-text-light-primary)', flexShrink: 0 }}>{quadraCurta(turma.quadras?.nome)}</strong>
        <span style={{ color: turma.livre ? 'var(--color-text-light-muted)' : 'var(--color-text-light-secondary)', fontStyle: turma.livre && !turma.nivelPlanejado ? 'italic' : 'normal', fontWeight: turma.nivelPlanejado ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {turma.livre && !turma.nivelPlanejado ? 'Livre' : turma.niveis?.nome || 'Sem nível'}{turma.livre && turma.nivelPlanejado ? ' · nova' : ''}
        </span>
        {(!turma.livre || turma.nivelPlanejado) && <span style={{ fontWeight: 800, flexShrink: 0, color: ocup === 0 ? 'var(--color-text-light-muted)' : 'var(--color-text-light-primary)' }}>{ocup}/{cap}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', minHeight: '20px' }}>
        {prof
          ? <Etiqueta chave={prof.chave} nome={prof.nome} cor={prof.cor} pequena />
          : <span style={{ fontSize: '11px', fontWeight: faltaProf ? 700 : 400, color: faltaProf ? 'var(--color-action-primary)' : 'var(--color-text-light-muted)' }}>sem professor</span>}
        {conflito && <AlertTriangle size={12} style={{ color: 'var(--color-state-danger)', flexShrink: 0 }} />}
        {alterado && <span title={`Na grade oficial: ${antes}`} style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, marginLeft: 'auto', backgroundColor: 'var(--color-action-primary)' }} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------------------------

export function OrganizarGradePage() {
  const desktop = useDesktop()
  const tenisId = useModalidadeTenisId()
  const { data: turmasTodas, isLoading: carregandoTurmas, isError: erroTurmas } = useTurmasTenisGrade(tenisId)
  const { data: professores, isLoading: carregandoProfs } = useProfessoresOrganizacao()
  const { data: salvo, isLoading: carregandoCenario, isError: erroCenario } = useCenarioGrade()
  const salvar = useSalvarCenarioGrade()

  const [cenario, setCenario] = useState(null)
  const [statusSalvo, setStatusSalvo] = useState('salvo') // salvo | pendente | salvando | erro
  const [pincel, setPincel] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [dia, setDia] = useState('todos')
  const [mostrarOutros, setMostrarOutros] = useState(false)
  const [turmaAberta, setTurmaAberta] = useState(null)
  const [novoAberto, setNovoAberto] = useState(null) // { id?, nome }
  const [confirmarReset, setConfirmarReset] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  // Carrega o cenário salvo uma vez; daí em diante a tela é a dona do estado e só grava.
  const carregado = useRef(false)
  useEffect(() => {
    if (salvo && !carregado.current) { carregado.current = true; setCenario(salvo.dados) }
  }, [salvo])

  // Grava sozinho 0,8s depois da última mudança.
  const primeiraVez = useRef(true)
  useEffect(() => {
    if (!cenario) return
    if (primeiraVez.current) { primeiraVez.current = false; return }
    setStatusSalvo('pendente')
    const t = setTimeout(() => {
      setStatusSalvo('salvando')
      salvar.mutate({ dados: cenario, local: !!salvo?.local }, {
        onSuccess: () => setStatusSalvo('salvo'),
        onError: e => { setStatusSalvo('erro'); toast.error('Não foi possível salvar o cenário: ' + e.message, { style: toastStyle }) },
      })
    }, 800)
    return () => clearTimeout(t)
  }, [cenario]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') setPincel(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const c = cenario || CENARIO_VAZIO
  const semanaInicio = c.semana || ultimaSemanaDoMes()
  const semanaFim = format(addDays(parseISO(semanaInicio), 5), 'yyyy-MM-dd')
  const { data: alunosSemanaBanco, isLoading: carregandoSemana } = useAlunosDaSemana(semanaInicio, semanaFim)
  // Ajustes da lista do clube que valem só nesta tela (ver ajustesOrganizarGrade.js).
  const alunosSemana = useMemo(() => alunosSemanaBanco && aplicarAjustesAlunos(alunosSemanaBanco), [alunosSemanaBanco])
  const [mostrarLivres, setMostrarLivres] = useState(true)
  const { data: quadrasTenis } = useQuadras(tenisId)
  const { data: horariosGrade } = useHorariosGrade()
  const { data: niveisTenis } = useNiveis(tenisId)
  const mudarSemana = dias => setCenario(a => ({ ...a, semana: format(addDays(parseISO(a.semana || ultimaSemanaDoMes()), dias), 'yyyy-MM-dd') }))

  // A grade é montada por VAGA: dia × horário (Cadastro > Horários) × quadra de Tênis ativa. Cada
  // quadra comporta uma aula por horário — o cadastro tem várias turmas antigas "ativas" na mesma
  // vaga (sexta 7h tinha 8 pra 3 quadras), então turma só entra se tiver aluno na semana de
  // referência; vaga sem turma rodando vira "Livre", pra planejar turma nova. A chave da
  // atribuição de professor é a própria vaga (dia|hora|quadra), não o id da turma.
  const { turmas, livres } = useMemo(() => {
    const comAluno = (turmasTodas || []).map(t => ({ ...t, semana: alunosSemana?.[t.id] || null })).filter(t => ocupacao(t) > 0)
    const quadras = [...new Set([...(quadrasTenis || []).map(q => q.nome), ...comAluno.map(t => t.quadras?.nome).filter(Boolean)])]
    const vagas = []
    let qtdLivres = 0
    for (const d of DIAS) {
      const horasDia = new Set([
        ...(horariosGrade || []).filter(h => h.dias_semana?.includes(d.chave)).map(h => h.horario.slice(0, 5)),
        ...comAluno.filter(t => t.horario_dia_semana === d.chave).map(hora),
      ])
      for (const h of horasDia) {
        for (const q of quadras) {
          const chave = `${d.chave}|${h}|${q}`
          const reais = comAluno.filter(t => t.horario_dia_semana === d.chave && hora(t) === h && t.quadras?.nome === q)
          if (reais.length) {
            reais.forEach((t, i) => vagas.push({ ...t, id: i === 0 ? chave : `${chave}#${t.id}`, turmaId: t.id }))
          } else {
            qtdLivres++
            if (mostrarLivres) vagas.push({ id: chave, livre: true, horario_dia_semana: d.chave, horario_inicio: `${h}:00`, quadras: { nome: q }, niveis: null, semana: null, professor_titular_id: null, nome: `${d.longo} · ${h} · ${q} · Livre` })
          }
        }
      }
    }
    // Nível escolhido no cenário pra vaga (ex.: Livre das 6h vira "Individual") sobrepõe o da turma.
    const planejados = c.niveis || {}
    const comNivel = vagas.map(v => (planejados[v.id] ? { ...v, niveis: { nome: planejados[v.id] }, nivelPlanejado: true } : v))
    return { turmas: comNivel, livres: qtdLivres }
  }, [turmasTodas, alunosSemana, quadrasTenis, horariosGrade, mostrarLivres, c.niveis])

  // Professores: Tênis primeiro (cores fixas pela ordem do nome), depois os demais, depois os novos.
  const { tenis, outros, mapaProf } = useMemo(() => {
    const lista = professores || []
    const t = lista.filter(p => ehTenis(p, tenisId))
    const o = lista.filter(p => !ehTenis(p, tenisId))
    const mapa = {}
    let i = 0
    const add = (chave, nome, extra) => { mapa[chave] = { chave, nome, cor: PALETA[i++ % PALETA.length], ...extra } }
    const nomeTela = p => NOMES_PROFESSOR_GRADE[p.id] || p.apelido || nomeCurto(p.nome)
    t.forEach(p => add(p.id, nomeTela(p), { nomeCompleto: p.nome }))
    o.forEach(p => add(p.id, nomeTela(p), { nomeCompleto: p.nome }))
    c.novos.forEach(n => add(n.id, n.nome, { novo: true }))
    // Titular que não está mais na lista de ativos (inativado) continua aparecendo na grade.
    ;(turmasTodas || []).forEach(tu => {
      const k = tu.professor_titular_id
      if (k && !mapa[k]) add(k, NOMES_PROFESSOR_GRADE[k] || tu.professores?.apelido || nomeCurto(tu.professores?.nome) || 'Professor inativo', { inativo: true })
    })
    return { tenis: t, outros: o, mapaProf: mapa }
  }, [professores, tenisId, c.novos, turmasTodas])

  const desligados = useMemo(() => new Set(c.desligados), [c.desligados])
  const original = t => t.professor_titular_id || null
  const baseVazia = c.base !== 'oficial'
  const efetivo = t => {
    const k = tem(c.atribuicoes, t.id) ? c.atribuicoes[t.id] : baseVazia ? null : original(t)
    return k && !desligados.has(k) && mapaProf[k] ? k : null
  }

  const dados = useMemo(() => {
    const lista = (turmas || []).filter(t => DIAS.some(d => d.chave === t.horario_dia_semana))
    const porProf = {}, porProfAntes = {}, ocupado = {}
    const linhas = lista.map(t => {
      const k = efetivo(t)
      const ant = original(t)
      if (k) { porProf[k] = (porProf[k] || 0) + 1; const s = `${k}|${t.horario_dia_semana}|${hora(t)}`; ocupado[s] = (ocupado[s] || 0) + 1 }
      if (ant) porProfAntes[ant] = (porProfAntes[ant] || 0) + 1
      // Montando do zero, turma ainda vazia não conta como "mudou": só quem já tem professor diferente do oficial.
      return { turma: t, k, ant, alterado: baseVazia ? !!k && k !== ant : k !== ant }
    })
    linhas.forEach(l => { l.conflito = !!l.k && ocupado[`${l.k}|${l.turma.horario_dia_semana}|${hora(l.turma)}`] > 1 })
    const horas = [...new Set(lista.map(hora))].sort()
    return {
      linhas, horas, porProf, porProfAntes,
      semProf: linhas.filter(l => !l.k).length,
      alteradas: linhas.filter(l => l.alterado).length,
      conflitos: linhas.filter(l => l.conflito).length,
    }
  }, [turmas, c, mapaProf]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- ações ---------------------------------------------------------------------------------
  function atribuir(turma, chave) {
    const k = chave === VAZIO ? null : chave
    if (k && !mapaProf[k]) return
    setCenario(atual => {
      const at = { ...atual.atribuicoes }
      const padrao = atual.base === 'oficial' ? original(turma) : null
      if (k === padrao) delete at[turma.id]; else at[turma.id] = k
      // Colocar de volta alguém que estava fora da grade o traz de volta pra lista.
      const des = k ? atual.desligados.filter(x => x !== k) : atual.desligados
      return { ...atual, atribuicoes: at, desligados: des }
    })
  }
  const desligar = chave => setCenario(a => ({ ...a, desligados: [...new Set([...a.desligados, chave])] }))
  const reativar = chave => setCenario(a => ({ ...a, desligados: a.desligados.filter(x => x !== chave) }))
  function salvarNovo({ id, nome }) {
    const n = nome.trim()
    if (!n) return
    setCenario(a => id
      ? { ...a, novos: a.novos.map(x => (x.id === id ? { ...x, nome: n } : x)) }
      : { ...a, novos: [...a.novos, { id: `novo-${Date.now()}`, nome: n }] })
    setNovoAberto(null)
  }
  function removerNovo(id) {
    setCenario(a => {
      const at = Object.fromEntries(Object.entries(a.atribuicoes).filter(([, v]) => v !== id))
      return { ...a, novos: a.novos.filter(x => x.id !== id), atribuicoes: at, desligados: a.desligados.filter(x => x !== id) }
    })
    if (pincel === id) setPincel(null)
  }
  const alternarPincel = chave => setPincel(p => (p === chave ? null : chave))

  // ---- render --------------------------------------------------------------------------------
  if (carregandoTurmas || carregandoProfs || carregandoCenario || carregandoSemana || !tenisId || (!cenario && !erroCenario)) return <Loading />
  if (erroTurmas || erroCenario) {
    return <div style={{ ...cartao, padding: '16px', fontSize: '13px', color: 'var(--color-state-danger)' }}>Não foi possível carregar a grade. Atualize a página.</div>
  }

  const passaFiltro = l =>
    filtro === 'todas' || (filtro === 'sem' && !l.k) || (filtro === 'alteradas' && l.alterado) || (filtro === 'conflitos' && l.conflito)
  const diasVisiveis = DIAS.filter(d => dia === 'todos' || d.chave === dia)
  const celulas = {}
  dados.linhas.forEach(l => {
    const s = `${l.turma.horario_dia_semana}|${hora(l.turma)}`
    ;(celulas[s] = celulas[s] || []).push(l)
  })
  Object.values(celulas).forEach(arr => arr.sort((a, b) =>
    (a.turma.quadras?.nome || '').localeCompare(b.turma.quadras?.nome || '', 'pt', { numeric: true }) || (a.turma.niveis?.nome || '').localeCompare(b.turma.niveis?.nome || '')))

  const profPincel = pincel && pincel !== VAZIO ? mapaProf[pincel] : null
  const itemProf = p => {
    const info = mapaProf[p.id]
    return (
      <ItemPaleta key={p.id} chave={p.id} nome={info.nome} cor={info.cor} qtd={dados.porProf[p.id] || 0} qtdAntes={dados.porProfAntes[p.id] || 0}
        ativo={pincel === p.id} onPincel={() => alternarPincel(p.id)}
        acoes={<BotaoIcone titulo={`Tirar ${info.nome} da grade`} onClick={() => desligar(p.id)}><UserMinus size={14} /></BotaoIcone>} />
    )
  }
  const tituloSecao = t => <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-light-muted)', margin: '10px 0 4px' }}>{t}</div>

  // PDF do cenário como está na tela (dia filtrado ou a semana toda). Sem professor = linha em branco.
  async function baixarPdf() {
    setGerandoPdf(true)
    try {
      const itens = dados.linhas.map(l => ({
        dia: l.turma.horario_dia_semana, hora: hora(l.turma), quadra: l.turma.quadras?.nome || 'Sem quadra',
        nivel: l.turma.livre && !l.turma.nivelPlanejado ? 'Livre' : `${l.turma.niveis?.nome || 'Sem nível'}${l.turma.livre ? ' (nova)' : ''}`,
        livre: !!l.turma.livre && !l.turma.nivelPlanejado, ocup: ocupacao(l.turma), cap: capacidade(l.turma),
        prof: l.k && mapaProf[l.k] ? { nome: mapaProf[l.k].nome, cor: mapaProf[l.k].cor } : null,
      }))
      await gerarPdfOrganizarGrade({ itens, dias: diasVisiveis, semanaInicio, semanaFim })
    } catch (e) { toast.error('Não foi possível gerar o PDF: ' + e.message, { style: toastStyle }) }
    finally { setGerandoPdf(false) }
  }

  const statusTexto = salvo?.local
    ? 'Salvo só neste navegador'
    : { salvo: 'Cenário salvo', pendente: 'Alterações não salvas...', salvando: 'Salvando...', erro: 'Erro ao salvar' }[statusSalvo]

  const paleta = (
    <aside style={{
      ...cartao, padding: '10px 10px 12px', alignSelf: 'start',
      ...(desktop ? { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' } : { marginBottom: '14px' }),
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>Professores</div>
      <p style={{ fontSize: '11px', lineHeight: 1.45, color: 'var(--color-text-light-muted)', margin: '2px 0 4px' }}>
        Arraste o nome até a turma, ou toque no nome e depois nas turmas. O número é quantas aulas ele tem no cenário.
      </p>

      <div style={{ padding: '4px 0 2px' }}>
        <ItemPaleta chave={VAZIO} nome="Sem professor" cor={COR_SEM_PROF} qtd={dados.semProf} ativo={pincel === VAZIO}
          onPincel={() => alternarPincel(VAZIO)} acoes={<Eraser size={14} style={{ color: 'var(--color-text-light-muted)', marginRight: '4px' }} />} />
      </div>

      {tituloSecao(`Tênis (${tenis.filter(p => !desligados.has(p.id)).length})`)}
      <div style={desktop ? {} : { display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
        {tenis.filter(p => !desligados.has(p.id)).map(itemProf)}
      </div>

      {tituloSecao(`Professores novos (${c.novos.filter(n => !desligados.has(n.id)).length})`)}
      <div style={desktop ? {} : { display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
        {c.novos.map(n => {
          const info = mapaProf[n.id]
          return (
            <ItemPaleta key={n.id} chave={n.id} nome={info.nome} cor={info.cor} qtd={dados.porProf[n.id] || 0}
              ativo={pincel === n.id} onPincel={() => alternarPincel(n.id)}
              acoes={<>
                <BotaoIcone titulo="Renomear" onClick={() => setNovoAberto({ id: n.id, nome: n.nome })}><Pencil size={13} /></BotaoIcone>
                <BotaoIcone titulo="Remover" onClick={() => removerNovo(n.id)} cor="var(--color-state-danger)"><Trash2 size={13} /></BotaoIcone>
              </>} />
          )
        })}
      </div>
      <button type="button" onClick={() => setNovoAberto({ nome: `Novo prof ${c.novos.length + 1}` })} style={{
        width: '100%', marginTop: '6px', padding: '8px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        border: '1px dashed var(--color-action-primary)', backgroundColor: 'transparent', color: 'var(--color-action-primary)',
      }}><UserPlus size={14} /> ADD NOVO PROF</button>

      {outros.length > 0 && (
        <>
          <button type="button" onClick={() => setMostrarOutros(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            {tituloSecao(`${mostrarOutros ? '▾' : '▸'} Outras modalidades (${outros.filter(p => !desligados.has(p.id)).length})`)}
          </button>
          {mostrarOutros && (
            <div style={desktop ? {} : { display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
              {outros.filter(p => !desligados.has(p.id)).map(itemProf)}
            </div>
          )}
        </>
      )}

      {c.desligados.filter(k => mapaProf[k]).length > 0 && (
        <>
          {tituloSecao('Fora da grade')}
          {c.desligados.filter(k => mapaProf[k]).map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-light-muted)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mapaProf[k].nome}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', whiteSpace: 'nowrap' }}>tinha {dados.porProfAntes[k] || 0}</span>
              <BotaoIcone titulo={`Devolver ${mapaProf[k].nome} para a grade`} onClick={() => reativar(k)} cor="var(--color-state-success)"><RotateCcw size={13} /></BotaoIcone>
            </div>
          ))}
        </>
      )}
    </aside>
  )

  const stat = (rotulo, valor, cor, chaveFiltro) => (
    <button type="button" onClick={() => setFiltro(f => (f === chaveFiltro ? 'todas' : chaveFiltro))} style={{
      ...cartao, padding: '8px 12px', flex: '1 1 120px', textAlign: 'left', cursor: chaveFiltro ? 'pointer' : 'default',
      outline: filtro === chaveFiltro && chaveFiltro !== 'todas' ? `2px solid ${cor}` : 'none',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, lineHeight: 1.1, color: cor }}>{valor}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>{rotulo}</div>
    </button>
  )

  const grade = (
    <div style={{ minWidth: 0 }}>
      {pincel && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '9px 12px', borderRadius: '10px', marginBottom: '10px',
          backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)', fontSize: '13px',
        }}>
          <Hand size={16} style={{ color: 'var(--color-brand-lima)' }} />
          <span style={{ flex: 1, minWidth: '180px' }}>
            {profPincel ? <>Colocando <strong>{profPincel.nome}</strong>: toque nas turmas.</> : <>Tirando o professor: toque nas turmas.</>}
          </span>
          <button type="button" onClick={() => setPincel(null)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            backgroundColor: 'var(--color-brand-lima)', color: 'var(--color-brand-verde-court)',
          }}><Check size={13} /> Pronto</button>
        </div>
      )}

      <div style={{ ...cartao, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', padding: '8px 10px', marginBottom: '10px' }}>
        <CalendarRange size={15} style={{ color: 'var(--color-text-light-muted)' }} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Alunos da semana</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <BotaoIcone titulo="Semana anterior" onClick={() => mudarSemana(-7)}><ChevronLeft size={15} /></BotaoIcone>
          <strong style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', whiteSpace: 'nowrap' }}>{fmtDia(semanaInicio)} a {fmtDia(semanaFim)}</strong>
          <BotaoIcone titulo="Próxima semana" onClick={() => mudarSemana(7)}><ChevronRight size={15} /></BotaoIcone>
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-light-muted)', cursor: 'pointer', marginLeft: 'auto' }}>
          <input type="checkbox" checked={mostrarLivres} onChange={e => setMostrarLivres(e.target.checked)} style={{ accentColor: 'var(--color-action-primary)' }} />
          Mostrar horários livres ({livres})
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        <Chip ativo={dia === 'todos'} onClick={() => setDia('todos')}>Semana toda</Chip>
        {DIAS.map(d => <Chip key={d.chave} ativo={dia === d.chave} onClick={() => setDia(d.chave)}>{d.longo}</Chip>)}
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
        <div style={{
          display: 'grid', gap: '4px',
          gridTemplateColumns: `46px repeat(${diasVisiveis.length}, minmax(${dia === 'todos' ? 150 : 220}px, 1fr))`,
          minWidth: dia === 'todos' ? `${46 + diasVisiveis.length * 154}px` : undefined,
        }}>
          <div />
          {diasVisiveis.map(d => (
            <div key={d.chave} style={{
              padding: '7px 8px', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em',
              backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)',
            }}>{dia === 'todos' ? d.curto : d.longo.toUpperCase()}</div>
          ))}
          {dados.horas.map(h => (
            <FragmentoLinha key={h} h={h} dias={diasVisiveis} celulas={celulas} render={l => {
              const prof = l.k ? mapaProf[l.k] : null
              return (
                <CardTurma key={l.turma.id} turma={l.turma} prof={prof} alterado={l.alterado} conflito={l.conflito}
                  antes={l.ant ? mapaProf[l.ant]?.nome || 'professor' : 'sem professor'}
                  apagado={!passaFiltro(l)} destacado={!!pincel && pincel !== VAZIO && l.k === pincel} pincelAtivo={!!pincel}
                  onDrop={k => atribuir(l.turma, k)}
                  onClick={() => (pincel ? atribuir(l.turma, pincel) : setTurmaAberta(l.turma.id))} />
              )
            }} />
          ))}
        </div>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-light-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
        O número em cada turma é alunos na lista da aula na semana escolhida / vagas (individual 1, grupo 4). Atualiza sozinho conforme a agenda é preenchida. O pontinho indica professor diferente do que está hoje na grade oficial.
      </p>
    </div>
  )

  const turmaModal = turmaAberta ? turmas.find(t => t.id === turmaAberta) : null
  const kModal = turmaModal ? efetivo(turmaModal) : null
  const escolhiveis = [...tenis, ...c.novos.map(n => ({ id: n.id })), ...(mostrarOutros ? outros : [])].filter(p => !desligados.has(p.id) && mapaProf[p.id])

  return (
    <div className="fade-in" style={{ paddingBottom: '24px', color: 'var(--color-text-light-primary)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', margin: '4px 0 12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, margin: 0 }}>Organizar Grade</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', margin: '4px 0 0', maxWidth: '640px', lineHeight: 1.5 }}>
            Rascunho da grade de Tênis (segunda a sábado) para planejar os professores. Nada aqui muda a agenda oficial.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: statusSalvo === 'erro' ? 'var(--color-state-danger)' : salvo?.local ? 'var(--color-state-warning)' : 'var(--color-text-light-muted)' }}>
            {salvo?.local ? <CloudOff size={13} /> : <Check size={13} />}{statusTexto}
          </span>
          <button type="button" onClick={() => setConfirmarReset(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
          }}><RotateCcw size={13} /> Recomeçar</button>
          <button type="button" onClick={baixarPdf} disabled={gerandoPdf} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', cursor: gerandoPdf ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700,
            border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', opacity: gerandoPdf ? 0.7 : 1,
          }}><FileDown size={13} /> {gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}</button>
        </div>
      </div>

      {salvo?.local && (
        <div style={{ ...cartao, padding: '9px 12px', marginBottom: '12px', fontSize: '12px', color: 'var(--color-state-warning)', borderColor: 'var(--color-state-warning)' }}>
          O cenário ainda não está sendo salvo no servidor (falta rodar o SQL da tela). Por enquanto ele fica guardado só neste navegador.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        {stat('turmas de Tênis com aluno', dados.linhas.filter(l => !l.turma.livre).length, 'var(--color-text-light-primary)', 'todas')}
        {stat('sem professor', dados.semProf, 'var(--color-text-light-primary)', 'sem')}
        {stat(baseVazia ? 'com professor diferente do oficial' : 'mudaram de professor', dados.alteradas, 'var(--color-action-primary)', 'alteradas')}
        {stat('choques de horário', dados.conflitos, dados.conflitos ? 'var(--color-state-danger)' : 'var(--color-text-light-primary)', 'conflitos')}
      </div>

      {desktop
        ? <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>{paleta}{grade}</div>
        : <>{paleta}{grade}</>}

      <Modal open={!!turmaModal} onClose={() => setTurmaAberta(null)} size="sm"
        title={turmaModal ? `${DIAS.find(d => d.chave === turmaModal.horario_dia_semana)?.longo} ${hora(turmaModal)} · ${turmaModal.quadras?.nome || ''}` : ''}>
        {turmaModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {turmaModal.livre
                ? <div><strong style={{ color: 'var(--text-primary)' }}>Horário livre</strong> · nenhuma turma com aluno nesta vaga na semana de referência</div>
                : <div><strong style={{ color: 'var(--text-primary)' }}>{turmaModal.niveis?.nome || 'Sem nível'}</strong> · {ocupacao(turmaModal)}/{capacidade(turmaModal)} alunos</div>}
              {ocupacao(turmaModal) > 0 && (
                <div style={{ fontSize: '12px' }}>{turmaModal.semana.alunos.join(', ')}</div>
              )}
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Grade oficial: <strong>{original(turmaModal) ? mapaProf[original(turmaModal)]?.nome : 'sem professor'}</strong>
              </div>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Nível nesta vaga</span>
              <select value={c.niveis?.[turmaModal.id] || ''} onChange={e => {
                const v = e.target.value
                setCenario(a => { const n = { ...(a.niveis || {}) }; if (v) n[turmaModal.id] = v; else delete n[turmaModal.id]; return { ...a, niveis: n } })
              }} style={{ padding: '9px 10px', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)' }}>
                <option value="">{turmaModal.livre ? 'Livre (sem turma)' : `Manter o atual (${(turmasTodas || []).find(t => t.id === turmaModal.turmaId)?.niveis?.nome || 'sem nível'})`}</option>
                {(niveisTenis || []).map(n => <option key={n.id} value={n.nome.trim()}>{n.nome.trim()}</option>)}
              </select>
            </label>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Escolha o professor</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {escolhiveis.map(p => {
                const info = mapaProf[p.id]
                const sel = kModal === p.id
                return (
                  <button key={p.id} type="button" onClick={() => { atribuir(turmaModal, p.id); setTurmaAberta(null) }} style={{
                    padding: '6px 11px', borderRadius: '999px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    border: sel ? `1.5px solid ${info.cor}` : '1px solid var(--border)',
                    backgroundColor: sel ? `color-mix(in srgb, ${info.cor} 16%, var(--surface-overlay))` : 'var(--surface-raised)', color: 'var(--text-primary)',
                  }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: info.cor }} />{info.nome}</button>
                )
              })}
            </div>
            {!mostrarOutros && outros.length > 0 && (
              <button type="button" onClick={() => setMostrarOutros(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', color: 'var(--color-action-primary)', fontWeight: 700 }}>
                Mostrar professores de outras modalidades
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { atribuir(turmaModal, VAZIO); setTurmaAberta(null) }} style={{
                flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                border: '1px dashed var(--border)', background: 'none', color: 'var(--text-secondary)',
              }}><Eraser size={13} /> Deixar sem professor</button>
              {kModal !== original(turmaModal) && !(original(turmaModal) && desligados.has(original(turmaModal))) && (
                <button type="button" onClick={() => { atribuir(turmaModal, original(turmaModal) || VAZIO); setTurmaAberta(null) }} style={{
                  flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  border: '1px solid var(--border)', background: 'none', color: 'var(--text-primary)',
                }}><RotateCcw size={13} /> Usar o da grade oficial</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!novoAberto} onClose={() => setNovoAberto(null)} size="sm" title={novoAberto?.id ? 'Renomear professor novo' : 'Novo professor'}>
        {novoAberto && (
          <form onSubmit={e => { e.preventDefault(); salvarNovo(novoAberto) }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Uma vaga para um professor que ainda não está na equipe. Ele ganha uma cor própria e pode ser arrastado para as turmas como os demais.
            </p>
            <input autoFocus value={novoAberto.nome} onChange={e => setNovoAberto(n => ({ ...n, nome: e.target.value }))} placeholder="Ex.: Prof. manhã, Novo prof 1"
              style={{ padding: '10px 12px', borderRadius: '10px', fontSize: '14px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)' }} />
            <button type="submit" disabled={!novoAberto.nome.trim()} style={{
              padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', opacity: novoAberto.nome.trim() ? 1 : 0.6,
            }}>{novoAberto.id ? <><Check size={14} /> Salvar nome</> : <><Plus size={14} /> Adicionar</>}</button>
          </form>
        )}
      </Modal>

      <Modal open={confirmarReset} onClose={() => setConfirmarReset(false)} size="sm" title="Recomeçar o cenário">
        <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          Apaga as trocas feitas até agora. Os professores novos e quem você tirou da grade continuam na lista.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['vazia', 'Tudo sem professor', 'Grade limpa, para montar do zero.'],
            ['oficial', 'Copiar a grade oficial', 'Cada turma começa com o professor de hoje.'],
          ].map(([base, titulo, sub]) => (
            <button key={base} type="button" onClick={() => { setCenario(a => ({ ...a, base, atribuicoes: {}, niveis: {} })); setPincel(null); setConfirmarReset(false) }} style={{
              padding: '11px 13px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface-raised)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{titulo}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
            </button>
          ))}
          <button type="button" onClick={() => setConfirmarReset(false)} style={{ padding: '10px', borderRadius: '10px', border: 'none', background: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Uma linha da grade (horário + uma célula por dia), achatada dentro do CSS grid do pai.
function FragmentoLinha({ h, dias, celulas, render }) {
  return (
    <>
      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-light-secondary)', paddingTop: '8px', textAlign: 'right', paddingRight: '4px' }}>{h}</div>
      {dias.map(d => {
        const itens = celulas[`${d.chave}|${h}`] || []
        return (
          <div key={d.chave} style={{
            display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', borderRadius: '8px', minHeight: '34px', boxSizing: 'border-box',
            backgroundColor: 'var(--color-surface-light-base)', border: '1px solid var(--color-border-light-subtle)',
          }}>
            {itens.map(render)}
          </div>
        )
      })}
    </>
  )
}
