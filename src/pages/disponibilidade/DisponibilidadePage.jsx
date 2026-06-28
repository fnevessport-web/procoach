import { useState, useEffect } from 'react'
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
  disponivel: { cor: '#22c55e', bg: 'rgba(34,197,94,0.15)', borda: 'rgba(34,197,94,0.4)', label: '✅ Disponível' },
  talvez: { cor: '#fcc825', bg: 'rgba(252,200,37,0.15)', borda: 'rgba(252,200,37,0.4)', label: '🤔 Talvez' },
  indisponivel: { cor: '#EF4444', bg: 'rgba(239,68,68,0.15)', borda: 'rgba(239,68,68,0.4)', label: '❌ Indisponível' },
}

const CICLO = [null, 'disponivel', 'talvez', 'indisponivel']

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
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
      const { data: prof, error } = await supabase
        .from('professores')
        .select('id, nome')
        .eq('token_disponibilidade', token)
        .single()

      if (error || !prof) { setLoading(false); return }
      setProfessor(prof)

      // Carrega disponibilidades já salvas
      const { data: disps } = await supabase
        .from('disponibilidades')
        .select('dia_semana, horario, status')
        .eq('professor_id', prof.id)

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
      const rows = []
      DIAS.forEach(({ key: dia }) => {
        HORARIOS.forEach(horario => {
          const status = grade[`${dia}-${horario}`]
          if (status) {
            rows.push({
              professor_id: professor.id,
              dia_semana: dia,
              horario,
              status,
              atualizado_em: new Date().toISOString(),
            })
          }
        })
      })

      // Deleta antigas e insere novas
      await supabase.from('disponibilidades').delete().eq('professor_id', professor.id)
      if (rows.length > 0) {
        const { error } = await supabase.from('disponibilidades').insert(rows)
        if (error) throw error
      }

      setEnviado(true)
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontSize: '14px' }}>Carregando...</div>
    </div>
  )

  if (!professor) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
        <div style={{ color: '#F0F2F5', fontSize: '16px', fontWeight: '600' }}>Link inválido</div>
        <div style={{ color: '#555', fontSize: '13px', marginTop: '8px' }}>Este link de disponibilidade não existe ou expirou.</div>
      </div>
    </div>
  )

  if (enviado) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ color: '#F0F2F5', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Disponibilidade enviada!</div>
        <div style={{ color: '#555', fontSize: '13px' }}>Obrigado, {professor.nome}! Suas informações foram salvas com sucesso.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', padding: '20px 16px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ fontSize: '22px', fontWeight: '800', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ▶ PRO COACH
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#F0F2F5', marginBottom: '4px' }}>
            Olá, {professor.nome.split(' ')[0]}! 👋
          </div>
          <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
            Preencha sua disponibilidade semanal. Toque em cada horário para alternar entre as opções.
          </div>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS).map(([key, s]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.bg, border: `1px solid ${s.borda}` }} />
              <span style={{ fontSize: '11px', color: '#888' }}>{s.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#111', border: '1px solid #2a2a2a' }} />
            <span style={{ fontSize: '11px', color: '#888' }}>Não marcado</span>
          </div>
        </div>

        {/* Grade por dia */}
        {DIAS.map(({ key: dia, label }) => (
          <div key={dia} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                      border: s ? `1px solid ${s.borda}` : '1px solid #2a2a2a',
                      backgroundColor: s ? s.bg : '#111',
                      color: s ? s.cor : '#444',
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
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '15px', fontWeight: '700',
            cursor: salvando ? 'not-allowed' : 'pointer',
            marginTop: '8px', marginBottom: '32px',
          }}
        >
          {salvando ? 'Enviando...' : '✅ Enviar Disponibilidade'}
        </button>
      </div>
    </div>
  )
}