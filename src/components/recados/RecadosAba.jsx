import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2, Inbox, Archive, Send, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import useAppStore from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'
import { useRecadosDoProfessor, useRecadosEnviados, useApagarRecado, recadoNoPainel } from '../../hooks/useRecados'
import { nomeProfessor } from '../../lib/nomes'
import { FotoProfessor } from '../ui/FotoProfessor'
import { Loading } from '../ui/Loading'
import { CartaoRecado, RecadoLeitura } from './RecadoLeitura'
import { NovoRecado } from './NovoRecado'

// Aba "Recados" dentro de Mensagens. Professor: recebidos (no painel) + pasta Lidos.
// Todo mundo da equipe: enviar recado e acompanhar os enviados (gestão vê todos).
export function RecadosAba() {
  const { perfil } = useAppStore()
  const { role } = usePermissions()
  const ehGestao = role === 'gestor' || role === 'coordenador'
  const professorId = role === 'professor' ? perfil?.professor_id : null
  const [novo, setNovo] = useState(false)
  const [pasta, setPasta] = useState(professorId ? 'recebidos' : 'enviados')
  const [aberto, setAberto] = useState(null)
  const { data: recebidos = [], isLoading: l1 } = useRecadosDoProfessor(professorId)
  const { data: enviados = [], isLoading: l2 } = useRecadosEnviados({ todos: ehGestao })
  const apagar = useApagarRecado()

  if (novo) return <NovoRecado onFechar={() => setNovo(false)} />

  const ativos = recebidos.filter(r => recadoNoPainel(r))
  const lidos = recebidos.filter(r => r.lido_em)
  const pastas = [
    ...(professorId ? [{ v: 'recebidos', label: 'Recebidos', icon: Inbox, n: ativos.filter(r => !r.lido_em).length }, { v: 'lidos', label: 'Lidos', icon: Archive, n: 0 }] : []),
    { v: 'enviados', label: ehGestao ? 'Enviados (equipe)' : 'Enviados', icon: Send, n: 0 },
  ]

  return (
    <div>
      <button onClick={() => setNovo(true)} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '14px' }}>
        <Plus size={17} /> Enviar recado para professor
      </button>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {pastas.map(({ v, label, icon: Icon, n }) => (
          <button key={v} onClick={() => setPasta(v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${pasta === v ? 'var(--color-action-primary)' : 'var(--color-border-dark)'}`,
            backgroundColor: pasta === v ? 'color-mix(in srgb, var(--color-action-primary) 20%, var(--color-surface-dark-raised))' : 'var(--color-surface-dark-raised)',
            color: 'var(--color-text-dark-primary)',
          }}>
            <Icon size={13} /> {label}{n > 0 && <span style={{ backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', borderRadius: '999px', padding: '0 6px', fontSize: '10px' }}>{n}</span>}
          </button>
        ))}
      </div>

      {(pasta === 'recebidos' || pasta === 'lidos') && (l1 ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(pasta === 'recebidos' ? ativos : lidos).map(r => <CartaoRecado key={r.id} recado={r} onAbrir={() => setAberto({ recado: r, marcar: true })} />)}
          {(pasta === 'recebidos' ? ativos : lidos).length === 0 && <Vazio texto={pasta === 'recebidos' ? 'Nenhum recado novo.' : 'Nenhum recado lido guardado.'} />}
        </div>
      ))}

      {pasta === 'enviados' && (l2 ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {enviados.length === 0 && <Vazio texto="Nenhum recado enviado ainda." />}
          {enviados.map(g => {
            const lidosN = g.destinatarios.filter(d => d.lido_em).length
            return (
              <div key={g.grupo_id} style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
                  <span>{format(new Date(g.criado_em), "dd/MM 'às' HH:mm")}</span>
                  {ehGestao && <span>· por <b style={{ color: 'var(--color-text-dark-primary)' }}>{g.autor_nome}</b></span>}
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: lidosN === g.destinatarios.length ? 'var(--color-state-success)' : 'var(--color-text-dark-secondary)' }}>{lidosN}/{g.destinatarios.length} leram</span>
                </div>
                <button onClick={() => setAberto({ recado: g, marcar: false })} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginTop: '4px', fontSize: '13px', color: 'var(--color-text-dark-primary)', lineHeight: 1.4 }}>
                  {g.texto.length > 160 ? g.texto.slice(0, 160) + '...' : g.texto}
                  {g.tipo === 'turma' && <span style={{ color: 'var(--color-text-dark-secondary)' }}> · {g.aula_ids?.length} turma(s)</span>}
                </button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                  {g.destinatarios.map(d => (
                    <span key={d.id} title={d.lido_em ? `Leu em ${format(new Date(d.lido_em), 'dd/MM HH:mm')}` : 'Ainda não leu'} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px 2px 2px', borderRadius: '999px', fontSize: '11px', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', border: `1px solid ${d.lido_em ? 'rgba(75,139,106,0.6)' : 'var(--color-border-dark)'}` }}>
                      <FotoProfessor src={d.professor?.foto_url} nome={d.professor?.nome} size={18} redondo />
                      {nomeProfessor(d.professor)}
                      {d.lido_em && <Check size={11} color="var(--color-state-success)" />}
                    </span>
                  ))}
                  <button onClick={async () => { if (!window.confirm('Apagar esse recado para todos os destinatários?')) return; try { await apagar.mutateAsync(g.grupo_id); toast.success('Recado apagado') } catch (e) { toast.error(e.message) } }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-text-dark-muted)', cursor: 'pointer', display: 'flex' }} title="Apagar"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {aberto && <RecadoLeitura recado={aberto.recado} podeMarcar={aberto.marcar} onFechar={() => setAberto(null)} />}
    </div>
  )
}

function Vazio({ texto }) {
  return <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-dark-muted)', backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '12px', border: '1px solid var(--color-border-dark)' }}>{texto}</div>
}
