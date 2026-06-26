import { Search, X } from 'lucide-react'

export function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 36px', borderRadius: '10px',
          backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
          color: '#F0F2F5', fontSize: '13px', outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = '#fcc825'}
        onBlur={e => e.target.style.borderColor = '#2a2a2a'}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}