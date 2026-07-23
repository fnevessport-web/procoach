import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { NIVEIS_PC_SCORE, FAIXAS_ETARIAS, REAVALIACAO_PRAZO_DIAS } from '../../lib/pcScore'

const secaoStyle = { marginBottom: '30px' }
const tituloStyle = { fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: '0 0 12px' }
const paragrafoStyle = { fontSize: '13px', color: 'var(--color-text-light-secondary)', lineHeight: '1.7', margin: '0 0 10px' }

const DIMENSOES_TENIS = [
  { nome: 'Saque', descricao: 'A qualidade e a consistência do saque — o fundamento que abre cada ponto.' },
  { nome: 'Direita', descricao: 'Controle e potência no golpe de direita (forehand), o mais usado durante o jogo.' },
  { nome: 'Esquerda', descricao: 'Controle e potência no golpe de esquerda (backhand).' },
  { nome: 'Voleio', descricao: 'Capacidade de finalizar pontos perto da rede.' },
  { nome: 'Posicionamento', descricao: 'Leitura de jogo e ocupação inteligente da quadra durante o ponto.' },
  { nome: 'Condicionamento', descricao: 'Resistência física pra manter o nível técnico do início ao fim do jogo.' },
]

function Secao({ titulo, children }) {
  return (
    <div style={secaoStyle}>
      <h2 style={tituloStyle}>{titulo}</h2>
      {children}
    </div>
  )
}

export function ComoFuncionaAPontuacaoPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      height: '100vh', width: '100%', backgroundColor: 'var(--color-surface-light-base)',
      display: 'flex', justifyContent: 'center', padding: '24px 16px',
      boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ width: '100%', maxWidth: '640px' }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
          color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '20px',
        }}>
          <ChevronLeft size={16} /> Voltar
        </button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/images/logo-pc-green.png" alt="ProCoach" style={{ height: '40px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: '0 0 4px' }}>
            Como funciona o PC Score
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', margin: 0 }}>Evolução técnica — Tênis</p>
        </div>

        <Secao titulo="1. O que é o PC Score">
          <p style={paragrafoStyle}>
            O PC Score é o índice que o ProCoach usa pra acompanhar a evolução técnica de cada
            aluno de tênis. Ele resume as 6 dimensões avaliadas pelo professor num único número,
            numa escala de <b>1 a 100</b>.
          </p>
          <p style={paragrafoStyle}>
            A parte que mais gera dúvida: <b>quanto menor o número, melhor o nível técnico</b> —
            o mesmo princípio de organização usado por índices de rating conhecidos no tênis
            mundial (o PC Score é um índice próprio do ProCoach, não afiliado a nenhuma
            organização externa). Um aluno com PC Score 15 está tecnicamente à frente de um aluno
            com PC Score 70.
          </p>
        </Secao>

        <Secao titulo="2. Os 5 níveis">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            {NIVEIS_PC_SCORE.map(n => (
              <div key={n.chave} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '10px',
                backgroundColor: `${n.cor}12`, border: `1px solid ${n.cor}33`,
              }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: n.cor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{n.label}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: n.cor }}>
                  {n.min}–{n.max}
                </span>
              </div>
            ))}
          </div>
          <p style={paragrafoStyle}>
            Cada avaliação nova recalcula o PC Score do aluno e o coloca numa dessas faixas —
            é essa faixa que aparece em destaque no card do aluno.
          </p>
        </Secao>

        <Secao titulo="3. Por que a mesma nota pode gerar PC Scores diferentes">
          <p style={paragrafoStyle}>
            O professor avalia cada dimensão numa nota de 1 a 5 — isso não muda. O que muda é o
            <b> peso</b> de cada dimensão dentro do cálculo, de acordo com a faixa etária do
            aluno: crianças ainda estão desenvolvendo condicionamento e noção de quadra, então
            essas duas dimensões pesam mais nessa fase; já em jovens/adultos, saque e voleio —
            fundamentos que dependem mais de técnica consolidada — ganham mais peso.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAIXAS_ETARIAS.map(f => (
              <div key={f.chave} style={{
                padding: '12px 14px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>
                  {f.label} <span style={{ color: 'var(--color-text-light-secondary)', fontWeight: '400' }}>· {f.faixaIdade}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '4px' }}>
                  {f.chave === 'kids' && 'Condicionamento e Posicionamento pesam mais no cálculo.'}
                  {f.chave === 'infantil' && 'Todas as dimensões pesam igual.'}
                  {f.chave === 'adulto' && 'Saque e Voleio pesam mais no cálculo.'}
                </div>
              </div>
            ))}
          </div>
          <p style={{ ...paragrafoStyle, marginTop: '10px' }}>
            Essa faixa é calculada automaticamente pela data de nascimento do aluno quando ela
            está cadastrada; enquanto isso não acontece, o professor escolhe a faixa manualmente
            no cadastro do aluno.
          </p>
        </Secao>

        <Secao titulo="4. As 6 dimensões avaliadas no Tênis">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DIMENSOES_TENIS.map(d => (
              <div key={d.nome}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{d.nome}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px', lineHeight: '1.6' }}>{d.descricao}</div>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="5. Reavaliação periódica">
          <p style={paragrafoStyle}>
            Toda avaliação técnica vale por até <b>{REAVALIACAO_PRAZO_DIAS} dias</b>. Passado
            esse prazo, o card do aluno mostra um aviso de reavaliação pendente pro professor e
            pro gestor — assim o PC Score de cada aluno nunca fica desatualizado por muito tempo,
            e a evolução real de cada um continua sendo acompanhada de perto.
          </p>
        </Secao>

        <p style={{ textAlign: 'center', fontSize: '10px', color: 'var(--color-text-light-muted)', marginTop: '24px', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </p>
      </div>
    </div>
  )
}
