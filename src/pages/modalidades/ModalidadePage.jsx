import { Fragment, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { useModalidadeDashboard, getOpcoesMeses } from '../../hooks/useModalidadeDashboard'
import { ICONES_MODALIDADES, EMPRESAS, DIAS_HEATMAP } from '../../constants/modalidades'
import { classificarPct, CORES_SEMAFORO } from '../../constants/semaforo'
import { Loading } from '../../components/ui/Loading'

const selectStyle = {
  fontSize: '11px', color: 'var(--color-text-dark-primary)', backgroundColor: 'var(--color-surface-dark-overlay)',
  border: '1px solid var(--color-border-dark)', borderRadius: '6px', padding: '4px 6px',
  outline: 'none', textTransform: 'capitalize', cursor: 'pointer',
}

const DIA_LABEL = { segunda: 'SEG', terca: 'TER', quarta: 'QUA', quinta: 'QUI', sexta: 'SEX', sabado: 'SAB' }

const sectionLabelStyle = {
  fontSize: '10px', color: 'var(--color-text-dark-secondary)', letterSpacing: '1.5px',
  textTransform: 'uppercase', fontWeight: '700', margin: '0 0 10px',
}

const cardStyle = {
  background: 'var(--color-surface-dark-raised)', borderRadius: '8px', border: '0.5px solid var(--color-border-dark)',
  padding: '14px', boxSizing: 'border-box',
}

const scrollHintStyle = {
  fontSize: '10px', color: 'var(--color-text-dark-muted)', textAlign: 'center', marginTop: '6px',
}

function Section({ label, children, style }) {
  return (
    <div style={{ marginBottom: '22px', ...style }}>
      <p style={sectionLabelStyle}>{label}</p>
      {children}
    </div>
  )
}

function ProgressBar({ pct, color, bg = 'var(--color-border-dark)' }) {
  return (
    <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: bg, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', backgroundColor: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
    </div>
  )
}

// Duas barras empilhadas (mês de comparação em cinza, mês atual em amarelo) — mesmo
// padrão visual do card "Presença acumulada" logo abaixo, pra deixar claro qual
// número pertence a qual mês, valendo pra qualquer par de meses escolhido.
function ComparativoCard({ titulo, labelAtual, valorAtual, labelComparacao, valorComparacao }) {
  const maior = Math.max(valorAtual || 0, valorComparacao || 0, 1)
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '10px' }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '4px' }}>
            <span style={{ textTransform: 'capitalize' }}>{labelComparacao}</span>
            <span style={{ fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{valorComparacao}</span>
          </div>
          <ProgressBar pct={(valorComparacao / maior) * 100} color="var(--color-text-dark-secondary)" />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '4px' }}>
            <span style={{ textTransform: 'capitalize' }}>{labelAtual}</span>
            <span style={{ fontWeight: '700', color: 'var(--color-action-primary)' }}>{valorAtual}</span>
          </div>
          <ProgressBar pct={(valorAtual / maior) * 100} color="var(--color-action-primary)" />
        </div>
      </div>
    </div>
  )
}

const NIVEL_OCUPACAO = {
  cheio: 'var(--color-state-danger)',
  medio: 'var(--color-action-primary)',
  baixo: 'var(--color-state-info)',
}

const NIVEL_CALOR = {
  lotado: 'var(--color-state-danger)',
  medio: 'var(--color-state-warning)',
  vazio: 'var(--color-state-info)',
  sem_dados: 'var(--color-border-dark-subtle)',
}

export function ModalidadePage() {
  const { nomeModalidade } = useParams()
  const navigate = useNavigate()
  const opcoesMeses = getOpcoesMeses()
  const [mesAtual, setMesAtual] = useState(opcoesMeses[0].valor)
  const [mesComparacao, setMesComparacao] = useState(opcoesMeses[1].valor)

  const {
    modalidade, empresa, temDados, acontecendoAgora, mes,
    mapaCalor, ocupacaoTurmas, topAlunos, riscoEvasao, rankingProfessores,
    isLoading,
  } = useModalidadeDashboard(nomeModalidade, { mesAtual, mesComparacao })

  const icone = ICONES_MODALIDADES[nomeModalidade]
  const empresaLabel = EMPRESAS.find(e => e.valor === empresa)?.label || ''

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 22px' }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: 'var(--color-action-primary)', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={24} />
        </button>
        {icone && (
          <div style={{ width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={icone} alt={nomeModalidade} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nomeModalidade}
          </h1>
          {empresaLabel && (
            <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', margin: '2px 0 0' }}>{empresaLabel}</p>
          )}
        </div>
      </div>

      {isLoading ? <Loading /> : !temDados ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '80px 24px',
        }}>
          {icone && (
            <img src={icone} alt="" style={{ width: '96px', height: '96px', objectFit: 'contain', opacity: 0.2, marginBottom: '20px' }} />
          )}
          <p style={{ fontSize: '14px', color: 'var(--color-text-dark-secondary)', fontWeight: '600', margin: '0 0 6px' }}>Nenhum dado disponível ainda</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', margin: 0, maxWidth: '260px', lineHeight: '1.5' }}>
            Quando houver alunos inscritos nesta modalidade, as informações aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Acontecendo agora */}
          {acontecendoAgora && (
            <div style={{
              marginBottom: '22px', borderRadius: '8px', padding: '14px',
              backgroundColor: 'rgba(194,212,97,0.08)', border: '0.5px solid rgba(194,212,97,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span className="pulse-badge" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-accent-live)', letterSpacing: '0.5px' }}>ACONTECENDO AGORA</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginLeft: 'auto' }}>{acontecendoAgora.horario}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{acontecendoAgora.aulas}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>{acontecendoAgora.aulas === 1 ? 'aula rolando' : 'aulas rolando'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{acontecendoAgora.alunosEsperados}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>alunos esperados</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-state-success)' }}>✓ {acontecendoAgora.presentes}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>presentes</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-state-danger)' }}>✗ {acontecendoAgora.faltas}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>faltas</div>
                </div>
              </div>
            </div>
          )}

          {/* Visão geral do mês */}
          <Section label="Visão geral do mês">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <select value={mesAtual} onChange={e => setMesAtual(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                {opcoesMeses.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
              </select>
              <select value={mesComparacao} onChange={e => setMesComparacao(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                {opcoesMeses.map(o => <option key={o.valor} value={o.valor}>vs. {o.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
              <ComparativoCard
                titulo="Alunos ativos"
                labelAtual={mes.labelMesAtual} valorAtual={mes.alunosAtivos}
                labelComparacao={mes.labelMesComparacao} valorComparacao={mes.alunosAtivosComparacao}
              />
              <ComparativoCard
                titulo="Aulas no mês"
                labelAtual={mes.labelMesAtual} valorAtual={mes.aulasRealizadas}
                labelComparacao={mes.labelMesComparacao} valorComparacao={mes.aulasComparacao}
              />
            </div>
            <p style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', margin: '0 0 8px', lineHeight: '1.4' }}>
              Comparativo proporcional — primeiros {mes.diasComparados} dias de cada mês.
            </p>
            <div style={cardStyle}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '10px' }}>Presença acumulada</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{mes.labelMesComparacao}</span>
                    <span style={{ fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{mes.pctComparacao}%</span>
                  </div>
                  <ProgressBar pct={mes.pctComparacao} color="var(--color-text-dark-secondary)" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{mes.labelMesAtual}</span>
                    <span style={{ fontWeight: '700', color: CORES_SEMAFORO[classificarPct(mes.pctAtual)] }}>{mes.pctAtual}%</span>
                  </div>
                  <ProgressBar pct={mes.pctAtual} color={CORES_SEMAFORO[classificarPct(mes.pctAtual)]} />
                </div>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', margin: '10px 0 0', lineHeight: '1.4' }}>
                Comparativo proporcional — primeiros {mes.diasComparados} dias de <span style={{ textTransform: 'capitalize' }}>{mes.labelMesComparacao}</span> vs <span style={{ textTransform: 'capitalize' }}>{mes.labelMesAtual}</span>.
              </p>
            </div>

            {riscoEvasao.length > 0 && (
              <div style={{
                marginTop: '10px', padding: '12px 14px', borderRadius: '10px',
                backgroundColor: 'rgba(180,71,47,0.08)', border: '1px solid rgba(180,71,47,0.25)',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <TriangleAlert size={16} color="var(--color-state-danger)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)', lineHeight: '1.4' }}>
                  <strong style={{ color: 'var(--color-state-danger)' }}>{riscoEvasao.length} aluno{riscoEvasao.length === 1 ? '' : 's'}</strong> em risco alto de evasão (3+ faltas seguidas) — veja a lista em "Alerta — risco de evasão" abaixo.
                </span>
              </div>
            )}
          </Section>

          {/* Mapa de calor */}
          <Section label="Mapa de calor">
            <div style={cardStyle}>
              <p style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', margin: '0 0 12px', lineHeight: '1.5' }}>
                Cor = % de ocupação das vagas do horário, calculada a partir das presenças registradas nas aulas. Cada turma em grupo tem 4 vagas, cada aula individual tem 1 vaga — turmas simultâneas no mesmo horário somam as vagas. Ex.: às 11h, 1 turma em grupo cheia (4 presenças) + 1 individual cheia (1 presença) = 5 de 5 vagas = 100%. Já às 12h, 5 presenças divididas em 2 turmas em grupo (4+4 = 8 vagas possíveis) = 5 de 8 = 63% — mesmo número de pessoas, ocupação diferente. O número no card é a média de presenças no horário, não a % de ocupação.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <div className="heatmap-grid">
                  <div />
                  {DIAS_HEATMAP.map(dia => (
                    <div key={dia} style={{ fontSize: '8px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', fontWeight: '700' }}>{DIA_LABEL[dia]}</div>
                  ))}
                  {Array.from({ length: 16 }, (_, i) => 6 + i).map(hora => (
                    <Fragment key={hora}>
                      <div style={{ fontSize: '8px', color: 'var(--color-text-dark-secondary)', display: 'flex', alignItems: 'center' }}>
                        {String(hora).padStart(2, '0')}h
                      </div>
                      {DIAS_HEATMAP.map(dia => {
                        const cel = mapaCalor.find(c => c.dia === dia && c.hora === hora)
                        return (
                          <div
                            key={`${dia}-${hora}`}
                            className="heatmap-cell"
                            title={cel?.pct != null ? `${cel.pct}% de ocupação` : 'sem dados'}
                            style={{ backgroundColor: NIVEL_CALOR[cel?.nivel || 'sem_dados'] }}
                          />
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '12px' }}>
                {[
                  { label: 'Lotado ≥80%', cor: NIVEL_CALOR.lotado },
                  { label: 'Médio 40–79%', cor: NIVEL_CALOR.medio },
                  { label: 'Vazio <40%', cor: NIVEL_CALOR.vazio },
                  { label: 'Sem dados', cor: NIVEL_CALOR.sem_dados },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: item.cor, flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Ocupação das turmas */}
          <Section label="Ocupação das turmas">
            <div style={cardStyle}>
              <div style={{ maxHeight: '150px', overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ocupacaoTurmas.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', margin: 0 }}>Nenhuma turma cadastrada</p>
                ) : ocupacaoTurmas.map(t => (
                  <div key={t.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-dark-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                        {t.nome}
                      </span>
                      <span style={{ color: NIVEL_OCUPACAO[t.nivel], fontWeight: '700', flexShrink: 0 }}>{t.ocupacao}/{t.capacidade}</span>
                    </div>
                    <ProgressBar pct={(t.ocupacao / t.capacidade) * 100} color={NIVEL_OCUPACAO[t.nivel]} />
                  </div>
                ))}
              </div>
              {ocupacaoTurmas.length > 0 && <p style={scrollHintStyle}>↕ role para ver todas as turmas</p>}
            </div>
          </Section>

          {/* Top alunos — frequência */}
          <Section label="Top alunos — frequência">
            <div style={cardStyle}>
              <div style={{ maxHeight: '220px', overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topAlunos.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', margin: 0 }}>Nenhum registro de presença neste mês</p>
                ) : topAlunos.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-dark-muted)', width: '14px', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                        {a.nome}
                      </div>
                      <ProgressBar pct={a.pct} color="var(--color-state-success)" />
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-state-success)' }}>{a.pct}%</div>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-dark-secondary)' }}>{a.aulas} aulas</div>
                    </div>
                  </div>
                ))}
              </div>
              {topAlunos.length > 0 && <p style={scrollHintStyle}>↕ role para ver mais</p>}
            </div>
          </Section>

          {/* Risco de evasão */}
          <Section label="Alerta — risco de evasão">
            <div style={cardStyle}>
              <div style={{ maxHeight: '180px', overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {riscoEvasao.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', margin: 0 }}>Nenhum alerta no momento</p>
                ) : riscoEvasao.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-state-danger)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)' }}>{a.nome}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>
                        {a.faltasConsecutivas} faltas consecutivas · última aula há {a.diasDesdeUltimaAula} {a.diasDesdeUltimaAula === 1 ? 'dia' : 'dias'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {riscoEvasao.length > 0 && <p style={scrollHintStyle}>↕ role para ver mais</p>}
            </div>
          </Section>

          {/* Ranking de professores */}
          <Section label="Ranking de professores" style={{ marginBottom: '8px' }}>
            <div style={cardStyle}>
              <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rankingProfessores.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', margin: 0 }}>Nenhuma aula ministrada neste mês</p>
                ) : rankingProfessores.map(p => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-dark-primary)' }}>{p.nome}</span>
                      <span style={{ color: 'var(--color-action-primary)', fontWeight: '700' }}>{p.aulas} {p.aulas === 1 ? 'aula' : 'aulas'}</span>
                    </div>
                    <ProgressBar pct={p.pct} color="var(--color-action-primary)" />
                  </div>
                ))}
              </div>
              {rankingProfessores.length > 0 && <p style={scrollHintStyle}>↕ role para ver mais</p>}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
