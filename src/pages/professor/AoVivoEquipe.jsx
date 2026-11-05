import { useEffect, useState } from 'react'
import { useHomeDashboard } from '../../hooks/useHomeDashboard'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import { horarioParaMinutos } from '../../constants/modalidades'
import { nomeProfessor } from '../../lib/nomes'

// "AO VIVO" no painel do professor: quem da equipe está em quadra agora, com foto e apelido
// (mesma fonte da Home da gestão). Contexto escuro.
function usePctAula(inicio, fim) {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setAgora(new Date()), 30000); return () => clearInterval(id) }, [])
  const i = horarioParaMinutos(inicio), f = horarioParaMinutos(fim)
  if (i == null || f == null || f <= i) return 0
  const m = agora.getHours() * 60 + agora.getMinutes()
  return Math.min(100, Math.max(0, ((m - i) / (f - i)) * 100))
}

function CardAoVivo({ aula }) {
  const pct = usePctAula(aula.horarioInicio, aula.horarioFim)
  return (
    <div style={{ flexShrink: 0, width: '128px', padding: '10px', borderRadius: '14px', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative' }}>
        <FotoProfessor src={aula.professores?.foto_url} nome={aula.professores?.nome} size={64} redondo />
        <span className="pulse-badge" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-accent-live)', border: '2px solid var(--color-surface-dark-raised)' }} />
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-dark-primary)', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {aula.professores ? nomeProfessor(aula.professores) : 'Sem professor'}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', textAlign: 'center', lineHeight: 1.3 }}>
        {aula.quadraNome}<br />{aula.horarioInicio?.slice(0, 5)} · {aula.modalidadeNome}
      </div>
      <div style={{ width: '100%', height: '3px', borderRadius: '2px', backgroundColor: 'var(--color-border-dark-subtle)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-accent-live)' }} />
      </div>
    </div>
  )
}

export function AoVivoEquipe() {
  const { aoVivoAgora = [], isLoading } = useHomeDashboard()
  if (isLoading) return null
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        {aoVivoAgora.length > 0 && <span className="pulse-badge" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-accent-live)' }} />}
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: aoVivoAgora.length ? 'var(--color-accent-live)' : 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          Ao vivo {aoVivoAgora.length > 0 ? `· ${aoVivoAgora.length} em quadra` : ''}
        </h3>
      </div>
      {aoVivoAgora.length === 0 ? (
        <div style={{ padding: '14px', borderRadius: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-dark-muted)', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)' }}>
          Nenhum professor em quadra agora.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
          {aoVivoAgora.map(a => <CardAoVivo key={a.id} aula={a} />)}
        </div>
      )}
    </div>
  )
}
