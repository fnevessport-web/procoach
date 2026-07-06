import { useState, useEffect } from 'react'

// Altura real da área visível da tela, via window.visualViewport — mais confiável que
// vh/dvh em CSS puro pra saber quanto espaço sobra quando o teclado ou a barra de
// endereço do navegador mobile ocupam parte da tela (dvh nem sempre recalcula certo
// nessas situações, dependendo do navegador/versão).
export function useVisualViewportHeight() {
  const [height, setHeight] = useState(() => window.visualViewport?.height || window.innerHeight)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const atualizar = () => setHeight(vv.height)
    atualizar()
    vv.addEventListener('resize', atualizar)
    vv.addEventListener('scroll', atualizar)
    return () => {
      vv.removeEventListener('resize', atualizar)
      vv.removeEventListener('scroll', atualizar)
    }
  }, [])

  return height
}
