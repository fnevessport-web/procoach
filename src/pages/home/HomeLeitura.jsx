import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timer } from 'lucide-react'
import { useHomeDashboard } from '../../hooks/useHomeDashboard'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import { ICONES_MODALIDADES, LOGO_EMPRESA, EMPRESAS, horarioParaMinutos } from '../../constants/modalidades'
import { AulasCoordenador } from '../aulas/AulasCoordenador'

// Home dedicada ao role "leitura" (acesso somente-consulta do clube): uma única
// tela com scroll — "Ao vivo agora" compacto (2 linhas visíveis, resto rola) em
// cima, Grade completa do dia embutida embaixo. Sem os blocos de "Hoje —
// acumulado"/"Professores agora"/"Modalidades" da Home normal, que não fazem
// parte do que foi pedido pra esse acesso.
//
// Contexto escuro (mesma família da HomePage.jsx) — tokens --color-*-dark-* diretos.
// A <AulasCoordenador somenteLeitura /> embutida no fim é ela mesma sempre clara (não usa
// alias, é uma página de contexto fixo) — fica como uma "ilha clara" dentro dessa página
// escura, o inverso do caso dos cards de Pontuação Beyond/Conquistas na ficha do aluno.

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

function ModalidadesRow({ modalidades, onSelect }) {
  if (!modalidades?.length) return null
  return (
    <div className="modalidades-mobile-row" style={{ marginBottom: '26px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-dark-primary)', margin: '0 0 12px' }}>Modalidades</h2>
      <div className="modalidades-row">
        {modalidades.map(mod => {
          const icone = ICONES_MODALIDADES[mod.nome]
          return (
            <button
              key={mod.id}
              onClick={() => onSelect(mod)}
              className="modalidade-card"
              style={{ border: '1px solid var(--color-border-dark-subtle)', background: 'var(--color-surface-dark-raised)' }}
            >
              <div className="modalidade-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icone
                  ? <img src={icone} alt={mod.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>{mod.nome}</span>
                }
              </div>
              <span className="modalidade-label" style={{ color: 'var(--color-text-dark-secondary)' }}>{mod.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function HomeLeitura() {
  const navigate = useNavigate()
  const { perfil } = useAppStore()
  const { aoVivoAgora, isLoading } = useHomeDashboard()
  const { data: modalidades } = useModalidades()

  const [filtroAoVivo, setFiltroAoVivo] = useState('todas')
  const [filtroAoVivoAberto, setFiltroAoVivoAberto] = useState(false)

  const aoVivoFiltrado = aoVivoAgora.filter(aula => {
    if (filtroAoVivo === 'todas') return true
    return aula.empresa === filtroAoVivo
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
          <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', margin: '2px 0 0' }}>Acesso do clube</p>
        </div>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: 'var(--color-action-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-action-on-primary)' }}>{getIniciais(perfil?.nome)}</span>
        </div>
      </div>

      {/* Ao vivo agora */}
      <div style={{ marginBottom: '26px' }}>
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
                  minWidth: '170px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
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
          <div className="ao-vivo-grid-compact" style={{ paddingRight: '2px' }}>
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
                    {aula.professores?.nome?.split(' ')[0]}
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

      {/* Modalidades — só no mobile; no desktop os atalhos ficam na barra lateral do app, junto do Início */}
      <ModalidadesRow modalidades={modalidades} onSelect={selectModalidade} />

      {/* Grade completa */}
      <div>
        <h2 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-dark-secondary)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Grade completa
        </h2>
        <AulasCoordenador somenteLeitura />
      </div>
    </div>
  )
}
