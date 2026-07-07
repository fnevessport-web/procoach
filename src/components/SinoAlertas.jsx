import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAlertas, useMarcarAlertaLido, useMarcarTodosAlertasLidos } from '../hooks/useAlertas'

const ROTA_POR_TIPO = {
  mensagem_nova: '/mensagens',
  turma_ativada: '/aulas',
  aluno_incluido: '/aulas',
  aluno_adicionado: '/aulas',
  aluno_removido: '/aulas',
  esqueci_senha: '/cadastros',
}

const COR_PRIORIDADE = { alta: '#e24b4a', media: '#fcc825', baixa: '#555' }

export function SinoAlertas() {
  const [aberto, setAberto] = useState(false)
  const { data: alertas = [] } = useAlertas()
  const marcarLido = useMarcarAlertaLido()
  const marcarTodosLidos = useMarcarTodosAlertasLidos()
  const navigate = useNavigate()

  const naoLidos = alertas.filter(a => !a.lido).length

  function handleClickAlerta(alerta) {
    if (!alerta.lido) marcarLido.mutate(alerta.id)
    setAberto(false)
    navigate(ROTA_POR_TIPO[alerta.tipo] || '/')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setAberto(!aberto)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', position: 'relative' }}>
        <Bell size={20} color="#555" />
        {naoLidos > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            minWidth: '16px', height: '16px', padding: '0 3px', backgroundColor: '#EF4444',
            borderRadius: '8px', fontSize: '10px', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>
            {naoLidos > 9 ? '9+' : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setAberto(false)} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: '8px',
            width: '280px', maxHeight: '360px', overflowY: 'auto',
            backgroundColor: '#1a1a1a', border: '1px solid #1e1e1e', borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #1e1e1e' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#F0F2F5' }}>Alertas</span>
              {naoLidos > 0 && (
                <button onClick={() => marcarTodosLidos.mutate()} style={{ background: 'none', border: 'none', color: '#fcc825', fontSize: '11px', cursor: 'pointer' }}>
                  Marcar tudo como lido
                </button>
              )}
            </div>

            {alertas.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: '12px', color: '#555' }}>
                Nenhum alerta por aqui
              </div>
            ) : (
              <div>
                {alertas.map(a => (
                  <button key={a.id} onClick={() => handleClickAlerta(a)} style={{
                    display: 'flex', gap: '8px', width: '100%', padding: '10px 14px',
                    border: 'none', borderBottom: '1px solid #1e1e1e', background: a.lido ? 'transparent' : 'rgba(252,200,37,0.04)',
                    cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COR_PRIORIDADE[a.prioridade] || '#555', flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: a.lido ? '#888' : '#F0F2F5', lineHeight: '1.4' }}>{a.mensagem}</div>
                      <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                        {formatDistanceToNow(new Date(a.criado_em), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
