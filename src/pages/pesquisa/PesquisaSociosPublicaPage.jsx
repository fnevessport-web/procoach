import { useState, useEffect, useRef } from 'react'
import { XCircle, CheckCircle2, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import { CabecalhoRelatorio, EstrelasInput, NpsInput } from './PesquisaSatisfacaoPage'
import {
  NOMES_PROFESSORES_PESQUISA_SOCIOS, TEXTO_INTRO_PESQUISA_SOCIOS, TEXTO_PERGUNTA_NPS,
  TEXTO_PERGUNTA_MOTIVO_NPS, TEXTO_PERGUNTA_PROFESSORES, PERGUNTAS_POR_PROFESSOR,
  TEXTO_COMENTARIO_PROFESSOR, TEXTO_PERGUNTA_FINAL,
} from '../../constants/pesquisaSocios'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const textareaStyle = {
  width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-base)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit',
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

  const refsPerguntas = useRef({}) // pra destaque+scroll de campo obrigatório faltando
  const refsBlocos = useRef({}) // pra scroll automático até o bloco do professor recém-marcado
  const qtdSelecionadosAnterior = useRef(0)

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
      setProfessores(resProfs.data || [])
    }
    carregar()
  }, [token])

  // Scroll automático até o bloco do professor recém-marcado — só quando a seleção CRESCE
  // (desmarcar não deve rolar a tela). requestAnimationFrame porque o bloco só existe no DOM
  // depois do re-render que a mudança de estado dispara.
  useEffect(() => {
    if (professoresSelecionados.length > qtdSelecionadosAnterior.current) {
      const novoId = professoresSelecionados[professoresSelecionados.length - 1]
      requestAnimationFrame(() => refsBlocos.current[novoId]?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    qtdSelecionadosAnterior.current = professoresSelecionados.length
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
                    <FotoProfessor src={p.foto_url} nome={p.nome} size={40} redondo />
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
                  <FotoProfessor src={prof.foto_url} nome={prof.nome} size={48} redondo />
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
    </div>
  )
}
