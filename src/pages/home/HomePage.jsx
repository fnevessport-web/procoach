import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModalidades } from '../../hooks/useModalidades'
import { useHomeDashboard } from '../../hooks/useHomeDashboard'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'
import { ICONES_MODALIDADES, LOGO_EMPRESA, EMPRESAS } from '../../constants/modalidades'

function getIniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(' ').filter(Boolean)
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function FotoProfessor({ src, nome, size = 48 }) {
  const [erro, setErro] = useState(false)
  if (src && !erro) {
    return (
      <img src={src} alt={nome} onError={() => setErro(true)} style={{
        width: size, height: size, borderRadius: '8px',
        objectFit: 'cover', objectPosition: 'top', flexShrink: 0,
      }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '8px', flexShrink: 0,
      background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: '700', color: 'white',
    }}>
      {getIniciais(nome)}
    </div>
  )
}

function CardDelta({ label, valor, delta }) {
  const subiu = delta > 0
  return (
    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #252525', padding: '12px' }}>
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '22px', fontWeight: '700', color: '#F0F2F5' }}>{valor}</span>
        {delta !== 0 && (
          <span style={{ fontSize: '11px', fontWeight: '600', color: subiu ? '#1D9E75' : '#e24b4a' }}>
            {subiu ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { perfil, modalidadeSelecionada, setModalidadeSelecionada } = useAppStore()
  const { data: modalidades, isLoading: loadingModalidades } = useModalidades()
  const { aoVivoAgora, hojeAcumulado, professoresAgora, alertasSemProfessor, isLoading } = useHomeDashboard()
  const role = perfil?.role || 'professor'

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
    setModalidadeSelecionada(mod)
    navigate(`/modalidade/${encodeURIComponent(mod.nome)}`)
  }

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>

      {/* Saudação */}
      <div style={{ margin: '16px 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
            Olá, {perfil?.nome?.split(' ')[0] || 'Usuário'}
          </h1>
          <p style={{ fontSize: '12px', color: '#555', margin: '2px 0 0', textTransform: 'capitalize' }}>{role}</p>
        </div>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{getIniciais(perfil?.nome)}</span>
        </div>
      </div>

      {/* Alerta: aulas sem professor com aluno ativo */}
      {alertasSemProfessor.length > 0 && (
        <div style={{
          marginBottom: '22px', borderRadius: '12px', padding: '14px 16px',
          backgroundColor: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#e24b4a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {alertasSemProfessor.length} {alertasSemProfessor.length === 1 ? 'aula sem professor' : 'aulas sem professor'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {alertasSemProfessor.map(a => (
              <div key={a.id} onClick={() => abrirAula(a.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                fontSize: '12px', color: '#F0F2F5', cursor: 'pointer',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{a.ehHoje ? 'Hoje' : 'Amanhã'} {a.horarioInicio}</b> · {a.nivelNome || a.turmaNome} · {a.quadraNome}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ao vivo agora */}
      <div style={{ marginBottom: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-badge" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#e24b4a' }} />
            <h2 style={{ fontSize: '12px', fontWeight: '700', color: '#888', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ao vivo agora · {aoVivoFiltrado.length} {aoVivoFiltrado.length === 1 ? 'aula' : 'aulas'}
            </h2>
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setFiltroAoVivoAberto(!filtroAoVivoAberto)} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 9px', borderRadius: '8px', cursor: 'pointer',
              background: filtroAoVivo !== 'todas' ? 'rgba(252,200,37,0.1)' : '#1a1a1a',
              border: filtroAoVivo !== 'todas' ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
              color: filtroAoVivo !== 'todas' ? '#fcc825' : '#555', fontSize: '11px',
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
                  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: '10px', padding: '8px', zIndex: 40,
                  minWidth: '170px', maxHeight: '260px', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <button onClick={() => { setFiltroAoVivo('todas'); setFiltroAoVivoAberto(false) }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontSize: '12px', marginBottom: '4px',
                    background: filtroAoVivo === 'todas' ? 'rgba(252,200,37,0.1)' : 'transparent',
                    color: filtroAoVivo === 'todas' ? '#fcc825' : '#888',
                  }}>
                    Todas
                    {filtroAoVivo === 'todas' && <span>✓</span>}
                  </button>

                  <div style={{ fontSize: '9px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 2px' }}>Empresa</div>
                  {EMPRESAS.map(e => (
                    <button key={e.valor} onClick={() => { setFiltroAoVivo(e.valor); setFiltroAoVivoAberto(false) }} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                      cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                      background: filtroAoVivo === e.valor ? 'rgba(252,200,37,0.1)' : 'transparent',
                      color: filtroAoVivo === e.valor ? '#fcc825' : '#888',
                    }}>
                      {e.label}
                      {filtroAoVivo === e.valor && <span>✓</span>}
                    </button>
                  ))}

                  {modalidades?.length > 0 && (
                    <>
                      <div style={{ fontSize: '9px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px 2px' }}>Modalidade</div>
                      {modalidades.map(m => (
                        <button key={m.id} onClick={() => { setFiltroAoVivo(m.nome); setFiltroAoVivoAberto(false) }} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                          cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                          background: filtroAoVivo === m.nome ? 'rgba(252,200,37,0.1)' : 'transparent',
                          color: filtroAoVivo === m.nome ? '#fcc825' : '#888',
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
            padding: '20px', textAlign: 'center', fontSize: '12px', color: '#444',
            backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #252525',
          }}>
            Nenhuma aula rolando agora
          </div>
        ) : aoVivoFiltrado.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center', fontSize: '12px', color: '#444',
            backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #252525',
          }}>
            Nenhuma aula ao vivo com esse filtro
          </div>
        ) : (
          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
            {aoVivoFiltrado.map(aula => (
              <button key={aula.id} onClick={() => abrirAula(aula.id)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '12px', textAlign: 'left', width: '100%',
                backgroundColor: '#1a1a1a', border: '1px solid #252525', cursor: 'pointer',
                boxSizing: 'border-box',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  <FotoProfessor src={aula.professores?.foto_url} nome={aula.professores?.nome} />
                  <span style={{ fontSize: '9px', color: '#555', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {aula.professores?.nome?.split(' ')[0]}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {aula.turmaNome}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span className="pulse-badge" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#e24b4a' }} />
                      <span style={{ fontSize: '9px', color: '#555' }}>{aula.horarioInicio?.slice(0, 5)}</span>
                      {aula.empresa && LOGO_EMPRESA[aula.empresa] && (
                        <img src={LOGO_EMPRESA[aula.empresa]} alt={aula.empresa} style={{ height: '12px', objectFit: 'contain', opacity: 0.85 }} />
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[aula.modalidadeNome, aula.quadraNome].filter(Boolean).join(' · ')}
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(29,158,117,0.12)', color: '#1D9E75', fontSize: '10px', fontWeight: '600' }}>
                      ✓ {aula.presentes}
                    </span>
                    <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(226,75,74,0.12)', color: '#e24b4a', fontSize: '10px', fontWeight: '600' }}>
                      ✗ {aula.faltas}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modalidades */}
      <div style={{ marginBottom: '26px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', margin: '0 0 12px' }}>Modalidades</h2>
        {loadingModalidades ? <Loading /> : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {modalidades?.map(mod => {
              const selected = modalidadeSelecionada?.id === mod.id
              const icone = ICONES_MODALIDADES[mod.nome]
              return (
                <button
                  key={mod.id}
                  onClick={() => selectModalidade(mod)}
                  style={{
                    flexShrink: 0, width: '72px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '10px 6px', borderRadius: '14px',
                    border: selected ? '1.5px solid rgba(207,27,155,0.7)' : '1px solid rgba(255,255,255,0.06)',
                    background: selected ? 'rgba(252,200,37,0.06)' : '#1a1a1a',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icone
                      ? <img src={icone} alt={mod.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '10px', color: '#555' }}>{mod.nome}</span>
                    }
                  </div>
                  <span style={{ fontSize: '10px', color: selected ? '#fcc825' : '#888', textAlign: 'center', lineHeight: '1.2' }}>
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
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', margin: '0 0 10px' }}>Hoje — acumulado</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <CardDelta label="Aulas no dia" valor={hojeAcumulado.totalAulas} delta={hojeAcumulado.deltaAulas} />
          <CardDelta label="Alunos esperados" valor={hojeAcumulado.alunosEsperados} delta={hojeAcumulado.deltaAlunos} />
        </div>
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: '14px', border: '1px solid #252525',
          padding: '16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#fcc825' }}>{hojeAcumulado.pctPresenca}%</div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px' }}>Presença acumulada</div>
          <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: '#252525', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${hojeAcumulado.pctPresenca}%`, height: '100%', backgroundColor: '#1D9E75', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px' }}>
            <span style={{ color: '#1D9E75' }}>✓ {hojeAcumulado.presentes} presentes</span>
            <span style={{ color: '#e24b4a' }}>✗ {hojeAcumulado.faltas} faltas</span>
          </div>
        </div>
      </div>

      {/* Professores agora */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', margin: '0 0 10px' }}>Professores agora</h2>
        {isLoading ? <Loading /> : professoresAgora.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', padding: '16px' }}>Nenhum professor cadastrado</div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {professoresAgora.map(prof => {
              const ativo = prof.status === 'ativo'
              const conteudo = (
                <div style={{
                  flexShrink: 0, width: '128px',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  padding: '10px', borderRadius: '12px',
                  backgroundColor: '#1a1a1a', border: '1px solid #252525', textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: ativo ? '#1D9E75' : '#444', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#F0F2F5', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prof.nome?.split(' ')[0]}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: ativo ? '#fcc825' : '#555' }}>
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
        <span style={{ fontSize: '10px', color: '#222', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </span>
      </div>
    </div>
  )
}
