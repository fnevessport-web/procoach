import { useState, useEffect } from 'react'
import { XCircle, CheckCircle2, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const DIAS = [
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terça' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sábado' },
]

const HORARIOS = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

const STATUS = {
  disponivel: { cor: 'var(--color-state-success)', bg: 'rgba(75,139,106,0.15)', borda: 'rgba(75,139,106,0.4)', label: 'Disponível' },
  talvez: { cor: 'var(--color-state-warning)', bg: 'rgba(201,138,60,0.15)', borda: 'rgba(201,138,60,0.4)', label: 'Talvez' },
  indisponivel: { cor: 'var(--color-state-danger)', bg: 'rgba(180,71,47,0.15)', borda: 'rgba(180,71,47,0.4)', label: 'Indisponível' },
}

const CICLO = ['disponivel', 'talvez', 'indisponivel']

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

export function DisponibilidadePage() {
  const token = window.location.pathname.split('/').pop()
  const [professor, setProfessor] = useState(null)
  const [grade, setGrade] = useState({}) // { 'segunda-06:00': 'disponivel' }
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    async function carregar() {
      // Acesso público (sem login) passa por RPC — nunca lê a tabela professores/disponibilidades
      // direto, pra não expor CPF/dados bancários nem os tokens de outros professores.
      const { data: profs, error } = await supabase.rpc('buscar_professor_por_token', { p_token: token })
      const prof = profs?.[0]

      if (error || !prof) { setLoading(false); return }
      setProfessor(prof)

      const { data: disps } = await supabase.rpc('buscar_disponibilidade_por_token', { p_token: token })

      const gradeInicial = {}
      disps?.forEach(d => {
        gradeInicial[`${d.dia_semana}-${d.horario}`] = d.status
      })
      setGrade(gradeInicial)
      setLoading(false)
    }
    carregar()
  }, [token])

  function toggleCelula(dia, horario) {
    const key = `${dia}-${horario}`
    const atual = grade[key] || null
    const idx = CICLO.indexOf(atual)
    const proximo = CICLO[(idx + 1) % CICLO.length]
    setGrade(prev => ({ ...prev, [key]: proximo }))
  }

  async function handleSalvar() {
    if (!professor) return
    setSalvando(true)
    try {
      const linhas = []
      DIAS.forEach(({ key: dia }) => {
        HORARIOS.forEach(horario => {
          const status = grade[`${dia}-${horario}`]
          if (status) linhas.push({ dia_semana: dia, horario, status })
        })
      })

      const { error } = await supabase.rpc('salvar_disponibilidade_por_token', { p_token: token, p_linhas: linhas })
      if (error) throw error

      setEnviado(true)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setSalvando(false)
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
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px', marginTop: '8px' }}>Este link de disponibilidade não existe ou expirou.</div>
      </div>
    </div>
  )

  if (enviado) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface-light-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <CheckCircle2 size={48} color="var(--color-state-success)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-light-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Disponibilidade enviada!</div>
        <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '13px' }}>Obrigado, {professor.nome}! Suas informações foram salvas com sucesso.</div>
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100vh', backgroundColor: 'var(--color-surface-light-base)', padding: '20px 16px', boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>

      {/* Header */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-action-primary)' }}>
            ▶ PRO COACH
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}>
            Olá, {professor.nome}!
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', lineHeight: '1.5' }}>
            Preencha sua disponibilidade semanal. Toque em cada horário para alternar entre as opções.
          </div>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS).map(([key, s]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.bg, border: `1px solid ${s.borda}` }} />
              <span style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Grade por dia */}
        {DIAS.map(({ key: dia, label }) => (
          <div key={dia} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-action-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              {HORARIOS.map(horario => {
                const key = `${dia}-${horario}`
                const status = grade[key] || null
                const s = status ? STATUS[status] : null
                return (
                  <button
                    key={horario}
                    onClick={() => toggleCelula(dia, horario)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: s ? `1px solid ${s.borda}` : '1px solid var(--color-border-light)',
                      backgroundColor: s ? s.bg : 'var(--color-surface-light-overlay)',
                      color: s ? s.cor : 'var(--color-text-light-muted)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {horario}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Botão salvar */}
        <button
          onClick={handleSalvar}
          disabled={salvando}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '15px', fontWeight: '700',
            cursor: salvando ? 'not-allowed' : 'pointer',
            marginTop: '8px', marginBottom: '32px',
          }}
        >
          {salvando ? 'Enviando...' : <><Send size={15} /> Enviar Disponibilidade</>}
        </button>
      </div>
    </div>
  )
}