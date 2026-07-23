import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft } from 'lucide-react'
import { useAulasDiaParaReposicao, useReposicoesDoAluno, useAgendarSlotAluno } from '../../hooks/useAulas'
import { useAlunos } from '../../hooks/useAlunos'
import { supabase } from '../../lib/supabase'
import { isAulaIndividual, VAGAS_INDIVIDUAL, VAGAS_GRUPO } from '../../constants/modalidades'
import { calcStatusPorPrazo } from '../../constants/reposicao'
import { Loading } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

// Placeholder — ainda não existe tabela de preço por plano/modalidade. Ajustar aqui até
// que isso exista.
const VALOR_AVULSA_PLACEHOLDER = 80

export function AgendaAluno() {
  const location = useLocation()
  const navigate = useNavigate()

  const [alunoId, setAlunoId] = useState(location.state?.alunoId || null)
  const [alunoNome, setAlunoNome] = useState(location.state?.alunoNome || '')
  const [modalidadeFiltro, setModalidadeFiltro] = useState(location.state?.modalidadeId || null)
  const [busca, setBusca] = useState('')
  const [dataSel, setDataSel] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [slotSel, setSlotSel] = useState(null)
  const [modalidadesAluno, setModalidadesAluno] = useState([])

  const { data: todosAlunos } = useAlunos()
  const { data: aulasData, isLoading: loadingDia } = useAulasDiaParaReposicao(alunoId ? dataSel : null)
  const { data: reposicoesAluno } = useReposicoesDoAluno(alunoId)
  const agendar = useAgendarSlotAluno()

  useEffect(() => {
    if (!alunoId) return
    supabase.from('alunos_modalidades').select('modalidade_id').eq('aluno_id', alunoId)
      .then(({ data }) => setModalidadesAluno((data || []).map(m => m.modalidade_id)))
  }, [alunoId])

  const alunosFiltrados = busca.length >= 2
    ? (todosAlunos || []).filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
    : []

  function selecionarAluno(a) {
    setAlunoId(a.id)
    setAlunoNome(a.nome)
    setBusca('')
    setSlotSel(null)
  }

  const proxDias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return format(d, 'yyyy-MM-dd')
  })

  const aulasDoDia = (aulasData || [])
    .filter(a => modalidadesAluno.length === 0 || modalidadesAluno.includes(a.turmas?.modalidade_id))
    .filter(a => !modalidadeFiltro || a.turmas?.modalidade_id === modalidadeFiltro)
    .map(a => {
      const capacidade = isAulaIndividual(a) ? VAGAS_INDIVIDUAL : VAGAS_GRUPO
      const ocupacao = a.presencas?.length || 0
      const jaEsta = a.presencas?.some(p => p.aluno_id === alunoId)
      const vagas = capacidade - ocupacao
      const reposicaoPendente = (reposicoesAluno || []).find(r =>
        r.status === 'pendente' &&
        r.modalidade_id === a.turmas?.modalidade_id &&
        (!r.data_limite || r.data_limite >= format(new Date(), 'yyyy-MM-dd'))
      )
      return { ...a, capacidade, ocupacao, jaEsta, vagas, reposicaoPendente }
    })
    .sort((a, b) => (a.turmas?.horario_inicio || '').localeCompare(b.turmas?.horario_inicio || ''))

  async function handleConfirmar(usarReposicao) {
    if (!slotSel || !alunoId) return
    try {
      await agendar.mutateAsync({
        aulaId: slotSel.id,
        alunoId,
        tipoParticipacao: usarReposicao ? 'reposicao' : 'avulso',
        valorCobrado: usarReposicao ? null : VALOR_AVULSA_PLACEHOLDER,
      })
      toast.success(
        usarReposicao ? 'Reposição agendada!' : `Aula avulsa agendada — R$ ${VALOR_AVULSA_PLACEHOLDER}`,
        { style: toastStyle }
      )
      setSlotSel(null)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 22px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: 'var(--color-action-primary)', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: 0 }}>
          Agendar reposição / aula avulsa
        </h1>
      </div>

      {/* Busca do aluno */}
      {!alunoId ? (
        <div>
          <input
            autoFocus
            placeholder="Buscar aluno..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '10px', border: 'none',
              outline: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)',
              color: 'var(--color-text-light-primary)', fontSize: '14px', boxSizing: 'border-box', marginBottom: '10px',
            }}
          />
          {alunosFiltrados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alunosFiltrados.map(a => (
                <button key={a.id} onClick={() => selecionarAluno(a)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderRadius: '10px', border: 'none', backgroundColor: 'var(--color-surface-light-raised)',
                  color: 'var(--color-text-light-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                }}>
                  {a.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Aluno selecionado */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(165,76,46,0.08)',
            border: '1px solid rgba(165,76,46,0.25)', marginBottom: '16px',
          }}>
            <span style={{ fontSize: '14px', color: 'var(--color-text-light-primary)', fontWeight: '600' }}>{alunoNome}</span>
            <button onClick={() => { setAlunoId(null); setAlunoNome(''); setModalidadeFiltro(null) }} style={{
              background: 'none', border: 'none', color: 'var(--color-action-primary)', fontSize: '12px', cursor: 'pointer',
            }}>trocar aluno</button>
          </div>

          {/* Tabs dos próximos 14 dias */}
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px', scrollbarWidth: 'none' }}>
            {proxDias.map(d => {
              const isSel = d === dataSel
              const dtObj = new Date(d + 'T12:00')
              return (
                <button key={d} onClick={() => { setDataSel(d); setSlotSel(null) }} style={{
                  flexShrink: 0, padding: '8px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer', textAlign: 'center', minWidth: '50px',
                  background: isSel ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
                  outline: isSel ? 'none' : '1px solid var(--color-border-light)',
                  color: isSel ? 'white' : 'var(--color-text-light-secondary)',
                }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.8 }}>
                    {format(dtObj, 'EEE', { locale: ptBR })}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', margin: '2px 0' }}>{format(dtObj, 'dd')}</div>
                  <div style={{ fontSize: '8px', opacity: 0.7 }}>{format(dtObj, 'MMM', { locale: ptBR })}</div>
                </button>
              )
            })}
          </div>

          {/* Aulas do dia — sem nomes de outros alunos, só ocupação */}
          {loadingDia ? <Loading /> : aulasDoDia.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)', borderRadius: '12px', border: '1px solid var(--color-surface-light-raised)' }}>
              Nenhuma aula disponível nas modalidades desse aluno neste dia
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {aulasDoDia.map(a => {
                const isSel = slotSel?.id === a.id
                const semVaga = a.vagas <= 0 || a.jaEsta
                return (
                  <button key={a.id}
                    onClick={() => !semVaga && setSlotSel(isSel ? null : a)}
                    disabled={semVaga}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '12px', border: 'none', textAlign: 'left', width: '100%',
                      cursor: semVaga ? 'default' : 'pointer',
                      opacity: semVaga ? 0.4 : 1,
                      backgroundColor: isSel ? 'rgba(61,107,122,0.12)' : 'var(--color-surface-light-raised)',
                      outline: isSel ? '1px solid rgba(61,107,122,0.5)' : '1px solid var(--color-border-light)',
                    }}>
                    <div style={{ minWidth: '42px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: semVaga ? 'var(--color-text-light-muted)' : 'var(--color-action-primary)' }}>
                        {a.turmas?.horario_inicio?.slice(0, 5)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)' }}>{a.turmas?.horario_fim?.slice(0, 5)}</div>
                    </div>
                    <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--color-border-light)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: semVaga ? 'var(--color-text-light-muted)' : 'var(--color-text-light-primary)' }}>
                        {a.turmas?.nome}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)', marginTop: '2px' }}>
                        {a.turmas?.quadras?.nome}
                        {a.turmas?.niveis?.nome && ` · ${a.turmas.niveis.nome}`}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0,
                      backgroundColor: semVaga ? 'rgba(30,43,36,0.05)' : 'rgba(75,139,106,0.15)',
                      color: semVaga ? 'var(--color-text-light-muted)' : 'var(--color-state-success)',
                    }}>
                      {a.jaEsta ? 'já inscrito' : a.vagas <= 0 ? 'Sem vagas disponíveis'
                        : a.capacidade === VAGAS_INDIVIDUAL ? 'Individual — livre'
                        : `${a.ocupacao}/${a.capacidade} vagas`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Confirmação */}
          {slotSel && (
            <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)' }}>
              {slotSel.reposicaoPendente ? (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--color-state-info)', marginBottom: '10px' }}>
                    ✓ Reposição disponível — {calcStatusPorPrazo(slotSel.reposicaoPendente.data_limite).label}
                  </div>
                  <button onClick={() => handleConfirmar(true)} disabled={agendar.isPending} style={{
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    background: 'var(--color-action-primary)',
                    color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    {agendar.isPending ? 'Agendando...' : 'Usar reposição disponível'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '10px' }}>
                    Sem reposição disponível pra essa modalidade — aula avulsa paga
                  </div>
                  <button onClick={() => handleConfirmar(false)} disabled={agendar.isPending} style={{
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    background: 'var(--color-action-primary)',
                    color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    {agendar.isPending ? 'Agendando...' : `Agendar aula avulsa — R$ ${VALOR_AVULSA_PLACEHOLDER}`}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
