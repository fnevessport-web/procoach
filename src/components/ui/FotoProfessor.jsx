import { useState } from 'react'

function getIniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(' ').filter(Boolean)
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// Dual-contexto: usado hoje só em telas escuras (Home), mas é um componente genérico —
// --color-action-primary/--color-action-on-primary já são os mesmos hex nos dois contextos.
export function FotoProfessor({ src, nome, size = 48 }) {
  const [erro, setErro] = useState(false)
  if (src && !erro) {
    return (
      <img src={src} alt={nome} onError={() => setErro(true)} style={{
        width: size, height: size, borderRadius: '8px',
        objectFit: 'cover', objectPosition: 'top', flexShrink: 0,
      }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '8px', flexShrink: 0,
      backgroundColor: 'var(--color-action-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: '700', color: 'var(--color-action-on-primary)',
    }}>
      {getIniciais(nome)}
    </div>
  )
}
