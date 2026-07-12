import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download } from 'lucide-react'
import { PONTOS_POR_RESULTADO, NIVEIS_ASSIDUIDADE, JANELA_DIAS, MINIMO_JOGOS_CLASSIFICACAO } from '../../lib/pontuacaoBeyond'
import { MODALIDADE_EMPRESA } from '../../constants/modalidades'
import { exportarRegrasRankingPDF } from '../../lib/relatorioPdf'
import toast from 'react-hot-toast'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const secaoStyle = { marginBottom: '30px' }
const tituloStyle = { fontSize: '15px', fontWeight: '700', color: '#F0F2F5', margin: '0 0 12px' }
const paragrafoStyle = { fontSize: '13px', color: '#aaa', lineHeight: '1.7', margin: '0 0 10px' }

function Secao({ titulo, children }) {
  return (
    <div style={secaoStyle}>
      <h2 style={tituloStyle}>{titulo}</h2>
      {children}
    </div>
  )
}

// Exemplo numérico — mesmo cálculo usado em exportarRegrasRankingPDF (relatorioPdf.js), só
// pra ilustrar a fórmula de forma concreta, com o líder hipotético de uma categoria.
const JOGOS_EXEMPLO = 12
const VITORIAS_EXEMPLO = 9
const DERROTAS_EXEMPLO = 3
const NIVEL_EXEMPLO = NIVEIS_ASSIDUIDADE.find(n => n.chave === 'Prata')
const SOMA_EXEMPLO = VITORIAS_EXEMPLO * PONTOS_POR_RESULTADO.avulso.vitoria + DERROTAS_EXEMPLO * PONTOS_POR_RESULTADO.avulso.derrota
const MEDIA_EXEMPLO = Math.round((SOMA_EXEMPLO / JOGOS_EXEMPLO) * 10) / 10
const PONTUACAO_EXEMPLO = Math.round(MEDIA_EXEMPLO * NIVEL_EXEMPLO.multiplicador * 10) / 10

export function ComoFuncionaORankingPage() {
  const navigate = useNavigate()
  const [exportando, setExportando] = useState(false)

  async function handleExportarPDF() {
    setExportando(true)
    try {
      await exportarRegrasRankingPDF({ empresa: MODALIDADE_EMPRESA['Tênis'] || 'procopio' })
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + err.message, { style: toastStyle })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100%', backgroundColor: '#110f0f',
      display: 'flex', justifyContent: 'center', padding: '24px 16px',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: '640px' }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
          color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '20px',
        }}>
          <ChevronLeft size={16} /> Voltar
        </button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '40px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: '0 0 4px' }}>
            Regras do Ranking
          </h1>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Pontuação Beyond — Tênis</p>
        </div>

        <Secao titulo="1. Tabela de pontos por jogo">
          <p style={paragrafoStyle}>
            Cada jogo aprovado soma pontos pro jogador — jogos de <b>torneio interno valem o
            dobro</b>, pra estimular participação:
          </p>
          <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 14px', backgroundColor: '#1a1a1a' }}>
              <span style={{ fontSize: '11px', color: '#555', fontWeight: '700' }}>RESULTADO</span>
              <span style={{ fontSize: '11px', color: '#555', fontWeight: '700', textAlign: 'right' }}>AVULSO</span>
              <span style={{ fontSize: '11px', color: '#555', fontWeight: '700', textAlign: 'right' }}>TORNEIO</span>
            </div>
            {[
              ['Vitória', PONTOS_POR_RESULTADO.avulso.vitoria, PONTOS_POR_RESULTADO.torneio.vitoria],
              ['Derrota', PONTOS_POR_RESULTADO.avulso.derrota, PONTOS_POR_RESULTADO.torneio.derrota],
              ['Vitória por W.O.', PONTOS_POR_RESULTADO.avulso.wo_vitoria, PONTOS_POR_RESULTADO.torneio.wo_vitoria],
              ['Derrota por W.O.', PONTOS_POR_RESULTADO.avulso.wo_derrota, PONTOS_POR_RESULTADO.torneio.wo_derrota],
              ['Jogo cancelado', 0, 0],
            ].map(([nome, avulso, torneio], i) => (
              <div key={nome} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 14px', backgroundColor: i % 2 === 1 ? '#161616' : 'transparent' }}>
                <span style={{ fontSize: '13px', color: '#F0F2F5' }}>{nome}</span>
                <span style={{ fontSize: '13px', color: '#fcc825', fontWeight: '700', textAlign: 'right' }}>{avulso}</span>
                <span style={{ fontSize: '13px', color: '#fcc825', fontWeight: '700', textAlign: 'right' }}>{torneio}</span>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="2. A fórmula">
          <p style={{ ...paragrafoStyle, fontSize: '14px', color: '#F0F2F5', fontWeight: '600', textAlign: 'center', padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.25)' }}>
            Pontuação Beyond = média de pontos por jogo × nível de assiduidade
          </p>
          <p style={paragrafoStyle}>
            A média usa <b>todos os jogos válidos</b> dos últimos {JANELA_DIAS} dias — sem
            descartar nenhum, nem a pior derrota: isso é intencional, e reflete a fase atual de
            cada jogador. Diferente do PC Score técnico, aqui <b>maior é sempre melhor</b>.
          </p>
        </Secao>

        <Secao titulo="3. Níveis de assiduidade">
          <p style={paragrafoStyle}>
            O multiplicador da fórmula depende de quantos jogos válidos o jogador teve nos
            últimos {JANELA_DIAS} dias:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {NIVEIS_ASSIDUIDADE.map(n => (
              <div key={n.chave} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '10px',
                backgroundColor: `${n.cor}12`, border: `1px solid ${n.cor}33`,
              }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: n.cor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0F2F5' }}>{n.chave}</span>
                  <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                    {n.max === Infinity ? `${n.min}+ jogos` : `${n.min}–${n.max} jogos`}
                  </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: n.cor }}>×{n.multiplicador}</span>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="4. As regras">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              `Mínimo de ${MINIMO_JOGOS_CLASSIFICACAO} jogos válidos na janela pra aparecer classificado na tabela — antes disso, o jogador fica "Em qualificação".`,
              `Janela deslizante de ${JANELA_DIAS} dias: todo dia, jogos que completam ${JANELA_DIAS} dias saem automaticamente da conta. Não é um reset em bloco — é contínuo.`,
              'Derrota também pontua e entra na média — perder participando é melhor do que não jogar, mas uma sequência de derrotas puxa a pontuação pra baixo de verdade.',
              'Cortes de categoria a cada 3 meses, alinhados ao ciclo de avaliação técnica: os melhores colocados de cada categoria sobem de nível, os últimos descem.',
            ].map((regra, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#cf1b9b', flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.7' }}>{regra}</span>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="5. Pontuação Beyond × PC Score — são coisas diferentes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825' }}>Pontuação Beyond</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Mede o <b>resultado em partidas</b> (o placar dos jogos). Maior = melhor.
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#cf1b9b' }}>PC Score</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Mede a <b>evolução técnica</b> avaliada pelo professor. Menor = melhor.
              </div>
            </div>
          </div>
          <p style={{ ...paragrafoStyle, marginTop: '10px' }}>
            O PC Score pode sugerir a categoria inicial de um aluno no ranking, mas o gestor
            sempre pode ajustar manualmente — os dois indicadores nunca se misturam no card do
            aluno.
          </p>
        </Secao>

        <Secao titulo="6. Exemplo de cálculo">
          <p style={paragrafoStyle}>
            Um jogador com {JOGOS_EXEMPLO} jogos válidos na janela (nível {NIVEL_EXEMPLO.chave},
            multiplicador ×{NIVEL_EXEMPLO.multiplicador}), sendo {VITORIAS_EXEMPLO} vitórias e{' '}
            {DERROTAS_EXEMPLO} derrotas em jogos avulsos:
          </p>
          <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: '12px', color: '#888' }}>
              Média: ({VITORIAS_EXEMPLO} × {PONTOS_POR_RESULTADO.avulso.vitoria} + {DERROTAS_EXEMPLO} × {PONTOS_POR_RESULTADO.avulso.derrota}) ÷ {JOGOS_EXEMPLO} = <b style={{ color: '#ccc' }}>{MEDIA_EXEMPLO}</b> pontos/jogo
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#fcc825', marginTop: '8px' }}>
              Pontuação Beyond: {MEDIA_EXEMPLO} × {NIVEL_EXEMPLO.multiplicador} = {PONTUACAO_EXEMPLO}
            </div>
          </div>
        </Secao>

        <button
          onClick={handleExportarPDF}
          disabled={exportando}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
            padding: '13px', borderRadius: '10px', border: 'none', cursor: exportando ? 'default' : 'pointer',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
            fontSize: '13px', fontWeight: '700', opacity: exportando ? 0.6 : 1, marginBottom: '10px',
          }}
        >
          <Download size={15} />
          {exportando ? 'Gerando PDF...' : 'Exportar Regras em PDF'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '10px', color: '#222', marginTop: '24px', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </p>
      </div>
    </div>
  )
}
