import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ChevronDown, ChevronRight, CloudRain, Plus, Save, Trash2, UserPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { Modal } from '../../components/ui/Modal'
import { useSalvarPresencas, useAtualizarStatusAula } from '../../hooks/useAulas'
import { useAlunos } from '../../hooks/useAlunos'
import { QUADRAS_EMPRESA } from '../../hooks/useFinanceiro'
import { calcularValorAula, emEscopoRegraValorGrupo, diaSemanaDaData } from '../../constants/modalidades'

// Aulas de um professor numa data, editáveis — aberto pelo gestor/coordenador no card do professor
// (Cadastros > Professores) pra ajustar o fechamento sem ir até a agenda: status da aula, alunos
// (presença e tipo), incluir/excluir aula. Reaproveita as mesmas mutações da agenda
// (useSalvarPresencas, useAtualizarStatusAula) pra manter reposições/pagamento consistentes.
// O professor continua vendo só a versão de leitura (ModalDetalhesDia).

const STATUS = [
  { chave: 'dada', rotulo: 'Confirmada' },
  { chave: 'chuva', rotulo: 'Cancelada por chuva' },
  { chave: 'cancelada', rotulo: 'Cancelada (outro motivo)' },
]
const PRESENCA = [['presente', 'Presente'], ['falta', 'Falta'], ['falta_justificada', 'Falta just.']]
const TIPOS = [['mensalista', 'Mensalista'], ['avulso', 'Avulso'], ['reposicao', 'Reposição'], ['cortesia', 'Cortesia']]

const fmtBRL = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const parteObs = obs => (obs || '').split('·').map(s => s.trim())
const nomeAula = a => a.turmas?.nome || parteObs(a.observacoes)[3] || 'Avulsa'
const horaAula = a => a.turmas?.horario_inicio?.slice(0, 5) || parteObs(a.observacoes)[2] || ''
const statusDe = a => (a.status_aula === 'cancelada' ? (a.motivo_cancelamento === 'Chuva' ? 'chuva' : 'cancelada') : 'dada')

const input = {
  padding: '6px 8px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--border)',
  backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)',
}
const botao = (cor, cheio) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 12px', borderRadius: '9px',
  fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: cheio ? 'none' : `1px solid ${cor}`,
  backgroundColor: cheio ? cor : 'transparent', color: cheio ? 'var(--color-action-on-primary)' : cor,
})

function invalidar(qc) {
  ;['aulas', 'aulas_professor', 'aulas_dia_prof_detalhe', 'aulas-dia-editavel', 'fin_detalhe_dia', 'fin_custos_prof', 'fin_aulas_prof', 'fin_aulas_ano_prof', 'relatorio_repos']
    .forEach(k => qc.invalidateQueries({ queryKey: [k] }))
}

function EditorAula({ aula, professor, alunos, onFechar }) {
  const qc = useQueryClient()
  const salvarPresencas = useSalvarPresencas()
  const atualizarStatus = useAtualizarStatusAula()
  const [status, setStatus] = useState(statusDe(aula))
  const [lista, setLista] = useState(() => (aula.presencas || []).filter(p => p.alunos).map(p => ({
    aluno_id: p.aluno_id, nome: p.alunos.nome, status_presenca: p.status_presenca || 'presente', tipo_participacao: p.tipo_participacao || 'mensalista',
  })))
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (q.length < 2) return []
    const ja = new Set(lista.map(p => p.aluno_id))
    return (alunos || []).filter(a => !ja.has(a.id) && a.nome?.toLowerCase().includes(q)).slice(0, 8)
  }, [busca, alunos, lista])

  const muda = (id, campo, valor) => setLista(l => l.map(p => (p.aluno_id === id ? { ...p, [campo]: valor } : p)))

  async function salvar() {
    setSalvando(true)
    try {
      const antes = new Set((aula.presencas || []).map(p => p.aluno_id))
      const agora = new Set(lista.map(p => p.aluno_id))
      const removidos = [...antes].filter(id => !agora.has(id))
      const novos = [...agora].filter(id => !antes.has(id))
      if (removidos.length) {
        const { error } = await supabase.from('presencas').delete().eq('aula_id', aula.id).in('aluno_id', removidos)
        if (error) throw error
      }
      // Inclusão aqui vale só para esta aula (não matricula na turma) — é ajuste de fechamento.
      if (lista.length) await salvarPresencas.mutateAsync({ aulaId: aula.id, presencas: lista, idsNovos: novos })

      if (status !== statusDe(aula)) {
        const statusAula = status === 'dada' ? 'dada' : 'cancelada'
        const motivo = status === 'chuva' ? 'Chuva' : status === 'cancelada' ? 'Outro' : null
        // Mesma regra da agenda: chuva dentro do escopo (Tênis / Padel do Marcelo) paga 50%,
        // outro cancelamento não paga, confirmada paga.
        const pagaProfessor = status === 'dada' ? true : status === 'chuva' && emEscopoRegraValorGrupo(aula, professor?.id)
        await atualizarStatus.mutateAsync({ aulaId: aula.id, statusAula, pagaProfessor, motivoCancelamento: motivo })
      }
      await logAudit('aulas', aula.id, 'UPDATE',
        { turma: nomeAula(aula), horario: horaAula(aula), data: aula.data_aula, status: statusDe(aula), alunos: (aula.presencas || []).map(p => p.alunos?.nome).filter(Boolean) },
        { origem: 'card do professor', status, alunos: lista.map(p => `${p.nome} (${p.tipo_participacao}, ${p.status_presenca})`) })
      invalidar(qc)
      toast.success('Aula atualizada')
      onFechar()
    } catch (e) { toast.error('Não foi possível salvar: ' + e.message) }
    finally { setSalvando(false) }
  }

  async function excluir() {
    setSalvando(true)
    try {
      await supabase.from('presencas').delete().eq('aula_id', aula.id)
      await supabase.from('reposicoes').delete().eq('aula_origem_id', aula.id)
      const { error } = await supabase.from('aulas').delete().eq('id', aula.id)
      if (error) throw error
      await logAudit('aulas', aula.id, 'DELETE',
        { turma: nomeAula(aula), horario: horaAula(aula), data: aula.data_aula, professor: professor?.nome, alunos: (aula.presencas || []).map(p => p.alunos?.nome).filter(Boolean), origem: 'card do professor' }, null)
      invalidar(qc)
      toast.success('Aula excluída')
      onFechar()
    } catch (e) { toast.error('Não foi possível excluir: ' + e.message) }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {STATUS.map(s => (
          <button key={s.chave} type="button" onClick={() => setStatus(s.chave)} style={{
            padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${status === s.chave ? 'var(--color-action-primary)' : 'var(--border)'}`,
            backgroundColor: status === s.chave ? 'var(--color-action-primary)' : 'transparent',
            color: status === s.chave ? 'var(--color-action-on-primary)' : 'var(--text-secondary)',
          }}>{s.rotulo}</button>
        ))}
      </div>
      {status === 'chuva' && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ao salvar, os alunos ficam com falta justificada e ganham crédito de reposição (igual à agenda).</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {lista.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhum aluno nesta aula.</div>}
        {lista.map(p => (
          <div key={p.aluno_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <span style={{ flex: '1 1 140px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.nome}</span>
            <select value={p.status_presenca} onChange={e => muda(p.aluno_id, 'status_presenca', e.target.value)} style={input}>
              {PRESENCA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <select value={p.tipo_participacao} onChange={e => muda(p.aluno_id, 'tipo_participacao', e.target.value)} style={input}>
              {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <button type="button" title="Tirar desta aula" onClick={() => setLista(l => l.filter(x => x.aluno_id !== p.aluno_id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)', display: 'flex', padding: '4px' }}><X size={14} /></button>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserPlus size={14} style={{ color: 'var(--text-muted)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Incluir aluno (digite o nome)" style={{ ...input, flex: 1 }} />
        </div>
        {sugestoes.length > 0 && (
          <div style={{ marginTop: '4px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {sugestoes.map(a => (
              <button key={a.id} type="button" onClick={() => { setLista(l => [...l, { aluno_id: a.id, nome: a.nome, status_presenca: 'presente', tipo_participacao: 'mensalista' }]); setBusca('') }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: '12px', border: 'none', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                {a.nome}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Aluno incluído aqui entra só nesta aula (não é matriculado na turma).</div>
      </div>

      {confirmarExclusao ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '9px', borderRadius: '9px', backgroundColor: 'color-mix(in srgb, var(--color-state-danger) 8%, transparent)' }}>
          <span style={{ flex: '1 1 160px', fontSize: '12px', color: 'var(--color-state-danger)', fontWeight: 600 }}>Excluir esta aula e a lista de alunos dela?</span>
          <button type="button" onClick={() => setConfirmarExclusao(false)} style={botao('var(--text-secondary)')}>Não</button>
          <button type="button" disabled={salvando} onClick={excluir} style={botao('var(--color-state-danger)', true)}><Trash2 size={13} /> Sim, excluir</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button type="button" onClick={() => setConfirmarExclusao(true)} style={botao('var(--color-state-danger)')}><Trash2 size={13} /> Excluir aula</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onFechar} style={botao('var(--text-secondary)')}>Cancelar</button>
          <button type="button" disabled={salvando} onClick={salvar} style={botao('var(--color-action-primary)', true)}><Save size={13} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      )}
    </div>
  )
}

function NovaAula({ professor, dataStr, onCriada, onCancelar }) {
  const qc = useQueryClient()
  const diaSemana = diaSemanaDaData(dataStr)
  const [turmaId, setTurmaId] = useState('')
  const [comAlunos, setComAlunos] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [existente, setExistente] = useState(null)

  const { data: turmas = [] } = useQuery({
    queryKey: ['turmas-dia-semana', diaSemana],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas')
        .select('id, nome, horario_inicio, professor_titular_id, empresa_id, contratante_id, modalidades(nome), turmas_alunos(aluno_id, ativo)')
        .eq('ativo', true).is('empresa_id', null).eq('horario_dia_semana', diaSemana).order('horario_inicio')
      if (error) throw error
      return data || []
    },
  })
  const ordenadas = useMemo(() => [...turmas].sort((a, b) =>
    (b.professor_titular_id === professor.id) - (a.professor_titular_id === professor.id) || (a.horario_inicio || '').localeCompare(b.horario_inicio || '')), [turmas, professor.id])
  const turma = turmas.find(t => t.id === turmaId)
  const matriculados = (turma?.turmas_alunos || []).filter(a => a.ativo).map(a => a.aluno_id)

  async function criar() {
    if (!turma) return
    setSalvando(true)
    try {
      const { data: ja } = await supabase.from('aulas').select('id, professor_executou_id, professores!professor_executou_id(nome)').eq('turma_id', turma.id).eq('data_aula', dataStr)
      if (ja?.length) { setExistente(ja[0]); return }
      const { data: nova, error } = await supabase.from('aulas').insert({
        turma_id: turma.id, data_aula: dataStr, professor_executou_id: professor.id, professor_titular_id: turma.professor_titular_id,
        empresa_id: turma.empresa_id || null, contratante_id: turma.contratante_id || null,
        status: 'confirmada_coord', status_aula: 'dada', paga_professor: true, eh_substituicao: turma.professor_titular_id !== professor.id,
      }).select('id').single()
      if (error) throw error
      if (comAlunos && matriculados.length) {
        const { error: e2 } = await supabase.from('presencas').insert(matriculados.map(aluno_id => ({
          aula_id: nova.id, aluno_id, presente: true, status_presenca: 'presente', tipo_participacao: 'mensalista',
        })))
        if (e2) throw e2
      }
      await logAudit('aulas', nova.id, 'INSERT', null, { turma: turma.nome, data: dataStr, professor: professor.nome, origem: 'card do professor' })
      invalidar(qc)
      toast.success('Aula incluída')
      onCriada(nova.id)
    } catch (e) { toast.error('Não foi possível incluir: ' + e.message) }
    finally { setSalvando(false) }
  }

  async function trazerParaEste() {
    setSalvando(true)
    try {
      const { error } = await supabase.from('aulas').update({ professor_executou_id: professor.id, eh_substituicao: turma.professor_titular_id !== professor.id }).eq('id', existente.id)
      if (error) throw error
      await logAudit('aulas', existente.id, 'UPDATE', { professor: existente.professores?.nome }, { professor: professor.nome, origem: 'card do professor' })
      invalidar(qc)
      toast.success(`Aula passada para ${professor.nome}`)
      onCriada(existente.id)
    } catch (e) { toast.error(e.message) }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ padding: '12px', borderRadius: '12px', border: '1px dashed var(--color-action-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Incluir aula neste dia</div>
      <select value={turmaId} onChange={e => { setTurmaId(e.target.value); setExistente(null) }} style={{ ...input, padding: '9px 10px', fontSize: '13px' }}>
        <option value="">Escolha a turma ({diaSemana})...</option>
        {ordenadas.map(t => (
          <option key={t.id} value={t.id}>{t.horario_inicio?.slice(0, 5)} · {t.nome}{t.professor_titular_id === professor.id ? ' ★' : ''}</option>
        ))}
      </select>
      {turma && matriculados.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={comAlunos} onChange={e => setComAlunos(e.target.checked)} style={{ accentColor: 'var(--color-action-primary)' }} />
          Já colocar os {matriculados.length} alunos matriculados (como presentes)
        </label>
      )}
      {existente && (
        <div style={{ fontSize: '12px', color: 'var(--color-state-warning)', lineHeight: 1.5 }}>
          Essa turma já tem aula nesse dia{existente.professor_executou_id === professor.id ? ' com este mesmo professor.' : `, com ${existente.professores?.nome || 'outro professor'}.`}
          {existente.professor_executou_id !== professor.id && (
            <div style={{ marginTop: '6px' }}>
              <button type="button" disabled={salvando} onClick={trazerParaEste} style={botao('var(--color-action-primary)', true)}>Passar essa aula para {professor.apelido || professor.nome}</button>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancelar} style={botao('var(--text-secondary)')}>Cancelar</button>
        <button type="button" disabled={!turma || salvando} onClick={criar} style={{ ...botao('var(--color-action-primary)', true), opacity: turma ? 1 : 0.5 }}><Plus size={13} /> Incluir aula</button>
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>★ = turma em que ele é o titular. Aula avulsa (sem turma) continua sendo criada pela agenda.</div>
    </div>
  )
}

// `empresa` (opcional, 'procopio' | 'beach_arena'): vindo do Financeiro, mostra só as aulas das
// quadras daquela empresa e calcula o valor com a regra dela — igual à lista do Financeiro.
export function ModalAulasDiaEditavel({ professor, dataStr: dataInicial, onClose, empresa = null }) {
  const [dataStr, setDataStr] = useState(dataInicial)
  const [aberta, setAberta] = useState(null)
  const [incluindo, setIncluindo] = useState(false)
  const { data: alunos } = useAlunos()

  const { data: aulas = [], isLoading } = useQuery({
    queryKey: ['aulas-dia-editavel', professor.id, dataStr, empresa],
    queryFn: async () => {
      const { data, error } = await supabase.from('aulas')
        .select('id, data_aula, turma_id, observacoes, status_aula, motivo_cancelamento, paga_professor, turmas(nome, horario_inicio, quadras(nome), niveis(nome), modalidades(nome), eh_turma_reposicao), presencas(aluno_id, status_presenca, tipo_participacao, presente, status_inclusao_professor, alunos(nome))')
        .eq('professor_executou_id', professor.id).eq('data_aula', dataStr)
      if (error) throw error
      const quadras = empresa ? QUADRAS_EMPRESA[empresa] || [] : null
      const daEmpresa = a => !quadras || quadras.includes(a.turma_id ? a.turmas?.quadras?.nome || '' : parteObs(a.observacoes)[1])
      return (data || []).filter(daEmpresa).sort((a, b) => horaAula(a).localeCompare(horaAula(b)))
    },
  })

  const valor = a => (a.paga_professor && ['dada', 'cancelada'].includes(a.status_aula) ? calcularValorAula(a, professor, empresa) : 0)
  const totalDia = aulas.reduce((s, a) => s + valor(a), 0)

  return (
    <Modal open onClose={onClose} size="xl" title={`${professor.apelido || professor.nome} · aulas do dia`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <input type="date" value={dataStr} onChange={e => { if (e.target.value) { setDataStr(e.target.value); setAberta(null); setIncluindo(false) } }} style={{ ...input, padding: '8px 10px', fontSize: '13px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{format(parseISO(dataStr), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
          <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{aulas.length} aula{aulas.length === 1 ? '' : 's'} · {fmtBRL(totalDia)}</span>
        </div>

        {isLoading && <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px', textAlign: 'center' }}>Carregando...</div>}
        {!isLoading && aulas.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>Nenhuma aula deste professor nesse dia.</div>}

        {aulas.map(a => {
          const st = statusDe(a)
          const ps = (a.presencas || []).filter(p => p.alunos)
          const corSt = st === 'dada' ? 'var(--color-state-success)' : st === 'chuva' ? 'var(--color-state-info)' : 'var(--color-state-danger)'
          return (
            <div key={a.id} style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' }}>
              <button type="button" onClick={() => { setAberta(x => (x === a.id ? null : a.id)); setIncluindo(false) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                {aberta === a.id ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-action-primary)', minWidth: '40px' }}>{horaAula(a)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeAula(a)}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {ps.length ? ps.map(p => p.alunos.nome.trim().split(/\s+/)[0]).join(', ') : 'sem alunos'}
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: corSt, whiteSpace: 'nowrap' }}>
                  {st === 'chuva' ? <CloudRain size={12} /> : st === 'dada' ? <Check size={12} /> : <X size={12} />}{STATUS.find(s => s.chave === st).rotulo}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', minWidth: '62px', textAlign: 'right' }}>{fmtBRL(valor(a))}</span>
              </button>
              {aberta === a.id && <EditorAula key={a.id} aula={a} professor={professor} alunos={alunos} onFechar={() => setAberta(null)} />}
            </div>
          )
        })}

        {incluindo
          ? <NovaAula professor={professor} dataStr={dataStr} onCancelar={() => setIncluindo(false)} onCriada={id => { setIncluindo(false); setAberta(id) }} />
          : (
            <button type="button" onClick={() => { setIncluindo(true); setAberta(null) }} style={{ ...botao('var(--color-action-primary)'), borderStyle: 'dashed', padding: '11px' }}>
              <Plus size={14} /> Incluir aula neste dia
            </button>
          )}
      </div>
    </Modal>
  )
}
