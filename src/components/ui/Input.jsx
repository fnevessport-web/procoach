// Dual-contexto: aliases genéricos (var(--surface-overlay), var(--text-primary)...) — ver
// src/index.css (.theme-dark/.theme-light). --color-action-primary e --color-state-danger não
// precisam de alias, são os mesmos nos dois contextos.
export function Input({ label, error, className = '', type = 'text', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      )}
      <input
        type={type}
        className={className}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--surface-overlay)',
          border: error ? '1px solid var(--color-state-danger)' : '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          appearance: 'none',
          WebkitAppearance: 'none',
          minWidth: 0,
          display: 'block',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--color-action-primary)'}
        onBlur={e => e.target.style.borderColor = error ? 'var(--color-state-danger)' : 'var(--border)'}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--color-state-danger)' }}>{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>}
      <textarea
        className={className}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--surface-overlay)',
          border: error ? '1px solid var(--color-state-danger)' : '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          minWidth: 0,
          display: 'block',
        }}
        rows={3}
        onFocus={e => e.target.style.borderColor = 'var(--color-action-primary)'}
        onBlur={e => e.target.style.borderColor = error ? 'var(--color-state-danger)' : 'var(--border)'}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--color-state-danger)' }}>{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>}
      <select
        className={className}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--surface-overlay)',
          border: error ? '1px solid var(--color-state-danger)' : '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          minWidth: 0,
          display: 'block',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--color-action-primary)'}
        onBlur={e => e.target.style.borderColor = error ? 'var(--color-state-danger)' : 'var(--border)'}
        {...props}
      >
        {children}
      </select>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-state-danger)' }}>{error}</span>}
    </div>
  )
}
