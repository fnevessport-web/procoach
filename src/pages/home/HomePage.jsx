import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModalidades } from '../../hooks/useModalidades'
import { useHomeDashboard } from '../../hooks/useHomeDashboard'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'

const ICONES_MODALIDADES = {
  'Tênis':          '/images/tenis.png',
  'Padel':          '/images/padel.png',
  'Pickleball':     '/images/pickleball.png',
  'Squash':         '/images/squash.png',
  'Beach Tennis':   '/images/beachtennis.png',
  'Futevôlei':      '/images/futevolei.png',
  'Vôlei de Praia': '/images/voleidepraia.png',
}

const LOGO_EMPRESA = {
  procopio: '/images/logoprocopio.png',
  beach_arena: '/images/logobeacharena.png',
}

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
  const { aoVivoAgora, hojeAcumulado, professoresAgora, isLoading } = useHomeDashboard()
  const role = perfil?.role || 'professor'

  function abrirAula(aulaId) {
    navigate('/aulas', { state: { highlightAulaId: aulaId, fromHome: true } })
  }

  function selectModalidade(mod) {
    if (modalidadeSelecionada?.id === mod.id) {
      setModalidadeSelecionada(null)
    } else {
      setModalidadeSelecionada(mod)
      navigate('/aulas')
    }
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

      {/* Ao vivo agora */}
      <div style={{ marginBottom: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span className="pulse-badge" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#e24b4a' }} />
          <h2 style={{ fontSize: '12px', fontWeight: '700', color: '#888', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Ao vivo agora · {aoVivoAgora.length} {aoVivoAgora.length === 1 ? 'aula' : 'aulas'}
          </h2>
        </div>

        {isLoading ? <Loading /> : aoVivoAgora.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center', fontSize: '12px', color: '#444',
            backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #252525',
          }}>
            Nenhuma aula rolando agora
          </div>
        ) : (
          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
            {aoVivoAgora.map(aula => (
              <button key={aula.id} onClick={() => abrirAula(aula.id)} style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                padding: '12px', borderRadius: '12px', textAlign: 'left', width: '100%',
                backgroundColor: '#1a1a1a', border: '1px solid #252525', cursor: 'pointer',
                boxSizing: 'border-box',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="pulse-badge" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#e24b4a' }} />
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#e24b4a', letterSpacing: '0.5px' }}>AO VIVO</span>
                    <span style={{ fontSize: '11px', color: '#555' }}>{aula.turmas?.horario_inicio?.slice(0, 5)}</span>
                  </div>
                  {aula.empresa && LOGO_EMPRESA[aula.empresa] && (
                    <img src={LOGO_EMPRESA[aula.empresa]} alt={aula.empresa} style={{ height: '16px', objectFit: 'contain', opacity: 0.85 }} />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <FotoProfessor src={aula.professores?.foto_url} nome={aula.professores?.nome} />
                    <span style={{ fontSize: '9px', color: '#555', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {aula.professores?.nome?.split(' ')[0]}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {aula.turmas?.nome}
                    </div>
                    <div style={{ fontSize: '12px', color: '#fcc825', marginTop: '2px' }}>
                      {aula.quadraNome}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '5px', borderRadius: '8px', backgroundColor: 'rgba(29,158,117,0.12)', color: '#1D9E75', fontSize: '11px', fontWeight: '600' }}>
                    ✓ {aula.presentes} presente{aula.presentes !== 1 ? 's' : ''}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '5px', borderRadius: '8px', backgroundColor: 'rgba(226,75,74,0.12)', color: '#e24b4a', fontSize: '11px', fontWeight: '600' }}>
                    ✗ {aula.faltas} falta{aula.faltas !== 1 ? 's' : ''}
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
