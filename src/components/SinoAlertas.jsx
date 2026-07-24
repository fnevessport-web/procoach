import { useState } from 'react'
import { Bell, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAlertas, useMarcarAlertaLido, useMarcarTodosAlertasLidos } from '../hooks/useAlertas'
import { supabase } from '../lib/supabase'

// Tipos cujo referencia_id aponta pra uma aula — clicar deve abrir ela direto, não só cair
// na lista genérica de /aulas.
const TIPOS_COM_AULA = ['aluno_incluido', 'aluno_adicionado', 'aluno_removido']

const ROTA_POR_TIPO = {
  mensagem_nova: '/mensagens',
  turma_ativada: '/aulas',
  aluno_incluido: '/aulas',
  aluno_adicionado: '/aulas',
  aluno_removido: '/aulas',
  esqueci_senha: '/cadastros',
  avaliacao_pendente_confirmacao: '/dashboard-professor',
}

const COR_PRIORIDADE = { alta: 'var(--color-state-danger)', media: 'var(--color-state-warning)', baixa: 'var(--color-text-dark-muted)' }

export function SinoAlertas() {
  const [aberto, setAberto] = useState(false)
  const { data: alertas = [] } = useAlertas()
  const marcarLido = useMarcarAlertaLido()
  const marcarTodosLidos = useMarcarTodosAlertasLidos()
  const navigate = useNavigate()

  const naoLidos = alertas.filter(a => !a.lido).length

  async function handleClickAlerta(alerta) {
    if (!alerta.lido) marcarLido.mutate(alerta.id)
    setAberto(false)

    if (TIPOS_COM_AULA.includes(alerta.tipo) && alerta.referencia_id) {
      const { data: aula } = await supabase
        .from('aulas').select('data_aula').eq('id', alerta.referencia_id).maybeSingle()
      navigate('/aulas', {
        state: { highlightAulaId: alerta.referencia_id, data: aula?.data_aula, abrirAoDestacar: true },
      })
      return
    }

    navigate(ROTA_POR_TIPO[alerta.tipo] || '/')
  }

  // Segunda ação, só pros alertas vinculados a um aluno (mensagem sobre um aluno específico,
  // avaliação pendente de confirmação) — vai direto pro card do aluno sem passar pela ação
  // principal (conversa / painel de confirmação).
  function handleVerAluno(e, alerta) {
    e.stopPropagation()
    if (!alerta.lido) marcarLido.mutate(alerta.id)
    setAberto(false)
    navigate(`/cadastros/alunos/${alerta.aluno_id}`)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setAberto(!aberto)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', position: 'relative' }}>
        <Bell size={20} color="var(--color-text-dark-secondary)" />
        {naoLidos > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            minWidth: '16px', height: '16px', padding: '0 3px', backgroundColor: 'var(--color-state-danger)',
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
            backgroundColor: 'var(--color-chrome-raised)', border: '1px solid var(--color-chrome-border)', borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--color-chrome-border)' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>Alertas</span>
              {naoLidos > 0 && (
                <button onClick={() => marcarTodosLidos.mutate()} style={{ background: 'none', border: 'none', color: 'var(--color-action-primary)', fontSize: '11px', cursor: 'pointer' }}>
                  Marcar tudo como lido
                </button>
              )}
            </div>

            {alertas.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-dark-secondary)' }}>
                Nenhum alerta por aqui
              </div>
            ) : (
              <div>
                {alertas.map(a => (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickAlerta(a)}
                    onKeyDown={e => { if (e.key === 'Enter') handleClickAlerta(a) }}
                    style={{
                      display: 'flex', gap: '8px', width: '100%', padding: '10px 14px',
                      border: 'none', borderBottom: '1px solid var(--color-chrome-border)', background: a.lido ? 'transparent' : 'rgba(165,76,46,0.08)',
                      cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COR_PRIORIDADE[a.prioridade] || 'var(--color-text-dark-muted)', flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: a.lido ? 'var(--color-text-dark-secondary)' : 'var(--color-text-dark-primary)', lineHeight: '1.4' }}>{a.mensagem}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-dark-muted)' }}>
                          {formatDistanceToNow(new Date(a.criado_em), { locale: ptBR, addSuffix: true })}
                        </div>
                        {a.aluno_id && (
                          <button onClick={e => handleVerAluno(e, a)} style={{
                            display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            padding: '3px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-secondary)', fontSize: '10px', fontWeight: '600',
                          }}>
                            <User size={10} /> Ver aluno
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
