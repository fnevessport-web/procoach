import { Loader2 } from 'lucide-react'

export function Loading({ text = 'Carregando...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '64px 0' }}>
      <Loader2 size={32} className="spin" style={{ color: '#fcc825' }} />
      <span style={{ fontSize: '13px', color: '#555' }}>{text}</span>
    </div>
  )
}

export function PageLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#110f0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '48px', objectFit: 'contain' }} />
        <Loader2 size={24} className="spin" style={{ color: '#fcc825' }} />
      </div>
    </div>
  )
}

export function EmptyState({ icon, iconImg, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '12px', padding: '64px 0', textAlign: 'center',
    }}>
      {iconImg ? (
        <img src={iconImg} alt={title} style={{ width: '56px', height: '56px', objectFit: 'contain', opacity: 0.6 }} />
      ) : (
        <div style={{ fontSize: '40px' }}>{icon || '📭'}</div>
      )}
      <div style={{ fontSize: '15px', fontWeight: '500', color: '#F0F2F5' }}>{title}</div>
      {description && <p style={{ fontSize: '13px', color: '#555', maxWidth: '240px' }}>{description}</p>}
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  )
}