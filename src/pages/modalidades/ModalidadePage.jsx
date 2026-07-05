import { Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useModalidadeDashboard } from '../../hooks/useModalidadeDashboard'
import { ICONES_MODALIDADES, EMPRESAS } from '../../constants/modalidades'
import { Loading } from '../../components/ui/Loading'

const DIA_LABEL = { segunda: 'SEG', terca: 'TER', quarta: 'QUA', quinta: 'QUI', sexta: 'SEX', sabado: 'SAB' }

const sectionLabelStyle = {
  fontSize: '10px', color: '#555', letterSpacing: '1.5px',
  textTransform: 'uppercase', fontWeight: '700', margin: '0 0 10px',
}

const cardStyle = {
  background: '#1a1a1a', borderRadius: '8px', border: '0.5px solid #252525',
  padding: '14px', boxSizing: 'border-box',
}

const scrollHintStyle = {
  fontSize: '10px', color: '#333', textAlign: 'center', marginTop: '6px',
}

function Section({ label, children, style }) {
  return (
    <div style={{ marginBottom: '22px', ...style }}>
      <p style={sectionLabelStyle}>{label}</p>
      {children}
    </div>
  )
}

function ProgressBar({ pct, color, bg = '#252525' }) {
  return (
    <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: bg, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', backgroundColor: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
    </div>
  )
}

const NIVEL_OCUPACAO = {
  cheio: '#EF4444',
  medio: '#fcc825',
  baixo: '#3b82f6',
}

const NIVEL_CALOR = {
  lotado: '#8a2323',
  medio: '#c9772f',
  vazio: '#2c4a63',
  sem_dados: '#1f1f1f',
}

export function ModalidadePage() {
  const { nomeModalidade } = useParams()
  const navigate = useNavigate()
  const {
    modalidade, empresa, temDados, acontecendoAgora, mes,
    mapaCalor, ocupacaoTurmas, topAlunos, riscoEvasao, rankingProfessores,
    isLoading,
  } = useModalidadeDashboard(nomeModalidade)

  const icone = ICONES_MODALIDADES[nomeModalidade]
  const empresaLabel = EMPRESAS.find(e => e.valor === empresa)?.label || ''

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 22px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: '#fcc825', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={24} />
        </button>
        {icone && (
          <div style={{ width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={icone} alt={nomeModalidade} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#F0F2F5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nomeModalidade}
          </h1>
          {empresaLabel && (
            <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>{empresaLabel}</p>
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
          <p style={{ fontSize: '14px', color: '#888', fontWeight: '600', margin: '0 0 6px' }}>Nenhum dado disponível ainda</p>
          <p style={{ fontSize: '12px', color: '#555', margin: 0, maxWidth: '260px', lineHeight: '1.5' }}>
            Quando houver alunos inscritos nesta modalidade, as informações aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Acontecendo agora */}
          {acontecendoAgora && (
            <div style={{
              marginBottom: '22px', borderRadius: '8px', padding: '14px',
              backgroundColor: '#1a0f0f', border: '0.5px solid #3a1515',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span className="pulse-badge" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#e24b4a' }} />
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#e24b4a', letterSpacing: '0.5px' }}>ACONTECENDO AGORA</span>
                <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>{acontecendoAgora.horario}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5' }}>{acontecendoAgora.aulas}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>{acontecendoAgora.aulas === 1 ? 'aula rolando' : 'aulas rolando'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5' }}>{acontecendoAgora.alunosEsperados}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>alunos esperados</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1D9E75' }}>✓ {acontecendoAgora.presentes}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>presentes</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#e24b4a' }}>✗ {acontecendoAgora.faltas}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>faltas</div>
                </div>
              </div>
            </div>
          )}

          {/* Visão geral do mês */}
          <Section label="Visão geral do mês">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Alunos ativos</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#F0F2F5' }}>{mes.alunosAtivos}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Aulas no mês</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#F0F2F5' }}>{mes.aulasRealizadas}</div>
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px' }}>Presença acumulada</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{mes.labelMesAnterior}</span>
                    <span style={{ fontWeight: '700', color: '#F0F2F5' }}>{mes.pctAnterior}%</span>
                  </div>
                  <ProgressBar pct={mes.pctAnterior} color="#555" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{mes.labelMesAtual}</span>
                    <span style={{ fontWeight: '700', color: '#fcc825' }}>{mes.pctAtual}%</span>
                  </div>
                  <ProgressBar pct={mes.pctAtual} color="#fcc825" />
                </div>
              </div>
              <p style={{ fontSize: '10px', color: '#555', margin: '10px 0 0', lineHeight: '1.4' }}>
                Comparativo proporcional — primeiros {mes.diasComparados} dias de <span style={{ textTransform: 'capitalize' }}>{mes.labelMesAnterior}</span> vs <span style={{ textTransform: 'capitalize' }}>{mes.labelMesAtual}</span>.
              </p>
            </div>
          </Section>

          {/* Mapa de calor */}
          <Section label="Mapa de calor">
            <div style={cardStyle}>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'inline-grid', gridTemplateColumns: `32px repeat(6, 26px)`, gap: '3px' }}>
                  <div />
                  {Object.values(DIA_LABEL).map(lbl => (
                    <div key={lbl} style={{ fontSize: '8px', color: '#555', textAlign: 'center', fontWeight: '700' }}>{lbl}</div>
                  ))}
                  {Array.from({ length: 16 }, (_, i) => 6 + i).map(hora => (
                    <Fragment key={hora}>
                      <div style={{ fontSize: '8px', color: '#555', display: 'flex', alignItems: 'center' }}>
                        {String(hora).padStart(2, '0')}h
                      </div>
                      {Object.keys(DIA_LABEL).map(dia => {
                        const cel = mapaCalor.find(c => c.dia === dia && c.hora === hora)
                        return (
                          <div
                            key={`${dia}-${hora}`}
                            title={cel?.pct != null ? `${cel.pct}% de presença` : 'sem dados'}
                            style={{
                              width: '26px', height: '14px', borderRadius: '3px',
                              backgroundColor: NIVEL_CALOR[cel?.nivel || 'sem_dados'],
                            }}
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
                    <span style={{ fontSize: '10px', color: '#555' }}>{item.label}</span>
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
                  <p style={{ fontSize: '12px', color: '#555', textAlign: 'center', margin: 0 }}>Nenhuma turma cadastrada</p>
                ) : ocupacaoTurmas.map(t => (
                  <div key={t.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                      <span style={{ color: '#F0F2F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
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
                  <p style={{ fontSize: '12px', color: '#555', textAlign: 'center', margin: 0 }}>Nenhum registro de presença neste mês</p>
                ) : topAlunos.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#444', width: '14px', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#F0F2F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                        {a.nome}
                      </div>
                      <ProgressBar pct={a.pct} color="#1D9E75" />
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1D9E75' }}>{a.pct}%</div>
                      <div style={{ fontSize: '9px', color: '#555' }}>{a.aulas} aulas</div>
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
                  <p style={{ fontSize: '12px', color: '#555', textAlign: 'center', margin: 0 }}>Nenhum alerta no momento</p>
                ) : riscoEvasao.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#e24b4a', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#F0F2F5' }}>{a.nome}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>
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
                  <p style={{ fontSize: '12px', color: '#555', textAlign: 'center', margin: 0 }}>Nenhuma aula ministrada neste mês</p>
                ) : rankingProfessores.map(p => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: '#F0F2F5' }}>{p.nome}</span>
                      <span style={{ color: '#fcc825', fontWeight: '700' }}>{p.aulas} {p.aulas === 1 ? 'aula' : 'aulas'}</span>
                    </div>
                    <ProgressBar pct={p.pct} color="#fcc825" />
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
