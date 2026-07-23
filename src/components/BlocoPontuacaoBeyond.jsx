import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { usePosicaoAluno, useHistoricoConfrontos } from '../hooks/useRanking'
import { NIVEIS_ASSIDUIDADE, PESO_CATEGORIA } from '../lib/pontuacaoBeyond'
import { Loading } from './ui/Loading'

const LABEL_RESULTADO = {
  vitoria: { texto: 'Vitória', cor: 'var(--color-state-success)' },
  derrota: { texto: 'Derrota', cor: 'var(--color-state-danger)' },
  wo_vitoria: { texto: 'Vitória (W.O.)', cor: 'var(--color-state-success)' },
  wo_derrota: { texto: 'Derrota (W.O.)', cor: 'var(--color-state-danger)' },
}

function corNivel(nivel) {
  return NIVEIS_ASSIDUIDADE.find(n => n.chave === nivel)?.cor || 'var(--color-text-dark-secondary)'
}

function TracoNaoRanqueado({ texto }) {
  return (
    <div
      title={texto}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px',
        borderRadius: '10px', backgroundColor: 'var(--color-surface-dark-overlay)', border: '1px dashed var(--color-border-dark)',
      }}
    >
      <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text-dark-muted)' }}>—</span>
      <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>{texto}</span>
    </div>
  )
}

// Bloco "Pontuação Beyond" — ranking interno de jogos (ver src/lib/pontuacaoBeyond.js).
// Fica sempre separado e claramente rotulado em relação ao PC Score/Evolução Técnica logo
// acima: um mede resultado em partidas (maior = melhor), o outro mede evolução técnica
// avaliada pelo professor (menor = melhor) — nunca se misturam na tela, por design (item 9
// do módulo Ranking).
export function BlocoPontuacaoBeyond({ aluno, modalidadeId }) {
  const [expandido, setExpandido] = useState(false)
  const { data: info, isLoading } = usePosicaoAluno(aluno.id, modalidadeId)
  const { data: historico } = useHistoricoConfrontos(aluno.id, modalidadeId)

  if (isLoading) {
    return (
      <div className="theme-dark">
        <SecaoTitulo />
        <Loading />
      </div>
    )
  }

  if (info?.semGenero) {
    return (
      <div className="theme-dark">
        <SecaoTitulo />
        <TracoNaoRanqueado texto="Gênero não cadastrado — preencha em Dados pessoais pra esse aluno entrar no ranking." />
      </div>
    )
  }

  const geral = info?.geral
  const categoria = info?.categoria

  if (!geral) {
    return (
      <div className="theme-dark">
        <SecaoTitulo />
        <TracoNaoRanqueado texto="Ainda sem jogos registrados no ranking (ou nível fora das categorias adultas do ranking)." />
      </div>
    )
  }

  const generoLabel = info.genero === 'masculino' ? 'Masc.' : 'Fem.'
  const classificado = geral.posicao != null
  const cor = corNivel(geral.nivel)

  // Agrega o histórico por adversário — mesma lista de jogos, só reagrupada, pra dar o "H2H"
  // pedido no item 6 sem precisar de uma query separada.
  const h2h = {}
  ;(historico || []).forEach(h => {
    const chave = h.adversarios
    if (!h2h[chave]) h2h[chave] = { vitorias: 0, derrotas: 0 }
    if (h.resultado === 'vitoria' || h.resultado === 'wo_vitoria') h2h[chave].vitorias++
    else if (h.resultado === 'derrota' || h.resultado === 'wo_derrota') h2h[chave].derrotas++
  })

  return (
    <div className="theme-dark">
      <SecaoTitulo />
      <button
        onClick={() => setExpandido(v => !v)}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left',
          padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-dark-overlay)', border: `1px solid ${cor}33`,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Geral {generoLabel}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', fontWeight: '700' }}>
                {classificado ? `${geral.posicao}º` : geral.num_jogos > 0 ? `Em qualificação (${geral.num_jogos}/5)` : '—'}
              </div>
            </div>
            {categoria && (
              <div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{categoria.ranking_categorias?.nome || 'Categoria'}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', fontWeight: '700' }}>
                  {categoria.posicao != null ? `${categoria.posicao}º` : categoria.num_jogos > 0 ? `Em qualificação (${categoria.num_jogos}/5)` : '—'}
                </div>
              </div>
            )}
          </div>
          {expandido ? <ChevronUp size={15} color="var(--color-text-dark-secondary)" /> : <ChevronDown size={15} color="var(--color-text-dark-secondary)" />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-action-primary)' }}>
              {geral.pontuacao_beyond ?? '—'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>{geral.num_jogos} jogo{geral.num_jogos === 1 ? '' : 's'} na janela</span>
          </div>
          {geral.nivel && (
            <span style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '7px', fontWeight: '700', backgroundColor: `${cor}22`, color: cor }}>
              {geral.nivel}
            </span>
          )}
        </div>
      </button>

      {expandido && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: 'var(--color-surface-dark-overlay)', fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
            Cálculo (Categoria): média de <strong style={{ color: 'var(--color-text-dark-secondary)' }}>{geral.media ?? '—'}</strong> pontos/jogo × nível{' '}
            <strong style={{ color: cor }}>{geral.nivel || '—'}</strong>
            {geral.nivel && <> (×{NIVEIS_ASSIDUIDADE.find(n => n.chave === geral.nivel)?.multiplicador})</>}
            {categoria?.pontuacao_beyond != null && <> = <strong style={{ color: 'var(--color-text-dark-secondary)' }}>{categoria.pontuacao_beyond}</strong></>}.
            {categoria?.ranking_categorias?.nome && PESO_CATEGORIA[categoria.ranking_categorias.nome] != null && (
              <>
                {' '}No <strong style={{ color: 'var(--color-action-primary)' }}>Geral</strong>, entra ainda o peso da categoria{' '}
                <strong style={{ color: 'var(--color-text-dark-secondary)' }}>{categoria.ranking_categorias.nome}</strong> (×{PESO_CATEGORIA[categoria.ranking_categorias.nome]}),
                que dá <strong style={{ color: 'var(--color-action-primary)' }}>{geral.pontuacao_beyond}</strong>.
              </>
            )}
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Confrontos (H2H)
            </div>
            {!historico?.length ? (
              <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>Nenhum jogo aprovado ainda.</div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {Object.entries(h2h).map(([nome, r]) => (
                    <span key={nome} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-secondary)' }}>
                      vs {nome}: <strong style={{ color: 'var(--color-state-success)' }}>{r.vitorias}V</strong>-<strong style={{ color: 'var(--color-state-danger)' }}>{r.derrotas}D</strong>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {historico.slice(0, 10).map(h => (
                    <div key={h.jogoId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--color-surface-dark-overlay)', fontSize: '11px',
                    }}>
                      <span style={{ color: 'var(--color-text-dark-secondary)' }}>
                        vs {h.adversarios} · {format(new Date(h.data + 'T12:00'), 'dd/MM', { locale: ptBR })}
                      </span>
                      <span style={{ color: LABEL_RESULTADO[h.resultado]?.cor || 'var(--color-text-dark-secondary)', fontWeight: '700' }}>
                        {LABEL_RESULTADO[h.resultado]?.texto || '—'} ({h.pontos > 0 ? '+' : ''}{h.pontos})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SecaoTitulo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      <Trophy size={12} color="var(--color-action-primary)" />
      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Pontuação Beyond
      </span>
    </div>
  )
}
