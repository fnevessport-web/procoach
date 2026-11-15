import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Tv, Smartphone, Copy, Radio, Users, Shuffle, ListOrdered, Settings, Plus, Play,
  Trash2, Camera, Check, RotateCcw, ChevronUp, ChevronDown, UserPlus, UserMinus, Phone, Pause, SkipForward, FastForward, Flag, ExternalLink, Search, X, ClipboardList, Share2, Printer,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCampeonato, aplicarPatchesJogos } from '../../hooks/useCampeonato'
import {
  sortearDuplasPorPresenca, encaixarPorPresenca, montarChave, propagar, agendar, embaralhar, resumoPlacar, nomeCurto, vencedorDoSet, validarPlacarDigitado, camposDoPlacar, textoSet, inicioAposAquecimento,
  rotuloFase, rotuloFaseCurto, ordenarJogos, normalizar, duplaIncompleta, validarDuplas, reagendarPelaOrdem, origemDaVaga, primeiroNome,
} from '../../lib/campeonato'
import { Avatar, AvataresDupla, Chave, SorteioAoVivo, QrCode, Marcas, TempoJogo } from './componentes'
import { rotuloStatusCampeonato, urlPublica, urlTV, proximosPorQuadra, duplasEliminadas } from './util'
import { EditorFoto } from './EditorFoto'
import { baixarSumulasPDF } from '../../lib/sumulaCampeonatoPdf'

// Gestão de um campeonato: operação ao vivo das quadras (placar com +/-), atletas e check-in,
// sorteio ao vivo, lista de jogos editável e configuração. Tudo que muda aqui aparece na hora no
// link público e na TV (tempo real do Supabase).

const ABAS = [
  { id: 'operacao', label: 'Ao vivo', icon: Radio },
  { id: 'atletas', label: 'Atletas', icon: Users },
  { id: 'sorteio', label: 'Sorteio', icon: Shuffle },
  { id: 'jogos', label: 'Jogos', icon: ListOrdered },
  { id: 'config', label: 'Configurar', icon: Settings },
]

const SEM_SEGUIDOS = new Set()

const estiloInput = {
  boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--color-border-dark)',
  backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 14, outline: 'none',
}

export function Botao({ children, onClick, variante = 'secundario', disabled, titulo, estilo, tamanho = 'md' }) {
  const cores = {
    primario: ['var(--color-action-primary)', 'var(--color-action-on-primary)', 'transparent'],
    secundario: ['var(--color-surface-dark-overlay)', 'var(--color-text-dark-primary)', 'var(--color-border-dark)'],
    perigo: ['transparent', 'var(--color-state-danger)', 'var(--color-state-danger)'],
    destaque: ['var(--color-brand-lima)', 'var(--color-brand-verde-court)', 'transparent'],
    fantasma: ['transparent', 'var(--color-text-dark-secondary)', 'transparent'],
  }[variante]
  const pad = tamanho === 'sm' ? '6px 10px' : tamanho === 'lg' ? '14px 20px' : '9px 14px'
  return (
    <button onClick={onClick} disabled={disabled} title={titulo} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: pad, borderRadius: 10,
      backgroundColor: cores[0], color: cores[1], border: `1px solid ${cores[2]}`, fontWeight: 700,
      fontSize: tamanho === 'sm' ? 12 : tamanho === 'lg' ? 16 : 14, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap', ...estilo,
    }}>{children}</button>
  )
}

export function Painel({ titulo, children, extra }) {
  return (
    <section style={{ padding: 16, borderRadius: 16, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)', marginBottom: 16 }}>
      {(titulo || extra) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {titulo && <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-dark-secondary)' }}>{titulo}</h2>}
          {extra && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{extra}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

async function rodar(fn, ok) {
  try {
    await fn()
    if (ok) toast.success(ok)
    return true
  } catch (e) {
    toast.error(e.message || 'Erro ao salvar')
    return false
  }
}

export function CampeonatoAdminPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dados = useCampeonato({ id })
  const { campeonato, carregando, erro, recarregar } = dados
  const [abaEscolhida, setAba] = useState(null)
  // Até a gestão escolher uma aba, abre na que faz sentido para o momento do torneio.
  const aba = abaEscolhida || (campeonato?.status === 'sorteio' ? 'sorteio' : campeonato?.status === 'inscricoes' ? 'atletas' : 'operacao')

  if (carregando) return <div style={{ padding: 30, color: 'var(--color-text-dark-muted)' }}>Carregando...</div>
  if (erro || !campeonato) return <div style={{ padding: 30, color: 'var(--color-state-warning)' }}>{erro || 'Campeonato não encontrado'}</div>

  // Salva um jogo e recalcula a chave inteira (vencedor avança, perdedor da semi vai pro 3º).
  const salvarJogo = async (jogoId, patch, { silencioso = false } = {}) => {
    const novos = dados.jogos.map(j => (j.id === jogoId ? { ...j, ...patch } : j))
    const mudancas = propagar(novos)
    const resetados = mudancas.filter(m => m.patch.status === 'agendado' && m.id !== jogoId && ['ao_vivo', 'finalizado', 'wo'].includes(dados.jogos.find(j => j.id === m.id)?.status))
    if (resetados.length && !window.confirm(`Isso muda quem joga em ${resetados.length} jogo(s) seguinte(s) que já tinham começado ou terminado. Eles voltam para "agendado" sem placar. Continuar?`)) return false
    const juntos = new Map()
    juntos.set(jogoId, { ...patch })
    for (const m of mudancas) juntos.set(m.id, { ...(juntos.get(m.id) || {}), ...m.patch })
    return rodar(async () => {
      await aplicarPatchesJogos([...juntos].map(([id2, p]) => ({ id: id2, patch: p })))
      await recarregar(['jogos'])
    }, silencioso ? null : 'Salvo')
  }

  const [statusTxt, statusCor] = rotuloStatusCampeonato(campeonato.status)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '4px 2px 60px', color: 'var(--color-text-dark-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/campeonatos')} style={{ background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', cursor: 'pointer', padding: 4 }}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="cp-display" style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>{campeonato.nome}</h1>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: statusCor, marginTop: 2 }}>{statusTxt}</div>
        </div>
        <Botao tamanho="sm" onClick={() => window.open(urlTV(campeonato.slug), '_blank')}><Tv size={15} />Abrir TV</Botao>
        <Botao tamanho="sm" onClick={() => window.open(urlPublica(campeonato.slug), '_blank')}><Smartphone size={15} />Link do associado</Botao>
        <Botao tamanho="sm" titulo="Copiar o link do operador de quadra" onClick={() => copiarLinkOperador(campeonato)}><ClipboardList size={15} />Link do operador</Botao>
        <Botao tamanho="sm" titulo="Súmulas de papel, 4 por folha A4, para cortar" onClick={() => rodar(() => baixarSumulasPDF({ campeonato, jogos: dados.jogos, duplaPorId: dados.duplaPorId }), null)}><Printer size={15} />Súmulas (PDF)</Botao>
        <Botao tamanho="sm" variante="fantasma" titulo="Copiar link do associado" onClick={() => { navigator.clipboard.writeText(urlPublica(campeonato.slug)); toast.success('Link copiado') }}><Copy size={15} /></Botao>
      </div>

      <div className="cp-sem-scroll" style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {ABAS.map(({ id: idAba, label, icon: Icone }) => (
          <button key={idAba} onClick={() => setAba(idAba)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${aba === idAba ? 'var(--color-action-primary)' : 'var(--color-border-dark)'}`,
            backgroundColor: aba === idAba ? 'var(--color-action-primary)' : 'transparent',
            color: aba === idAba ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-secondary)', fontWeight: 700, fontSize: 14,
          }}><Icone size={15} />{label}</button>
        ))}
      </div>

      {aba === 'operacao' && <AbaOperacao dados={dados} salvarJogo={salvarJogo} />}
      {aba === 'atletas' && <AbaAtletas dados={dados} />}
      {aba === 'sorteio' && <AbaSorteio dados={dados} irPara={setAba} />}
      {aba === 'jogos' && <AbaJogos dados={dados} salvarJogo={salvarJogo} />}
      {aba === 'config' && <AbaConfig dados={dados} />}
    </div>
  )
}

// =============================================================================================
// AO VIVO
// =============================================================================================

function AbaOperacao({ dados, salvarJogo }) {
  const { campeonato, jogos, duplas, atletas, duplaPorId, recarregar } = dados
  const incompletas = duplas.filter(duplaIncompleta)
  const eliminadas = duplasEliminadas(jogos)
  const duplasAtivas = duplas.filter(d => !eliminadas.has(d.id))
  const ordenados = ordenarJogos(jogos.filter(j => j.status !== 'bye')).sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const aoVivo = ordenados.filter(j => j.status === 'ao_vivo')
  const prontos = ordenados.filter(j => j.status === 'agendado' && j.dupla_a_id && j.dupla_b_id)
  const quadras = [...new Set([...(campeonato.quadras || []), ...aoVivo.map(j => j.quadra).filter(Boolean)])]

  if (!jogos.length) {
    return <Painel><div style={{ color: 'var(--color-text-dark-secondary)', fontSize: 14 }}>Ainda não há jogos. Faça o check-in na aba <b>Atletas</b> e depois o sorteio na aba <b>Sorteio</b>.</div></Painel>
  }

  const iniciar = (jogo, quadra) => {
    const faltando = [jogo.dupla_a_id, jogo.dupla_b_id].map(id => duplas.find(d => d.id === id)).find(duplaIncompleta)
    if (faltando) return toast.error(`Defina o(a) parceiro(a) da dupla nº ${faltando.numero} antes de iniciar o jogo.`)
    return salvarJogo(jogo.id, { status: 'ao_vivo', quadra, iniciado_em: inicioAposAquecimento() })
  }
  // Próximo jogo de cada quadra (verde na chave) e troca de posição na fila.
  const proximosMapa = proximosPorQuadra(campeonato, jogos)
  const proximaDaQuadra = q => prontos.find(x => x.quadra === q)
  const tornarProximo = (j, q) => {
    const atual = proximaDaQuadra(q)
    if (!atual || atual.id === j.id) {
      return rodar(async () => {
        await aplicarPatchesJogos([{ id: j.id, patch: { quadra: q } }])
        await recarregar()
      }, `Jogo ${j.ordem} é o próximo na ${q}`)
    }
    return rodar(async () => {
      await aplicarPatchesJogos([
        { id: j.id, patch: { ordem: atual.ordem, horario: atual.horario, quadra: q } },
        { id: atual.id, patch: { ordem: j.ordem, horario: j.horario, quadra: j.quadra } },
      ])
      await recarregar()
    }, `Agora o próximo na ${q} é o de ${nomesDupla(duplaPorId.get(j.dupla_a_id))}`)
  }

  const completar = (dupla, campo, atletaId) => rodar(async () => {
    const { error } = await supabase.from('campeonato_duplas').update({ [campo]: atletaId || null }).eq('id', dupla.id)
    if (error) throw error
    await recarregar()
  }, 'Dupla completa!')

  return (
    <>
      {campeonato.status !== 'em_andamento' && campeonato.status !== 'encerrado' && (
        <Painel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--color-state-warning)' }}>O sorteio ainda não foi publicado. A TV continua mostrando o sorteio.</span>
            <Botao variante="primario" tamanho="sm" onClick={() => rodar(() => atualizarCampeonato(campeonato.id, { status: 'em_andamento', sorteio_revelados: dados.duplas.length }), 'Torneio em andamento')}>Publicar chave e começar</Botao>
          </div>
        </Painel>
      )}

      {incompletas.map(d => {
        const jogo = jogos.find(j => j.rodada === 1 && (j.dupla_a_id === d.id || j.dupla_b_id === d.id))
        const falta = d.atleta1_id ? 'atleta2_id' : 'atleta1_id'
        const quem = duplaPorId.get(d.id)
        return (
          <Painel key={d.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1px', color: 'var(--color-state-warning)' }}>DUPLA Nº {d.numero} SEM {falta === 'atleta2_id' ? 'PARCEIRA' : 'PARCEIRO'}</div>
                <div style={{ fontSize: 14, marginTop: 2 }}>{nomesDupla(quem)}{jogo ? ` · Jogo ${jogo.ordem} (${jogo.quadra}, ${jogo.horario})` : ''}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginTop: 2 }}>Convide alguém (ex.: uma eliminada nos primeiros jogos) e escolha aqui.</div>
              </div>
              <SelectAtleta atletas={atletas} valor={null} onChange={v => v && completar(d, falta, v)} duplas={duplasAtivas} duplaId={d.id} />
            </div>
          </Painel>
        )
      })}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>
        {quadras.map(q => {
          const jogo = aoVivo.find(j => j.quadra === q)
          return (
            <div key={q} style={{ padding: 14, borderRadius: 18, backgroundColor: 'var(--color-surface-dark-raised)', border: `1px solid ${jogo ? 'var(--color-accent-live)' : 'var(--color-border-dark-subtle)'}` }}>
              {jogo ? (
                <PlacarAoVivo jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} quadras={quadras} aoVivo={aoVivo} />
              ) : (
                <QuadraLivre quadra={q} prontos={prontos} duplaPorId={duplaPorId} onIniciar={iniciar} />
              )}
            </div>
          )
        })}
      </div>

      <Painel titulo={`Próximos jogos · ${prontos.length}`}>
        <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginBottom: 10 }}>O jogo marcado como <b style={{ color: 'var(--color-state-success)' }}>PRÓXIMO</b> fica em verde na chave da TV. Para mudar, toque em "Próximo na Quadra X" em outro jogo: os dois trocam de lugar na fila (número, horário e quadra).</div>
        {!prontos.length && <div style={{ fontSize: 14, color: 'var(--color-text-dark-muted)' }}>Nenhum jogo com as duas duplas definidas esperando quadra.</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {prontos.map(j => {
            const proxQuadra = proximosMapa.get(j.id)
            return (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, backgroundColor: proxQuadra ? 'color-mix(in srgb, var(--color-state-success) 14%, var(--color-surface-dark-overlay))' : 'var(--color-surface-dark-overlay)', border: `1px solid ${proxQuadra ? 'var(--color-state-success)' : 'transparent'}` }}>
              {proxQuadra && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', padding: '3px 8px', borderRadius: 999, backgroundColor: 'var(--color-state-success)', color: 'var(--color-text-dark-primary)', whiteSpace: 'nowrap' }}>▶ PRÓXIMO · {proxQuadra.toUpperCase()}</span>}
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-dark-muted)', minWidth: 54 }}>Jogo {j.ordem}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-secondary)', minWidth: 110 }}>{rotuloFaseCurto(j.fase)} · {j.quadra} · {j.horario}</span>
              <span style={{ flex: 1, minWidth: 200, fontSize: 14, fontWeight: 600 }}>{nomesDupla(duplaPorId.get(j.dupla_a_id))} <span style={{ color: 'var(--color-text-dark-muted)' }}>x</span> {nomesDupla(duplaPorId.get(j.dupla_b_id))}</span>
              {quadras.map(q => (
                <Botao key={q} tamanho="sm" variante={aoVivo.some(x => x.quadra === q) ? 'secundario' : 'primario'} disabled={aoVivo.some(x => x.quadra === q)} onClick={() => iniciar(j, q)}>
                  <Play size={13} />{q}
                </Botao>
              ))}
              <span style={{ display: 'flex', gap: 6, flexBasis: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {quadras.filter(q => proximaDaQuadra(q)?.id !== j.id).map(q => (
                  <Botao key={q} tamanho="sm" variante="fantasma" onClick={() => tornarProximo(j, q)}><ChevronUp size={13} />Próximo na {q}</Botao>
                ))}
              </span>
            </div>
            )
          })}
        </div>
      </Painel>

      <Painel titulo="Chave">
        <Chave campeonato={campeonato} jogos={jogos} duplas={dados.duplas} duplaPorId={duplaPorId} seguindo={SEM_SEGUIDOS} />
      </Painel>
    </>
  )
}

function nomesDupla(d) {
  if (!d) return 'A definir'
  return `${nomeCurto(d.atleta1?.nome)} / ${nomeCurto(d.atleta2?.nome)}`
}

export function QuadraLivre({ quadra, prontos, duplaPorId, onIniciar }) {
  const sugestao = prontos.find(j => j.quadra === quadra) || prontos[0]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span className="cp-display" style={{ fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap' }}>{quadra}</span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: 'var(--color-text-dark-muted)' }}>LIVRE</span>
      </div>
      {sugestao ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginBottom: 6 }}>Próximo sugerido: Jogo {sugestao.ordem} · {rotuloFaseCurto(sugestao.fase)}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{nomesDupla(duplaPorId.get(sugestao.dupla_a_id))}<br /><span style={{ color: 'var(--color-text-dark-muted)' }}>x</span> {nomesDupla(duplaPorId.get(sugestao.dupla_b_id))}</div>
          <Botao variante="primario" onClick={() => onIniciar(sugestao, quadra)} estilo={{ width: '100%' }}><Play size={16} />Iniciar jogo {sugestao.ordem} aqui</Botao>
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-dark-muted)' }}>Nenhum jogo pronto para chamar.</div>
      )}
    </div>
  )
}

export function PlacarAoVivo({ jogo, duplaPorId, salvarJogo, quadras = [], aoVivo = [] }) {
  // Trocar a quadra do jogo em andamento. Se a outra quadra também tem jogo, os dois trocam.
  const mudarQuadra = async q => {
    if (!q || q === jogo.quadra) return
    const outro = aoVivo.find(x => x.id !== jogo.id && x.quadra === q)
    if (!window.confirm(outro ? `A ${q} está com o Jogo ${outro.ordem}. Trocar as quadras dos dois jogos?` : `Mudar o Jogo ${jogo.ordem} para a ${q}?`)) return
    if (outro && (await salvarJogo(outro.id, { quadra: jogo.quadra }, { silencioso: true })) === false) return
    salvarJogo(jogo.id, { quadra: q })
  }
  const opcoes = [...new Set([jogo.quadra, ...quadras].filter(Boolean))]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 0, lineHeight: 1.15 }}>
          <select value={jogo.quadra || ''} onChange={e => mudarQuadra(e.target.value)} title="Trocar a quadra deste jogo" className="cp-display"
            style={{ fontSize: 22, fontWeight: 700, padding: '0 4px', marginLeft: -4, border: '1px dashed var(--color-border-dark)', borderRadius: 8, backgroundColor: 'transparent', color: 'var(--color-text-dark-primary)', cursor: 'pointer', maxWidth: '100%' }}>
            {opcoes.map(q => <option key={q} value={q} style={{ backgroundColor: 'var(--color-surface-dark-raised)', fontFamily: 'Inter, sans-serif', fontSize: 15 }}>{q}</option>)}
          </select>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1px', color: 'var(--color-text-dark-secondary)', whiteSpace: 'nowrap' }}>{rotuloFaseCurto(jogo.fase).toUpperCase()} · JOGO {jogo.ordem}</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <TempoJogo jogo={jogo} tamanho={13} rotulo={false} cor="var(--color-text-dark-muted)" />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-accent-on-live)', backgroundColor: 'var(--color-accent-live)', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>EM JOGO</span>
        </span>
      </div>
      <PlacarManual key={jogo.id} jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <BotaoWO jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} />
        {/* Fim do aquecimento: o cronômetro do jogo (TV e celulares) recomeça do zero. */}
        <Botao tamanho="sm" variante="secundario" onClick={() => window.confirm(`Zerar o tempo do Jogo ${jogo.ordem}? O cronômetro recomeça agora (use quando acabar o aquecimento).`) && salvarJogo(jogo.id, { iniciado_em: new Date().toISOString() })}><RotateCcw size={13} />Zerar tempo</Botao>
        <Botao tamanho="sm" variante="fantasma" onClick={() => window.confirm('Tirar este jogo da quadra e voltar para a fila?') && salvarJogo(jogo.id, { status: 'agendado' })}><Pause size={13} />Voltar para a fila</Botao>
      </div>
    </div>
  )
}

// Placar digitado a partir da súmula de papel: toque no quadrado e escreva os games de cada set.
// Set em 4 a 3 (tie-break do 3 a 3) abre o quadradinho do tie-break (pontos até 7). Nada é gravado enquanto digita: só
// o botão "Finalizar jogo" grava o placar, encerra o jogo e faz a dupla vencedora avançar na chave.
export function PlacarManual({ jogo, duplaPorId, salvarJogo, aoFinalizar }) {
  const [campos, setCampos] = useState(() => camposDoPlacar(jogo.sets))
  const [salvando, setSalvando] = useState(false)
  const { sets, vencedor, erro } = validarPlacarDigitado(campos)
  const algoDigitado = campos.some(c => c.a !== '' || c.b !== '')
  const preenchido = i => campos[i].a !== '' && campos[i].b !== ''
  const ehTb = i => {
    const a = Number(campos[i].a)
    const b = Number(campos[i].b)
    return preenchido(i) && Math.max(a, b) === 4 && Math.min(a, b) === 3
  }
  const v1 = preenchido(0) ? vencedorDoSet({ a: Number(campos[0].a), b: Number(campos[0].b) }, 0) : null
  const v2 = preenchido(1) ? vencedorDoSet({ a: Number(campos[1].a), b: Number(campos[1].b) }, 1) : null
  const terceiroFechado = !!v1 && v1 === v2 && campos[2].a === '' && campos[2].b === ''
  const mostraTb = [0, 1].some(ehTb)
  const lados = { a: jogo.dupla_a_id, b: jogo.dupla_b_id }

  const mudar = (i, campo, valor) => setCampos(cs => cs.map((c, k) => (k === i ? { ...c, [campo]: valor.replace(/\D/g, '').slice(0, 2) } : c)))

  const finalizar = async () => {
    if (!vencedor || salvando) return
    const venc = duplaPorId.get(lados[vencedor])
    const placar = sets.map(s => textoSet(s, vencedor)).join('  ')
    if (!window.confirm(`Finalizar o Jogo ${jogo.ordem}?\n\nVitória de ${nomesDupla(venc)}: ${placar}\n\nA dupla avança na chave.`)) return
    setSalvando(true)
    const antes = { sets: jogo.sets || [], status: jogo.status, vencedor_id: jogo.vencedor_id || null, finalizado_em: jogo.finalizado_em || null }
    const agora = new Date().toISOString()
    const ok = await salvarJogo(jogo.id, { sets, status: 'finalizado', vencedor_id: lados[vencedor], iniciado_em: jogo.iniciado_em && jogo.iniciado_em < agora ? jogo.iniciado_em : agora, finalizado_em: agora }, { silencioso: true })
    setSalvando(false)
    if (ok === false) return
    toast((t) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        Jogo {jogo.ordem} finalizado. {nomesDupla(venc)} avança!
        <button onClick={() => { toast.dismiss(t.id); salvarJogo(jogo.id, antes) }} style={{ border: '1px solid var(--color-border-dark)', background: 'none', color: 'inherit', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>Desfazer</button>
      </span>
    ), { duration: 8000 })
    aoFinalizar?.()
  }

  const quadrado = (i, campo, { pequeno = false, desligado = false } = {}) => (
    <input value={campos[i][campo]} inputMode="numeric" pattern="[0-9]*" disabled={desligado} aria-label={`${i + 1}º set ${campo}`}
      onFocus={e => e.target.select()} onChange={e => mudar(i, campo, e.target.value)}
      style={{
        boxSizing: 'border-box', width: pequeno ? 40 : '100%', height: pequeno ? 36 : 52, padding: 0, borderRadius: pequeno ? 9 : 12, textAlign: 'center', outline: 'none',
        fontSize: pequeno ? 17 : 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        border: `${pequeno ? 1 : 2}px solid ${desligado ? 'var(--color-border-dark-subtle)' : pequeno ? 'var(--color-brand-lima)' : 'var(--color-border-dark)'}`,
        backgroundColor: desligado ? 'transparent' : 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', opacity: desligado ? 0.35 : 1,
      }} />
  )
  const grade = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px 52px 52px', gap: 8, alignItems: 'center' }
  const linha = lado => {
    const d = duplaPorId.get(lados[lado])
    const ganhou = vencedor === lado
    return (
      <>
        <div style={{ ...grade, padding: '6px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <AvataresDupla dupla={d} tamanho={30} destaque={ganhou} />
            <div style={{ minWidth: 0, lineHeight: 1.2, color: ganhou ? 'var(--color-brand-lima)' : 'inherit' }}>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(d?.atleta1?.nome)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeCurto(d?.atleta2?.nome)}</div>
            </div>
          </div>
          {quadrado(0, lado)}
          {quadrado(1, lado)}
          {quadrado(2, lado, { desligado: terceiroFechado })}
        </div>
        {mostraTb && (
          <div style={{ ...grade, paddingBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: 'var(--color-brand-lima)', textAlign: 'right' }}>TIE-BREAK</div>
            {[0, 1].map(i => <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>{ehTb(i) ? quadrado(i, lado === 'a' ? 'tbA' : 'tbB', { pequeno: true }) : null}</div>)}
            <div />
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      <div style={{ ...grade, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', color: 'var(--color-text-dark-muted)', textAlign: 'center' }}>
        <span style={{ textAlign: 'left' }}>DUPLA</span><span>1º SET</span><span>2º SET</span><span>3º (TB)</span>
      </div>
      {linha('a')}
      <div style={{ height: 1, backgroundColor: 'var(--color-border-dark-subtle)' }} />
      {linha('b')}
      <div style={{ fontSize: 12, lineHeight: 1.4, minHeight: 18, marginTop: 6, color: vencedor ? 'var(--color-brand-lima)' : algoDigitado ? 'var(--color-state-warning)' : 'var(--color-text-dark-muted)' }}>
        {vencedor ? `Vitória de ${nomesDupla(duplaPorId.get(lados[vencedor]))}` : algoDigitado ? erro : 'Toque nos quadrados e digite os games da súmula. No 4 a 3 aparece o quadrado do tie-break (até 7).'}
      </div>
      <Botao variante="primario" disabled={!vencedor || salvando} onClick={finalizar} estilo={{ width: '100%', marginTop: 8, padding: '13px 16px', fontSize: 16, justifyContent: 'center' }}><Flag size={17} />{salvando ? 'Salvando...' : 'Finalizar jogo'}</Botao>
    </div>
  )
}

function BotaoWO({ jogo, duplaPorId, salvarJogo }) {
  const [aberto, setAberto] = useState(false)
  if (!aberto) return <Botao tamanho="sm" variante="fantasma" onClick={() => setAberto(true)}><Flag size={13} />W.O.</Botao>
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-dark-secondary)' }}>Quem vence por W.O.?</span>
      {['a', 'b'].map(l => {
        const d = duplaPorId.get(jogo[`dupla_${l}_id`])
        return d ? <Botao key={l} tamanho="sm" variante="secundario" onClick={() => { setAberto(false); salvarJogo(jogo.id, { status: 'wo', vencedor_id: d.id, finalizado_em: new Date().toISOString() }) }}>{nomesDupla(d)}</Botao> : null
      })}
      <Botao tamanho="sm" variante="fantasma" onClick={() => setAberto(false)}><X size={13} /></Botao>
    </span>
  )
}

// =============================================================================================
// ATLETAS
// =============================================================================================

function AbaAtletas({ dados }) {
  const { campeonato, atletas, recarregar } = dados
  const [lista, setLista] = useState('inscritos')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState({ nome: '', genero: 'F', situacao: 'inscrito', telefone: '' })
  // Telefones ficam numa tabela fechada (só a gestão lê); usados no "Sua dupla" do link público.
  const [contatos, setContatos] = useState(new Map())
  const [versaoContatos, setVersaoContatos] = useState(0)
  useEffect(() => {
    let vivo = true
    supabase.from('campeonato_contatos').select('atleta_id, telefone').then(({ data }) => {
      if (vivo && data) setContatos(new Map(data.map(c => [c.atleta_id, c.telefone])))
    })
    return () => { vivo = false }
  }, [versaoContatos, atletas.length])
  const salvarTelefone = (atletaId, bruto) => rodar(async () => {
    let d = String(bruto || '').replace(/\D/g, '')
    if (d && (d.length === 10 || d.length === 11)) d = '55' + d
    const r = d
      ? await supabase.from('campeonato_contatos').upsert({ atleta_id: atletaId, telefone: d })
      : await supabase.from('campeonato_contatos').delete().eq('atleta_id', atletaId)
    if (r.error) throw r.error
    setVersaoContatos(v => v + 1)
  }, 'Telefone salvo')
  const editarTelefone = (a) => {
    const atual = (contatos.get(a.id) || '').replace(/^55/, '')
    const novoTel = window.prompt(`Telefone de ${a.nome} (com DDD). Deixe vazio para apagar.`, atual)
    if (novoTel !== null) salvarTelefone(a.id, novoTel)
  }

  const inscritos = atletas.filter(a => a.situacao === 'inscrito')
  const conta = (g, soPresentes) => inscritos.filter(a => a.genero === g && (!soPresentes || a.presente)).length
  const espera = atletas.filter(a => a.situacao === 'espera')

  const casaBusca = a => !busca || normalizar(a.nome).includes(normalizar(busca))
  const porNome = (x, y) => x.nome.localeCompare(y.nome, 'pt-BR', { sensitivity: 'base' })
  // Fila de espera: ordem de chamada = campo "ordem" (quem se inscreveu antes vem primeiro).
  const filaDe = g => espera.filter(a => a.genero === g).sort((x, y) => x.ordem - y.ordem)
  const desistencias = atletas.filter(a => a.situacao === 'desistiu').sort(porNome)

  const atualizar = (id, patch, ok) => rodar(async () => {
    const { error } = await supabase.from('campeonato_atletas').update(patch).eq('id', id)
    if (error) throw error
    await recarregar()
  }, ok)

  const adicionar = () => rodar(async () => {
    if (!novo.nome.trim()) throw new Error('Digite o nome')
    const maxOrdem = atletas.reduce((m, a) => Math.max(m, a.ordem || 0), 0)
    const { data: criado, error } = await supabase.from('campeonato_atletas').insert({ campeonato_id: campeonato.id, nome: novo.nome.trim(), genero: novo.genero, situacao: novo.situacao, ordem: maxOrdem + 1 }).select('id').single()
    if (error) throw error
    if (novo.telefone.trim()) await salvarTelefone(criado.id, novo.telefone)
    setNovo({ ...novo, nome: '', telefone: '' })
    await recarregar()
  }, 'Atleta incluído')

  const excluir = (a) => {
    if (!window.confirm(`Excluir ${a.nome} do campeonato?`)) return
    rodar(async () => {
      const { error } = await supabase.from('campeonato_atletas').delete().eq('id', a.id)
      if (error) throw error
      await recarregar()
    }, 'Excluído')
  }

  const desmarcarTodos = () => {
    if (!window.confirm('Desmarcar o check-in de todos?')) return
    rodar(async () => {
      const { error } = await supabase.from('campeonato_atletas').update({ presente: false }).eq('campeonato_id', campeonato.id)
      if (error) throw error
      await recarregar()
    }, 'Check-ins desmarcados')
  }

  const todosPresentes = () => rodar(async () => {
    const { error } = await supabase.from('campeonato_atletas').update({ presente: true }).eq('campeonato_id', campeonato.id).eq('situacao', 'inscrito')
    if (error) throw error
    await recarregar()
  }, 'Todos os inscritos marcados como presentes')

  // Troca a posição na fila com o vizinho (setas).
  const mover = (fila, i, delta) => {
    const a = fila[i]
    const b = fila[i + delta]
    if (!a || !b) return
    rodar(async () => {
      const r1 = await supabase.from('campeonato_atletas').update({ ordem: b.ordem }).eq('id', a.id)
      if (r1.error) throw r1.error
      const r2 = await supabase.from('campeonato_atletas').update({ ordem: a.ordem }).eq('id', b.id)
      if (r2.error) throw r2.error
      await recarregar()
    })
  }
  const tirar = (a) => {
    if (!window.confirm(`Tirar ${a.nome} do torneio?

Vai para a lista de Desistências (dá para voltar com um toque).`)) return
    atualizar(a.id, { situacao: 'desistiu', presente: false }, `${primeiroNome(a.nome)} saiu do torneio`)
  }
  const chamar = (a) => {
    if (!window.confirm(`Chamar ${a.nome} da fila de espera para o torneio?`)) return
    atualizar(a.id, { situacao: 'inscrito' }, `${primeiroNome(a.nome)} entrou no torneio`)
  }

  const abas = [
    ['inscritos', `Inscritos · ${inscritos.length}`],
    ['espera', `Fila de espera · ${espera.length}`],
    ['desistiu', `Desistências · ${desistencias.length}`],
  ]
  const titulo = t => <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--color-text-dark-secondary)', margin: '14px 2px 8px', textTransform: 'uppercase' }}>{t}</div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Numero rotulo="Mulheres inscritas" valor={conta('F')} sub={`${conta('F', true)} presentes`} />
        <Numero rotulo="Homens inscritos" valor={conta('M')} sub={`${conta('M', true)} presentes`} />
        <Numero rotulo="Duplas possíveis" valor={Math.min(conta('F', true) || conta('F'), conta('M', true) || conta('M'))} sub={conta('F', true) || conta('M', true) ? 'com os presentes' : 'com os inscritos'} />
        <Numero rotulo="Lista de espera" valor={espera.length} sub="veja a aba Fila de espera" />
      </div>

      <Painel titulo="Incluir atleta">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...estiloInput, flex: '1 1 220px' }} placeholder="Nome completo" value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} onKeyDown={e => e.key === 'Enter' && adicionar()} />
          <input style={{ ...estiloInput, flex: '0 1 170px' }} placeholder="Telefone (DDD)" inputMode="tel" value={novo.telefone} onChange={e => setNovo({ ...novo, telefone: e.target.value })} />
          <select style={estiloInput} value={novo.genero} onChange={e => setNovo({ ...novo, genero: e.target.value })}><option value="F">Feminino</option><option value="M">Masculino</option></select>
          <select style={estiloInput} value={novo.situacao} onChange={e => setNovo({ ...novo, situacao: e.target.value })}><option value="inscrito">Inscrito</option><option value="espera">Lista de espera</option></select>
          <Botao variante="primario" onClick={adicionar}><Plus size={15} />Incluir</Botao>
        </div>
      </Painel>

      <Painel extra={lista === 'inscritos' ? <><Botao tamanho="sm" onClick={todosPresentes}><Check size={13} />Marcar todos presentes</Botao><Botao tamanho="sm" variante="fantasma" onClick={desmarcarTodos}><X size={13} />Desmarcar todos</Botao></> : null}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {abas.map(([v, t]) => (
            <button key={v} onClick={() => setLista(v)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: `1px solid ${lista === v ? 'var(--color-brand-lima)' : 'var(--color-border-dark)'}`, backgroundColor: lista === v ? 'color-mix(in srgb, var(--color-brand-lima) 12%, transparent)' : 'transparent', color: lista === v ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)' }}>{t}</button>
          ))}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dark-muted)' }} />
            <input style={{ ...estiloInput, paddingLeft: 30, width: 200 }} placeholder="Buscar" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        {lista === 'inscritos' && [['F', 'Mulheres'], ['M', 'Homens']].map(([g, t]) => {
          const doLado = inscritos.filter(a => a.genero === g && casaBusca(a)).sort(porNome)
          return (
            <div key={g}>
              {titulo(`${t} · ${conta(g)} inscritos · ${conta(g, true)} com check-in`)}
              <div style={{ display: 'grid', gap: 6 }}>
                {doLado.map(a => <LinhaAtleta key={a.id} atleta={a} atualizar={atualizar} excluir={excluir} telefone={contatos.get(a.id)} onTelefone={() => editarTelefone(a)} acoes={<Botao tamanho="sm" variante="perigo" titulo="Tirar do torneio (vai para Desistências, dá para voltar)" onClick={() => tirar(a)}><UserMinus size={14} />Tirar</Botao>} />)}
                {!doLado.length && <div style={{ fontSize: 14, color: 'var(--color-text-dark-muted)' }}>Ninguém aqui.</div>}
              </div>
            </div>
          )
        })}

        {lista === 'espera' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', margin: '8px 2px 0', lineHeight: 1.5 }}>
              Ordem de chamada: o nº 1 é o próximo a ser chamado. Use as setas para mudar a ordem e <b>Chamar</b> para colocar a pessoa no torneio.
            </div>
            {[['F', 'Mulheres'], ['M', 'Homens']].map(([g, t]) => {
              const fila = filaDe(g)
              if (!fila.length) return null
              return (
                <div key={g}>
                  {titulo(`${t} · ${fila.length} na fila`)}
                  <div style={{ display: 'grid', gap: 6 }}>
                    {fila.map((a, i) => casaBusca(a) && (
                      <LinhaAtleta key={a.id} atleta={a} atualizar={atualizar} excluir={excluir} telefone={contatos.get(a.id)} onTelefone={() => editarTelefone(a)} numero={i + 1} acoes={(
                        <>
                          <Botao tamanho="sm" variante="fantasma" titulo="Subir na fila" disabled={i === 0} onClick={() => mover(fila, i, -1)}><ChevronUp size={15} /></Botao>
                          <Botao tamanho="sm" variante="fantasma" titulo="Descer na fila" disabled={i === fila.length - 1} onClick={() => mover(fila, i, 1)}><ChevronDown size={15} /></Botao>
                          <Botao tamanho="sm" variante="destaque" onClick={() => chamar(a)}><UserPlus size={14} />Chamar</Botao>
                        </>
                      )} />
                    ))}
                  </div>
                </div>
              )
            })}
            {!espera.length && <div style={{ fontSize: 14, color: 'var(--color-text-dark-muted)', marginTop: 10 }}>Fila de espera vazia.</div>}
          </>
        )}

        {lista === 'desistiu' && (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {desistencias.filter(casaBusca).map(a => <LinhaAtleta key={a.id} atleta={a} atualizar={atualizar} excluir={excluir} telefone={contatos.get(a.id)} onTelefone={() => editarTelefone(a)} acoes={<Botao tamanho="sm" variante="destaque" onClick={() => atualizar(a.id, { situacao: 'inscrito' }, `${primeiroNome(a.nome)} voltou para o torneio`)}><UserPlus size={14} />Voltar para o torneio</Botao>} />)}
            {!desistencias.length && <div style={{ fontSize: 14, color: 'var(--color-text-dark-muted)' }}>Nenhuma desistência.</div>}
          </div>
        )}
      </Painel>
    </>
  )
}

function Numero({ rotulo, valor, sub }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{rotulo}</div>
      <div className="cp-display" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)' }}>{sub}</div>
    </div>
  )
}

function LinhaAtleta({ atleta: a, atualizar, excluir, numero, acoes, telefone, onTelefone }) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(a.nome)
  const ref = useRef(null)
  const [arquivo, setArquivo] = useState(null)
  const foto = (e) => {
    const arq = e.target.files?.[0]
    e.target.value = ''
    if (arq) setArquivo(arq)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 12, backgroundColor: 'var(--color-surface-dark-overlay)', opacity: a.situacao === 'desistiu' ? 0.55 : 1 }}>
      {numero != null && (
        <span className="cp-display" style={{ minWidth: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, backgroundColor: numero === 1 ? 'var(--color-brand-lima)' : 'var(--color-surface-dark-raised)', color: numero === 1 ? 'var(--color-brand-verde-court)' : 'var(--color-text-dark-primary)' }}>{numero}</span>
      )}
      <input ref={ref} type="file" accept="image/*" onChange={foto} style={{ display: 'none' }} />
      {arquivo && <EditorFoto arquivo={arquivo} onCancelar={() => setArquivo(null)} onConfirmar={async (f) => { await atualizar(a.id, { foto: f }, 'Foto salva'); setArquivo(null) }} />}
      <button onClick={() => ref.current?.click()} title="Trocar foto" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}>
        <Avatar atleta={a} tamanho={38} />
        {!a.foto && <Camera size={12} style={{ position: 'absolute', right: -2, bottom: -2, color: 'var(--color-text-dark-secondary)' }} />}
      </button>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        {editando ? (
          <span style={{ display: 'flex', gap: 6 }}>
            <input autoFocus style={{ ...estiloInput, flex: 1, padding: '6px 8px' }} value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { atualizar(a.id, { nome: nome.trim() }, 'Nome salvo'); setEditando(false) } if (e.key === 'Escape') setEditando(false) }} />
            <Botao tamanho="sm" variante="primario" onClick={() => { atualizar(a.id, { nome: nome.trim() }, 'Nome salvo'); setEditando(false) }}><Check size={13} /></Botao>
          </span>
        ) : (
          <button onClick={() => { setNome(a.nome); setEditando(true) }} title="Editar nome" style={{ background: 'none', border: 'none', color: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'text', padding: 0, textAlign: 'left' }}>{a.nome}</button>
        )}
      </div>
      <select value={a.genero} onChange={e => atualizar(a.id, { genero: e.target.value })} style={{ ...estiloInput, padding: '6px 8px', fontSize: 13 }}><option value="F">F</option><option value="M">M</option></select>
      <select value={a.situacao} onChange={e => atualizar(a.id, { situacao: e.target.value, ...(e.target.value !== 'inscrito' ? { presente: false } : {}) })} style={{ ...estiloInput, padding: '6px 8px', fontSize: 13 }}>
        <option value="inscrito">Inscrito</option><option value="espera">Espera</option><option value="desistiu">Desistiu</option>
      </select>
      <button onClick={() => atualizar(a.id, { presente: !a.presente })} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', minWidth: 104, justifyContent: 'center',
        border: `1px solid ${a.presente ? 'var(--color-state-success)' : 'var(--color-border-dark)'}`,
        backgroundColor: a.presente ? 'var(--color-state-success)' : 'transparent', color: a.presente ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-secondary)',
      }}>{a.presente ? <><Check size={14} />Presente</> : 'Check-in'}</button>
      {onTelefone && (
        <button onClick={onTelefone} title="Editar telefone" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent', color: telefone ? 'var(--color-text-dark-secondary)' : 'var(--color-state-warning)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Phone size={12} />{telefone ? telefone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : 'sem telefone'}
        </button>
      )}
      {a.foto && <Botao tamanho="sm" variante="fantasma" titulo="Apagar foto" onClick={() => window.confirm('Apagar a foto?') && atualizar(a.id, { foto: null }, 'Foto apagada')}><Camera size={13} /><X size={11} /></Botao>}
      {acoes}
      <Botao tamanho="sm" variante="fantasma" titulo="Excluir atleta" onClick={() => excluir(a)}><Trash2 size={14} /></Botao>
    </div>
  )
}

// =============================================================================================
// SORTEIO
// =============================================================================================

// Apaga duplas, jogos e placares e volta o torneio para antes do sorteio. Opcionalmente também
// desmarca os check-ins e apaga as fotos (zerar para um novo teste). Não sorteia nada.
async function zerarCampeonato(id, { checkins = false, fotos = false } = {}) {
  const { error: e1 } = await supabase.from('campeonato_jogos').delete().eq('campeonato_id', id)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('campeonato_duplas').delete().eq('campeonato_id', id)
  if (e2) throw e2
  await atualizarCampeonato(id, { status: 'inscricoes', sorteio_revelados: 0, sorteio_em: null })
  const patch = { ...(checkins ? { presente: false } : {}), ...(fotos ? { foto: null } : {}) }
  if (Object.keys(patch).length) {
    const { error: e3 } = await supabase.from('campeonato_atletas').update(patch).eq('campeonato_id', id)
    if (e3) throw e3
  }
}

// Avança o sorteio só se o número no banco ainda for o esperado: evita que o cronômetro
// automático, disparando atrasado, desfaça um "Revelar todas" (voltando de 16 para 6, por exemplo).
async function avancarRevelados(id, de, para) {
  const { error } = await supabase.from('campeonatos').update({ sorteio_revelados: para }).eq('id', id).eq('sorteio_revelados', de)
  if (error) throw error
}

async function atualizarCampeonato(id, patch) {
  const { error } = await supabase.from('campeonatos').update(patch).eq('id', id)
  if (error) throw error
}

function AbaSorteio({ dados, irPara }) {
  const { campeonato, atletas, duplas, jogos, duplaPorId, recarregar } = dados
  const [auto, setAuto] = useState(true)
  const [segundos, setSegundos] = useState(8)
  const iniciando = useRef(false)
  const [iniciandoUI, setIniciandoUI] = useState(false)
  const revelados = campeonato.sorteio_revelados || 0
  const emSorteio = campeonato.status === 'sorteio'

  const inscritos = atletas.filter(a => a.situacao === 'inscrito')
  const usaPresentes = inscritos.some(a => a.presente)
  // Todos os inscritos entram no sorteio. Quem não fez check-in joga nos últimos jogos da 1ª
  // rodada (sortearDuplasPorPresenca + encaixarPorPresenca).
  const base = inscritos
  const homens = base.filter(a => a.genero === 'M')
  const mulheres = base.filter(a => a.genero === 'F')
  const qtdCompletas = Math.min(homens.length, mulheres.length)
  const ausentes = usaPresentes ? inscritos.filter(a => !a.presente).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')) : []
  const inscritosF = inscritos.filter(a => a.genero === 'F').length
  const inscritosM = inscritos.filter(a => a.genero === 'M').length
  const sobraQtd = Math.abs(homens.length - mulheres.length)
  const sobraHomens = homens.length > mulheres.length
  // quem sobra vira dupla com parceiro(a) "A definir"
  const qtdDuplas = qtdCompletas >= 1 ? Math.max(homens.length, mulheres.length) : 0

  // Ritmo do sorteio: esta tela revela uma dupla a cada N segundos (todo mundo vê junto).
  useEffect(() => {
    if (!emSorteio || !auto || revelados >= duplas.length) return
    const t = setTimeout(() => {
      avancarRevelados(campeonato.id, revelados, revelados + 1).then(() => recarregar(['camp'])).catch(e => toast.error(e.message))
    }, segundos * 1000)
    return () => clearTimeout(t)
  }, [emSorteio, auto, revelados, duplas.length, segundos, campeonato.id, recarregar])

  // Revelada a última dupla, publica a chave sozinho depois de alguns segundos (dá tempo de a TV
  // mostrar a última dupla). Antes dependia do botão "Publicar chave" e os celulares ficavam presos
  // na tela do sorteio. O update é condicional: se alguém já publicou, não faz nada.
  useEffect(() => {
    if (!emSorteio || !duplas.length || revelados < duplas.length) return
    const t = setTimeout(async () => {
      const { error } = await supabase.from('campeonatos').update({ status: 'em_andamento' }).eq('id', campeonato.id).eq('status', 'sorteio')
      if (error) return toast.error(error.message)
      toast.success('Sorteio concluído. Chave publicada!')
      recarregar()
    }, 10000)
    return () => clearTimeout(t)
  }, [emSorteio, revelados, duplas.length, campeonato.id, recarregar])

  const iniciar = () => {
    if (qtdCompletas < 2) return toast.error('Precisa de pelo menos 2 homens e 2 mulheres')
    const sobra = qtdDuplas - qtdCompletas
    const msg = `Sortear ${qtdDuplas} duplas entre TODOS os inscritos?` +
      (sobra ? `\n\n${sobra} dupla(s) ficam com parceiro(a) "A DEFINIR" (sai por último no sorteio e o jogo dela é o último da 1ª rodada). Depois é só escolher a pessoa na aba Ao vivo.` : '') +
      (usaPresentes && ausentes.length ? `\n\nSem check-in (${ausentes.length}): ${ausentes.map(a => nomeCurto(a.nome)).join(', ')}. Entram no sorteio, mas jogam nos ÚLTIMOS jogos da 1ª rodada. Quem fez check-in joga primeiro.` : '') +
      `\n\nA TV e os celulares vão mostrar o sorteio ao vivo.`
    if (iniciando.current) return
    if (!window.confirm(msg)) return
    // Trava 1 (este aparelho): o botão ficava ativo enquanto gravava; um 2º toque sorteava de
    // novo. Foi o que gerou as 32 duplas repetidas no teste de 08/11.
    if (iniciando.current) return
    iniciando.current = true
    setIniciandoUI(true)
    rodar(async () => {
      const { duplas: novas } = sortearDuplasPorPresenca(homens, mulheres)
      validarDuplas(novas, qtdDuplas)
      const incompletas = new Set(novas.filter(duplaIncompleta).map(d => d.id))
      let chave = montarChave(novas, { terceiro: campeonato.disputa_terceiro })
      for (const m of propagar(chave)) chave = chave.map(j => (j.id === m.id ? { ...j, ...m.patch } : j))
      for (const m of agendar(chave, campeonato.quadras, campeonato.hora_inicio, campeonato.duracao_min, incompletas)) chave = chave.map(j => (j.id === m.id ? { ...j, ...m.patch } : j))
      // Presentes nos primeiros jogos, quem não fez check-in nos últimos.
      if (usaPresentes) {
        const presentes = new Set(inscritos.filter(a => a.presente).map(a => a.id))
        for (const m of encaixarPorPresenca(chave, novas, presentes)) chave = chave.map(j => (j.id === m.id ? { ...j, ...m.patch } : j))
      }
      // vencedor do bye já entra na 2ª rodada
      for (const m of propagar(chave)) chave = chave.map(j => (j.id === m.id ? { ...j, ...m.patch } : j))
      // Ordem de REVELAÇÃO (campo numero) sorteada à parte da posição na chave: senão as duplas
      // saíam na ordem dos jogos (Jogo 1, Jogo 2, Jogo 3...) e o sorteio parecia combinado.
      // Só a dupla com parceiro(a) "A definir" continua saindo por último.
      ;[...embaralhar(novas.filter(d => !duplaIncompleta(d))), ...novas.filter(duplaIncompleta)].forEach((d, i) => { d.numero = i + 1 })

      // Trava 2 (banco): não pode haver dupla gravada, e só UM aparelho consegue virar o status de
      // "inscrições" para "sorteio" (update condicional). Quem perder a corrida não grava nada.
      const { count, error: e0 } = await supabase.from('campeonato_duplas').select('id', { count: 'exact', head: true }).eq('campeonato_id', campeonato.id)
      if (e0) throw e0
      if (count) throw new Error('Já existe um sorteio gravado. Atualize a página. Para sortear de novo, use "Desfazer sorteio" primeiro.')
      const { data: trava, error: eT } = await supabase.from('campeonatos')
        .update({ status: 'sorteio', sorteio_revelados: 0, sorteio_em: new Date().toISOString() })
        .eq('id', campeonato.id).eq('status', 'inscricoes').select('id')
      if (eT) throw eT
      if (!trava?.length) throw new Error('O sorteio já foi iniciado (em outro aparelho ou aba). Nada foi sorteado de novo.')

      try {
        const { error: e1 } = await supabase.from('campeonato_duplas').insert(novas.map(d => ({ ...d, campeonato_id: campeonato.id })))
        if (e1) throw e1
        const { error: e2 } = await supabase.from('campeonato_jogos').insert(chave.map(j => ({ ...j, campeonato_id: campeonato.id })))
        if (e2) throw e2
      } catch (e) {
        // Não deixa sorteio pela metade: volta tudo para antes do sorteio.
        await zerarCampeonato(campeonato.id).catch(() => {})
        throw e
      }
      await recarregar()
    }, 'Sorteio iniciado').finally(() => {
      iniciando.current = false
      setIniciandoUI(false)
    })
  }

  const refazer = () => {
    const comPlacar = jogos.some(j => ['ao_vivo', 'finalizado', 'wo'].includes(j.status))
    if (!window.confirm(`Desfazer o sorteio? Apaga todas as duplas e jogos e volta para antes do sorteio. NÃO sorteia de novo: o novo sorteio só começa quando você tocar em "Iniciar sorteio ao vivo".\n\nCheck-ins e fotos continuam.${comPlacar ? '\n\nATENÇÃO: já existem jogos com placar. Tudo será perdido.' : ''}`)) return
    rodar(async () => {
      await zerarCampeonato(campeonato.id)
      await recarregar()
    }, 'Sorteio desfeito. Nada foi sorteado de novo.')
  }

  const publicar = () => rodar(async () => {
    await atualizarCampeonato(campeonato.id, { status: 'em_andamento', sorteio_revelados: duplas.length })
    await recarregar()
    irPara('operacao')
  }, 'Chave publicada. Bom torneio!')

  const trocarAtleta = (dupla, campo, atletaId) => rodar(async () => {
    const { error } = await supabase.from('campeonato_duplas').update({ [campo]: atletaId || null }).eq('id', dupla.id)
    if (error) throw error
    await recarregar()
  }, 'Dupla atualizada')

  if (!duplas.length) {
    return (
      <Painel titulo="Sorteio das duplas mistas">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
          <Numero rotulo="Homens" valor={homens.length} sub={usaPresentes ? 'presentes' : 'inscritos'} />
          <Numero rotulo="Mulheres" valor={mulheres.length} sub={usaPresentes ? 'presentes' : 'inscritos'} />
          <Numero rotulo="Duplas" valor={qtdDuplas} sub={qtdDuplas ? `chave de ${2 ** Math.ceil(Math.log2(Math.max(2, qtdDuplas)))}` : ''} />
        </div>
        {/* O aviso de sobra só vale com o check-in: até lá ainda pode faltar gente dos dois lados. */}
        {!usaPresentes ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            <b>Aguardando check-in.</b> Os números acima são dos inscritos. Assim que começarem os check-ins, esta tela passa a contar só quem chegou e avisa se alguém vai ficar sem par.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 10 }}>
              Check-in: <b>{mulheres.length}</b> de {inscritosF} mulheres e <b>{homens.length}</b> de {inscritosM} homens.
            </div>
            {sobraQtd > 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-state-warning)', marginBottom: 10, lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-state-warning)' }}>
                <b>{sobraQtd} {sobraHomens ? (sobraQtd === 1 ? 'homem vai ficar' : 'homens vão ficar') : (sobraQtd === 1 ? 'mulher vai ficar' : 'mulheres vão ficar')} sem par.</b>{' '}
                {sobraQtd === 1 ? 'Ele(a) vira uma dupla' : `Cada um(a) vira uma dupla`} com {sobraHomens ? 'parceira' : 'parceiro'} "A definir", {sobraQtd === 1 ? 'sorteada' : 'sorteadas'} por último e com o jogo no fim da 1ª rodada. Dá tempo de convidar alguém eliminado.
                {' '}Se preferir equilibrar antes, chame alguém da fila de espera ({sobraHomens ? 'mulheres' : 'homens'}) na aba Atletas.
              </div>
            )}
            {ausentes.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                <b>Ainda sem check-in ({ausentes.length}):</b> {ausentes.map(a => nomeCurto(a.nome)).join(', ')}. Entram no sorteio e jogam nos últimos jogos da 1ª rodada.
              </div>
            )}
          </>
        )}
        {qtdDuplas > 0 && (qtdDuplas & (qtdDuplas - 1)) !== 0 && <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 10 }}>Com {qtdDuplas} duplas, {2 ** Math.ceil(Math.log2(qtdDuplas)) - qtdDuplas} dupla(s) sorteada(s) avançam direto (bye) na 1ª rodada.</div>}
        <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Ao tocar em sortear, o sistema embaralha, monta a chave e define quadra e horário de cada jogo (primeiro jogo às {campeonato.hora_inicio}, {campeonato.duracao_min} min por rodada, quadras: {(campeonato.quadras || []).join(', ')}). As duplas vão aparecendo uma a uma na TV e nos celulares.
        </div>
        <Botao variante="primario" tamanho="lg" onClick={iniciar} disabled={qtdCompletas < 2 || iniciandoUI || campeonato.status !== 'inscricoes'}><Shuffle size={18} />{iniciandoUI ? 'Sorteando...' : 'Iniciar sorteio ao vivo'}</Botao>
      </Painel>
    )
  }

  return (
    <>
      {emSorteio && (
        <Painel titulo="Controle do sorteio ao vivo">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="cp-display" style={{ fontSize: 22, fontWeight: 700, marginRight: 8 }}>{revelados} de {duplas.length}</span>
            <Botao onClick={() => setAuto(v => !v)}>{auto ? <><Pause size={15} />Pausar</> : <><Play size={15} />Retomar</>}</Botao>
            <Botao disabled={revelados >= duplas.length} onClick={() => rodar(() => avancarRevelados(campeonato.id, revelados, revelados + 1).then(() => recarregar(['camp'])))}><SkipForward size={15} />Próxima dupla</Botao>
            <Botao disabled={revelados >= duplas.length} onClick={() => { setAuto(false); rodar(() => atualizarCampeonato(campeonato.id, { sorteio_revelados: duplas.length }).then(recarregar)) }}><FastForward size={15} />Revelar todas</Botao>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-dark-secondary)' }}>
              a cada
              <select value={segundos} onChange={e => setSegundos(Number(e.target.value))} style={{ ...estiloInput, padding: '6px 8px' }}>{[3, 4, 6, 8, 10, 15].map(s => <option key={s} value={s}>{s}s</option>)}</select>
            </label>
            <Botao variante="destaque" estilo={{ marginLeft: 'auto' }} disabled={revelados < duplas.length} onClick={publicar}><Check size={15} />Publicar chave e começar</Botao>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginTop: 8 }}>Mantenha esta tela aberta durante o sorteio: é ela que dá o ritmo para a TV e os celulares.</div>
        </Painel>
      )}

      <Painel titulo="Duplas" extra={<Botao tamanho="sm" variante="perigo" onClick={refazer}><RotateCcw size={13} />Desfazer sorteio</Botao>}>
        <SorteioAoVivo campeonato={campeonato} duplas={duplas} duplaPorId={duplaPorId} atletas={atletas} seguindo={SEM_SEGUIDOS} colunas={2} escala={0.9} />
      </Painel>

      <Painel titulo="Editar duplas (substituição por suplente)">
        <div style={{ display: 'grid', gap: 8 }}>
          {duplas.map(d => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ width: 28, fontWeight: 800, color: 'var(--color-text-dark-muted)' }}>{d.numero}</span>
              <SelectAtleta atletas={atletas} valor={d.atleta1_id} onChange={v => trocarAtleta(d, 'atleta1_id', v)} duplas={duplas} duplaId={d.id} />
              <SelectAtleta atletas={atletas} valor={d.atleta2_id} onChange={v => trocarAtleta(d, 'atleta2_id', v)} duplas={duplas} duplaId={d.id} />
            </div>
          ))}
        </div>
      </Painel>
    </>
  )
}

// Escolha de atleta para uma dupla. Quem já está em OUTRA dupla aparece bloqueado, para ninguém
// jogar em duas duplas ao mesmo tempo.
function SelectAtleta({ atletas, valor, onChange, duplas = [], duplaId = null }) {
  const lista = [...atletas].filter(a => a.situacao !== 'desistiu' || a.id === valor).sort((a, b) => a.nome.localeCompare(b.nome))
  const emOutra = new Map()
  for (const d of duplas) {
    if (d.id === duplaId) continue
    for (const id of [d.atleta1_id, d.atleta2_id]) if (id) emOutra.set(id, d.numero)
  }
  return (
    <select value={valor || ''} onChange={e => onChange(e.target.value)} style={{ ...estiloInput, flex: '1 1 220px', minWidth: 0 }}>
      <option value="">(vazio)</option>
      {['F', 'M'].map(g => (
        <optgroup key={g} label={g === 'F' ? 'Mulheres' : 'Homens'}>
          {lista.filter(a => a.genero === g).map(a => (
            <option key={a.id} value={a.id} disabled={emOutra.has(a.id) && a.id !== valor}>
              {a.nome}{a.situacao === 'espera' ? ' (espera)' : ''}{emOutra.has(a.id) ? ` (já na dupla ${emOutra.get(a.id)})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// =============================================================================================
// JOGOS (edição manual de tudo)
// =============================================================================================

function AbaJogos({ dados, salvarJogo }) {
  const { campeonato, jogos, duplaPorId, recarregar } = dados
  const ordenados = ordenarJogos(jogos).sort((a, b) => (a.status === 'bye') - (b.status === 'bye') || (a.ordem || 999) - (b.ordem || 999))

  const recalcularHorarios = () => {
    if (!window.confirm(`Recalcular quadra e horário dos jogos ainda agendados, seguindo a ordem atual (Jogo 1, 2, 3...)?\n\nPrimeiro jogo às ${campeonato.hora_inicio}, ${campeonato.duracao_min} min por rodada, quadras: ${(campeonato.quadras || []).join(', ')}.`)) return
    rodar(async () => {
      await aplicarPatchesJogos(reagendarPelaOrdem(jogos, campeonato.quadras, campeonato.hora_inicio, campeonato.duracao_min))
      await recarregar(['jogos'])
    }, 'Horários recalculados')
  }

  const reorganizar = () => {
    if (!window.confirm('Refazer a ordem de TODOS os jogos ainda agendados do zero (rodada por rodada, intercalando os dois lados da chave)? A ordem que você arrumou à mão se perde.')) return
    rodar(async () => {
      const mud = agendar(jogos, campeonato.quadras, campeonato.hora_inicio, campeonato.duracao_min, new Set(dados.duplas.filter(duplaIncompleta).map(d => d.id)))
        .filter(m => jogos.find(j => j.id === m.id)?.status === 'agendado')
      await aplicarPatchesJogos(mud)
      await recarregar(['jogos'])
    }, 'Ordem refeita')
  }

  if (!jogos.length) return <Painel><div style={{ fontSize: 14, color: 'var(--color-text-dark-secondary)' }}>Os jogos são criados no sorteio.</div></Painel>

  return (
    <>
      <OrdemDosJogos dados={dados} onRecalcular={recalcularHorarios} onReorganizar={reorganizar} />
      <Painel titulo={`Placar e detalhes de cada jogo · ${jogos.filter(j => j.status !== 'bye').length}`}>
        <div style={{ display: 'grid', gap: 10 }}>
          {ordenados.map(j => <EditorJogo key={`${j.id}-${JSON.stringify(j.sets)}-${j.quadra}-${j.horario}-${j.status}`} jogo={j} campeonato={campeonato} duplaPorId={duplaPorId} salvarJogo={salvarJogo} dados={dados} />)}
        </div>
      </Painel>
    </>
  )
}

// Lista compacta para arrumar a ordem dos jogos com as setas. Mover troca o jogo de lugar com o
// vizinho: os dois trocam número, quadra e horário (os horários da grade continuam os mesmos).
// Só jogos ainda agendados se movem.
function OrdemDosJogos({ dados, onRecalcular, onReorganizar }) {
  const { jogos, duplaPorId, recarregar } = dados
  const [salvando, setSalvando] = useState(false)
  const lista = jogos.filter(j => j.status !== 'bye').sort((a, b) => (a.ordem || 999) - (b.ordem || 999))
  const vaga = (j, lado) => {
    const d = duplaPorId.get(j[`dupla_${lado}_id`])
    return d ? nomesDupla(d) : (origemDaVaga(j, lado, jogos) || 'A definir')
  }

  const mover = async (i, delta) => {
    const a = lista[i]
    const b = lista[i + delta]
    if (!a || !b || salvando) return
    if (a.status !== 'agendado' || b.status !== 'agendado') return toast.error('Só dá para trocar jogos que ainda não começaram.')
    setSalvando(true)
    await rodar(async () => {
      await aplicarPatchesJogos([
        { id: a.id, patch: { ordem: b.ordem, quadra: b.quadra, horario: b.horario } },
        { id: b.id, patch: { ordem: a.ordem, quadra: a.quadra, horario: a.horario } },
      ])
      await recarregar(['jogos'])
    })
    setSalvando(false)
  }

  const corStatus = { ao_vivo: 'var(--color-accent-live)', finalizado: 'var(--color-state-success)', wo: 'var(--color-state-warning)' }
  return (
    <Painel titulo="Ordem dos jogos" extra={<>
      <Botao tamanho="sm" onClick={onRecalcular}><RotateCcw size={13} />Recalcular horários</Botao>
      <Botao tamanho="sm" variante="fantasma" onClick={onReorganizar}>Refazer ordem do zero</Botao>
    </>}>
      <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', marginBottom: 10, lineHeight: 1.5 }}>
        Use as setas para mudar a ordem: o jogo troca de lugar com o vizinho (número, quadra e horário). Depois de mexer bastante, toque em <b>Recalcular horários</b> para refazer a grade na ordem nova.
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {lista.map((j, i) => {
          const travado = j.status !== 'agendado'
          return (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, backgroundColor: 'var(--color-surface-dark-overlay)', opacity: travado ? 0.6 : 1 }}>
              <span className="cp-display" style={{ minWidth: 30, fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{j.ordem}</span>
              <span style={{ minWidth: 92, fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-secondary)', lineHeight: 1.25 }}>
                {j.horario || '--:--'}<br /><span style={{ color: 'var(--color-text-dark-muted)' }}>{j.quadra || 'sem quadra'}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.3 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: corStatus[j.status] || 'var(--color-text-dark-muted)' }}>{rotuloFaseCurto(j.fase)}{travado ? ` · ${{ ao_vivo: 'ao vivo', finalizado: 'encerrado', wo: 'W.O.' }[j.status]}` : ''}</span>
                <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{vaga(j, 'a')} <span style={{ color: 'var(--color-text-dark-muted)' }}>x</span> {vaga(j, 'b')}</span>
              </span>
              <Botao tamanho="sm" variante="fantasma" titulo="Jogar antes" disabled={travado || salvando || i === 0 || lista[i - 1]?.status !== 'agendado'} onClick={() => mover(i, -1)}><ChevronUp size={16} /></Botao>
              <Botao tamanho="sm" variante="fantasma" titulo="Jogar depois" disabled={travado || salvando || i === lista.length - 1 || lista[i + 1]?.status !== 'agendado'} onClick={() => mover(i, 1)}><ChevronDown size={16} /></Botao>
            </div>
          )
        })}
      </div>
    </Painel>
  )
}

function EditorJogo({ jogo, campeonato, duplaPorId, salvarJogo, dados }) {
  const [substituindo, setSubstituindo] = useState(null)
  const [sets, setSets] = useState(() => [0, 1, 2].map(i => ({ a: jogo.sets?.[i]?.a ?? '', b: jogo.sets?.[i]?.b ?? '' })))
  const [quadra, setQuadra] = useState(jogo.quadra || '')
  const [horario, setHorario] = useState(jogo.horario || '')

  if (jogo.status === 'bye') {
    return (
      <div style={{ padding: '8px 12px', borderRadius: 12, border: '1px dashed var(--color-border-dark)', fontSize: 13, color: 'var(--color-text-dark-muted)' }}>
        {rotuloFase(jogo.fase)}: {nomesDupla(duplaPorId.get(jogo.vencedor_id))} avança direto (bye)
      </div>
    )
  }

  // Mantém os pontos do tie-break (digitados no placar) se os games daquele set não mudaram.
  const limpos = sets.map((s, i) => ({ s, i })).filter(({ s }) => s.a !== '' || s.b !== '').map(({ s, i }) => {
    const novo = { a: Number(s.a) || 0, b: Number(s.b) || 0 }
    const orig = jogo.sets?.[i]
    return orig?.tb && orig.a === novo.a && orig.b === novo.b ? { ...novo, tb: orig.tb } : novo
  })
  const resumo = resumoPlacar(limpos)
  const lados = { a: jogo.dupla_a_id, b: jogo.dupla_b_id }
  const completo = !!(jogo.dupla_a_id && jogo.dupla_b_id)

  const salvarPlacar = () => {
    if (resumo.vencedor) salvarJogo(jogo.id, { sets: limpos, status: 'finalizado', vencedor_id: lados[resumo.vencedor], finalizado_em: jogo.finalizado_em || new Date().toISOString() })
    else salvarJogo(jogo.id, { sets: limpos, status: limpos.length ? 'ao_vivo' : jogo.status === 'ao_vivo' ? 'ao_vivo' : 'agendado', vencedor_id: null, finalizado_em: null, ...(limpos.length && !jogo.iniciado_em ? { iniciado_em: new Date().toISOString() } : {}) })
  }
  const inputSet = (i, l) => (
    <input value={sets[i][l]} inputMode="numeric" onChange={e => setSets(s => s.map((x, k) => (k === i ? { ...x, [l]: e.target.value.replace(/\D/g, '').slice(0, 2) } : x)))}
      style={{ ...estiloInput, width: 40, padding: '6px 4px', textAlign: 'center', fontWeight: 800 }} />
  )

  return (
    <div style={{ padding: 12, borderRadius: 14, backgroundColor: 'var(--color-surface-dark-overlay)', border: `1px solid ${jogo.status === 'ao_vivo' ? 'var(--color-accent-live)' : 'transparent'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>Jogo {jogo.ordem}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-secondary)' }}>{rotuloFase(jogo.fase)}</span>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: jogo.status === 'ao_vivo' ? 'var(--color-accent-live)' : jogo.status === 'agendado' ? 'var(--color-text-dark-muted)' : 'var(--color-state-success)' }}>{{ agendado: 'agendado', ao_vivo: 'ao vivo', finalizado: 'encerrado', wo: 'W.O.' }[jogo.status]}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={quadra} onChange={e => { setQuadra(e.target.value); salvarJogo(jogo.id, { quadra: e.target.value || null }, { silencioso: true }) }} style={{ ...estiloInput, padding: '6px 8px', fontSize: 13 }}>
            <option value="">Quadra</option>
            {[...new Set([...(campeonato.quadras || []), jogo.quadra].filter(Boolean))].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          <input type="time" value={horario} onChange={e => setHorario(e.target.value)} onBlur={() => horario !== (jogo.horario || '') && salvarJogo(jogo.id, { horario: horario || null }, { silencioso: true })} style={{ ...estiloInput, padding: '5px 8px', fontSize: 13 }} />
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center' }}>
        {['a', 'b'].map(l => {
          const d = duplaPorId.get(lados[l])
          const venceu = jogo.vencedor_id && jogo.vencedor_id === lados[l]
          return [
            <div key={`n${l}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 14, fontWeight: venceu ? 800 : 600, color: venceu ? 'var(--color-brand-lima)' : 'inherit' }}>
              {d ? <AvataresDupla dupla={d} tamanho={24} /> : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomesDupla(d)}</span>
              {d && ['agendado', 'ao_vivo'].includes(jogo.status) && (
                <button onClick={() => setSubstituindo(substituindo === l ? null : l)} style={{ flexShrink: 0, border: 'none', background: 'none', color: 'var(--color-state-warning)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: '0 4px' }}>Substituir</button>
              )}
            </div>,
            <div key={`s${l}`} style={{ display: 'flex', gap: 4 }}>{[0, 1, 2].map(i => <span key={i}>{inputSet(i, l)}</span>)}</div>,
          ]
        })}
      </div>
      {substituindo && (
        <SubstituirDupla jogo={jogo} lado={substituindo} dados={dados} salvarJogo={salvarJogo} onFechar={() => setSubstituindo(null)} />
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Botao tamanho="sm" variante="primario" disabled={!completo} onClick={salvarPlacar}><Check size={13} />Salvar placar{resumo.vencedor ? ' e classificar' : ''}</Botao>
        {jogo.status === 'agendado' && completo && <Botao tamanho="sm" onClick={() => salvarJogo(jogo.id, { status: 'ao_vivo', iniciado_em: new Date().toISOString(), quadra: quadra || jogo.quadra })}><Play size={13} />Iniciar</Botao>}
        {completo && ['agendado', 'ao_vivo'].includes(jogo.status) && <BotaoWO jogo={jogo} duplaPorId={duplaPorId} salvarJogo={salvarJogo} />}
        {['finalizado', 'wo'].includes(jogo.status) && <Botao tamanho="sm" onClick={() => salvarJogo(jogo.id, { status: 'ao_vivo', vencedor_id: null, finalizado_em: null })}><RotateCcw size={13} />Reabrir</Botao>}
        {jogo.status !== 'agendado' && <Botao tamanho="sm" variante="fantasma" onClick={() => window.confirm('Zerar o placar e voltar o jogo para agendado?') && salvarJogo(jogo.id, { status: 'agendado', sets: [], vencedor_id: null, iniciado_em: null, finalizado_em: null })}>Zerar</Botao>}
      </div>
    </div>
  )
}

// Quando uma dupla não consegue jogar: (1) trocar um ou os dois atletas dela, ou (2) chamar a
// dupla que perdeu para ela no jogo anterior para entrar no lugar ("lucky loser"). No caso (2) o
// jogo anterior passa a W.O. a favor de quem entra, e a chave se ajusta sozinha.
function SubstituirDupla({ jogo, lado, dados, salvarJogo, onFechar }) {
  const { jogos, atletas, duplas, duplaPorId, recarregar } = dados
  const d = duplaPorId.get(jogo[`dupla_${lado}_id`])
  const eliminadas = duplasEliminadas(jogos)
  const duplasAtivas = duplas.filter(x => !eliminadas.has(x.id))
  const anterior = jogo.fase !== 'terceiro' && jogo.rodada > 1
    ? jogos.find(j => j.rodada === jogo.rodada - 1 && j.fase !== 'terceiro' && j.posicao === 2 * jogo.posicao + (lado === 'a' ? 0 : 1))
    : null
  const perdedorId = anterior && ['finalizado', 'wo'].includes(anterior.status) && anterior.vencedor_id
    ? (anterior.vencedor_id === anterior.dupla_a_id ? anterior.dupla_b_id : anterior.dupla_a_id)
    : null
  const perdedor = perdedorId ? duplaPorId.get(perdedorId) : null

  const trocarAtleta = (campo, atletaId) => rodar(async () => {
    const { error } = await supabase.from('campeonato_duplas').update({ [campo]: atletaId || null }).eq('id', d.id)
    if (error) throw error
    await recarregar()
  }, 'Dupla atualizada')

  const chamarPerdedor = async () => {
    if (!window.confirm(`${nomesDupla(d)} não vai jogar e ${nomesDupla(perdedor)} entra no lugar?\n\nO jogo ${anterior.ordem} fica registrado como W.O. a favor de ${nomesDupla(perdedor)}.`)) return
    const ok = await salvarJogo(anterior.id, { status: 'wo', vencedor_id: perdedorId, finalizado_em: anterior.finalizado_em || new Date().toISOString() })
    if (ok) onFechar()
  }

  if (!d) return null
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid var(--color-state-warning)', backgroundColor: 'color-mix(in srgb, var(--color-state-warning) 8%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Substituir {nomesDupla(d)}</span>
        <button onClick={onFechar} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--color-text-dark-muted)', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 6 }}>1. Trocar atleta(s) desta dupla</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <SelectAtleta atletas={atletas} valor={d.atleta1_id} onChange={v => trocarAtleta('atleta1_id', v)} duplas={duplasAtivas} duplaId={d.id} />
        <SelectAtleta atletas={atletas} valor={d.atleta2_id} onChange={v => trocarAtleta('atleta2_id', v)} duplas={duplasAtivas} duplaId={d.id} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 6 }}>2. Chamar outra dupla no lugar</div>
      {perdedor ? (
        <Botao tamanho="sm" variante="destaque" onClick={chamarPerdedor}><UserPlus size={14} />Chamar {nomesDupla(perdedor)} (perdeu para eles no jogo {anterior.ordem})</Botao>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-dark-muted)', lineHeight: 1.5 }}>
          {jogo.rodada === 1 ? 'Na 1ª rodada não há dupla anterior para chamar. Troque os atletas acima ou use W.O.' : 'O jogo anterior ainda não terminou.'}
        </div>
      )}
    </div>
  )
}

// =============================================================================================
// LINK DO OPERADOR (quem marca o placar em quadra, sem login)
// =============================================================================================

function urlOperador(slug, token) {
  return `${window.location.origin}/campeonato/${slug}/operador/${token}`
}

async function buscarTokenOperador(campeonatoId) {
  const { data, error } = await supabase.from('campeonato_operador_tokens').select('token').eq('campeonato_id', campeonatoId).maybeSingle()
  if (error) throw new Error('O link do operador ainda não foi ativado no banco (rodar o SQL 2026-11-15b_campeonato_operador.sql).')
  if (data?.token) return data.token
  const token = crypto.randomUUID().replace(/-/g, '')
  const r = await supabase.from('campeonato_operador_tokens').insert({ campeonato_id: campeonatoId, token })
  if (r.error) throw r.error
  return token
}

async function copiarLinkOperador(campeonato) {
  try {
    const token = await buscarTokenOperador(campeonato.id)
    await navigator.clipboard.writeText(urlOperador(campeonato.slug, token))
    toast.success('Link do operador copiado')
  } catch (e) {
    toast.error(e.message)
  }
}

// O operador só marca placar: iniciar jogo, games, encerrar, lançar resultado e W.O. Gerar um
// link novo derruba o antigo na hora (ex.: celular perdido, operador que saiu).
function LinkOperador({ campeonato }) {
  const [token, setToken] = useState(null)
  const [erro, setErro] = useState(null)
  useEffect(() => {
    let vivo = true
    buscarTokenOperador(campeonato.id).then(t => vivo && setToken(t)).catch(e => vivo && setErro(e.message))
    return () => { vivo = false }
  }, [campeonato.id])
  const gerarNovo = () => {
    if (!window.confirm('Gerar um link novo? O link atual do operador para de funcionar na hora, e você precisa mandar o novo para quem está em quadra.')) return
    rodar(async () => {
      const novo = crypto.randomUUID().replace(/-/g, '')
      const { error } = await supabase.from('campeonato_operador_tokens').upsert({ campeonato_id: campeonato.id, token: novo })
      if (error) throw error
      setToken(novo)
    }, 'Link novo gerado')
  }
  const url = token ? urlOperador(campeonato.slug, token) : ''
  const mensagem = `🎾 ${campeonato.nome}: link para marcar o placar em quadra (operador). Abra no celular e deixe a tela aberta: ${url}`
  return (
    <Painel titulo="Link do operador (placar em quadra)">
      <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        Para quem vai ficar em quadra marcando o placar pelo celular, sem login. Pelo link a pessoa só consegue <b>iniciar jogo, marcar os games, encerrar, lançar resultado e W.O.</b> Atletas, sorteio, ordem dos jogos e configuração continuam só aqui com você.
      </div>
      {erro ? <div style={{ fontSize: 13, color: 'var(--color-state-warning)' }}>{erro}</div> : !token ? <div style={{ fontSize: 13, color: 'var(--color-text-dark-muted)' }}>Carregando...</div> : (
        <>
          <LinkCopiavel rotulo="Link do operador" url={url} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Botao tamanho="sm" variante="primario" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank')}><Share2 size={13} />Enviar pelo WhatsApp</Botao>
            <Botao tamanho="sm" onClick={() => window.open(url, '_blank')}><ExternalLink size={13} />Abrir</Botao>
            <Botao tamanho="sm" variante="perigo" onClick={gerarNovo}><RotateCcw size={13} />Gerar link novo (derruba o atual)</Botao>
          </div>
        </>
      )}
    </Painel>
  )
}

// =============================================================================================
// CONFIGURAÇÃO
// =============================================================================================

// Volta o torneio ao estado inicial para fazer um novo teste (os atletas continuam cadastrados).
function PainelZerar({ campeonato, recarregar }) {
  const [checkins, setCheckins] = useState(true)
  const [fotos, setFotos] = useState(false)
  const zerar = () => {
    const itens = ['duplas, jogos e placares', ...(checkins ? ['check-ins'] : []), ...(fotos ? ['fotos'] : [])]
    if (window.prompt(`Zerar ${itens.join(', ')}?\nOs atletas continuam cadastrados e nada é sorteado.\n\nDigite ZERAR para confirmar.`) !== 'ZERAR') return
    rodar(async () => {
      await zerarCampeonato(campeonato.id, { checkins, fotos })
      await recarregar()
    }, 'Torneio zerado. Pronto para um novo teste.')
  }
  return (
    <Painel titulo="Zerar para novo teste">
      <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
        Volta o torneio para antes do sorteio: apaga duplas, jogos e placares. Não sorteia nada. Os atletas cadastrados continuam.
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={checkins} onChange={e => setCheckins(e.target.checked)} />Desmarcar todos os check-ins</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={fotos} onChange={e => setFotos(e.target.checked)} />Apagar todas as fotos</label>
      </div>
      <Botao variante="perigo" onClick={zerar}><RotateCcw size={14} />Zerar torneio</Botao>
    </Painel>
  )
}

function AbaConfig({ dados }) {
  const { campeonato, recarregar } = dados
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({
    nome: campeonato.nome || '', subtitulo: campeonato.subtitulo || '', data: campeonato.data || '', local: campeonato.local || '',
    quadras: (campeonato.quadras || []).join(', '), hora_inicio: campeonato.hora_inicio || '09:00', duracao_min: campeonato.duracao_min || 40,
    disputa_terceiro: campeonato.disputa_terceiro, regras: campeonato.regras || '', status: campeonato.status,
  }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const salvar = () => rodar(async () => {
    await atualizarCampeonato(campeonato.id, {
      nome: form.nome.trim(), subtitulo: form.subtitulo || null, data: form.data || null, local: form.local || null,
      quadras: form.quadras.split(',').map(s => s.trim()).filter(Boolean), hora_inicio: form.hora_inicio,
      duracao_min: Number(form.duracao_min) || 40, disputa_terceiro: !!form.disputa_terceiro, regras: form.regras || null, status: form.status,
    })
    await recarregar()
  }, 'Configuração salva')
  const excluir = () => {
    if (window.prompt(`Para excluir o campeonato inteiro (atletas, duplas e jogos), digite EXCLUIR`) !== 'EXCLUIR') return
    rodar(async () => {
      const { error } = await supabase.from('campeonatos').delete().eq('id', campeonato.id)
      if (error) throw error
      navigate('/campeonatos')
    }, 'Campeonato excluído')
  }
  const campo = (rotulo, k, props = {}) => (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{rotulo}</div>
      <input style={{ ...estiloInput, width: '100%' }} value={form[k]} onChange={e => set(k, e.target.value)} {...props} />
    </label>
  )
  return (
    <>
      <Painel titulo="Links para divulgar">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ padding: 10, borderRadius: 14, backgroundColor: 'var(--color-brand-areia)' }}><QrCode url={urlPublica(campeonato.slug)} tamanho={150} /></div>
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 10 }}>
            <LinkCopiavel rotulo="Link do associado (QR code)" url={urlPublica(campeonato.slug)} />
            <LinkCopiavel rotulo="Telão (abrir no navegador da TV, tela cheia com F11)" url={urlTV(campeonato.slug)} />
          </div>
          <Marcas altura={22} />
        </div>
      </Painel>
      <Painel titulo="Dados do campeonato" extra={<Botao variante="primario" tamanho="sm" onClick={salvar}><Check size={13} />Salvar</Botao>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {campo('Nome', 'nome')}
          {campo('Subtítulo', 'subtitulo')}
          {campo('Data', 'data', { type: 'date' })}
          {campo('Local', 'local')}
          {campo('Quadras (separadas por vírgula)', 'quadras')}
          {campo('Primeiro jogo', 'hora_inicio', { type: 'time' })}
          {campo('Minutos por rodada de jogos', 'duracao_min', { type: 'number', min: 10, max: 180 })}
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Status</div>
            <select style={{ ...estiloInput, width: '100%' }} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="inscricoes">Inscrições / check-in</option>
              <option value="sorteio">Sorteio ao vivo</option>
              <option value="em_andamento">Em andamento</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={!!form.disputa_terceiro} onChange={e => set('disputa_terceiro', e.target.checked)} />Disputa de 3º lugar (vale no próximo sorteio)
          </label>
        </div>
        <label style={{ display: 'block', marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Regulamento (aparece no link do associado)</div>
          <textarea rows={8} style={{ ...estiloInput, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} value={form.regras} onChange={e => set('regras', e.target.value)} />
        </label>
      </Painel>
      <LinkOperador campeonato={campeonato} />
      <PainelZerar campeonato={campeonato} recarregar={recarregar} />
      <Painel titulo="Zona de perigo">
        <Botao variante="perigo" onClick={excluir}><Trash2 size={14} />Excluir campeonato</Botao>
      </Painel>
    </>
  )
}

function LinkCopiavel({ rotulo, url }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{rotulo}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input readOnly value={url} style={{ ...estiloInput, flex: 1, fontSize: 13 }} onFocus={e => e.target.select()} />
        <Botao tamanho="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success('Copiado') }}><Copy size={13} /></Botao>
        <Botao tamanho="sm" onClick={() => window.open(url, '_blank')}><ExternalLink size={13} /></Botao>
      </div>
    </div>
  )
}
