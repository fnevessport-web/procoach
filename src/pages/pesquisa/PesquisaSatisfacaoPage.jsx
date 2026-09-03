import { useState, useEffect, useRef } from 'react'
import { XCircle, CheckCircle2, Send, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PERGUNTAS_PESQUISA_SATISFACAO, TEXTO_INTRO_PESQUISA } from '../../constants/pesquisaSatisfacao'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

// Mesma paleta de COR_SALVIA/COR_LARANJA/COR_VINHO/COR_MARINHO (CORES_CHIP) do cabeçalho
// do relatório mensal (relatorioPdf.js) — replicado aqui em CSS pra ficar visualmente
// idêntico, já que o PDF é gerado com jsPDF (não dá pra reaproveitar o código, só a
// paleta/estrutura).
const CORES_CHIP = ['#A3BFAE', '#C1652F', '#6B1B27', '#1B293D']
const COR_CREME = '#F1EFEA'
const COR_TINTA = '#1A1818'
const COR_TEXTO_SUAVE = '#6E6A64'

function EstrelasInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
        >
          <Star size={26} fill={n <= value ? 'var(--color-action-primary)' : 'none'} color="var(--color-action-primary)" />
        </button>
      ))}
    </div>
  )
}

function NpsInput({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: '4px' }}>
      {Array.from({ length: 11 }, (_, n) => n).map(n => {
        const ativo = value === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              padding: '8px 0', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
              border: ativo ? 'none' : '1px solid var(--color-border-light)',
              background: ativo ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
              color: ativo ? 'white' : 'var(--color-text-light-secondary)',
            }}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

// Cabeçalho idêntico ao do relatório mensal (relatorioPdf.js: desenharLockupLogos +
// CORES_CHIP): logo Beyond + linha fina + logo da unidade, título, subtítulo em itálico,
// tarja de 4 cores embaixo. Sem nenhum dado do professor — esse cabeçalho é igual pra
// qualquer link.
function CabecalhoRelatorio() {
  return (
    <div style={{ backgroundColor: COR_CREME }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 20px 16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <img src="/images/logobeyond_preto.png" alt="Beyond" style={{ height: '58px', objectFit: 'contain' }} />
          <div style={{ width: '1px', height: '44px', backgroundColor: 'rgba(26,24,24,0.25)' }} />
          <img src="/images/logoprocopio_preto.png" alt="Procópio" style={{ height: '58px', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: '16px', fontWeight: '700', color: COR_TINTA }}>PESQUISA DE SATISFAÇÃO</div>
        <div style={{ fontSize: '11px', fontStyle: 'italic', color: COR_TEXTO_SUAVE, marginTop: '2px' }}>PROCÓPIO</div>
      </div>
      <div style={{ display: 'flex' }}>
        {CORES_CHIP.map((cor, i) => (
          <div key={i} style={{ flex: 1, height: '4px', backgroundColor: cor }} />
        ))}
      </div>
    </div>
  )
}

export function PesquisaSatisfacaoPage() {
  const token = window.location.pathname.split('/').pop()
  const [linkValido, setLinkValido] = useState(null) // null = ainda carregando
  const [respostas, setRespostas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [tentouEnviar, setTentouEnviar] = useState(false) // true depois do 1º clique em Enviar com pergunta faltando — só a partir daí destaca campo vazio
  const refsPerguntas = useRef({})

  useEffect(() => {
    async function carregar() {
      // Acesso público (sem login) só via RPC — mesmo padrão de buscar_professor_por_token
      // (disponibilidade). A RPC não devolve nome nem qualquer outro dado do professor —
      // só confirma se o token existe (ver 031_pesquisa_remove_nome.sql) — pra essa
      // informação nunca aparecer nem na tela nem numa resposta de rede inspecionável. O
      // link é reutilizável de propósito — cada envio vira uma resposta nova, nunca
      // sobrescreve a anterior, então não existe "já respondeu" aqui: o formulário sempre
      // abre em branco.
      const { data, error } = await supabase.rpc('buscar_professor_por_token_pesquisa', { p_token: token })
      setLinkValido(!error && data === true)
    }
    carregar()
  }, [token])

  function setResposta(id, valor) {
    setRespostas(prev => ({ ...prev, [id]: valor }))
  }

  // Todas as perguntas são obrigatórias agora, inclusive as de texto livre — pra estrela/nps
  // basta ter um valor selecionado, pra texto precisa ter algo digitado (não só espaços).
  function perguntaVazia(p) {
    if (p.tipo === 'texto') return !String(respostas[p.id] || '').trim()
    return respostas[p.id] == null
  }
  const faltamObrigatorias = PERGUNTAS_PESQUISA_SATISFACAO.some(perguntaVazia)

  async function handleEnviar() {
    if (faltamObrigatorias) {
      setTentouEnviar(true)
      toast.error('Preencha as perguntas destacadas em vermelho antes de enviar.', { style: toastStyle })
      const primeiraFaltando = PERGUNTAS_PESQUISA_SATISFACAO.find(perguntaVazia)
      refsPerguntas.current[primeiraFaltando?.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setEnviando(true)
    try {
      const { error } = await supabase.rpc('salvar_pesquisa_por_token', { p_token: token, p_respostas: respostas })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setEnviando(false)
    }
  }

  // height + overflowY (não minHeight) é o que de fato permite rolar aqui — página pública
  // fica fora do AppLayout, então não herda o scroll do .app-main; sem isso o conteúdo que
  // passa de 100vh simplesmente fica cortado, sem scroll nenhum (mesmo ajuste já usado em
  // DisponibilidadePage.jsx).
  const containerStyle = {
    height: '100vh', backgroundColor: 'var(--color-surface-light-base)', boxSizing: 'border-box',
    overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
  }

  if (linkValido === null) return (
    <div style={containerStyle}>
      <CabecalhoRelatorio />
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Carregando...</div>
    </div>
  )

  if (!linkValido) return (
    <div style={containerStyle}>
      <CabecalhoRelatorio />
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <XCircle size={40} color="var(--color-state-danger)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '16px', fontWeight: '600' }}>Link inválido</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px', marginTop: '8px' }}>Este link de pesquisa não existe ou expirou.</div>
      </div>
    </div>
  )

  if (enviado) return (
    <div style={containerStyle}>
      <CabecalhoRelatorio />
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <CheckCircle2 size={48} color="var(--color-state-success)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Respostas enviadas!</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px' }}>Obrigado! Sua resposta foi registrada.</div>
      </div>
    </div>
  )

  return (
    <div style={containerStyle}>
      <CabecalhoRelatorio />
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', lineHeight: '1.5', marginBottom: '28px' }}>
          {TEXTO_INTRO_PESQUISA}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {PERGUNTAS_PESQUISA_SATISFACAO.map(p => {
            const vazia = tentouEnviar && perguntaVazia(p)
            return (
              <div
                key={p.id}
                ref={el => { refsPerguntas.current[p.id] = el }}
                style={{
                  padding: '12px', borderRadius: '12px', boxSizing: 'border-box',
                  border: vazia ? '1.5px solid var(--color-state-danger)' : '1.5px solid transparent',
                  backgroundColor: vazia ? 'rgba(180,71,47,0.06)' : 'transparent',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '10px' }}>
                  {p.texto}
                </div>
                {p.tipo === 'estrelas' && <EstrelasInput value={respostas[p.id] || 0} onChange={v => setResposta(p.id, v)} />}
                {p.tipo === 'nps' && <NpsInput value={respostas[p.id]} onChange={v => setResposta(p.id, v)} />}
                {p.tipo === 'texto' && (
                  <textarea
                    rows={6}
                    value={respostas[p.id] || ''}
                    onChange={e => setResposta(p.id, e.target.value)}
                    placeholder="Escreva sua resposta..."
                    style={{
                      width: '100%', minHeight: '140px', padding: '12px 14px', borderRadius: '10px', boxSizing: 'border-box',
                      border: `1px solid ${vazia ? 'var(--color-state-danger)' : 'var(--color-border-light)'}`, backgroundColor: 'var(--color-surface-light-overlay)',
                      color: 'var(--color-text-light-primary)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit',
                    }}
                  />
                )}
                {vazia && (
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-state-danger)', marginTop: '8px' }}>
                    Essa pergunta é obrigatória.
                  </div>
                )}
              </div>
            )
          })}
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
