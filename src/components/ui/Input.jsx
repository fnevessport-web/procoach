export function Input({ label, error, className = '', type = 'text', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium" style={{ color: '#888' }}>{label}</label>
      )}
      <input
        type={type}
        className={className}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#110f0f',
          border: error ? '1px solid #EF4444' : '1px solid #2a2a2a',
          color: '#F0F2F5',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          appearance: 'none',
          WebkitAppearance: 'none',
          minWidth: 0,
          display: 'block',
        }}
        onFocus={e => e.target.style.borderColor = '#fcc825'}
        onBlur={e => e.target.style.borderColor = error ? '#EF4444' : '#2a2a2a'}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium" style={{ color: '#888' }}>{label}</label>}
      <textarea
        className={className}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#110f0f',
          border: error ? '1px solid #EF4444' : '1px solid #2a2a2a',
          color: '#F0F2F5',
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          minWidth: 0,
          display: 'block',
        }}
        rows={3}
        onFocus={e => e.target.style.borderColor = '#fcc825'}
        onBlur={e => e.target.style.borderColor = error ? '#EF4444' : '#2a2a2a'}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium" style={{ color: '#888' }}>{label}</label>}
      <select
        className={className}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#110f0f',
          border: error ? '1px solid #EF4444' : '1px solid #2a2a2a',
          color: '#F0F2F5',
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
        onFocus={e => e.target.style.borderColor = '#fcc825'}
        onBlur={e => e.target.style.borderColor = error ? '#EF4444' : '#2a2a2a'}
        {...props}
      >
        {children}
      </select>
      {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
    </div>
  )
}