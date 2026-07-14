import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download } from 'lucide-react'
import { PONTOS_POR_RESULTADO, NIVEIS_ASSIDUIDADE, JANELA_DIAS, MINIMO_JOGOS_CLASSIFICACAO, PESO_CATEGORIA, pontuacaoComPesoCategoria } from '../../lib/pontuacaoBeyond'
import { MODALIDADE_EMPRESA, EMPRESAS } from '../../constants/modalidades'
import { exportarRegrasRankingPDF } from '../../lib/relatorioPdf'
import toast from 'react-hot-toast'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

// Mesma paleta das faixas de cor dos relatórios Beyond (relatorioPdf.js: COR_SALVIA/
// COR_LARANJA/COR_VINHO/COR_MARINHO) — os 4 cards de pontos por jogo usam essas cores, pra
// amarrar a identidade visual entre a tela e o PDF exportado.
const COR_VITORIA = '#A3BFAE'
const COR_DERROTA = '#C1652F'
const COR_VITORIA_TORNEIO = '#1B293D'
const COR_DERROTA_TORNEIO = '#6B1B27'

const secaoStyle = { marginBottom: '30px' }
const tituloWrapStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }
const paragrafoStyle = { fontSize: '13px', color: '#aaa', lineHeight: '1.7', margin: '0 0 10px' }

function NumeroSecao({ n }) {
  return (
    <span style={{
      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: '800',
    }}>
      {n}
    </span>
  )
}

function Secao({ n, titulo, children }) {
  return (
    <div style={secaoStyle}>
      <div style={tituloWrapStyle}>
        <NumeroSecao n={n} />
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

function CardPonto({ valor, label, cor }) {
  return (
    <div style={{ flex: '1 1 auto', minWidth: '110px', padding: '14px 10px', borderRadius: '10px', backgroundColor: cor, textAlign: 'center' }}>
      <div style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>{valor}</div>
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.85)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

// Exemplo de cálculo do "líder" — mesmo número usado em exportarRegrasRankingPDF
// (relatorioPdf.js), pra ficar idêntico ao documento oficial de regras.
const LIDER_NOME = 'Rafael'
const LIDER_JOGOS = 24
const LIDER_NIVEL = NIVEIS_ASSIDUIDADE.find(n => n.chave === 'Ouro')
const LIDER_MEDIA = 97.9
const LIDER_PONTUACAO = Math.round(LIDER_MEDIA * LIDER_NIVEL.multiplicador * 10) / 10

// Exemplo didático do corte de categoria — mesmos 10 atletas fictícios do documento oficial,
// pra mostrar como média alta (Gustavo) e nível alto por assiduidade (Bruno) competem entre
// si na fórmula, e quem sobe/desce no corte do ciclo.
const EXEMPLO_CICLO = [
  { pos: 1, nome: 'Rafael', jogos: 24, nivel: 'Ouro', media: 97.9, peso: 1.5, pontuacao: 146.9, movimento: 'sobe' },
  { pos: 2, nome: 'Bruno', jogos: 22, nivel: 'Ouro', media: 85.9, peso: 1.5, pontuacao: 128.9, movimento: 'sobe' },
  { pos: 3, nome: 'Diego', jogos: 13, nivel: 'Prata', media: 90.0, peso: 1.2, pontuacao: 108.0, movimento: null },
  { pos: 4, nome: 'Gustavo', jogos: 9, nivel: 'Bronze', media: 87.8, peso: 1.0, pontuacao: 87.8, movimento: null },
  { pos: 5, nome: 'Paulo', jogos: 11, nivel: 'Prata', media: 70.9, peso: 1.2, pontuacao: 85.1, movimento: null },
  { pos: 6, nome: 'Thiago', jogos: 16, nivel: 'Prata', media: 68.8, peso: 1.2, pontuacao: 82.5, movimento: null },
  { pos: 7, nome: 'Enrico', jogos: 8, nivel: 'Bronze', media: 76.2, peso: 1.0, pontuacao: 76.2, movimento: null },
  { pos: 8, nome: 'Leonardo', jogos: 6, nivel: 'Bronze', media: 75.0, peso: 1.0, pontuacao: 75.0, movimento: null },
  { pos: 9, nome: 'Marcelo', jogos: 18, nivel: 'Prata', media: 54.4, peso: 1.2, pontuacao: 65.3, movimento: 'desce' },
  { pos: 10, nome: 'Fernando', jogos: 5, nivel: 'Bronze', media: 30.0, peso: 1.0, pontuacao: 30.0, movimento: 'desce' },
]

function corNivel(nivel) {
  return NIVEIS_ASSIDUIDADE.find(n => n.chave === nivel)?.cor || '#555'
}

// Ordem de exibição do peso de categoria — do mais fácil pro mais difícil, mesma leitura das
// 3 categorias adultas do ranking (ranking_categorias.ordem).
const ORDEM_PESO_CATEGORIA = ['Iniciante', 'Intermediário', 'Avançado']

// Mesmo Rafael da Seção 3, agora supondo categoria Avançado — mostra o mesmo número (146.9)
// ganhando a camada extra do peso de categoria no Ranking Geral.
const LIDER_CATEGORIA_EXEMPLO = 'Avançado'
const LIDER_PONTUACAO_GERAL = pontuacaoComPesoCategoria(LIDER_PONTUACAO, LIDER_CATEGORIA_EXEMPLO)

export function ComoFuncionaORankingPage() {
  const navigate = useNavigate()
  const [exportando, setExportando] = useState(false)
  const nomeUnidade = EMPRESAS.find(e => e.valor === (MODALIDADE_EMPRESA['Tênis'] || 'procopio'))?.label || ''

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
      height: '100vh', width: '100%', backgroundColor: '#110f0f',
      display: 'flex', justifyContent: 'center', padding: '24px 16px',
      boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
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
            Pontuação Beyond — Como Funciona o Ranking
          </h1>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
            Regras oficiais para associados · Ranking Interno de Tênis{nomeUnidade ? ` · ${nomeUnidade} Arena` : ''}
          </p>
        </div>

        <Secao n={1} titulo="Os pontos de cada jogo">
          <p style={paragrafoStyle}>
            Todo jogo dá pontos aos dois jogadores — <b>ganhar vale mais, mas perder também
            pontua</b>. Nos torneios internos os pontos valem <b>o dobro</b>, para estimular a
            participação.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <CardPonto valor={PONTOS_POR_RESULTADO.avulso.vitoria} label="Vitória" cor={COR_VITORIA} />
            <CardPonto valor={PONTOS_POR_RESULTADO.avulso.derrota} label="Derrota" cor={COR_DERROTA} />
            <CardPonto valor={PONTOS_POR_RESULTADO.torneio.vitoria} label="Vitória Torneio" cor={COR_VITORIA_TORNEIO} />
            <CardPonto valor={PONTOS_POR_RESULTADO.torneio.derrota} label="Derrota Torneio" cor={COR_DERROTA_TORNEIO} />
          </div>
        </Secao>

        <Secao n={2} titulo="Sua Pontuação Beyond = média × nível de assiduidade">
          <p style={paragrafoStyle}>
            Primeiro o sistema calcula a <b>média</b> dos seus pontos (soma dividida pelo número
            de jogos). Depois multiplica pelo seu <b>nível de assiduidade</b> — quanto mais você
            joga, maior o seu nível:
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {NIVEIS_ASSIDUIDADE.map(n => (
              <div key={n.chave} style={{
                flex: '1 1 auto', minWidth: '110px', padding: '12px 10px', borderRadius: '10px', textAlign: 'center',
                backgroundColor: `${n.cor}18`, border: `1px solid ${n.cor}44`,
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#F0F2F5' }}>{n.chave.toUpperCase()}</div>
                <div style={{ fontSize: '10px', color: '#888', margin: '2px 0 4px' }}>
                  {n.max === Infinity ? `${n.min}+ jogos` : `${n.min} a ${n.max} jogos`}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: n.cor }}>×{n.multiplicador}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.25)' }}>
            <p style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.7', margin: 0 }}>
              <b style={{ color: '#fcc825' }}>Por que o nível de assiduidade?</b> Para valorizar
              quem frequenta e joga com constância. Dois atletas com a mesma média: quem joga
              mais tem nível maior e sobe no ranking. <b>Aparecer e jogar compensa!</b>
            </p>
          </div>
        </Secao>

        <Secao n={3} titulo="Exemplo real — como o líder pontuou">
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#000', border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#fcc825', letterSpacing: '0.5px', marginBottom: '10px' }}>
              {LIDER_NOME.toUpperCase()} — {LIDER_JOGOS} JOGOS (NÍVEL {LIDER_NIVEL.chave.toUpperCase()})
            </div>
            <div style={{ fontSize: '12px', color: '#aaa', lineHeight: '1.9' }}>
              Média dos {LIDER_JOGOS} jogos = {LIDER_MEDIA} pontos<br />
              Nível {LIDER_NIVEL.chave} ({LIDER_NIVEL.min}+ jogos) = ×{LIDER_NIVEL.multiplicador}<br />
              Pontuação Beyond = {LIDER_MEDIA} × {LIDER_NIVEL.multiplicador} = <b style={{ color: '#fcc825' }}>{LIDER_PONTUACAO}</b>
            </div>
          </div>
        </Secao>

        <Secao n={4} titulo="Tabela do ciclo — exemplo com 10 atletas">
          <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #2a2a2a', marginBottom: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1.6fr 1fr 1fr 1.2fr', gap: '4px', padding: '9px 10px', backgroundColor: '#000' }}>
              <span />
              <span style={{ fontSize: '10px', color: '#888', fontWeight: '700' }}>ATLETA</span>
              <span style={{ fontSize: '10px', color: '#888', fontWeight: '700', textAlign: 'right' }}>JOGOS</span>
              <span style={{ fontSize: '10px', color: '#888', fontWeight: '700', textAlign: 'right' }}>NÍVEL</span>
              <span style={{ fontSize: '10px', color: '#888', fontWeight: '700', textAlign: 'right' }}>BEYOND</span>
            </div>
            {EXEMPLO_CICLO.map((a, i) => (
              <div key={a.pos} style={{
                display: 'grid', gridTemplateColumns: '28px 1.6fr 1fr 1fr 1.2fr', gap: '4px', alignItems: 'center',
                padding: '9px 10px', backgroundColor: i % 2 === 1 ? '#161616' : 'transparent',
              }}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%', fontSize: '9px', fontWeight: '800',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: a.pos <= 2 ? '#fcc82533' : a.pos >= 9 ? '#EF444433' : '#2a2a2a',
                  color: a.pos <= 2 ? '#fcc825' : a.pos >= 9 ? '#EF4444' : '#888',
                }}>
                  {a.pos}
                </span>
                <span style={{ fontSize: '12px', color: '#F0F2F5', fontWeight: '600' }}>{a.nome}</span>
                <span style={{ fontSize: '11px', color: '#888', textAlign: 'right' }}>{a.jogos}</span>
                <span style={{ fontSize: '9px', fontWeight: '700', textAlign: 'right', color: corNivel(a.nivel) }}>{a.nivel}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#cf1b9b' }}>{a.pontuacao}</span>
                  {a.movimento === 'sobe' && <span style={{ fontSize: '9px', color: '#22c55e' }}>↑</span>}
                  {a.movimento === 'desce' && <span style={{ fontSize: '9px', color: '#EF4444' }}>↓</span>}
                </span>
              </div>
            ))}
          </div>
          <p style={paragrafoStyle}>
            Repare: o <b>Diego</b> (13 jogos, Prata) tem média melhor que o <b>Bruno</b>, mas o
            Bruno lidera com o nível Ouro e muitos jogos. Já o <b>Gustavo</b> (Bronze, 9 jogos)
            fica à frente de vários Pratas graças à sua média alta. Cada um sobe do seu jeito:
            jogando bem, jogando muito, ou os dois.
          </p>
        </Secao>

        <Secao n={5} titulo="Ranking Geral: peso extra por categoria">
          <p style={paragrafoStyle}>
            Você aparece em <b>dois rankings</b>: o da sua <b>Categoria</b> (Iniciante,
            Intermediário ou Avançado) e o <b>Geral</b>, que junta todo mundo numa lista só.
            No Geral, vencer em categorias mais avançadas vale mais pontos, porque o{' '}
            <b>nível de dificuldade é maior</b>.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {ORDEM_PESO_CATEGORIA.map(nome => (
              <div key={nome} style={{
                flex: '1 1 auto', minWidth: '110px', padding: '12px 10px', borderRadius: '10px', textAlign: 'center',
                backgroundColor: 'rgba(207,27,155,0.08)', border: '1px solid rgba(207,27,155,0.25)',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#F0F2F5' }}>{nome.toUpperCase()}</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#cf1b9b', marginTop: '4px' }}>×{PESO_CATEGORIA[nome]}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#000', border: '1px solid #2a2a2a', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#fcc825', letterSpacing: '0.5px', marginBottom: '10px' }}>
              {LIDER_NOME.toUpperCase()} NA CATEGORIA {LIDER_CATEGORIA_EXEMPLO.toUpperCase()}
            </div>
            <div style={{ fontSize: '12px', color: '#aaa', lineHeight: '1.9' }}>
              Pontuação Beyond (Categoria) = <b style={{ color: '#F0F2F5' }}>{LIDER_PONTUACAO}</b><br />
              Peso da categoria {LIDER_CATEGORIA_EXEMPLO} = ×{PESO_CATEGORIA[LIDER_CATEGORIA_EXEMPLO]}<br />
              Pontuação Beyond (Geral) = {LIDER_PONTUACAO} × {PESO_CATEGORIA[LIDER_CATEGORIA_EXEMPLO]} = <b style={{ color: '#cf1b9b' }}>{LIDER_PONTUACAO_GERAL}</b>
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.25)' }}>
            <p style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.7', margin: 0 }}>
              Isso garante que um atleta Avançado fique corretamente à frente no Geral, mas sem
              travar a mobilidade: um Iniciante excepcional ainda pode superar um Avançado de
              baixo desempenho. <b style={{ color: '#fcc825' }}>Na sua Categoria, esse peso não
              entra</b> — lá todo mundo já está competindo no mesmo nível.
            </p>
          </div>
        </Secao>

        <Secao n={6} titulo="As 4 regras que você precisa saber">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              `Mínimo de ${MINIMO_JOGOS_CLASSIFICACAO} jogos. Antes disso seus pontos são registrados, mas você ainda não aparece na classificação (fica "em qualificação"). No ${MINIMO_JOGOS_CLASSIFICACAO}º jogo, você entra.`,
              `Seus jogos valem por ${JANELA_DIAS} dias. Cada partida conta pelos últimos ${JANELA_DIAS} dias; depois expira. Quem para de jogar vai caindo no ranking naturalmente, aos poucos — nunca zera de uma vez.`,
              'Perder também conta. A derrota entra na sua média e pode puxá-la para baixo. Se você entrar em má fase, seu ranking reflete isso — mantendo tudo justo e atual.',
              'Cortes a cada 3 meses. Na mesma época das avaliações técnicas, os melhores de cada categoria sobem de nível e os últimos descem, mantendo todos jogando contra adversários do seu nível.',
            ].map((regra, i) => {
              const [titulo, ...resto] = regra.split('. ')
              return (
                <div key={i} style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(252,200,37,0.06)', border: '1px solid rgba(252,200,37,0.2)' }}>
                  <span style={{ fontSize: '13px', color: '#F0F2F5' }}>
                    <b>{i + 1}. {titulo}.</b> <span style={{ color: '#aaa' }}>{resto.join('. ')}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </Secao>

        <Secao n={7} titulo="Dois números no seu perfil">
          <p style={paragrafoStyle}>
            No seu card dentro do app você verá <b>dois indicadores diferentes</b>, que medem
            coisas distintas:
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825' }}>Pontuação Beyond</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Seu desempenho nas partidas do ranking. <b>Quanto maior, melhor</b> — você sobe
                jogando e vencendo.
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#cf1b9b' }}>PC Score (técnico)</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Sua evolução técnica, avaliada pelo professor a cada 3 meses. <b>Quanto menor,
                melhor</b> — como o ranking mundial profissional.
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(207,27,155,0.08)', border: '1px solid rgba(207,27,155,0.25)' }}>
            <p style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.7', margin: 0 }}>
              Os dois se completam: quanto melhor sua técnica (PC Score baixo), mais partidas
              você tende a vencer (Pontuação Beyond alta).
            </p>
          </div>
          <p style={{ ...paragrafoStyle, marginTop: '10px', textAlign: 'center', fontSize: '12px' }}>
            Dúvidas? Fale com a recepção ou a coordenação{nomeUnidade ? ` do ${nomeUnidade} Arena` : ''}.
          </p>
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
