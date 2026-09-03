import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XCircle, CheckCircle2, Send, X, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import { CabecalhoRelatorio, EstrelasInput, NpsInput } from './PesquisaSatisfacaoPage'
import {
  NOMES_PROFESSORES_PESQUISA_SOCIOS, TEXTO_INTRO_PESQUISA_SOCIOS, TEXTO_PERGUNTA_NPS,
  TEXTO_PERGUNTA_MOTIVO_NPS, TEXTO_PERGUNTA_PROFESSORES, PERGUNTAS_POR_PROFESSOR,
  TEXTO_COMENTARIO_PROFESSOR, TEXTO_PERGUNTA_FINAL, nomeExibicaoProfessor,
  ID_PROFESSOR_NAO_LEMBRO, NOME_PROFESSOR_NAO_LEMBRO,
} from '../../constants/pesquisaSocios'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const textareaStyle = {
  width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-overlay)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit',
}

// Foto clicável (lista de seleção e cabeçalho do bloco) — abre em tamanho grande, pra quem
// não lembra o nome do professor conseguir reconhecer o rosto. Portal pro <body> pelo mesmo
// motivo do Modal.jsx: position:fixed dentro do container com overflow-y desta página tem
// bug conhecido no Safari mobile (fica preso dentro do scroll em vez de cobrir a tela toda).
function FotoClicavel({ src, nome, size, onAmpliar }) {
  return (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onAmpliar({ src, nome }) }}
      style={{ background: 'none', border: 'none', padding: 0, cursor: src ? 'zoom-in' : 'default', flexShrink: 0, borderRadius: '50%' }}
    >
      <FotoProfessor src={src} nome={nome} size={size} redondo />
    </button>
  )
}

// Avatar de silhueta escura pra opção "Não lembro o nome" — nunca é clicável/ampliável
// (não tem foto de verdade pra mostrar grande, e "ampliar" um ícone genérico não ajudaria
// ninguém a reconhecer nada).
function AvatarNaoLembro({ size }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: '#2E2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <User size={size * 0.58} color="#7A7A7A" fill="#7A7A7A" />
    </div>
  )
}

function ModalFotoAmpliada({ foto, onClose }) {
  if (!foto) return null
  return createPortal((
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', cursor: 'zoom-out',
    }}>
      <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}>
        <X size={26} color="white" />
      </button>
      {foto.src
        ? <img src={foto.src} alt={foto.nome} style={{ maxWidth: '85%', maxHeight: '65vh', borderRadius: '16px', objectFit: 'cover' }} />
        : <FotoProfessor nome={foto.nome} size={160} redondo />}
      <div style={{ color: 'white', fontSize: '17px', fontWeight: '700' }}>{foto.nome}</div>
    </div>
  ), document.body)
}

function tituloPergunta(texto) {
  return <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '10px' }}>{texto}</div>
}

function avisoObrigatorio() {
  return <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-state-danger)', marginTop: '8px' }}>Essa pergunta é obrigatória.</div>
}

function blocoObrigatorioStyle(vazia) {
  return {
    padding: '12px', borderRadius: '12px', boxSizing: 'border-box',
    border: vazia ? '1.5px solid var(--color-state-danger)' : '1.5px solid transparent',
    backgroundColor: vazia ? 'rgba(180,71,47,0.06)' : 'transparent',
  }
}

export function PesquisaSociosPublicaPage() {
  const token = window.location.pathname.split('/').pop()
  const [linkValido, setLinkValido] = useState(null) // null = ainda carregando
  const [professores, setProfessores] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [tentouEnviar, setTentouEnviar] = useState(false)

  const [nps, setNps] = useState(null)
  const [motivoNps, setMotivoNps] = useState('')
  const [professoresSelecionados, setProfessoresSelecionados] = useState([]) // ids, na ordem em que foram marcados
  const [avaliacoes, setAvaliacoes] = useState({}) // { [professorId]: { nota_tecnica, ..., comentario } }
  const [comentarioFinal, setComentarioFinal] = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState(null) // { src, nome } | null

  const refsPerguntas = useRef({}) // pra destaque+scroll de campo obrigatório faltando
  const refsBlocos = useRef({}) // pra scroll automático até o bloco do professor recém-marcado
  const qtdSelecionadosAnterior = useRef(0)
  const timerScrollRef = useRef(null)

  useEffect(() => {
    async function carregar() {
      // Duas RPCs públicas (sessão anônima não lê `professores` nem `pesquisa_socios_*`
      // direto — só via SECURITY DEFINER, ver 032_pesquisa_socios.sql): uma valida o token
      // (booleano puro, mesmo padrão de 031_pesquisa_remove_nome.sql), outra lista só os 13
      // professores fixos da pesquisa (nome/foto, nunca dado sensível).
      const [resValido, resProfs] = await Promise.all([
        supabase.rpc('validar_token_pesquisa_socios', { p_token: token }),
        supabase.rpc('listar_professores_pesquisa_socios', { p_nomes: NOMES_PROFESSORES_PESQUISA_SOCIOS }),
      ])
      setLinkValido(!resValido.error && resValido.data === true)
      // Nome de exibição (curto) em vez do nome completo do cadastro — aplicado aqui, na
      // entrada dos dados, pra todo o resto da tela (lista, blocos, foto ampliada) já
      // trabalhar com o nome certo sem precisar pensar nisso de novo. "Não lembro o nome"
      // entra como um 14º item da mesma lista, sempre por último — assim todo o resto do
      // componente (seleção, blocos, ordem por clique, validação) trata ela igual a um
      // professor de verdade, sem precisar de nenhum caso especial além do avatar.
      const professoresReais = (resProfs.data || []).map(p => ({ ...p, nome: nomeExibicaoProfessor(p.nome) }))
      setProfessores([...professoresReais, { id: ID_PROFESSOR_NAO_LEMBRO, nome: NOME_PROFESSOR_NAO_LEMBRO, foto_url: null }])
    }
    carregar()
  }, [token])

  // Scroll automático até o bloco de professor que falta preencher — só quando a seleção
  // CRESCE (desmarcar não deve rolar a tela) e só depois de ~700ms sem marcar mais ninguém
  // (debounce). Sem o debounce, marcar vários professores em sequência rápida ficava
  // "puxando" a tela pra baixo a cada clique, sem dar tempo de continuar marcando na lista —
  // pedido explícito pra deixar a pessoa marcar todo mundo primeiro, só descendo sozinho
  // quando ela parar. Alvo é o primeiro selecionado que ainda não tem nenhuma nota (não
  // necessariamente o último marcado), pra sempre pousar em quem falta responder.
  useEffect(() => {
    if (professoresSelecionados.length > qtdSelecionadosAnterior.current) {
      clearTimeout(timerScrollRef.current)
      timerScrollRef.current = setTimeout(() => {
        const semNenhumaNota = id => !PERGUNTAS_POR_PROFESSOR.some(p => avaliacoes[id]?.[p.chave])
        const alvo = professoresSelecionados.find(semNenhumaNota) ?? professoresSelecionados[professoresSelecionados.length - 1]
        refsBlocos.current[alvo]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 700)
    }
    qtdSelecionadosAnterior.current = professoresSelecionados.length
    return () => clearTimeout(timerScrollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professoresSelecionados])

  function toggleProfessor(id) {
    setProfessoresSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function setNotaProfessor(profId, chave, valor) {
    setAvaliacoes(prev => ({ ...prev, [profId]: { ...prev[profId], [chave]: valor } }))
  }
  function setComentarioProfessor(profId, texto) {
    setAvaliacoes(prev => ({ ...prev, [profId]: { ...prev[profId], comentario: texto } }))
  }

  // Lista de tudo que é obrigatório, na ordem em que aparece na tela — usada tanto pra saber
  // se falta algo quanto pra achar a primeira pendência e rolar até ela.
  function unidadesObrigatorias() {
    const unidades = [
      { id: 'nps', vazia: nps == null },
      { id: 'professores', vazia: professoresSelecionados.length === 0 },
    ]
    professoresSelecionados.forEach(profId => {
      PERGUNTAS_POR_PROFESSOR.forEach(p => {
        unidades.push({ id: `prof_${profId}_${p.chave}`, vazia: !avaliacoes[profId]?.[p.chave] })
      })
    })
    return unidades
  }

  async function handleEnviar() {
    const primeiraFaltando = unidadesObrigatorias().find(u => u.vazia)
    if (primeiraFaltando) {
      setTentouEnviar(true)
      toast.error('Preencha as perguntas destacadas em vermelho antes de enviar.', { style: toastStyle })
      refsPerguntas.current[primeiraFaltando.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setEnviando(true)
    try {
      const payload = {
        nps,
        motivo_nota: motivoNps.trim() || null,
        professores_ids: professoresSelecionados,
        avaliacoes,
        comentario_final: comentarioFinal.trim() || null,
      }
      const { error } = await supabase.rpc('salvar_resposta_pesquisa_socios', { p_token: token, p_respostas: payload })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setEnviando(false)
    }
  }

  // height + overflowY (não minHeight) — mesma correção de scroll usada em
  // PesquisaSatisfacaoPage.jsx/DisponibilidadePage.jsx pra páginas públicas fora do AppLayout.
  const containerStyle = {
    height: '100vh', backgroundColor: 'var(--color-surface-light-base)', boxSizing: 'border-box',
    overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
  }

  const tituloCabecalho = 'PESQUISA DE SATISFAÇÃO — AULAS DE TÊNIS BEYOND THE CLUB'

  if (linkValido === null) return (
    <div style={containerStyle}>
      <CabecalhoRelatorio titulo={tituloCabecalho} subtitulo="BEYOND THE CLUB" />
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Carregando...</div>
    </div>
  )

  if (!linkValido) return (
    <div style={containerStyle}>
      <CabecalhoRelatorio titulo={tituloCabecalho} subtitulo="BEYOND THE CLUB" />
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <XCircle size={40} color="var(--color-state-danger)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '16px', fontWeight: '600' }}>Link inválido</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px', marginTop: '8px' }}>Este link de pesquisa não existe ou expirou.</div>
      </div>
    </div>
  )

  if (enviado) return (
    <div style={containerStyle}>
      <CabecalhoRelatorio titulo={tituloCabecalho} subtitulo="BEYOND THE CLUB" />
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <CheckCircle2 size={48} color="var(--color-state-success)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Respostas enviadas!</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px' }}>Obrigado! Sua resposta foi registrada.</div>
      </div>
    </div>
  )

  const npsVazio = tentouEnviar && nps == null
  const professoresVazio = tentouEnviar && professoresSelecionados.length === 0

  return (
    <div style={containerStyle}>
      <CabecalhoRelatorio titulo={tituloCabecalho} subtitulo="BEYOND THE CLUB" />
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', lineHeight: '1.5', marginBottom: '28px' }}>
          {TEXTO_INTRO_PESQUISA_SOCIOS}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* NPS */}
          <div ref={el => { refsPerguntas.current.nps = el }} style={blocoObrigatorioStyle(npsVazio)}>
            {tituloPergunta(TEXTO_PERGUNTA_NPS)}
            <NpsInput value={nps} onChange={setNps} />
            {npsVazio && avisoObrigatorio()}
          </div>

          {/* Motivo da nota (opcional) */}
          <div>
            {tituloPergunta(TEXTO_PERGUNTA_MOTIVO_NPS)}
            <textarea
              rows={4}
              value={motivoNps}
              onChange={e => setMotivoNps(e.target.value)}
              placeholder="Escreva sua resposta... (opcional)"
              style={textareaStyle}
            />
          </div>

          {/* Seleção de professores */}
          <div ref={el => { refsPerguntas.current.professores = el }} style={blocoObrigatorioStyle(professoresVazio)}>
            {tituloPergunta(TEXTO_PERGUNTA_PROFESSORES)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {professores.map(p => {
                const marcado = professoresSelecionados.includes(p.id)
                return (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    border: marcado ? '1.5px solid var(--color-action-primary)' : '1px solid var(--color-border-light)',
                    backgroundColor: marcado ? 'rgba(165,76,46,0.06)' : 'var(--color-surface-light-overlay)',
                  }}>
                    <input type="checkbox" checked={marcado} onChange={() => toggleProfessor(p.id)} style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                    {p.id === ID_PROFESSOR_NAO_LEMBRO
                      ? <AvatarNaoLembro size={40} />
                      : <FotoClicavel src={p.foto_url} nome={p.nome} size={40} onAmpliar={setFotoAmpliada} />}
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)' }}>{p.nome}</span>
                  </label>
                )
              })}
            </div>
            {professoresVazio && <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-state-danger)', marginTop: '8px' }}>Selecione pelo menos um professor.</div>}
          </div>

          {/* Um bloco por professor marcado, na ordem em que foram marcados */}
          {professoresSelecionados.map(profId => {
            const prof = professores.find(p => p.id === profId)
            if (!prof) return null
            return (
              <div
                key={profId}
                ref={el => { refsBlocos.current[profId] = el }}
                style={{ border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '16px', backgroundColor: 'var(--color-surface-light-overlay)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  {prof.id === ID_PROFESSOR_NAO_LEMBRO
                    ? <AvatarNaoLembro size={48} />
                    : <FotoClicavel src={prof.foto_url} nome={prof.nome} size={48} onAmpliar={setFotoAmpliada} />}
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{prof.nome}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {PERGUNTAS_POR_PROFESSOR.map(p => {
                    const campoId = `prof_${profId}_${p.chave}`
                    const vazia = tentouEnviar && !avaliacoes[profId]?.[p.chave]
                    return (
                      <div key={p.chave} ref={el => { refsPerguntas.current[campoId] = el }} style={blocoObrigatorioStyle(vazia)}>
                        {tituloPergunta(p.texto)}
                        <EstrelasInput value={avaliacoes[profId]?.[p.chave] || 0} onChange={v => setNotaProfessor(profId, p.chave, v)} />
                        {vazia && avisoObrigatorio()}
                      </div>
                    )
                  })}
                  <div>
                    {tituloPergunta(TEXTO_COMENTARIO_PROFESSOR)}
                    <textarea
                      rows={4}
                      value={avaliacoes[profId]?.comentario || ''}
                      onChange={e => setComentarioProfessor(profId, e.target.value)}
                      placeholder="Escreva sua resposta... (opcional)"
                      style={textareaStyle}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Comentário final livre (opcional) */}
          <div>
            {tituloPergunta(TEXTO_PERGUNTA_FINAL)}
            <textarea
              rows={5}
              value={comentarioFinal}
              onChange={e => setComentarioFinal(e.target.value)}
              placeholder="Escreva sua resposta... (opcional)"
              style={{ ...textareaStyle, minHeight: '110px' }}
            />
          </div>
        </div>

        <button
          onClick={handleEnviar}
          disabled={enviando}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '15px', fontWeight: '700',
            cursor: enviando ? 'not-allowed' : 'pointer',
            marginTop: '28px', marginBottom: '32px',
          }}
        >
          {enviando ? 'Enviando...' : <><Send size={15} /> Enviar Respostas</>}
        </button>
      </div>

      <ModalFotoAmpliada foto={fotoAmpliada} onClose={() => setFotoAmpliada(null)} />
    </div>
  )
}
