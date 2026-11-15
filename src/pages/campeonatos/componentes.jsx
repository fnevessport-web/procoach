import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Trophy, Timer, Clock, MapPin } from 'lucide-react'
import {
  nomeCurto, iniciais, rotuloFase, rotuloFaseCurto, totalRodadas,
  origemDaVaga, msAtraso, msEmJogo, formatarDuracao, primeiroNome,
} from '../../lib/campeonato'
import { COR_DESTAQUE, duplaTemSeguido, jogoTemSeguido, duplasOcultas, useAgora } from './util'
import './campeonato.css'

// Componentes da aba Campeonatos compartilhados entre o link público, a TV e a gestão.
// Contexto sempre escuro (tokens -dark-* diretos), como Ranking/Conquistas.

export function Marcas({ altura = 30, separador = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: altura * 0.6 }}>
      {/* Versões recortadas e horizontais (mesma proporção ~4:1), para os dois logos terem o mesmo tamanho. */}
      <img src="/images/logobeyond_recorte.png" alt="Beyond The Club" style={{ height: altura * 0.7, width: 'auto', objectFit: 'contain' }} />
      {separador && <span style={{ width: 1, height: altura * 1.1, backgroundColor: 'var(--color-border-dark)' }} />}
      <img src="/images/logoprocopio_horizontal.png" alt="Procopio" style={{ height: altura * 0.85, width: 'auto', objectFit: 'contain' }} />
    </div>
  )
}

export function Avatar({ atleta, tamanho = 32, destaque = false, borda = true }) {
  const estilo = {
    width: tamanho, height: tamanho, borderRadius: '50%', flexShrink: 0, objectFit: 'cover',
    border: borda ? `2px solid ${destaque ? COR_DESTAQUE : 'var(--color-border-dark)'}` : 'none',
    boxSizing: 'border-box',
  }
  if (atleta?.foto) return <img src={atleta.foto} alt="" style={estilo} />
  return (
    <span style={{
      ...estilo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-secondary)',
      fontSize: Math.max(9, tamanho * 0.36), fontWeight: 700, letterSpacing: '0.5px',
    }}>{atleta ? iniciais(atleta.nome) : '?'}</span>
  )
}

export function AvataresDupla({ dupla, tamanho = 32, destaque = false }) {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }}>
      <Avatar atleta={dupla?.atleta1} tamanho={tamanho} destaque={destaque} />
      <span style={{ marginLeft: -tamanho * 0.3 }}><Avatar atleta={dupla?.atleta2} tamanho={tamanho} destaque={destaque} /></span>
    </span>
  )
}

export function ChipStatus({ jogo, tamanho = 10 }) {
  if (jogo.status === 'ao_vivo') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, backgroundColor: 'var(--color-accent-live)', color: 'var(--color-accent-on-live)', fontSize: tamanho, fontWeight: 800, letterSpacing: '1px' }}>
        <span className="cp-pulso" style={{ width: tamanho * 0.6, height: tamanho * 0.6, borderRadius: '50%', backgroundColor: 'var(--color-accent-on-live)' }} />EM JOGO
      </span>
    )
  }
  const mapa = {
    finalizado: ['Encerrado', 'var(--color-text-dark-muted)'],
    wo: ['W.O.', 'var(--color-state-warning)'],
    bye: ['Bye', 'var(--color-text-dark-muted)'],
    agendado: [jogo.horario ? `Previsto ${jogo.horario}` : 'Na fila', 'var(--color-text-dark-secondary)'],
  }
  const [txt, cor] = mapa[jogo.status] || mapa.agendado
  return <span style={{ fontSize: tamanho, fontWeight: 700, letterSpacing: '0.5px', color: cor, textTransform: 'uppercase' }}>{txt}</span>
}

// Linha de uma dupla com placar por set (usada nos cartões grandes).
function LinhaDupla({ dupla, lado, jogo, seguindo, escala = 1, mostrarSets = true, vazio = 'A definir' }) {
  const destaque = duplaTemSeguido(dupla, seguindo)
  const venceu = jogo.vencedor_id && jogo.vencedor_id === dupla?.id
  const perdeu = jogo.vencedor_id && dupla && jogo.vencedor_id !== dupla.id
  const sets = jogo.sets || []
  // Placar não é marcado ao vivo (vem da súmula no fim do jogo): só mostra os sets já lançados.
  const atual = -1
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10 * escala, padding: `${6 * escala}px ${8 * escala}px`, borderRadius: 10 * escala,
      backgroundColor: destaque ? 'color-mix(in srgb, var(--color-brand-lima) 12%, transparent)' : 'transparent',
      opacity: perdeu ? 0.5 : 1,
    }}>
      {dupla ? <AvataresDupla dupla={dupla} tamanho={34 * escala} destaque={destaque} /> : <Avatar tamanho={34 * escala} />}
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
        {dupla ? (
          <>
            <div style={{ fontSize: 14 * escala, fontWeight: venceu ? 800 : 600, color: destaque ? COR_DESTAQUE : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(dupla.atleta1?.nome)}</div>
            <div style={{ fontSize: 14 * escala, fontWeight: venceu ? 800 : 600, color: destaque ? COR_DESTAQUE : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(dupla.atleta2?.nome)}</div>
          </>
        ) : (
          <div style={{ fontSize: 13 * escala, color: 'var(--color-text-dark-muted)', fontStyle: 'italic' }}>{vazio}</div>
        )}
      </div>
      {venceu && <Trophy size={16 * escala} color="var(--color-brand-lima)" style={{ flexShrink: 0 }} />}
      {mostrarSets && (
        <div style={{ display: 'flex', gap: 4 * escala }}>
          {[0, 1, 2].map(i => {
            const s = sets[i]
            if (!s && i > atual) return null
            const valor = s ? (s[lado] ?? 0) : 0
            const ehAtual = i === atual
            return (
              <span key={i} style={{
                minWidth: 26 * escala, textAlign: 'center', padding: `${3 * escala}px ${4 * escala}px`, borderRadius: 6 * escala,
                fontSize: 18 * escala, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                backgroundColor: ehAtual ? 'var(--color-action-primary)' : 'var(--color-surface-dark-overlay)',
                color: ehAtual ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-primary)',
              }}>{valor}</span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Cartão grande de jogo (ao vivo / próximos), com quadra, fase e placar.
// Cronômetro do jogo ao vivo ("Tempo de jogo 22:10") ou atraso do jogo agendado ("Atrasado
// 12:40"). Atualiza sozinho a cada segundo. Sem nada a mostrar, não ocupa espaço.
export function TempoJogo({ jogo, dataTorneio, tamanho = 13, rotulo = true, cor, icone = true }) {
  const agora = useAgora(1000)
  if (jogo.status === 'ao_vivo' && jogo.iniciado_em && new Date(jogo.iniciado_em).getTime() > agora) {
    // Aquecimento: contagem regressiva até o início do jogo (iniciado_em fica no futuro).
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: tamanho * 0.35, fontSize: tamanho, fontWeight: 800, color: 'var(--color-state-warning)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {icone && <Timer size={tamanho * 1.05} />}Aquecimento {formatarDuracao(new Date(jogo.iniciado_em).getTime() - agora + 999)}
      </span>
    )
  }
  if (jogo.status === 'ao_vivo' && jogo.iniciado_em) {
    // Discreto (cinza): informa sem disputar atenção com o placar.
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: tamanho * 0.35, fontSize: tamanho, fontWeight: 700, color: cor || 'var(--color-text-dark-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {icone && <Timer size={tamanho * 1.05} />}{rotulo ? 'Tempo de jogo ' : ''}{formatarDuracao(msEmJogo(jogo, agora))}
      </span>
    )
  }
  const atraso = msAtraso(jogo, dataTorneio, agora)
  if (atraso >= 60000) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: tamanho * 0.4, fontSize: tamanho, fontWeight: 800, color: 'var(--color-state-danger)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', filter: 'brightness(1.35)' }}>
        <Clock size={tamanho * 1.05} />{rotulo ? 'Atrasado ' : '+'}{formatarDuracao(atraso)}
      </span>
    )
  }
  return null
}

// compacto: sem moldura nem cabeçalho (quadra/fase), para ir dentro de outro cartão (TV).
export function CartaoJogo({ jogo, duplaPorId, seguindo, escala = 1, numero, acoes, dataTorneio, jogos, compacto = false }) {
  const a = duplaPorId.get(jogo.dupla_a_id)
  const b = duplaPorId.get(jogo.dupla_b_id)
  const destaque = jogoTemSeguido(jogo, duplaPorId, seguindo)
  const aoVivo = jogo.status === 'ao_vivo'
  const vazio = lado => (jogos ? origemDaVaga(jogo, lado, jogos) : null) || 'A definir'
  return (
    <div className={aoVivo && !compacto ? 'cp-ao-vivo' : ''} style={compacto ? { padding: 4 * escala } : {
      borderRadius: 16 * escala, padding: 12 * escala,
      backgroundColor: 'var(--color-surface-dark-raised)',
      border: `1px solid ${destaque ? COR_DESTAQUE : aoVivo ? 'var(--color-accent-live)' : 'var(--color-border-dark-subtle)'}`,
    }}>
      {!compacto && <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 * escala, marginBottom: 8 * escala, padding: `0 ${4 * escala}px` }}>
        <div style={{ minWidth: 0 }}>
          <SeloQuadra quadra={jogo.quadra} escala={escala} aoVivo={aoVivo} />
          <div style={{ fontSize: 11 * escala, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-brand-saibro)', filter: 'brightness(1.35)', whiteSpace: 'nowrap', marginTop: 5 * escala }}>
            {rotuloFaseCurto(jogo.fase)}{numero ? ` · Jogo ${numero}` : ''}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 * escala }}>
          <ChipStatus jogo={jogo} tamanho={10 * escala} />
          <TempoJogo jogo={jogo} dataTorneio={dataTorneio} tamanho={11.5 * escala} rotulo={false} />
        </div>
      </div>}
      <LinhaDupla dupla={a} lado="a" jogo={jogo} seguindo={seguindo} escala={escala} mostrarSets={jogo.status !== 'agendado'} vazio={vazio('a')} />
      <div style={{ height: 1, margin: `${3 * escala}px ${8 * escala}px`, backgroundColor: 'var(--color-border-dark-subtle)' }} />
      <LinhaDupla dupla={b} lado="b" jogo={jogo} seguindo={seguindo} escala={escala} mostrarSets={jogo.status !== 'agendado'} vazio={vazio('b')} />
      {acoes}
    </div>
  )
}

// A quadra em destaque: é a informação que o atleta mais procura ("onde eu jogo?").
export function SeloQuadra({ quadra, escala = 1, aoVivo = false }) {
  return (
    <span className="cp-display" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6 * escala, padding: `${3 * escala}px ${10 * escala}px`, borderRadius: 8 * escala,
      fontSize: 17 * escala, fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap',
      backgroundColor: aoVivo ? 'var(--color-accent-live)' : 'var(--color-surface-dark-overlay)',
      color: aoVivo ? 'var(--color-accent-on-live)' : 'var(--color-text-dark-primary)',
      border: `1px solid ${aoVivo ? 'var(--color-accent-live)' : 'var(--color-border-dark)'}`,
    }}>
      <MapPin size={14 * escala} />{quadra || 'Quadra a definir'}
    </span>
  )
}

// ---------- chave ----------

function JogoChave({ jogo, duplaPorId, seguindo, ocultas, escala = 1, proximos, jogos, realce }) {
  const linhas = ['a', 'b'].map(lado => {
    const id = jogo[`dupla_${lado}_id`]
    return ocultas.has(id) ? null : duplaPorId.get(id) || null
  })
  const aoVivo = jogo.status === 'ao_vivo'
  const destaqueJogo = linhas.some(d => duplaTemSeguido(d, seguindo))
  const quadraProxima = proximos?.get(jogo.id)
  const realcado = realce === jogo.id
  return (
    // legenda "Jogo N" em itálico embaixo do quadrado, fora do fluxo (não desalinha as linhas da chave)
    <div style={{ position: 'relative' }}>
    <div data-jogo={jogo.id} className={aoVivo ? 'cp-ao-vivo' : quadraProxima ? 'cp-proximo' : realcado ? 'cp-realce' : ''} style={{
      borderRadius: 8 * escala, overflow: 'hidden',
      backgroundColor: quadraProxima ? 'color-mix(in srgb, var(--color-state-success) 14%, var(--color-surface-dark-raised))' : 'var(--color-surface-dark-raised)',
      border: `${quadraProxima || realcado ? 2 : 1}px solid ${realcado ? 'var(--color-brand-lima)' : quadraProxima ? 'var(--color-state-success)' : destaqueJogo ? COR_DESTAQUE : aoVivo ? 'var(--color-accent-live)' : 'var(--color-border-dark-subtle)'}`,
    }}>
      {linhas.map((d, i) => {
        const lado = i === 0 ? 'a' : 'b'
        const venceu = d && jogo.vencedor_id === d.id
        const perdeu = d && jogo.vencedor_id && jogo.vencedor_id !== d.id
        const destaque = duplaTemSeguido(d, seguindo)
        const ehBye = !d && jogo.status === 'bye'
        return (
          <div key={lado} style={{
            display: 'flex', alignItems: 'center', gap: 6 * escala, padding: `${4 * escala}px ${7 * escala}px`,
            borderTop: i ? '1px solid var(--color-border-dark-subtle)' : 'none',
            backgroundColor: destaque ? 'color-mix(in srgb, var(--color-brand-lima) 14%, transparent)' : venceu ? 'color-mix(in srgb, var(--color-state-success) 30%, transparent)' : 'transparent',
            opacity: perdeu ? 0.45 : 1, minHeight: 34 * escala,
          }}>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
              {d ? (
                [d.atleta1, d.atleta2].map((at, k) => (
                  <div key={k} style={{ fontSize: 11.5 * escala, fontWeight: venceu ? 800 : 600, color: destaque ? COR_DESTAQUE : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nomeCurto(at?.nome) || '—'}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 11 * escala, color: 'var(--color-text-dark-muted)', fontStyle: 'italic' }}>{ehBye ? 'Bye (avança direto)' : (jogos && origemDaVaga(jogo, lado, jogos)?.replace(/ do jogo /, ' J')) || 'A definir'}</div>
              )}
            </div>
            {d && (jogo.status === 'ao_vivo' || jogo.status === 'finalizado') && (
              <span style={{ fontSize: 12 * escala, fontWeight: 800, color: venceu ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {(jogo.sets || []).map(s => s[lado] ?? 0).join(' ')}
              </span>
            )}
            {d && jogo.status === 'wo' && venceu && <span style={{ fontSize: 10 * escala, fontWeight: 800, color: 'var(--color-state-warning)' }}>W.O.</span>}
          </div>
        )
      })}
      {quadraProxima && !aoVivo && (
        <div style={{ fontSize: 9.5 * escala, fontWeight: 800, textTransform: 'uppercase', padding: `${3 * escala}px ${7 * escala}px`, color: 'var(--color-text-dark-primary)', backgroundColor: 'var(--color-state-success)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ▶ Próximo · {quadraProxima}
        </div>
      )}
      {/* Etiqueta de uma linha só: "● QUADRA 3" com o tempo de jogo à direita (ao vivo) ou
          "QUADRA 3 · 10:50" (agendado). O vermelho já diz que é ao vivo. */}
      {!quadraProxima && (aoVivo || (jogo.status === 'agendado' && (jogo.horario || jogo.quadra) && linhas.some(Boolean))) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 * escala, fontSize: 9 * escala, fontWeight: 800, textTransform: 'uppercase', padding: `${2 * escala}px ${7 * escala}px`, whiteSpace: 'nowrap', color: aoVivo ? 'var(--color-accent-on-live)' : 'var(--color-text-dark-muted)', backgroundColor: aoVivo ? 'var(--color-accent-live)' : 'var(--color-surface-dark-overlay)' }}>
          {aoVivo ? (
            <>
              <span className="cp-pulso" style={{ width: 5 * escala, height: 5 * escala, borderRadius: '50%', backgroundColor: 'var(--color-accent-on-live)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{jogo.quadra || 'Ao vivo'}</span>
              <span style={{ marginLeft: 'auto', opacity: 0.85 }}><TempoJogo jogo={jogo} tamanho={9 * escala} rotulo={false} cor="var(--color-accent-on-live)" icone={false} /></span>
            </>
          ) : (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{[jogo.quadra, jogo.horario].filter(Boolean).join(' · ')}</span>
          )}
        </div>
      )}
    </div>
    {jogo.ordem > 0 && jogo.status !== 'bye' && (
      <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 1 * escala, textAlign: 'center', fontSize: 8.5 * escala, fontStyle: 'italic', color: 'var(--color-text-dark-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        Jogo {jogo.ordem}
      </div>
    )}
    </div>
  )
}

function ColunaChave({ titulo, jogos, ehUltima, ehPrimeira, props, lado = 'cp-dir' }) {
  const pares = []
  for (let i = 0; i < jogos.length; i += 2) pares.push(jogos.slice(i, i + 2))
  return (
    <div className={`cp-col ${lado}`}>
      <div className="cp-col-titulo">{titulo}</div>
      <div className="cp-col-corpo">
        {pares.map((par, i) => (
          <div key={i} className={`cp-par ${!ehUltima && par.length === 2 ? 'cp-tem-saida' : ''}`}>
            {par.map(j => (
              <div key={j.id} className={`cp-slot ${!ehUltima ? 'cp-tem-saida' : ''} ${!ehPrimeira ? 'cp-tem-entrada' : ''}`}>
                <JogoChave jogo={j} {...props} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CampeaoBox({ jogos, duplaPorId, escala = 1 }) {
  const final = jogos.find(j => j.fase === 'final')
  const campea = final && ['finalizado', 'wo'].includes(final.status) ? duplaPorId.get(final.vencedor_id) : null
  if (!campea) return null
  return (
    <div className="cp-entrar" style={{ textAlign: 'center', padding: 10 * escala, borderRadius: 12 * escala, border: '1px solid var(--color-brand-lima)', backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 10%, transparent)' }}>
      <Trophy size={22 * escala} color="var(--color-brand-lima)" />
      <div style={{ fontSize: 9 * escala, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--color-brand-lima)', marginTop: 4 }}>CAMPEÕES</div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: `${6 * escala}px 0` }}><AvataresDupla dupla={campea} tamanho={34 * escala} destaque /></div>
      <div className="cp-display" style={{ fontSize: 13 * escala, fontWeight: 700 }}>{nomeCurto(campea.atleta1?.nome)}</div>
      <div className="cp-display" style={{ fontSize: 13 * escala, fontWeight: 700 }}>{nomeCurto(campea.atleta2?.nome)}</div>
    </div>
  )
}

// Chave linear (celular, com rolagem lateral) ou espelhada (TV: metade esquerda + final no
// centro + metade direita).
export function Chave({ campeonato, jogos, duplas, duplaPorId, seguindo, espelhada = false, escala = 1, larguraColuna = 190, porRodada = false, proximos, realce }) {
  const ocultas = useMemo(() => duplasOcultas(campeonato, duplas), [campeonato, duplas])
  const R = totalRodadas(jogos)
  const [rodadaEscolhida, setRodadaEscolhida] = useState(null)
  if (!jogos.length) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-dark-muted)', fontSize: 14 }}>A chave aparece aqui logo depois do sorteio das duplas.</div>
  }
  const props = { duplaPorId, seguindo, ocultas, escala, proximos, jogos, realce }
  const daRodada = r => jogos.filter(j => j.rodada === r && j.fase !== 'terceiro').sort((a, b) => a.posicao - b.posicao)
  const final = jogos.find(j => j.fase === 'final')
  const terceiro = jogos.find(j => j.fase === 'terceiro')

  // Celular: uma fase por vez (abas), jogos em lista vertical grandes. Abre na fase em andamento.
  if (porRodada) {
    const fases = Array.from({ length: R }, (_, i) => ({ chave: `r${i + 1}`, titulo: rotuloFaseCurto(daRodada(i + 1)[0]?.fase), lista: daRodada(i + 1) }))
    if (terceiro) fases.splice(R - 1, 0, { chave: 't', titulo: '3º lugar', lista: [terceiro] })
    const pendente = fases.find(f => f.lista.some(j => j.status === 'ao_vivo')) || fases.find(f => f.lista.some(j => j.status === 'agendado' && j.dupla_a_id && j.dupla_b_id)) || fases[0]
    const atual = fases.find(f => f.chave === rodadaEscolhida) || pendente
    return (
      <div>
        <div className="cp-sem-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
          {fases.map(f => {
            const ativa = f.chave === atual.chave
            const aoVivo = f.lista.some(j => j.status === 'ao_vivo')
            return (
              <button key={f.chave} onClick={() => setRodadaEscolhida(f.chave)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 800, border: `1px solid ${ativa ? 'var(--color-brand-lima)' : 'var(--color-border-dark)'}`, backgroundColor: ativa ? 'color-mix(in srgb, var(--color-brand-lima) 14%, transparent)' : 'transparent', color: ativa ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)' }}>
                {aoVivo && <span className="cp-pulso" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />}
                {f.titulo}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'grid', gap: 22 }}>
          {atual.lista.map(j => <JogoChave key={j.id} jogo={j} {...props} escala={1.15} />)}
        </div>
        <div style={{ marginTop: 14 }}><CampeaoBox jogos={jogos} duplaPorId={duplaPorId} /></div>
      </div>
    )
  }

  if (!espelhada) {
    return (
      <div className="cp-scroll-x" style={{ paddingBottom: 8 }}>
        <div className="cp-chave" style={{ minWidth: larguraColuna * R, minHeight: Math.max(420, daRodada(1).length * 92) }}>
          {Array.from({ length: R }, (_, i) => i + 1).map(r => (
            <ColunaChave key={r} titulo={rotuloFaseCurto(daRodada(r)[0]?.fase)} jogos={daRodada(r)} ehPrimeira={r === 1} ehUltima={r === R} props={props} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {terceiro && (
            <div style={{ width: larguraColuna + 20 }}>
              <div className="cp-col-titulo" style={{ textAlign: 'left' }}>{rotuloFase('terceiro')}</div>
              <JogoChave jogo={terceiro} {...props} />
            </div>
          )}
          <div style={{ width: larguraColuna + 20 }}><CampeaoBox jogos={jogos} duplaPorId={duplaPorId} /></div>
        </div>
      </div>
    )
  }

  const metade = (r, esquerda) => {
    const lista = daRodada(r)
    const meio = lista.length / 2
    return esquerda ? lista.slice(0, meio) : lista.slice(meio)
  }
  const rodadasLado = Array.from({ length: R - 1 }, (_, i) => i + 1)
  return (
    <div className="cp-chave" style={{ height: '100%' }}>
      {rodadasLado.map(r => (
        <ColunaChave key={`e${r}`} titulo={rotuloFaseCurto(daRodada(r)[0]?.fase)} jogos={metade(r, true)} ehPrimeira={r === 1} ehUltima={false} props={props} lado="cp-dir" />
      ))}
      {/* Palco da final: coluna central mais larga, troféu, "Grande Final" e cartão maior com
          sem moldura em volta. 3º lugar embaixo, discreto. */}
      <div className="cp-col" style={{ flex: '1.25 1 0' }}>
        <div className="cp-col-titulo" style={{ visibility: 'hidden' }}>Final</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 * escala, padding: `0 ${14 * escala}px` }}>
          <CampeaoBox jogos={jogos} duplaPorId={duplaPorId} escala={escala} />
          {final && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * escala, marginBottom: 10 * escala }}>
                <Trophy size={26 * escala} color="var(--color-brand-lima)" />
                <div className="cp-display" style={{ fontSize: 22 * escala, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap' }}>Grande Final</div>
                {final.status === 'agendado' && (final.horario || final.quadra) && (
                  <div style={{ fontSize: 10 * escala, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-dark-muted)', whiteSpace: 'nowrap' }}>{[final.quadra, final.horario].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              <JogoChave jogo={final} {...props} escala={escala * 1.35} />
            </div>
          )}
          {terceiro && (
            <div style={{ opacity: 0.9, marginTop: 12 * escala }}>
              <div className="cp-col-titulo" style={{ paddingBottom: 4 }}>Disputa de 3º lugar</div>
              <JogoChave jogo={terceiro} {...props} />
            </div>
          )}
        </div>
      </div>
      {[...rodadasLado].reverse().map(r => (
        <ColunaChave key={`d${r}`} titulo={rotuloFaseCurto(daRodada(r)[0]?.fase)} jogos={metade(r, false)} ehPrimeira={r === 1} ehUltima={false} props={props} lado="cp-esq" />
      ))}
    </div>
  )
}

// ---------- chave no celular (espelhada, em pé) ----------

// O mesmo desenho do telão, girado para caber no celular: o lado esquerdo da chave vem de cima e
// desce até a Grande Final no meio; o lado direito vem de baixo e sobe. A pessoa enxerga o caminho
// inteiro até a final (quem pode enfrentar em cada fase). Linhas finas ligam os jogos.
export function ChaveCelular({ campeonato, jogos, duplas, duplaPorId, seguindo, proximos }) {
  const ocultas = useMemo(() => duplasOcultas(campeonato, duplas), [campeonato, duplas])
  const R = totalRodadas(jogos)
  if (!jogos.length) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-dark-muted)', fontSize: 14 }}>A chave aparece aqui logo depois do sorteio das duplas.</div>
  }
  const daRodada = r => jogos.filter(j => j.rodada === r && j.fase !== 'terceiro').sort((a, b) => a.posicao - b.posicao)
  const final = jogos.find(j => j.fase === 'final')
  const terceiro = jogos.find(j => j.fase === 'terceiro')
  const metade = (r, esquerda) => {
    const lista = daRodada(r)
    const meio = lista.length / 2
    return esquerda ? lista.slice(0, meio) : lista.slice(meio)
  }
  const rodadasLado = Array.from({ length: Math.max(0, R - 1) }, (_, i) => i + 1)
  const props = { duplaPorId, seguindo, ocultas, proximos, jogos }

  const linhaJogos = (lista, chave) => (
    <div key={chave} style={{ display: 'grid', gridTemplateColumns: `repeat(${lista.length}, minmax(0, 1fr))`, gap: 6 }}>
      {lista.map(j => <div key={j.id} style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: lista.length === 1 ? '50%' : '100%' }}><JogoMini jogo={j} {...props} /></div></div>)}
    </div>
  )

  const titulo = (t, chave) => (
    <div key={chave} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '2px', color: 'var(--color-text-dark-muted)', textTransform: 'uppercase', margin: '10px 0 6px' }}>{t}</div>
  )

  // de cima: oitavas (4) -> quartas (2) -> semi (1); de baixo: o inverso
  const cima = []
  rodadasLado.forEach((r, i) => {
    const lista = metade(r, true)
    cima.push(titulo(rotuloFaseCurto(lista[0]?.fase), `te${r}`))
    cima.push(linhaJogos(lista, `e${r}`))
    cima.push(<Conectores key={`ce${r}`} filhos={lista.length} descendo />)
    if (i === rodadasLado.length - 1) { /* a última liga na final */ }
  })
  const baixo = []
  ;[...rodadasLado].reverse().forEach(r => {
    const lista = metade(r, false)
    baixo.push(<Conectores key={`cd${r}`} filhos={lista.length} />)
    baixo.push(linhaJogos(lista, `d${r}`))
    baixo.push(titulo(rotuloFaseCurto(lista[0]?.fase), `td${r}`))
  })

  return (
    <div>
      {cima}
      {final && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px' }}>
          <CampeaoBox jogos={jogos} duplaPorId={duplaPorId} />
          <Trophy size={22} color="var(--color-brand-lima)" style={{ marginTop: 6 }} />
          <div className="cp-display" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, margin: '2px 0 8px' }}>Grande Final</div>
          <div style={{ width: '58%' }}><JogoMini jogo={final} {...props} grande /></div>
          {terceiro && (
            <div style={{ width: '46%', marginTop: 22, opacity: 0.92 }}>
              <div style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--color-text-dark-muted)', marginBottom: 4 }}>DISPUTA DE 3º LUGAR</div>
              <JogoMini jogo={terceiro} {...props} />
            </div>
          )}
          <div style={{ height: 18 }} />
        </div>
      )}
      {baixo}
    </div>
  )
}

// Linhas finas que juntam cada par de jogos no jogo da fase seguinte. Desenhadas em % da largura,
// então acompanham a grade de colunas iguais. `descendo`: filhos em cima e pai embaixo.
function Conectores({ filhos, descendo = false }) {
  const pais = Math.max(1, filhos / 2)
  const caminhos = []
  for (let i = 0; i < pais; i++) {
    const p = ((i + 0.5) / pais) * 100
    if (filhos === 1) { caminhos.push(`M ${p} 0 V 16`); continue }
    const c1 = ((2 * i + 0.5) / filhos) * 100
    const c2 = ((2 * i + 1.5) / filhos) * 100
    caminhos.push(`M ${c1} 0 V 8 M ${c2} 0 V 8 M ${c1} 8 H ${c2} M ${p} 8 V 16`)
  }
  return (
    <svg viewBox="0 0 100 16" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 18, transform: descendo ? 'none' : 'scaleY(-1)', marginTop: descendo ? 10 : 0, marginBottom: descendo ? 0 : 0 }}>
      {caminhos.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--color-border-dark)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

// Quadrado pequeno da chave do celular: primeiro nome de cada atleta, sets e "Jogo N" embaixo.
function JogoMini({ jogo, duplaPorId, seguindo, ocultas, proximos, jogos, grande = false }) {
  const aoVivo = jogo.status === 'ao_vivo'
  const quadraProxima = proximos?.get(jogo.id)
  const lados = ['a', 'b'].map(lado => {
    const id = jogo[`dupla_${lado}_id`]
    return { lado, d: ocultas.has(id) ? null : duplaPorId.get(id) || null }
  })
  const meu = lados.some(x => duplaTemSeguido(x.d, seguindo))
  const fs = grande ? 12.5 : 10.5
  const borda = meu ? COR_DESTAQUE : aoVivo ? 'var(--color-accent-live)' : quadraProxima ? 'var(--color-state-success)' : 'var(--color-border-dark-subtle)'
  return (
    <div style={{ width: '100%' }}>
      <div className={aoVivo ? 'cp-ao-vivo' : ''} style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--color-surface-dark-raised)', border: `${meu || aoVivo || quadraProxima ? 1.5 : 1}px solid ${borda}` }}>
        {lados.map(({ lado, d }, i) => {
          const venceu = d && jogo.vencedor_id === d.id
          const perdeu = d && jogo.vencedor_id && jogo.vencedor_id !== d.id
          const destaque = duplaTemSeguido(d, seguindo)
          const sets = (jogo.sets || []).map(s => s[lado] ?? 0)
          return (
            <div key={lado} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: grande ? '5px 7px' : '3px 5px', borderTop: i ? '1px solid var(--color-border-dark-subtle)' : 'none', opacity: perdeu ? 0.42 : 1, backgroundColor: destaque ? 'color-mix(in srgb, var(--color-brand-lima) 14%, transparent)' : venceu ? 'color-mix(in srgb, var(--color-state-success) 26%, transparent)' : 'transparent', minHeight: grande ? 36 : 29 }}>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                {d ? [d.atleta1, d.atleta2].map((a, k) => (
                  <div key={k} style={{ fontSize: fs, fontWeight: venceu ? 800 : 600, color: destaque ? COR_DESTAQUE : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a ? primeiroNome(a.nome) : 'A definir'}</div>
                )) : (
                  <div style={{ fontSize: fs - 1, fontStyle: 'italic', color: 'var(--color-text-dark-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {jogo.status === 'bye' ? 'Bye' : (origemDaVaga(jogo, lado, jogos)?.replace(/^Vencedor do jogo /, 'Venc. J').replace(/^Perdedor do jogo /, 'Perd. J')) || 'A definir'}
                  </div>
                )}
              </div>
              {d && sets.length > 0 && jogo.status !== 'wo' && (
                <span style={{ fontSize: fs, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: venceu ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)', whiteSpace: 'nowrap' }}>{sets.join('')}</span>
              )}
              {d && jogo.status === 'wo' && venceu && <span style={{ fontSize: fs - 2, fontWeight: 800, color: 'var(--color-state-warning)' }}>WO</span>}
            </div>
          )
        })}
      </div>
      {jogo.ordem > 0 && jogo.status !== 'bye' && (
        <div style={{ textAlign: 'center', fontSize: 9, fontStyle: 'italic', color: aoVivo ? 'var(--color-accent-live)' : quadraProxima ? 'var(--color-state-success)' : 'var(--color-text-dark-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', filter: aoVivo || quadraProxima ? 'brightness(1.4)' : 'none' }}>
          Jogo {jogo.ordem}{aoVivo ? ' · ao vivo' : quadraProxima ? ' · próximo' : jogo.status === 'agendado' && jogo.horario ? ` · ${jogo.horario}` : ''}
        </div>
      )}
    </div>
  )
}

// ---------- sorteio ao vivo ----------

// Mostra as duplas já reveladas e, na vez da próxima, um "caça-níquel" girando nomes até a
// gestão revelar. O ritmo é controlado pela tela da gestão (campeonatos.sorteio_revelados), então
// todo mundo (TV e celulares) vê a mesma dupla aparecer ao mesmo tempo.
export function SorteioAoVivo({ campeonato, duplas, duplaPorId, atletas, seguindo, escala = 1, colunas = 2 }) {
  const revelados = campeonato?.sorteio_revelados || 0
  const total = duplas.length
  const terminou = campeonato?.status !== 'sorteio' || revelados >= total
  const homens = useMemo(() => atletas.filter(a => a.genero === 'M' && a.situacao === 'inscrito'), [atletas])
  const mulheres = useMemo(() => atletas.filter(a => a.genero === 'F' && a.situacao === 'inscrito'), [atletas])
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    if (terminou) return
    const t = setInterval(() => setGiro(g => g + 1), 90)
    return () => clearInterval(t)
  }, [terminou])

  const visiveis = duplas.filter(d => d.numero <= revelados || campeonato?.status !== 'sorteio')
  const sorteando = !terminou ? { h: homens[giro % Math.max(1, homens.length)], m: mulheres[(giro * 7) % Math.max(1, mulheres.length)] } : null

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 18 * escala }}>
        <div style={{ fontSize: 12 * escala, fontWeight: 800, letterSpacing: '3px', color: 'var(--color-brand-lima)' }}>
          {terminou ? 'DUPLAS DEFINIDAS' : 'SORTEIO AO VIVO'}
        </div>
        <div className="cp-display" style={{ fontSize: 30 * escala, fontWeight: 700, marginTop: 4 }}>
          {terminou ? `${total} duplas mistas` : `Dupla ${Math.min(revelados + 1, total)} de ${total}`}
        </div>
      </div>

      {sorteando && (
        <div className="cp-sorteando" style={{ maxWidth: 560 * escala, margin: `0 auto ${20 * escala}px`, padding: 16 * escala, borderRadius: 18 * escala, border: '2px solid', backgroundColor: 'var(--color-surface-dark-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 * escala }}>
          {[sorteando.h, sorteando.m].map((at, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 * escala, flex: 1, minWidth: 0, justifyContent: i ? 'flex-start' : 'flex-end' }}>
              {i === 1 && <span className="cp-display" style={{ fontSize: 22 * escala, color: 'var(--color-brand-saibro)', filter: 'brightness(1.4)' }}>&amp;</span>}
              <Avatar atleta={at} tamanho={44 * escala} />
              <span style={{ fontSize: 16 * escala, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', filter: 'blur(0.6px)', opacity: 0.85 }}>{nomeCurto(at?.nome)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, gap: 10 * escala }}>
        {visiveis.map(d0 => {
          const d = duplaPorId.get(d0.id)
          const destaque = duplaTemSeguido(d, seguindo)
          const recente = campeonato?.status === 'sorteio' && d.numero === revelados
          return (
            <div key={d.id} className="cp-entrar" style={{
              display: 'flex', alignItems: 'center', gap: 10 * escala, padding: `${10 * escala}px ${12 * escala}px`, borderRadius: 14 * escala,
              backgroundColor: recente ? 'color-mix(in srgb, var(--color-brand-saibro) 22%, var(--color-surface-dark-raised))' : 'var(--color-surface-dark-raised)',
              border: `1px solid ${destaque ? COR_DESTAQUE : recente ? 'var(--color-brand-saibro)' : 'var(--color-border-dark-subtle)'}`,
            }}>
              <span className="cp-display" style={{ fontSize: 20 * escala, fontWeight: 700, color: 'var(--color-text-dark-muted)', minWidth: 28 * escala, textAlign: 'center' }}>{d.numero}</span>
              <AvataresDupla dupla={d} tamanho={38 * escala} destaque={destaque} />
              <div style={{ minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ fontSize: 14 * escala, fontWeight: 700, color: destaque ? COR_DESTAQUE : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(d.atleta1?.nome)}</div>
                <div style={{ fontSize: 14 * escala, fontWeight: 700, color: destaque ? COR_DESTAQUE : 'var(--color-text-dark-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(d.atleta2?.nome)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- QR code ----------

function corToken(nome, reserva) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  return v || reserva
}

export function QrCode({ url, tamanho = 160 }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(url, {
      margin: 1, width: tamanho * 2, errorCorrectionLevel: 'M',
      color: { dark: corToken('--color-brand-verde-court', '#000000'), light: corToken('--color-brand-areia', '#ffffff') },
    }).then(d => { if (vivo) setSrc(d) }).catch(() => {})
    return () => { vivo = false }
  }, [url, tamanho])
  if (!src) return <div style={{ width: tamanho, height: tamanho }} />
  return <img src={src} alt="QR code" style={{ width: tamanho, height: tamanho, borderRadius: 10, display: 'block' }} />
}
