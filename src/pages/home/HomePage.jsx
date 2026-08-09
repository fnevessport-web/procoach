import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth } from 'date-fns'
import { Timer, ChevronRight, TriangleAlert, PartyPopper } from 'lucide-react'
import { useModalidades } from '../../hooks/useModalidades'
import { useHomeDashboard } from '../../hooks/useHomeDashboard'
import { useRelatorioMensal, gerarInsights } from '../../hooks/useRelatorioMensal'
import { classificarPct, CORES_SEMAFORO, LABEL_SEMAFORO } from '../../constants/semaforo'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import { ICONES_MODALIDADES, LOGO_EMPRESA, EMPRESAS, horarioParaMinutos } from '../../constants/modalidades'
import { nomeCurto } from '../../lib/nomes'

function useAgoraEmSegundos() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return agora
}

function formataMMSS(totalSegundos) {
  const s = Math.max(0, Math.floor(totalSegundos))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// Contexto escuro (página é Dashboard/visão geral) — tokens --color-*-dark-* diretos, sem
// alias, já que essa página nunca é clara. --color-accent-live (saibro) é o token reservado
// pra "ao vivo" (pedido explícito do redesign); --color-state-danger é só pra falta/alerta real.
function ProgressoAula({ horarioInicio, horarioFim }) {
  const agoraMs = useAgoraEmSegundos()
  const inicioMin = horarioParaMinutos(horarioInicio)
  const fimMin = horarioParaMinutos(horarioFim)
  if (inicioMin == null || fimMin == null) return null

  const agora = new Date(agoraMs)
  const agoraMin = agora.getHours() * 60 + agora.getMinutes() + agora.getSeconds() / 60
  const duracaoMin = fimMin - inicioMin
  const decorridoMin = agoraMin - inicioMin
  const pct = duracaoMin > 0 ? Math.min(100, Math.max(0, (decorridoMin / duracaoMin) * 100)) : 0

  // Nos 10min de tolerância após o término oficial, entra no estado "finalizada"
  const emTolerancia = agoraMin >= fimMin
  const decorridoSeg = Math.max(0, decorridoMin * 60)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ height: '3px', borderRadius: '2px', backgroundColor: 'var(--color-border-dark-subtle)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '2px',
          backgroundColor: 'var(--color-accent-live)', transition: 'width 1s linear',
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Timer size={10} color={emTolerancia ? 'var(--color-state-warning)' : 'var(--color-text-dark-secondary)'} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '9px', fontWeight: emTolerancia ? '700' : '400',
          color: emTolerancia ? 'var(--color-state-warning)' : 'var(--color-text-dark-secondary)', fontVariantNumeric: 'tabular-nums',
        }}>
          {formataMMSS(decorridoSeg)}
        </span>
        {emTolerancia && (
          <span className="pulse-badge" style={{ fontSize: '9px', fontWeight: '700', color: 'var(--color-state-warning)' }}>
            · aula finalizada
          </span>
        )}
      </div>
    </div>
  )
}

function getIniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(' ').filter(Boolean)
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function CardDelta({ label, valor, delta }) {
  const subiu = delta > 0
  return (
    <div style={{ backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px', border: '1px solid var(--color-border-dark)', padding: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{valor}</span>
        {delta !== 0 && (
          <span style={{ fontSize: '11px', fontWeight: '600', color: subiu ? 'var(--color-state-success)' : 'var(--color-state-danger)' }}>
            {subiu ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { perfil, modalidadeSelecionada } = useAppStore()
  const { data: modalidades, isLoading: loadingModalidades } = useModalidades()
  const { aoVivoAgora, feriadoHoje, hojeAcumulado, professoresAgora, alertasSemProfessor, isLoading } = useHomeDashboard()
  const role = perfil?.role || 'professor'

  // Saúde do mês: mesmo cálculo do Relatório Mensal (useRelatorioMensal), sem filtro de
  // empresa/modalidade — visão combinada das duas unidades, só pra dar o pulso geral do clube
  // sem precisar abrir o relatório completo.
  const { data: saudeMes } = useRelatorioMensal({
    periodoInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    periodoFim: format(new Date(), 'yyyy-MM-dd'),
  })
  const insightsMes = saudeMes ? gerarInsights(saudeMes) : []
  const insightDestaque = insightsMes.find(i => i.severidade === 'critico' || i.severidade === 'atencao') || insightsMes[0]

  const [filtroAoVivo, setFiltroAoVivo] = useState('todas')
  const [filtroAoVivoAberto, setFiltroAoVivoAberto] = useState(false)

  const aoVivoFiltrado = aoVivoAgora.filter(aula => {
    if (filtroAoVivo === 'todas') return true
    if (filtroAoVivo === 'procopio' || filtroAoVivo === 'beach_arena') return aula.empresa === filtroAoVivo
    return aula.modalidadeNome === filtroAoVivo
  })

  const filtroAoVivoLabel = filtroAoVivo === 'todas'
    ? 'Filtrar'
    : (EMPRESAS.find(e => e.valor === filtroAoVivo)?.label || filtroAoVivo)

  function abrirAula(aulaId) {
    navigate('/aulas', { state: { highlightAulaId: aulaId, fromHome: true } })
  }

  function selectModalidade(mod) {
    navigate(`/modalidade/${encodeURIComponent(mod.nome)}`)
  }

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>

      {/* Saudação */}
      <div style={{ margin: '16px 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: 0 }}>
            Olá, {perfil?.nome?.split(' ')[0] || 'Usuário'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', margin: '2px 0 0', textTransform: 'capitalize' }}>{role}</p>
        </div>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: 'var(--color-action-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-action-on-primary)' }}>{getIniciais(perfil?.nome)}</span>
        </div>
      </div>

      {/* Alerta: aulas sem professor com aluno ativo */}
      {alertasSemProfessor.length > 0 && (
        <div style={{
          marginBottom: '22px', borderRadius: '12px', padding: '14px 16px',
          backgroundColor: 'rgba(180,71,47,0.1)', border: '1px solid rgba(180,71,47,0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <TriangleAlert size={14} color="var(--color-state-danger)" />
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-state-danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {alertasSemProfessor.length} {alertasSemProfessor.length === 1 ? 'aula sem professor' : 'aulas sem professor'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {alertasSemProfessor.map(a => (
              <div key={a.id} onClick={() => abrirAula(a.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                fontSize: '12px', color: 'var(--color-text-dark-primary)', cursor: 'pointer',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{a.ehHoje ? 'Hoje' : 'Amanhã'} {a.horarioInicio}</b> · {a.nivelNome || a.turmaNome} · {a.quadraNome}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saúde do mês — pulso geral do clube, atalho pro relatório completo */}
      {saudeMes && (
        <button onClick={() => navigate('/kpis')} style={{
          width: '100%', marginBottom: '22px', padding: '16px', borderRadius: '14px',
          backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${CORES_SEMAFORO[classificarPct(saudeMes.taxaPresenca)]}33`,
          cursor: 'pointer', textAlign: 'left', display: 'block',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Saúde do mês
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-dark-secondary)' }}>
              <span style={{ fontSize: '11px' }}>Relatório completo</span>
              <ChevronRight size={13} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: insightDestaque ? '10px' : 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: CORES_SEMAFORO[classificarPct(saudeMes.taxaPresenca)] }}>
                {saudeMes.taxaPresenca}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>Presença · {LABEL_SEMAFORO[classificarPct(saudeMes.taxaPresenca)]}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: CORES_SEMAFORO[classificarPct(saudeMes.taxaRealizacao, { bom: 85, atencao: 65 })] }}>
                {saudeMes.taxaRealizacao}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>Realização · {LABEL_SEMAFORO[classificarPct(saudeMes.taxaRealizacao, { bom: 85, atencao: 65 })]}</div>
            </div>
          </div>
          {insightDestaque && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
                backgroundColor: CORES_SEMAFORO[insightDestaque.severidade],
              }} />
              <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', lineHeight: '1.4' }}>{insightDestaque.texto}</span>
            </div>
          )}
        </button>
      )}

      {/* Ao vivo agora */}
      <div style={{ marginBottom: '26px' }}>
        {feriadoHoje && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: 'rgba(61,107,122,0.12)', border: '1px solid rgba(61,107,122,0.35)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
            fontSize: '12px', color: 'var(--color-state-info)',
          }}>
            <PartyPopper size={14} style={{ flexShrink: 0 }} />
            Feriado — {feriadoHoje}: não teremos aula hoje.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            {aoVivoFiltrado.length > 0 && (
              <span className="pulse-badge" style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-accent-live)', boxShadow: '0 0 8px rgba(165,76,46,0.7)' }} />
            )}
            <h2 style={{ fontSize: '12px', fontWeight: '700', color: aoVivoFiltrado.length > 0 ? 'var(--color-accent-live)' : 'var(--color-text-dark-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {aoVivoFiltrado.length > 0 ? 'AO VIVO' : 'Ao vivo agora'} · {aoVivoFiltrado.length} {aoVivoFiltrado.length === 1 ? 'aula' : 'aulas'}
            </h2>
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setFiltroAoVivoAberto(!filtroAoVivoAberto)} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 9px', borderRadius: '8px', cursor: 'pointer',
              background: filtroAoVivo !== 'todas' ? 'rgba(165,76,46,0.12)' : 'var(--color-surface-dark-raised)',
              border: filtroAoVivo !== 'todas' ? '1px solid rgba(165,76,46,0.45)' : '1px solid var(--color-border-dark)',
              color: filtroAoVivo !== 'todas' ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)', fontSize: '11px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {filtroAoVivoLabel}
            </button>
            {filtroAoVivoAberto && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setFiltroAoVivoAberto(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                  backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)',
                  borderRadius: '10px', padding: '8px', zIndex: 40,
                  minWidth: '170px', maxHeight: '260px', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <button onClick={() => { setFiltroAoVivo('todas'); setFiltroAoVivoAberto(false) }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontSize: '12px', marginBottom: '4px',
                    background: filtroAoVivo === 'todas' ? 'rgba(165,76,46,0.12)' : 'transparent',
                    color: filtroAoVivo === 'todas' ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)',
                  }}>
                    Todas
                    {filtroAoVivo === 'todas' && <span>✓</span>}
                  </button>

                  <div style={{ fontSize: '9px', color: 'var(--color-text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 2px' }}>Empresa</div>
                  {EMPRESAS.map(e => (
                    <button key={e.valor} onClick={() => { setFiltroAoVivo(e.valor); setFiltroAoVivoAberto(false) }} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                      cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                      background: filtroAoVivo === e.valor ? 'rgba(165,76,46,0.12)' : 'transparent',
                      color: filtroAoVivo === e.valor ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)',
                    }}>
                      {e.label}
                      {filtroAoVivo === e.valor && <span>✓</span>}
                    </button>
                  ))}

                  {modalidades?.length > 0 && (
                    <>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px 2px' }}>Modalidade</div>
                      {modalidades.map(m => (
                        <button key={m.id} onClick={() => { setFiltroAoVivo(m.nome); setFiltroAoVivoAberto(false) }} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                          cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                          background: filtroAoVivo === m.nome ? 'rgba(165,76,46,0.12)' : 'transparent',
                          color: filtroAoVivo === m.nome ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)',
                        }}>
                          {m.nome}
                          {filtroAoVivo === m.nome && <span>✓</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {isLoading ? <Loading /> : aoVivoAgora.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-dark-muted)',
            backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px', border: '1px solid var(--color-border-dark)',
          }}>
            Nenhuma aula rolando agora
          </div>
        ) : aoVivoFiltrado.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-dark-muted)',
            backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px', border: '1px solid var(--color-border-dark)',
          }}>
            Nenhuma aula ao vivo com esse filtro
          </div>
        ) : (
          <div className="ao-vivo-grid" style={{ paddingRight: '2px' }}>
            {aoVivoFiltrado.map(aula => (
              <button key={aula.id} onClick={() => abrirAula(aula.id)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '12px', textAlign: 'left', width: '100%',
                backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', cursor: 'pointer',
                boxSizing: 'border-box',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  <FotoProfessor src={aula.professores?.foto_url} nome={aula.professores?.nome} />
                  <span style={{ fontSize: '9px', color: 'var(--color-text-dark-secondary)', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nomeCurto(aula.professores?.nome)}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {aula.turmaNome}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span className="pulse-badge" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />
                      <span style={{ fontSize: '9px', color: 'var(--color-text-dark-secondary)' }}>{aula.horarioInicio?.slice(0, 5)}</span>
                      {aula.empresa && LOGO_EMPRESA[aula.empresa] && (
                        <img src={LOGO_EMPRESA[aula.empresa]} alt={aula.empresa} style={{ height: '12px', objectFit: 'contain', opacity: 0.85 }} />
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[aula.modalidadeNome, aula.quadraNome].filter(Boolean).join(' · ')}
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(75,139,106,0.15)', color: 'var(--color-state-success)', fontSize: '10px', fontWeight: '600' }}>
                      ✓ {aula.presentes}
                    </span>
                    <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(180,71,47,0.15)', color: 'var(--color-state-danger)', fontSize: '10px', fontWeight: '600' }}>
                      ✗ {aula.faltas}
                    </span>
                  </div>

                  <ProgressoAula horarioInicio={aula.horarioInicio} horarioFim={aula.horarioFim} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modalidades */}
      <div style={{ marginBottom: '26px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-dark-primary)', margin: '0 0 12px' }}>Modalidades</h2>
        {loadingModalidades ? <Loading /> : (
          <div className="modalidades-row">
            {modalidades?.map(mod => {
              const selected = modalidadeSelecionada?.id === mod.id
              const icone = ICONES_MODALIDADES[mod.nome]
              return (
                <button
                  key={mod.id}
                  onClick={() => selectModalidade(mod)}
                  className="modalidade-card"
                  style={{
                    border: selected ? '1.5px solid var(--color-action-primary)' : '1px solid var(--color-border-dark-subtle)',
                    background: selected ? 'rgba(165,76,46,0.08)' : 'var(--color-surface-dark-raised)',
                  }}
                >
                  <div className="modalidade-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icone
                      ? <img src={icone} alt={mod.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>{mod.nome}</span>
                    }
                  </div>
                  <span className="modalidade-label" style={{ color: selected ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)' }}>
                    {mod.nome}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Hoje — acumulado */}
      <div style={{ marginBottom: '26px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-dark-primary)', margin: '0 0 10px' }}>Hoje — acumulado</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <CardDelta label="Aulas no dia" valor={hojeAcumulado.totalAulas} delta={hojeAcumulado.deltaAulas} />
          <CardDelta label="Alunos esperados" valor={hojeAcumulado.alunosEsperados} delta={hojeAcumulado.deltaAlunos} />
        </div>
        <div style={{
          backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px', border: '1px solid var(--color-border-dark)',
          padding: '16px', textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{hojeAcumulado.pctPresenca}%</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '10px' }}>Presença acumulada</div>
          <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-border-dark)', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${hojeAcumulado.pctPresenca}%`, height: '100%', backgroundColor: 'var(--color-state-success)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px' }}>
            <span style={{ color: 'var(--color-state-success)' }}>✓ {hojeAcumulado.presentes} presentes</span>
            <span style={{ color: 'var(--color-state-danger)' }}>✗ {hojeAcumulado.faltas} faltas</span>
          </div>
        </div>
      </div>

      {/* Professores agora */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-dark-primary)', margin: '0 0 10px' }}>Professores agora</h2>
        {isLoading ? <Loading /> : professoresAgora.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--color-text-dark-muted)', textAlign: 'center', padding: '16px' }}>Nenhum professor cadastrado</div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {professoresAgora.map(prof => {
              const ativo = prof.status === 'ativo'
              const conteudo = (
                <div style={{
                  flexShrink: 0, width: '128px',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  padding: '10px', borderRadius: '12px',
                  backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: ativo ? 'var(--color-state-success)' : 'var(--color-text-dark-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nomeCurto(prof.nome)}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: ativo ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)' }}>
                    {ativo ? (prof.quadraNome || 'Em aula') : (prof.proximoHorario ? `Próx ${prof.proximoHorario}` : 'Livre')}
                  </span>
                </div>
              )
              return ativo ? (
                <button key={prof.id} onClick={() => abrirAula(prof.aula.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                  {conteudo}
                </button>
              ) : (
                <div key={prof.id} style={{ flexShrink: 0 }}>{conteudo}</div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '8px', paddingBottom: '8px' }}>
        <button onClick={() => navigate('/politica-de-privacidade')} style={{
          background: 'none', border: 'none', color: 'var(--color-text-dark-muted)', fontSize: '11px', cursor: 'pointer', padding: 0, marginBottom: '6px', display: 'block', width: '100%',
        }}>
          Política de Privacidade
        </button>
        <span style={{ fontSize: '10px', color: 'var(--color-text-dark-muted)', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </span>
      </div>
    </div>
  )
}
