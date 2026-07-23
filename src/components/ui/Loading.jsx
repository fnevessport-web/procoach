import { Loader2 } from 'lucide-react'

// Loading/Skeleton/EmptyState são dual-contexto (aliases genéricos). PageLoading é o splash
// inicial — aparece antes do app decidir tema por rota (durante o carregamento de auth), então
// fica fixo no tom escuro da marca, igual ao Login.
export function Loading({ text = 'Carregando...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '64px 0' }}>
      <Loader2 size={32} className="spin" style={{ color: 'var(--color-action-primary)' }} />
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  )
}

// Placeholders retangulares com shimmer, pra usar no lugar do spinner quando o formato do conteúdo final já é conhecido
export function Skeleton({ width = '100%', height = '16px', radius = '8px', style }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />
}

export function SkeletonList({ rows = 3, rowHeight = '56px', gap = '8px' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={rowHeight} radius="12px" />
      ))}
    </div>
  )
}

export function PageLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'var(--color-surface-dark-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '48px', objectFit: 'contain' }} />
        <Loader2 size={24} className="spin" style={{ color: 'var(--color-action-primary)' }} />
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
        <img src={iconImg} alt={title} style={{ width: '56px', height: '56px', objectFit: 'contain', opacity: 0.2 }} />
      ) : (
        <div style={{ fontSize: '40px' }}>{icon || '📭'}</div>
      )}
      <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>{title}</div>
      {description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '240px' }}>{description}</p>}
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  )
}
