import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAlertas, useMarcarAlertaLido } from '../hooks/useAlertas'

// Modal de alta prioridade — aparece por cima de qualquer tela quando o professor
// logado tem alerta(s) de "turma ativada" não lido(s). Uma por vez, em sequência.
export function ModalTurmaAtivada() {
  const navigate = useNavigate()
  const { data: alertas = [] } = useAlertas()
  const marcarLido = useMarcarAlertaLido()
  const [fechadosNestaSessao, setFechadosNestaSessao] = useState([])

  const pendentes = alertas
    .filter(a => a.tipo === 'turma_ativada' && !a.lido && !fechadosNestaSessao.includes(a.id))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))

  const atual = pendentes[0]
  if (!atual) return null

  function fechar() {
    setFechadosNestaSessao(prev => [...prev, atual.id])
    marcarLido.mutate(atual.id)
  }

  async function verDetalhes() {
    let destino = {}
    if (atual.referencia_id) {
      const { data: proximaAula } = await supabase
        .from('aulas')
        .select('data_aula, turmas(horario_inicio)')
        .eq('turma_id', atual.referencia_id)
        .gte('data_aula', new Date().toISOString().slice(0, 10))
        .order('data_aula', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (proximaAula) {
        destino = { data: proximaAula.data_aula, horario: proximaAula.turmas?.horario_inicio?.slice(0, 5) }
      }
    }
    fechar()
    navigate('/aulas', { state: destino })
  }

  // Via portal pro <body>: sem isso, o WebKit mobile prende esse position:fixed dentro do
  // .app-main (overflow-y + scroll-touch) e o modal fica cortado, sem cobrir a tela toda.
  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div className="fade-in" style={{
        backgroundColor: '#1a1a1a', borderRadius: '20px', padding: '28px 24px',
        maxWidth: '360px', width: '100%', textAlign: 'center',
        border: '1px solid rgba(252,200,37,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <AlertTriangle size={40} color="#fcc825" style={{ marginBottom: '14px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#fcc825', letterSpacing: '1.5px', marginBottom: '12px' }}>
          ATENÇÃO
        </div>
        <p style={{ fontSize: '13px', color: '#F0F2F5', lineHeight: '1.6', margin: '0 0 24px' }}>
          {atual.mensagem}
        </p>
        <button onClick={verDetalhes} style={{
          width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '10px',
        }}>
          Ver detalhes
        </button>
        <button onClick={fechar} style={{ background: 'none', border: 'none', color: '#555', fontSize: '12px', cursor: 'pointer', padding: '6px' }}>
          Fechar
        </button>
      </div>
    </div>
  ), document.body)
}
