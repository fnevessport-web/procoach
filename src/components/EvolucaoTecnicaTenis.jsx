import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { NIVEIS_PC_SCORE, nivelPorPcScore } from '../lib/pcScore'
import { BADGES } from '../constants/badges'

function fmtData(d) {
  return d ? format(new Date(d + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

function SecaoTitulo({ children }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
      {children}
    </div>
  )
}

function CardVazio({ texto }) {
  return (
    <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#111', border: '1px dashed #2a2a2a', textAlign: 'center', fontSize: '12px', color: '#555' }}>
      {texto}
    </div>
  )
}

// Bolinhas 1-5 preenchidas — mesma linguagem visual usada em qualquer nota do app.
function DotsNota({ nota, cor }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{
          width: '9px', height: '9px', borderRadius: '50%',
          backgroundColor: n <= nota ? cor : '#2a2a2a',
        }} />
      ))}
    </div>
  )
}

// Módulo de Evolução Técnica — só Tênis nesta primeira versão (arquitetura pronta pra
// outras modalidades entrarem depois, ver pcScore.js). Recebe a lista completa de
// avaliações da modalidade (mais antiga primeiro, mesmo formato de useAvaliacoesModalidade)
// + as presenças já buscadas pelo card, pra não duplicar consulta.
export function EvolucaoTecnicaTenis({ aluno, avaliacoes, presencas }) {
  const navigate = useNavigate()

  const ultimaAvaliacao = avaliacoes?.length ? avaliacoes[avaliacoes.length - 1] : null
  const avaliacaoAnterior = avaliacoes?.length >= 2 ? avaliacoes[avaliacoes.length - 2] : null

  if (!ultimaAvaliacao) {
    return (
      <div>
        <SecaoTitulo>Evolução técnica</SecaoTitulo>
        <CardVazio texto="Nenhuma avaliação técnica ainda nesta modalidade — clique em &quot;Avaliar aluno&quot; pra começar." />
      </div>
    )
  }

  const pcScoreAtual = ultimaAvaliacao.pc_score
  const nivelAtual = pcScoreAtual != null ? nivelPorPcScore(pcScoreAtual) : null
  const corPcScore = nivelAtual?.cor || '#888'

  const variacaoPcScore = pcScoreAtual != null && avaliacaoAnterior?.pc_score != null
    ? pcScoreAtual - avaliacaoAnterior.pc_score
    : null
  // PC Score: menor é melhor — uma variação negativa (score caiu) é melhora, por isso a
  // seta e a cor são invertidas em relação ao que normalmente se esperaria de "+X".
  const melhorou = variacaoPcScore != null && variacaoPcScore < 0

  const totalPresencas = (presencas || []).filter(p => p.status_presenca === 'presente').length

  const entradasDimensoes = Object.entries(ultimaAvaliacao.dimensoes || {})
  const radarData = entradasDimensoes.map(([dimensao, valor]) => ({ dimensao, valor }))
  const proximoFoco = entradasDimensoes.length
    ? entradasDimensoes.reduce((pior, atual) => (atual[1] < pior[1] ? atual : pior))
    : null

  const ultimasQuatro = (avaliacoes || []).slice(-4).filter(a => a.pc_score != null)
  const evolucaoPcScore = ultimasQuatro.map(a => ({
    data: format(new Date(a.data_avaliacao + 'T12:00'), 'dd/MM', { locale: ptBR }),
    pcScore: a.pc_score,
  }))

  const badgesConquistados = (aluno.badges || []).filter(b => BADGES[b.tipo_badge])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Destaques lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Aulas com presença
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#F0F2F5' }}>{totalPresencas}</div>
        </div>
        <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#111', border: `1px solid ${corPcScore}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PC Score</span>
            <button
              onClick={() => navigate('/pontuacao')}
              title="Como funciona a pontuação"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#444' }}
            >
              <HelpCircle size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '26px', fontWeight: '800', color: corPcScore }}>
              {pcScoreAtual != null ? pcScoreAtual : '—'}
            </span>
            {variacaoPcScore != null && variacaoPcScore !== 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: '700',
                color: melhorou ? '#22c55e' : '#EF4444',
              }}>
                {melhorou ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                {Math.abs(variacaoPcScore)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: corPcScore, marginTop: '2px', fontWeight: '600' }}>
            {nivelAtual?.label || 'Faixa etária não definida'}
          </div>
        </div>
      </div>

      {pcScoreAtual == null && (
        <div style={{
          padding: '10px 12px', borderRadius: '10px', fontSize: '11px', color: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)',
        }}>
          Essa avaliação não tem PC Score calculado — falta faixa etária do aluno (data de nascimento
          ou seleção manual do professor).
        </div>
      )}

      {/* Radar das 6 dimensões */}
      <div>
        <SecaoTitulo>Perfil técnico</SecaoTitulo>
        <div style={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid #2a2a2a', padding: '10px' }}>
          <div style={{ fontSize: '11px', color: '#555', padding: '6px 8px 10px' }}>{fmtData(ultimaAvaliacao.data_avaliacao)}</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#2a2a2a" />
                <PolarAngleAxis dataKey="dimensao" tick={{ fill: '#888', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#444', fontSize: 9 }} axisLine={false} />
                <Radar dataKey="valor" stroke="#fcc825" fill="#fcc825" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#F0F2F5' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela de dimensões com dots */}
      <div>
        <SecaoTitulo>Dimensões</SecaoTitulo>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entradasDimensoes.map(([nome, valor]) => (
            <div key={nome} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: '9px', backgroundColor: '#111', border: '1px solid #2a2a2a',
            }}>
              <span style={{ fontSize: '13px', color: '#F0F2F5' }}>{nome}</span>
              <DotsNota nota={valor} cor="#fcc825" />
            </div>
          ))}
        </div>
      </div>

      {/* Próximo foco */}
      {proximoFoco && (
        <div style={{
          padding: '14px', borderRadius: '12px',
          backgroundColor: 'rgba(207,27,155,0.08)', border: '1px solid rgba(207,27,155,0.25)',
        }}>
          <div style={{ fontSize: '10px', color: '#cf1b9b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>
            Próximo foco
          </div>
          <div style={{ fontSize: '15px', color: '#F0F2F5', fontWeight: '700' }}>{proximoFoco[0]}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Nota atual: {proximoFoco[1]}/5 — a dimensão com mais espaço pra evoluir.</div>
        </div>
      )}

      {/* Evolução do PC Score — eixo invertido, menor é melhor */}
      {evolucaoPcScore.length > 1 && (
        <div>
          <SecaoTitulo>Evolução do PC Score</SecaoTitulo>
          <div style={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid #2a2a2a', padding: '10px', width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={evolucaoPcScore} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tick={{ fill: '#555', fontSize: 10 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
                <YAxis domain={[1, 100]} reversed tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#F0F2F5' }} />
                <Line type="monotone" dataKey="pcScore" stroke="#cf1b9b" strokeWidth={2} dot={{ r: 4, fill: '#cf1b9b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '10px', color: '#555', margin: '6px 0 0' }}>Quanto mais pra baixo no gráfico, melhor o nível técnico.</p>
        </div>
      )}

      {/* Análise Inteligente — narrativa gerada por IA, cacheada na própria avaliação */}
      <div>
        <SecaoTitulo>Análise inteligente</SecaoTitulo>
        {ultimaAvaliacao.narrativa_ia ? (
          <div style={{
            padding: '14px', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #2a2a2a',
            fontSize: '13px', color: '#ccc', lineHeight: '1.6',
          }}>
            {ultimaAvaliacao.narrativa_ia}
          </div>
        ) : (
          <CardVazio texto="Análise ainda não gerada pra essa avaliação." />
        )}
      </div>

      {/* Badges */}
      {badgesConquistados.length > 0 && (
        <div>
          <SecaoTitulo>Conquistas</SecaoTitulo>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {badgesConquistados.map(b => {
              const info = BADGES[b.tipo_badge]
              return (
                <span key={b.id} style={{
                  fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
                  backgroundColor: 'rgba(255,255,255,0.06)', color: '#F0F2F5', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  {info.emoji} {info.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {ultimaAvaliacao.comentario && (
        <div>
          <SecaoTitulo>Observação do professor</SecaoTitulo>
          <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#111', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            "{ultimaAvaliacao.comentario}"
          </div>
        </div>
      )}
    </div>
  )
}

// Exportado só pra referência de outras telas que precisem da mesma legenda dos 5 níveis
// (ex.: PDF, página de regras) sem duplicar a lista.
export { NIVEIS_PC_SCORE }
