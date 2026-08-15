import { useState, useEffect } from 'react'
import { format, addDays, addWeeks, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Lock, Settings, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import useAppStore from '../../store/useAppStore'
import { useTurmas, useSalvarTurma } from '../../hooks/useTurmas'
import { useAulas, useGerarAulas, useSalvarPresencas, useReposicoesDoAluno, resolverReposicaoFIFO } from '../../hooks/useAulas'
import { useAlunos, useSalvarAluno } from '../../hooks/useAlunos'
import { useContratantes, useCriarContratante } from '../../hooks/useContratantes'
import { useHorariosAgenda, useCriarHorarioAgenda, useExcluirHorarioAgenda } from '../../hooks/useHorariosAgenda'
import { useColaboradores } from '../../hooks/useColaboradoresParticular'
import { useBloqueiosAgenda, useCriarBloqueioAgenda, useRemoverBloqueioAgenda } from '../../hooks/useBloqueiosAgenda'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] // index = Date.getDay()
// Rótulo curto do cabeçalho da grade — fixo na mão em vez de format(d,'EEE',{locale:ptBR}),
// que nessa versão do date-fns devolve o nome por extenso mesmo pedindo abreviado.
const LABEL_DIA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const STATUS_OPCOES = [
  { value: 'dada', label: 'Dada' },
  { value: 'nao_dada', label: 'Sem Aula' },
  { value: 'cancelada', label: 'Cancelada' },
]

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = {
  fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
}

// Agenda semanal do modo Particular — 7 colunas (seg-dom) em vez do dia único com colunas por
// quadra que a grade do clube usa (AulasCoordenador.jsx), porque aqui só existe UMA "coluna" de
// atividade (a do próprio profissional), sem quadra nenhuma. Não importa nada de
// AulasCoordenador/AulasAdmin — só os hooks de dados (useTurmas/useAulas/useGerarAulas), que já
// toleram turma/aula sem quadra_id (mesmo caminho da aula avulsa do clube).
export function AgendaParticular() {
  const qc = useQueryClient()
  const { empresaSelecionada } = useAppStore()
  const empresaId = empresaSelecionada?.id

  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const dias = Array.from({ length: 7 }, (_, i) => addDays(semanaBase, i))
  const dataInicio = format(semanaBase, 'yyyy-MM-dd')
  const dataFim = format(dias[6], 'yyyy-MM-dd')

  const { data: horarios = [], isLoading: loadingHorarios } = useHorariosAgenda(empresaId)
  const { data: turmas = [] } = useTurmas(null, empresaId)
  const { data: aulasSemana = [], isLoading: loadingAulas } = useAulas({ empresaId, dataInicio, dataFim })
  const { data: bloqueios = [] } = useBloqueiosAgenda(empresaId, dataInicio, dataFim)
  const { data: contratantes = [] } = useContratantes(empresaId)
  const { data: alunos = [] } = useAlunos(null, empresaId)
  const { data: colaboradores = [] } = useColaboradores(empresaId)

  const salvarTurma = useSalvarTurma()
  const gerarAulas = useGerarAulas()
  const salvarAluno = useSalvarAluno()
  const criarContratante = useCriarContratante()
  const criarHorario = useCriarHorarioAgenda()
  const excluirHorario = useExcluirHorarioAgenda()
  const criarBloqueio = useCriarBloqueioAgenda()
  const removerBloqueio = useRemoverBloqueioAgenda()
  const salvarPresencas = useSalvarPresencas()

  const turmasPosicionadas = turmas.filter(t => t.horario_dia_semana && t.horario_inicio)

  // Garante que toda turma já posicionada tem aula gerada na semana visível — sem cron, gera
  // sob demanda ao navegar (mesmo padrão de uso do useGerarAulas que já existe pro clube).
  useEffect(() => {
    if (!empresaId || turmasPosicionadas.length === 0) return
    turmasPosicionadas.forEach(t => {
      const diaSemanaNum = DIAS_SEMANA.indexOf(t.horario_dia_semana)
      const jaTemAula = aulasSemana.some(a => a.turma_id === t.id && a.data_aula >= dataInicio && a.data_aula <= dataFim)
      if (!jaTemAula && diaSemanaNum >= 0) {
        gerarAulas.mutate({ turmaId: t.id, dataInicio, dataFim })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, dataInicio, dataFim, turmasPosicionadas.map(t => t.id).join(',')])

  const [celulaVazia, setCelulaVazia] = useState(null) // { dataStr, horario } | null
  const [bloqueioAberto, setBloqueioAberto] = useState(null) // bloqueio row | null
  const [aulaAberta, setAulaAberta] = useState(null) // aula row | null
  const [gerenciandoHorarios, setGerenciandoHorarios] = useState(false)

  function celulaDoTipo(dataStr, horarioStr) {
    const bloqueio = bloqueios.find(b => b.data === dataStr && b.horario?.slice(0, 5) === horarioStr)
    if (bloqueio) return { tipo: 'bloqueio', bloqueio }
    // Mensal usa o horário da turma; avulsa (sem turma) usa o horário gravado na própria aula.
    const aula = aulasSemana.find(a => a.data_aula === dataStr &&
      (a.turmas?.horario_inicio?.slice(0, 5) === horarioStr || a.horario?.slice(0, 5) === horarioStr))
    if (aula) return { tipo: 'aula', aula }
    return { tipo: 'vazia' }
  }

  function labelAula(aula) {
    return aula.turmas?.nome || aula.contratantes?.nome || aula.presencas?.[0]?.alunos?.nome || 'Aula avulsa'
  }

  if (loadingHorarios || loadingAulas) return <Loading text="Carregando agenda..." />

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: 0 }}>Agenda</h1>
        <button onClick={() => setGerenciandoHorarios(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9px',
          border: '1px solid var(--color-border-light)', background: 'var(--color-surface-light-raised)',
          color: 'var(--color-text-light-secondary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
        }}>
          <Settings size={13} /> Horários
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => setSemanaBase(s => addWeeks(s, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-text-light-secondary)' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-light-primary)', textTransform: 'capitalize' }}>
          {format(semanaBase, "dd 'de' MMM", { locale: ptBR })} – {format(dias[6], "dd 'de' MMM", { locale: ptBR })}
        </div>
        <button onClick={() => setSemanaBase(s => addWeeks(s, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-text-light-secondary)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7, minmax(96px, 1fr))`, minWidth: '760px' }}>
          <div />
          {dias.map(d => (
            <div key={d.toISOString()} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8px', backgroundColor: format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'rgba(165,76,46,0.08)' : 'transparent' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-action-primary)', letterSpacing: '0.5px' }}>{LABEL_DIA_CURTO[d.getDay()]}</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginTop: '2px' }}>{format(d, 'dd/MM')}</div>
            </div>
          ))}

          {horarios.map(h => {
            const horarioStr = h.horario.slice(0, 5)
            return (
              <div key={h.id} style={{ display: 'contents' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '11px', color: 'var(--color-text-light-muted)' }}>
                  {horarioStr}
                </div>
                {dias.map(d => {
                  const dataStr = format(d, 'yyyy-MM-dd')
                  const cel = celulaDoTipo(dataStr, horarioStr)
                  if (cel.tipo === 'bloqueio') {
                    return (
                      <button key={dataStr} onClick={() => setBloqueioAberto(cel.bloqueio)} style={{
                        margin: '2px', padding: '8px 6px', borderRadius: '8px', minHeight: '44px',
                        border: '1px dashed var(--color-border-light)', background: 'rgba(122,122,122,0.08)',
                        color: 'var(--color-text-light-muted)', fontSize: '10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                      }}>
                        <Lock size={11} />
                        {cel.bloqueio.motivo || 'Bloqueado'}
                      </button>
                    )
                  }
                  if (cel.tipo === 'aula') {
                    return (
                      <button key={dataStr} onClick={() => setAulaAberta(cel.aula)} style={{
                        margin: '2px', padding: '8px 6px', borderRadius: '8px', minHeight: '44px',
                        border: '1px solid rgba(165,76,46,0.3)', background: 'rgba(165,76,46,0.08)',
                        color: 'var(--color-action-primary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        textAlign: 'left',
                      }}>
                        {labelAula(cel.aula)}
                      </button>
                    )
                  }
                  return (
                    <button key={dataStr} onClick={() => setCelulaVazia({ dataStr, horario: horarioStr })} style={{
                      margin: '2px', padding: '8px 6px', borderRadius: '8px', minHeight: '44px',
                      border: '1px dashed var(--color-border-light)', background: 'none', cursor: 'pointer',
                    }} />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {celulaVazia && (
        <ModalCelulaVazia
          dataStr={celulaVazia.dataStr}
          horario={celulaVazia.horario}
          contratantes={contratantes}
          alunos={alunos}
          onFechar={() => setCelulaVazia(null)}
          onCriarContratante={async (dados) => criarContratante.mutateAsync({ empresaId, ...dados })}
          onCriarAluno={async (dados) => salvarAluno.mutateAsync({ empresa_id: empresaId, ...dados })}
          onCriarAvulsa={async ({ contratanteId, alunoId, isReposicao }) => {
            const { data: aula, error } = await supabase.from('aulas').insert({
              turma_id: null, empresa_id: empresaId, data_aula: celulaVazia.dataStr,
              horario: celulaVazia.horario, professor_executou_id: null,
              status_aula: 'dada', paga_professor: false, contratante_id: contratanteId || null,
            }).select().single()
            if (error) throw error
            if (alunoId) {
              await supabase.from('presencas').insert({
                aula_id: aula.id, aluno_id: alunoId, presente: false,
                status_presenca: 'presente', tipo_participacao: isReposicao ? 'reposicao' : 'avulso',
              })
              if (isReposicao) await resolverReposicaoFIFO({ alunoId, aulaDestinoId: aula.id })
            }
            qc.invalidateQueries({ queryKey: ['aulas'] })
            qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
            qc.invalidateQueries({ queryKey: ['reposicoes_aluno'] })
            toast.success(isReposicao ? 'Aula avulsa criada e reposição consumida!' : 'Aula avulsa criada!')
            setCelulaVazia(null)
          }}
          onCriarMensal={async ({ nome, contratanteId, alunoId }) => {
            const diaSemana = DIAS_SEMANA[new Date(celulaVazia.dataStr + 'T12:00').getDay()]
            const turmaId = await salvarTurma.mutateAsync({
              nome, empresa_id: empresaId, horario_dia_semana: diaSemana, horario_inicio: celulaVazia.horario,
              contratante_id: contratanteId || null, alunos_ids: alunoId ? [alunoId] : [],
            })
            await gerarAulas.mutateAsync({ turmaId, dataInicio, dataFim })
            toast.success('Turma criada e posicionada!')
            setCelulaVazia(null)
          }}
          onCongelar={async (motivo) => {
            await criarBloqueio.mutateAsync({ empresaId, data: celulaVazia.dataStr, horario: celulaVazia.horario, motivo })
            toast.success('Horário congelado.')
            setCelulaVazia(null)
          }}
        />
      )}

      {bloqueioAberto && (
        <Modal open onClose={() => setBloqueioAberto(null)} title="Horário congelado" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bloqueioAberto.motivo || 'Sem motivo informado.'}</div>
            <button
              onClick={async () => {
                await removerBloqueio.mutateAsync(bloqueioAberto.id)
                toast.success('Congelamento removido.')
                setBloqueioAberto(null)
              }}
              style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-state-danger)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >Remover congelamento</button>
          </div>
        </Modal>
      )}

      {aulaAberta && (
        <ModalAula
          aula={aulaAberta}
          alunos={alunos}
          colaboradores={colaboradores}
          onFechar={() => setAulaAberta(null)}
          onSalvar={async (statusAula, observacoes, presencasEdit, substitutoId, valorSubstituto) => {
            await supabase.from('aulas').update({
              status_aula: statusAula,
              paga_professor: statusAula === 'dada',
              observacoes: observacoes || null,
              professor_executou_id: substitutoId || null,
              valor_substituto: substitutoId ? (valorSubstituto || null) : null,
              atualizado_em: new Date().toISOString(),
            }).eq('id', aulaAberta.id)
            if (presencasEdit.length > 0) {
              await salvarPresencas.mutateAsync({ aulaId: aulaAberta.id, presencas: presencasEdit })
            } else {
              qc.invalidateQueries({ queryKey: ['aulas'] })
            }
            toast.success('Aula atualizada!')
            setAulaAberta(null)
          }}
        />
      )}

      {gerenciandoHorarios && (
        <ModalHorarios
          empresaId={empresaId}
          horarios={horarios}
          onFechar={() => setGerenciandoHorarios(false)}
          onAdicionar={async (horario) => { await criarHorario.mutateAsync({ empresaId, horario }) }}
          onRemover={async (id) => { await excluirHorario.mutateAsync(id) }}
        />
      )}
    </div>
  )
}

// Contratante + (se contratante.tipo === 'aluno') aluno — compartilhado entre as abas Avulsa e
// Mensal. Cada um tem seu próprio "+ novo" inline, pra nunca precisar sair do fluxo de agendar
// só pra ir cadastrar um contratante/aluno primeiro.
function SeletorContratanteAluno({ contratantes, alunos, contratanteId, setContratanteId, alunoId, setAlunoId, onCriarContratante, onCriarAluno }) {
  const [novoContratante, setNovoContratante] = useState(null) // { nome } | null
  const [novoAluno, setNovoAluno] = useState(null) // { nome } | null
  const [salvandoContratante, setSalvandoContratante] = useState(false)
  const [salvandoAluno, setSalvandoAluno] = useState(false)

  const contratanteSel = contratantes.find(c => c.id === contratanteId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div style={labelStyle}>Contratante</div>
        {novoContratante ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input style={inputStyle} placeholder="Nome (ex: Beyond, Clube Pinheiros)" value={novoContratante.nome}
              onChange={e => setNovoContratante({ nome: e.target.value })} autoFocus />
            <button disabled={!novoContratante.nome.trim() || salvandoContratante} onClick={async () => {
              setSalvandoContratante(true)
              try {
                const c = await onCriarContratante({ nome: novoContratante.nome.trim(), tipo: 'terceiro', tipoCobranca: null })
                setContratanteId(c.id)
                setNovoContratante(null)
              } catch (err) { toast.error(err.message) } finally { setSalvandoContratante(false) }
            }} style={{ flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              {salvandoContratante ? '...' : 'Salvar'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <select style={inputStyle} value={contratanteId || ''} onChange={e => { setContratanteId(e.target.value); setAlunoId('') }}>
              <option value="" disabled>Selecione</option>
              {contratantes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button onClick={() => setNovoContratante({ nome: '' })} title="Novo contratante" style={{
              flexShrink: 0, padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><Plus size={14} /></button>
          </div>
        )}
      </div>

      {contratanteSel?.tipo === 'aluno' && (
        <div>
          <div style={labelStyle}>Aluno</div>
          {novoAluno ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={inputStyle} placeholder="Nome do aluno" value={novoAluno.nome}
                onChange={e => setNovoAluno({ nome: e.target.value })} autoFocus />
              <button disabled={!novoAluno.nome.trim() || salvandoAluno} onClick={async () => {
                setSalvandoAluno(true)
                try {
                  const a = await onCriarAluno({ nome: novoAluno.nome.trim(), tipo_cobranca: 'por_aula' })
                  setAlunoId(a.id)
                  setNovoAluno(null)
                } catch (err) { toast.error(err.message) } finally { setSalvandoAluno(false) }
              }} style={{ flexShrink: 0, padding: '10px 14px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {salvandoAluno ? '...' : 'Salvar'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <select style={inputStyle} value={alunoId || ''} onChange={e => setAlunoId(e.target.value)}>
                <option value="" disabled>Selecione</option>
                {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <button onClick={() => setNovoAluno({ nome: '' })} title="Novo aluno" style={{
                flexShrink: 0, padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}><Plus size={14} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModalCelulaVazia({ dataStr, horario, contratantes, alunos, onFechar, onCriarContratante, onCriarAluno, onCriarAvulsa, onCriarMensal, onCongelar }) {
  const [aba, setAba] = useState('avulsa') // 'avulsa' | 'mensal' | 'congelar'
  const [contratanteId, setContratanteId] = useState(() => contratantes.find(c => c.nome === 'Particular')?.id || '')
  const [alunoId, setAlunoId] = useState('')
  const [nomeTurma, setNomeTurma] = useState('')
  const [motivo, setMotivo] = useState('')
  const [isReposicao, setIsReposicao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const { data: reposicoesAluno = [] } = useReposicoesDoAluno(aba === 'avulsa' ? alunoId : null)
  const reposicoesPendentes = reposicoesAluno.filter(r => r.status === 'pendente')

  async function rodar(fn) {
    setSalvando(true)
    try { await fn() } catch (err) { toast.error(err.message) } finally { setSalvando(false) }
  }

  const alunoEscolhido = alunos.find(a => a.id === alunoId)

  return (
    <Modal open onClose={onFechar} title={`${format(new Date(dataStr + 'T12:00'), "dd/MM", { locale: ptBR })} · ${horario}`} size="sm">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: 'var(--surface)', borderRadius: '10px', padding: '4px' }}>
        {[{ key: 'avulsa', label: 'Avulsa' }, { key: 'mensal', label: 'Mensal' }, { key: 'congelar', label: 'Congelar' }].map(t => (
          <button key={t.key} onClick={() => setAba(t.key)} style={{
            flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
            background: aba === t.key ? 'var(--color-action-primary)' : 'transparent',
            color: aba === t.key ? 'white' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {(aba === 'avulsa' || aba === 'mensal') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {aba === 'mensal' && (
            <div>
              <div style={labelStyle}>Nome da turma (opcional — usa o nome do aluno se vazio)</div>
              <input style={inputStyle} placeholder="Ex: nome do aluno" value={nomeTurma} onChange={e => setNomeTurma(e.target.value)} />
            </div>
          )}
          <SeletorContratanteAluno
            contratantes={contratantes} alunos={alunos}
            contratanteId={contratanteId} setContratanteId={setContratanteId}
            alunoId={alunoId} setAlunoId={id => { setAlunoId(id); setIsReposicao(false) }}
            onCriarContratante={onCriarContratante} onCriarAluno={onCriarAluno}
          />
          {aba === 'avulsa' && alunoId && reposicoesPendentes.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isReposicao} onChange={e => setIsReposicao(e.target.checked)} />
              Usar reposição pendente ({reposicoesPendentes.length} {reposicoesPendentes.length === 1 ? 'disponível' : 'disponíveis'})
            </label>
          )}
          <button
            disabled={!contratanteId || salvando}
            onClick={() => rodar(() => aba === 'avulsa'
              ? onCriarAvulsa({ contratanteId, alunoId: alunoId || null, isReposicao })
              : onCriarMensal({ nome: nomeTurma.trim() || alunoEscolhido?.nome || 'Aula', contratanteId, alunoId: alunoId || null })
            )}
            style={{
              padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: !contratanteId ? 0.5 : 1,
            }}
          >{salvando ? 'Salvando...' : aba === 'avulsa' ? 'Criar aula avulsa' : 'Criar e posicionar aqui'}</button>
        </div>
      )}

      {aba === 'congelar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input style={inputStyle} placeholder="Motivo (ex: deslocamento)" value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus />
          <button disabled={salvando} onClick={() => rodar(() => onCongelar(motivo.trim()))} style={{
            padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-state-danger)', color: 'white',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>{salvando ? 'Salvando...' : 'Congelar este horário'}</button>
        </div>
      )}
    </Modal>
  )
}

function ModalAula({ aula, alunos, colaboradores, onFechar, onSalvar }) {
  const [status, setStatus] = useState(aula.status_aula || 'dada')
  const [observacoes, setObservacoes] = useState(aula.observacoes || '')
  const [presencasEdit, setPresencasEdit] = useState(() =>
    (aula.presencas || []).map(p => ({
      aluno_id: p.aluno_id, nome: p.alunos?.nome || 'Aluno', tipo_participacao: p.tipo_participacao,
      status_presenca: p.status_presenca || 'presente',
    }))
  )
  const [substitutoId, setSubstitutoId] = useState(aula.professor_executou_id || '')
  const [valorSubstituto, setValorSubstituto] = useState(aula.valor_substituto ?? '')
  const [salvando, setSalvando] = useState(false)

  function escolherSubstituto(id) {
    setSubstitutoId(id)
    const colaborador = colaboradores?.find(c => c.id === id)
    setValorSubstituto(colaborador?.valor_aula_combinado ?? '')
  }

  function marcar(alunoId, statusPresenca) {
    setPresencasEdit(lista => lista.map(p => p.aluno_id === alunoId ? { ...p, status_presenca: statusPresenca } : p))
  }

  return (
    <Modal open onClose={onFechar} title={aula.turmas?.nome || aula.contratantes?.nome || aula.presencas?.[0]?.alunos?.nome || 'Aula avulsa'} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {format(new Date(aula.data_aula + 'T12:00'), "dd/MM 'às' ", { locale: ptBR })}{aula.turmas?.horario_inicio?.slice(0, 5) || aula.horario?.slice(0, 5)}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {STATUS_OPCOES.map(o => (
            <button key={o.value} onClick={() => setStatus(o.value)} style={{
              flex: 1, padding: '9px', borderRadius: '9px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
              border: `1px solid ${status === o.value ? 'var(--color-action-primary)' : 'var(--border)'}`,
              background: status === o.value ? 'rgba(165,76,46,0.12)' : 'var(--surface)',
              color: status === o.value ? 'var(--color-action-primary)' : 'var(--text-secondary)',
            }}>{o.label}</button>
          ))}
        </div>

        {presencasEdit.length > 0 && (
          <div>
            <div style={labelStyle}>Presença</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {presencasEdit.map(p => {
                const alunoCad = alunos?.find(a => a.id === p.aluno_id)
                const faltouStatus = alunoCad?.direito_reposicao ? 'falta_justificada' : 'falta'
                const faltou = p.status_presenca === 'falta_justificada' || p.status_presenca === 'falta'
                return (
                  <div key={p.aluno_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{p.nome}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => marcar(p.aluno_id, 'presente')} style={{
                        padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        border: `1px solid ${!faltou ? 'var(--color-state-success)' : 'var(--border)'}`,
                        background: !faltou ? 'rgba(75,139,106,0.12)' : 'var(--surface)',
                        color: !faltou ? 'var(--color-state-success)' : 'var(--text-secondary)',
                      }}>Presente</button>
                      <button onClick={() => marcar(p.aluno_id, faltouStatus)} style={{
                        padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        border: `1px solid ${faltou ? 'var(--color-state-danger)' : 'var(--border)'}`,
                        background: faltou ? 'rgba(180,71,47,0.12)' : 'var(--surface)',
                        color: faltou ? 'var(--color-state-danger)' : 'var(--text-secondary)',
                      }}>Faltou</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {colaboradores?.length > 0 && (
          <div>
            <div style={labelStyle}>Substituto (opcional)</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select style={inputStyle} value={substitutoId} onChange={e => escolherSubstituto(e.target.value)}>
                <option value="">Nenhum — dei a aula</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {substitutoId && (
                <input type="number" style={{ ...inputStyle, width: '110px', flexShrink: 0 }} placeholder="Valor (R$)"
                  value={valorSubstituto} onChange={e => setValorSubstituto(e.target.value)} />
              )}
            </div>
          </div>
        )}

        <textarea
          style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Observação (opcional)"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
        />
        <button
          disabled={salvando}
          onClick={async () => {
            setSalvando(true)
            await onSalvar(status, observacoes.trim(), presencasEdit, substitutoId || null, valorSubstituto ? Number(valorSubstituto) : null)
            setSalvando(false)
          }}
          style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  )
}

function ModalHorarios({ horarios, onFechar, onAdicionar, onRemover }) {
  const [novoHorario, setNovoHorario] = useState('')
  const [salvando, setSalvando] = useState(false)

  return (
    <Modal open onClose={onFechar} title="Horários da agenda" size="sm">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input type="time" style={inputStyle} value={novoHorario} onChange={e => setNovoHorario(e.target.value)} />
        <button
          disabled={!novoHorario || salvando}
          onClick={async () => {
            setSalvando(true)
            try { await onAdicionar(novoHorario); setNovoHorario('') }
            catch (err) { toast.error(err.message) }
            finally { setSalvando(false) }
          }}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 14px', borderRadius: '10px',
            border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', opacity: !novoHorario ? 0.5 : 1,
          }}
        ><Plus size={13} /> Adicionar</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
        {horarios.map(h => (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--surface)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{h.horario.slice(0, 5)}</span>
            <button onClick={() => onRemover(h.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)',
              display: 'flex', alignItems: 'center', padding: '4px',
            }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
