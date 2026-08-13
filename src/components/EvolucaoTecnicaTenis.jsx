import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronDown, ChevronUp, HelpCircle, AlertTriangle, Download, Pencil, Share2 } from 'lucide-react'
import { NIVEIS_PC_SCORE, nivelPorPcScore, precisaReavaliar, REAVALIACAO_PRAZO_DIAS, calcularMediasDominios } from '../lib/pcScore'
import { MODALIDADE_EMPRESA } from '../constants/modalidades'
import { exportarEvolucaoTecnicaPDF } from '../lib/relatorioPdf'
import { usePermissions } from '../hooks/usePermissions'
import { useCatalogoConquistas, useConquistasDoAluno } from '../hooks/useConquistas'
import { FileiraConquistas } from './ConquistasCard'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

function fmtData(d) {
  return d ? format(new Date(d + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

// pcScore.js guarda as cores dos níveis em hex (pra usar direto em CSS) — o jsPDF exige
// arrays [r,g,b], então convertemos só na hora de montar o PDF.
function hexParaRgb(hex) {
  const limpo = hex.replace('#', '')
  const bigint = parseInt(limpo, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

function SecaoTitulo({ children }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
      {children}
    </div>
  )
}

function CardVazio({ texto }) {
  return (
    <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px dashed var(--color-border-light)', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
      {texto}
    </div>
  )
}

function formataNota(n) {
  return n.toFixed(1).replace('.', ',')
}

// Módulo de Evolução Técnica — só Tênis nesta primeira versão (arquitetura pronta pra
// outras modalidades entrarem depois, ver pcScore.js). Recebe a lista completa de
// avaliações da modalidade (mais antiga primeiro, mesmo formato de useAvaliacoesModalidade)
// + as presenças já buscadas pelo card, pra não duplicar consulta.
// exportarPdfFn/brandingParams: só usados pelo modo Particular (CadastroParticular.jsx), que
// não pode gerar o PDF Beyond/Procópio — default preserva 100% do comportamento de hoje pra
// todo call site do clube (AlunoCard.jsx etc.), que não passa essas props.
export function EvolucaoTecnicaTenis({ aluno, modalidadeId, modalidadeNome, avaliacoes, presencas, definicoesDimensoes, exportarPdfFn, brandingParams }) {
  const navigate = useNavigate()
  const { podeEditarAvaliacaoTecnica } = usePermissions()
  const [exportando, setExportando] = useState(false)
  // { blob, filename } | null — depois de gerado, troca o botão único "Exportar PDF" por
  // "Baixar" + "Encaminhar" (arquivo de verdade, via Web Share API — sem link, sem login).
  const [pdfPronto, setPdfPronto] = useState(null)
  // Mesmas duas queries que o ConquistasCard.jsx (Card do Aluno) já usa — react-query dedupe
  // pela queryKey, então não duplica request nenhum quando os dois estão montados juntos.
  const { data: catalogoConquistas } = useCatalogoConquistas()
  const { data: minhasConquistas } = useConquistasDoAluno(aluno?.id)

  // Avaliação 'pendente' (aguardando confirmação de outro professor da modalidade, ver
  // migration 011) ainda não conta pro histórico oficial — não entra no radar, na evolução
  // do PC Score nem na regra dos 90 dias. Só aparece como um selo informativo enquanto isso.
  const avaliacoesConfirmadas = (avaliacoes || []).filter(a => a.status === 'confirmada')
  const ultimaBruta = avaliacoes?.length ? avaliacoes[avaliacoes.length - 1] : null
  const pendenteMaisRecente = ultimaBruta?.status === 'pendente' ? ultimaBruta : null
  const confirmacoesFaltando = (pendenteMaisRecente?.avaliacoes_tecnicas_confirmacoes || []).filter(c => !c.confirmado_em)
  const nomesFaltando = confirmacoesFaltando.map(c => c.professores?.nome).filter(Boolean).join(', ') || 'outro professor'

  const ultimaAvaliacao = avaliacoesConfirmadas.length ? avaliacoesConfirmadas[avaliacoesConfirmadas.length - 1] : null
  const avaliacaoAnterior = avaliacoesConfirmadas.length >= 2 ? avaliacoesConfirmadas[avaliacoesConfirmadas.length - 2] : null

  if (!ultimaAvaliacao) {
    return (
      <div>
        <SecaoTitulo>Evolução técnica</SecaoTitulo>
        {pendenteMaisRecente ? (
          <CardVazio texto={`Avaliação registrada, aguardando confirmação de ${nomesFaltando} pra virar oficial.`} />
        ) : (
          <CardVazio texto="Nenhuma avaliação técnica ainda nesta modalidade — clique em &quot;Avaliar aluno&quot; pra começar." />
        )}
        {podeEditarAvaliacaoTecnica && (
          <div style={{ marginTop: '18px' }}>
            <HistoricoCompleto aluno={aluno} modalidadeId={modalidadeId} avaliacoes={avaliacoes} navigate={navigate} />
          </div>
        )}
      </div>
    )
  }

  const pcScoreAtual = ultimaAvaliacao.pc_score
  const nivelAtual = pcScoreAtual != null ? nivelPorPcScore(pcScoreAtual) : null
  const corPcScore = nivelAtual?.cor || 'var(--color-text-light-secondary)'

  const variacaoPcScore = pcScoreAtual != null && avaliacaoAnterior?.pc_score != null
    ? pcScoreAtual - avaliacaoAnterior.pc_score
    : null
  // PC Score: menor é melhor — uma variação negativa (score caiu) é melhora, por isso a
  // seta e a cor são invertidas em relação ao que normalmente se esperaria de "+X".
  const melhorou = variacaoPcScore != null && variacaoPcScore < 0

  const totalPresencas = (presencas || []).filter(p => p.status_presenca === 'presente').length
  const reavaliacaoPendente = precisaReavaliar(ultimaAvaliacao.data_avaliacao)

  // Médias por domínio (Saque, Jogo de Fundo, Jogo de Rede, Tática, Condicionamento Físico) —
  // mesma unidade que já alimenta o PC Score (pcScore.js), 1 subitem sozinho seria ruído
  // demais pro radar.
  const mediasDominio = calcularMediasDominios(ultimaAvaliacao.dimensoes, definicoesDimensoes)
  const radarData = mediasDominio.map(u => ({ dimensao: u.nome, valor: u.media }))

  const ultimasQuatro = avaliacoesConfirmadas.slice(-4).filter(a => a.pc_score != null)
  const evolucaoPcScore = ultimasQuatro.map(a => ({
    data: format(new Date(a.data_avaliacao + 'T12:00'), 'dd/MM', { locale: ptBR }),
    pcScore: a.pc_score,
  }))

  // Evolução por domínio (mesmas últimas avaliações confirmadas do PC Score) — pro PDF poder
  // desenhar um mini-gráfico por domínio ao lado do gráfico geral.
  const mediasPorAvaliacao = ultimasQuatro.map(a => ({
    data: format(new Date(a.data_avaliacao + 'T12:00'), 'dd/MM', { locale: ptBR }),
    medias: calcularMediasDominios(a.dimensoes, definicoesDimensoes),
  }))
  const evolucaoPorDominio = mediasDominio
    .map(dom => ({
      nome: dom.nome,
      pontos: mediasPorAvaliacao
        .map(mp => ({ data: mp.data, valor: mp.medias.find(m => m.nome === dom.nome)?.media }))
        .filter(p => p.valor != null),
    }))
    .filter(d => d.pontos.length > 1)

  // Conquistas desbloqueadas (catálogo novo, com ícone SVG oficial) — alimenta tanto a seção
  // "Conquistas" em tela (estilo figurinha) quanto o PDF.
  const minhasConquistasPorId = Object.fromEntries((minhasConquistas || []).map(m => [m.conquista_id, m]))
  const conquistasDesbloqueadas = (catalogoConquistas || []).filter(c => minhasConquistasPorId[c.id]?.ativa)

  // Histórico mensal do ano corrente (janeiro até o mês atual) — presenças (conta reposição
  // como aula normal, já que ela já entra em status_presenca='presente') e faltas não
  // justificadas, lado a lado por mês. Sem corte de linhas (useHistoricoPresencaModalidade já
  // não limita mais), senão meses mais antigos do ano ficariam faltando pra aluno assíduo.
  const hoje = new Date()
  const historicoMensal = Array.from({ length: hoje.getMonth() + 1 }, (_, i) => {
    const mesData = new Date(hoje.getFullYear(), i, 1)
    const mesStr = format(mesData, 'yyyy-MM')
    const doMes = (presencas || []).filter(p => p.aulas?.data_aula?.startsWith(mesStr))
    return {
      mes: format(mesData, 'MMM', { locale: ptBR }).toUpperCase().replace('.', ''),
      presentes: doMes.filter(p => p.status_presenca === 'presente').length,
      faltas: doMes.filter(p => p.status_presenca === 'falta').length,
    }
  })

  async function handleExportarPDF() {
    setExportando(true)
    try {
      const fn = exportarPdfFn || exportarEvolucaoTecnicaPDF
      const resultado = await fn({
        alunoNome: aluno.nome,
        fotoUrl: aluno.foto_url,
        modalidadeNome,
        totalPresencas,
        pcScoreAtual,
        variacaoPcScore,
        nivelLabel: nivelAtual?.label || 'Faixa etária não definida',
        nivelChave: nivelAtual?.chave || null,
        dimensoes: mediasDominio.map(u => ({ nome: u.nome, valor: u.media })),
        evolucaoPcScore,
        evolucaoPorDominio,
        narrativaIA: ultimaAvaliacao.narrativa_ia,
        conquistas: conquistasDesbloqueadas.map(c => ({ nome: c.nome, icone: c.icone })),
        historicoMensal,
        niveisPcScore: NIVEIS_PC_SCORE.map(n => ({ ...n, cor: hexParaRgb(n.cor) })),
      }, brandingParams || { empresa: MODALIDADE_EMPRESA[modalidadeNome] || 'procopio' })
      setPdfPronto(resultado)
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + err.message, { style: toastStyle })
    } finally {
      setExportando(false)
    }
  }

  function handleBaixarPDF() {
    const url = URL.createObjectURL(pdfPronto.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = pdfPronto.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleEncaminharPDF() {
    try {
      const arquivo = new File([pdfPronto.blob], pdfPronto.filename, { type: 'application/pdf' })
      await navigator.share({ files: [arquivo], title: pdfPronto.filename, text: `Evolução técnica de ${aluno.nome}` })
    } catch {
      // Usuário cancelou o menu de compartilhamento ou o SO recusou — nada a fazer.
    }
  }

  const podeEncaminhar = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([], 'x.pdf', { type: 'application/pdf' })] })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        {!pdfPronto ? (
          <button
            onClick={handleExportarPDF}
            disabled={exportando}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '9px', border: '1px solid var(--color-border-light)', cursor: exportando ? 'default' : 'pointer',
              backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)', fontSize: '12px', fontWeight: '600',
              opacity: exportando ? 0.6 : 1,
            }}
          >
            <Download size={13} />
            {exportando ? 'Gerando PDF...' : 'Exportar PDF'}
          </button>
        ) : (
          <>
            <button
              onClick={handleBaixarPDF}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '9px', border: '1px solid var(--color-border-light)', cursor: 'pointer',
                backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)', fontSize: '12px', fontWeight: '600',
              }}
            >
              <Download size={13} /> Baixar PDF
            </button>
            {podeEncaminhar && (
              <button
                onClick={handleEncaminharPDF}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  background: 'var(--color-action-primary)', color: 'white', fontSize: '12px', fontWeight: '600',
                }}
              >
                <Share2 size={13} /> Encaminhar
              </button>
            )}
          </>
        )}
      </div>

      {pendenteMaisRecente && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px',
          backgroundColor: 'rgba(165,76,46,0.08)', border: '1px solid rgba(165,76,46,0.25)',
        }}>
          <AlertTriangle size={14} color="var(--color-action-primary)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--color-action-primary)' }}>
            Nova avaliação aguardando confirmação de {nomesFaltando} — ainda não entra nas métricas abaixo.
          </span>
        </div>
      )}

      {reavaliacaoPendente && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px',
          backgroundColor: 'rgba(180,71,47,0.08)', border: '1px solid rgba(180,71,47,0.25)',
        }}>
          <AlertTriangle size={14} color="var(--color-state-danger)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--color-state-danger)' }}>
            Reavaliação pendente — última avaliação há mais de {REAVALIACAO_PRAZO_DIAS} dias.
          </span>
        </div>
      )}

      {/* Destaques lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Aulas com presença
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--color-text-light-primary)' }}>{totalPresencas}</div>
        </div>
        <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-overlay)', border: `1px solid ${corPcScore}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PC Score</span>
            <button
              onClick={() => navigate('/pontuacao')}
              title="Como funciona a pontuação"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--color-text-light-muted)' }}
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
                color: melhorou ? 'var(--color-state-success)' : 'var(--color-state-danger)',
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
          padding: '10px 12px', borderRadius: '10px', fontSize: '11px', color: 'var(--color-state-warning)',
          backgroundColor: 'rgba(201,138,60,0.08)', border: '1px solid rgba(201,138,60,0.25)',
        }}>
          Essa avaliação não tem PC Score calculado — falta faixa etária do aluno (data de nascimento
          ou seleção manual do professor).
        </div>
      )}

      {/* Radar dos 5 domínios (cada um é a média dos seus subitens, nota 1-10) */}
      <div>
        <SecaoTitulo>Perfil técnico</SecaoTitulo>
        <div style={{ backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '12px', border: '1px solid var(--color-border-light)', padding: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', padding: '6px 8px 10px' }}>{fmtData(ultimaAvaliacao.data_avaliacao)}</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="var(--color-border-light)" />
                <PolarAngleAxis dataKey="dimensao" tick={{ fill: 'var(--color-text-light-secondary)', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fill: 'var(--color-text-light-muted)', fontSize: 9 }} axisLine={false} />
                <Radar dataKey="valor" stroke="var(--color-action-primary)" fill="var(--color-action-primary)" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: 'var(--color-text-light-primary)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Domínios */}
      <div>
        <SecaoTitulo>Domínios</SecaoTitulo>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mediasDominio.map(u => (
            <div key={u.nome} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-light-primary)' }}>{u.nome}</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{formataNota(u.media)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Evolução do PC Score — eixo invertido, menor é melhor */}
      {evolucaoPcScore.length > 1 && (
        <div>
          <SecaoTitulo>Evolução do PC Score</SecaoTitulo>
          <div style={{ backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '12px', border: '1px solid var(--color-border-light)', padding: '10px', width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={evolucaoPcScore} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border-light)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tick={{ fill: 'var(--color-text-light-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--color-border-light)' }} tickLine={false} />
                <YAxis domain={[1, 100]} reversed tick={{ fill: 'var(--color-text-light-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: 'var(--color-text-light-primary)' }} />
                <Line type="monotone" dataKey="pcScore" stroke="var(--color-state-info)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-state-info)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', margin: '6px 0 0' }}>Quanto mais pra baixo no gráfico, melhor o nível técnico.</p>
        </div>
      )}

      {/* Análise Inteligente — narrativa gerada por IA, cacheada na própria avaliação */}
      <div>
        <SecaoTitulo>Análise inteligente</SecaoTitulo>
        {ultimaAvaliacao.narrativa_ia ? (
          <div style={{
            padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
            fontSize: '13px', color: 'var(--color-text-light-secondary)', lineHeight: '1.6',
          }}>
            {ultimaAvaliacao.narrativa_ia}
          </div>
        ) : (
          <CardVazio texto="Análise ainda não gerada pra essa avaliação." />
        )}
      </div>

      {/* Conquistas */}
      {conquistasDesbloqueadas.length > 0 && (
        <div>
          <SecaoTitulo>Conquistas</SecaoTitulo>
          <FileiraConquistas conquistas={conquistasDesbloqueadas} />
        </div>
      )}

      {/* Histórico completo + edição — exclusivo de quem tem podeEditarAvaliacaoTecnica
          (hoje só o role gestor). Mostra TODAS as avaliações (inclusive pendentes), não só a
          última confirmada — é justamente o que falta pro resto da tela, que só olha a
          confirmada mais recente. */}
      {podeEditarAvaliacaoTecnica && (
        <HistoricoCompleto aluno={aluno} modalidadeId={modalidadeId} avaliacoes={avaliacoes} navigate={navigate} />
      )}
    </div>
  )
}

// Lista de toda avaliação (confirmada ou pendente) com botão de editar — navega pra
// /avaliar-aluno em modo edição (ver AvaliarAluno.jsx, avaliacaoParaEditar).
function HistoricoCompleto({ aluno, modalidadeId, avaliacoes, navigate }) {
  if (!avaliacoes?.length) return null
  const maisRecentesPrimeiro = [...avaliacoes].reverse()
  return (
    <div>
      <SecaoTitulo>Histórico completo (gestor)</SecaoTitulo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {maisRecentesPrimeiro.map(a => {
          const nivel = a.pc_score != null ? nivelPorPcScore(a.pc_score) : null
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light-primary)' }}>{fmtData(a.data_avaliacao)}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)' }}>
                  {a.professores?.nome || 'Professor não identificado'}
                  {a.status === 'pendente' && ' · pendente de confirmação'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {nivel && <span style={{ fontSize: '12px', fontWeight: '700', color: nivel.cor }}>{a.pc_score}</span>}
                <button
                  onClick={() => navigate('/avaliar-aluno', { state: { alunoId: aluno.id, alunoNome: aluno.nome, modalidadeId, avaliacaoParaEditar: a } })}
                  title="Editar avaliação"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-secondary)', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Exportado só pra referência de outras telas que precisem da mesma legenda dos 5 níveis
// (ex.: PDF, página de regras) sem duplicar a lista.
export { NIVEIS_PC_SCORE }
