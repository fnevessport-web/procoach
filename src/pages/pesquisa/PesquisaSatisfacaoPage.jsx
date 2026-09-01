import { useState, useEffect } from 'react'
import { XCircle, CheckCircle2, Send, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PERGUNTAS_PESQUISA_SATISFACAO } from '../../constants/pesquisaSatisfacao'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

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

export function PesquisaSatisfacaoPage() {
  const token = window.location.pathname.split('/').pop()
  const [professor, setProfessor] = useState(null)
  const [respostas, setRespostas] = useState({})
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    async function carregar() {
      // Acesso público (sem login) só via RPC — mesmo padrão de buscar_professor_por_token
      // (disponibilidade). Nunca lê pesquisas_satisfacao/professores direto: RLS daquela
      // tabela é travada só pro gestor (ver 028/029_pesquisa_*.sql). O link é reutilizável
      // de propósito — cada envio vira uma resposta nova, nunca sobrescreve a anterior,
      // então não existe "já respondeu" aqui: o formulário sempre abre em branco.
      const { data, error } = await supabase.rpc('buscar_professor_por_token_pesquisa', { p_token: token })
      const prof = data?.[0]
      if (error || !prof) { setLoading(false); return }
      setProfessor(prof)
      setLoading(false)
    }
    carregar()
  }, [token])

  function setResposta(id, valor) {
    setRespostas(prev => ({ ...prev, [id]: valor }))
  }

  const faltamObrigatorias = PERGUNTAS_PESQUISA_SATISFACAO
    .filter(p => p.tipo === 'estrelas')
    .some(p => !respostas[p.id])

  async function handleEnviar() {
    if (faltamObrigatorias) {
      toast.error('Responda todas as perguntas de nota antes de enviar.', { style: toastStyle })
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

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface-light-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Carregando...</div>
    </div>
  )

  if (!professor) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface-light-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <XCircle size={40} color="var(--color-state-danger)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '16px', fontWeight: '600' }}>Link inválido</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px', marginTop: '8px' }}>Este link de pesquisa não existe ou expirou.</div>
      </div>
    </div>
  )

  if (enviado) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface-light-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <CheckCircle2 size={48} color="var(--color-state-success)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Respostas enviadas!</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px' }}>Obrigado, {professor.nome}! Sua opinião é confidencial e só a coordenação tem acesso.</div>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: 'var(--color-surface-light-base)', padding: '20px 16px', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-action-primary)', marginBottom: '24px' }}>
          ▶ PRO COACH
        </div>

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}>
            Olá, {professor.nome}!
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', lineHeight: '1.5' }}>
            Sua opinião é confidencial — só a coordenação vê suas respostas, ninguém mais na equipe. Responda com sinceridade.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {PERGUNTAS_PESQUISA_SATISFACAO.map(p => (
            <div key={p.id}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '10px' }}>
                {p.texto}
              </div>
              {p.tipo === 'estrelas' ? (
                <EstrelasInput value={respostas[p.id] || 0} onChange={v => setResposta(p.id, v)} />
              ) : (
                <textarea
                  rows={3}
                  value={respostas[p.id] || ''}
                  onChange={e => setResposta(p.id, e.target.value)}
                  placeholder="Opcional"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
                    border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-overlay)',
                    color: 'var(--color-text-light-primary)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              )}
            </div>
          ))}
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
