import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAulasSemanaParaReposicao } from '../hooks/useAulas'
import { Modal } from './ui/Modal'
import { Loading } from './ui/Loading'

// vermelho = lotada · amarelo = 1 vaga · verde = 2-3 vagas · azul = vazia (sem ninguém)
function corPorOcupacao(ocupacao, capacidade) {
  if (ocupacao <= 0) return 'var(--color-state-info)'
  const vagas = capacidade - ocupacao
  if (vagas <= 0) return 'var(--color-state-danger)'
  if (vagas === 1) return 'var(--color-state-warning)'
  return 'var(--color-state-success)'
}

function LegendaItem({ cor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: cor }} />
      {label}
    </div>
  )
}

const CELL_W = 108

// Grade semanal (dias x horário) pra escolher uma aula de reposição — mesmo estilo visual da
// tela de Disponibilidade, mas com ocupação real por data (não a matrícula fixa da turma).
// Extraído de AulasAdmin.jsx (ModalReposicao) pra ser reaproveitado também na ficha do aluno
// (PainelReposicoesAluno.jsx) — os dois pontos de entrada levam pro mesmo caminho: escolher
// a aula aqui fecha esse modal e abre a aula de verdade na grade principal, já com o aluno
// pré-adicionado como reposição (a baixa da falta em si continua FIFO, resolvida sozinha
// quando a presença for salva — ver resolverReposicaoFIFO em useAulas.js).
//
// `proximaFalta` é opcional — só mostra a faixa "Vai baixar a falta mais antiga" quando vem
// preenchida ({ dataAula, turmaNome? }); sem ela, o resto da grade funciona igual.
export function GradeSemanalReposicao({ aluno, modalidadeId, proximaFalta, onVoltar, onFecharTudo }) {
  const navigate = useNavigate()
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [niveisFiltro, setNiveisFiltro] = useState([])

  const inicioSemana = format(addDays(new Date(), semanaOffset * 7), 'yyyy-MM-dd')
  const fimSemana = format(addDays(new Date(), semanaOffset * 7 + 6), 'yyyy-MM-dd')
  const diasSemana = Array.from({ length: 7 }, (_, i) => format(addDays(new Date(inicioSemana + 'T12:00'), i), 'yyyy-MM-dd'))

  const { data: aulasSemana, isLoading: loadingSemana } = useAulasSemanaParaReposicao(inicioSemana, fimSemana)

  // A falta é de uma modalidade específica — só faz sentido mostrar aula da mesma modalidade
  // como opção de reposição.
  const aulasDaModalidade = (aulasSemana || []).filter(a => !modalidadeId || a.turmas?.modalidade_id === modalidadeId)

  const niveisDisponiveis = [...new Map(
    aulasDaModalidade.filter(a => a.turmas?.niveis?.nome).map(a => [a.turmas.niveis.nome, a.turmas.niveis.nome])
  ).values()].sort()

  function toggleNivel(nome) {
    setNiveisFiltro(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome])
  }

  const aulasFiltradas = niveisFiltro.length === 0
    ? aulasDaModalidade
    : aulasDaModalidade.filter(a => niveisFiltro.includes(a.turmas?.niveis?.nome))

  const porDiaHorario = {}
  aulasFiltradas.forEach(a => {
    if (!a.turmas?.horario_inicio) return
    const chave = `${a.data_aula}-${a.turmas.horario_inicio.slice(0, 5)}`
    if (!porDiaHorario[chave]) porDiaHorario[chave] = []
    const capacidade = a.turmas?.niveis?.nome === 'Individual' ? 1 : 4
    const ocupacao = a.presencas?.length || 0
    const jaEsta = a.presencas?.some(p => p.aluno_id === aluno.id)
    porDiaHorario[chave].push({ ...a, capacidade, ocupacao, jaEsta })
  })
  const horariosComAula = [...new Set(aulasFiltradas.map(a => a.turmas?.horario_inicio?.slice(0, 5)).filter(Boolean))].sort()

  function handleEscolherSlot(a) {
    if (a.jaEsta || a.ocupacao >= a.capacidade) return
    onFecharTudo()
    navigate('/aulas', {
      state: {
        data: a.data_aula,
        highlightAulaId: a.id,
        abrirAoDestacar: true,
        alunoParaRepor: { id: aluno.id, nome: aluno.nome },
      },
    })
  }

  return (
    <Modal open onClose={onFecharTudo} title={aluno.nome} size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Info da falta + botão voltar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onVoltar} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)',
            background: 'none', color: 'var(--color-text-light-secondary)', cursor: 'pointer', fontSize: '13px',
          }}>← Voltar</button>
          {proximaFalta && (
            <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'rgba(61,107,122,0.08)', borderRadius: '8px', border: '1px solid rgba(61,107,122,0.2)' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-state-info)', fontWeight: '600', textTransform: 'uppercase' }}>Vai baixar a falta mais antiga</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', fontWeight: '600', marginTop: '1px' }}>
                {proximaFalta.dataAula ? format(new Date(proximaFalta.dataAula + 'T12:00'), "dd/MM · EEEE", { locale: ptBR }) : ''}
                {proximaFalta.turmaNome ? ` · ${proximaFalta.turmaNome}` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Filtro de nível */}
        {niveisDisponiveis.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {niveisDisponiveis.map(nome => {
              const ativo = niveisFiltro.includes(nome)
              return (
                <button key={nome} onClick={() => toggleNivel(nome)} style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                  background: ativo ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
                  outline: ativo ? 'none' : '1px solid var(--color-border-light)',
                  color: ativo ? 'white' : 'var(--color-text-light-secondary)', fontSize: '12px', fontWeight: ativo ? '600' : '400',
                  cursor: 'pointer',
                }}>{nome}</button>
              )
            })}
            {niveisFiltro.length > 0 && (
              <button onClick={() => setNiveisFiltro([])} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none',
                background: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', fontSize: '12px', cursor: 'pointer',
              }}>Limpar</button>
            )}
          </div>
        )}

        {/* Navegação de semana */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setSemanaOffset(s => Math.max(0, s - 1))} disabled={semanaOffset === 0} style={{
            padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border-light)', background: 'none',
            color: semanaOffset === 0 ? 'var(--color-text-light-muted)' : 'var(--color-text-light-secondary)', cursor: semanaOffset === 0 ? 'default' : 'pointer',
          }}><ChevronLeft size={14} /></button>
          <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', fontWeight: '600' }}>
            {format(new Date(inicioSemana + 'T12:00'), 'dd/MM')} — {format(new Date(fimSemana + 'T12:00'), 'dd/MM')}
            {semanaOffset === 0 && ' · essa semana'}
          </div>
          <button onClick={() => setSemanaOffset(s => s + 1)} style={{
            padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border-light)', background: 'none',
            color: 'var(--color-text-light-secondary)', cursor: 'pointer',
          }}><ChevronRight size={14} /></button>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '10px', color: 'var(--color-text-light-secondary)' }}>
          <LegendaItem cor="var(--color-state-danger)" label="Lotada" />
          <LegendaItem cor="var(--color-state-warning)" label="1 vaga" />
          <LegendaItem cor="var(--color-state-success)" label="2-3 vagas" />
          <LegendaItem cor="var(--color-state-info)" label="Vazia" />
        </div>

        {/* Grade */}
        {loadingSemana ? <Loading /> : horariosComAula.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)', borderRadius: '12px', border: '1px solid var(--color-surface-light-raised)' }}>
            Nenhuma aula de turma nessa semana{niveisFiltro.length > 0 ? ' com esse nível' : ''}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: `${42 + CELL_W * 7 + 2 * 6}px` }}>
              <div style={{ display: 'flex', gap: '2px', marginBottom: '4px', paddingLeft: '42px' }}>
                {diasSemana.map(d => (
                  <div key={d} style={{
                    width: `${CELL_W}px`, flexShrink: 0, textAlign: 'center',
                    fontSize: '10px', color: 'var(--color-text-light-secondary)', fontWeight: '700', padding: '6px 0',
                  }}>
                    <div style={{ letterSpacing: '1px' }}>{format(new Date(d + 'T12:00'), 'EEE', { locale: ptBR }).toUpperCase()}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '1px' }}>{format(new Date(d + 'T12:00'), 'dd/MM')}</div>
                  </div>
                ))}
              </div>

              {horariosComAula.map(horario => (
                <div key={horario} style={{ display: 'flex', gap: '2px', marginBottom: '2px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '38px', flexShrink: 0, fontSize: '9px', color: 'var(--color-text-light-secondary)',
                    textAlign: 'right', paddingRight: '6px', paddingTop: '9px', fontWeight: '500',
                  }}>{horario}</div>

                  {diasSemana.map(dia => {
                    const entradas = porDiaHorario[`${dia}-${horario}`] || []
                    return (
                      <div key={dia} style={{
                        width: `${CELL_W}px`, flexShrink: 0, minHeight: '34px',
                        backgroundColor: entradas.length ? 'var(--color-surface-light-raised)' : 'var(--color-surface-light-overlay)',
                        borderRadius: '6px', border: '1px solid var(--color-border-light-subtle)',
                        padding: entradas.length ? '4px' : '0',
                        display: 'flex', flexDirection: 'column', gap: '2px',
                      }}>
                        {entradas.map(a => {
                          const disponivel = !a.jaEsta && a.ocupacao < a.capacidade
                          const cor = a.jaEsta ? 'var(--color-text-light-secondary)' : corPorOcupacao(a.ocupacao, a.capacidade)
                          return (
                            <button key={a.id} onClick={() => handleEscolherSlot(a)} disabled={!disponivel} style={{
                              padding: '3px 7px', borderRadius: '4px', border: 'none', textAlign: 'left',
                              cursor: disponivel ? 'pointer' : 'default', opacity: disponivel ? 1 : 0.4,
                              backgroundColor: cor + '22', outline: `1px solid ${cor}55`,
                            }}>
                              <div style={{
                                fontSize: '10px', fontWeight: '600', color: cor,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{a.turmas?.niveis?.nome || a.turmas?.nome}</div>
                              <div style={{ fontSize: '9px', color: 'var(--color-text-light-secondary)' }}>
                                {a.jaEsta ? 'já inscrito' : `${a.ocupacao}/${a.capacidade}`}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
