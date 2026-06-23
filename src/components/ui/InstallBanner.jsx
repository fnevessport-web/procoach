import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) {
      setDismissed(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  if (!prompt || dismissed || installed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30">
      <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
        <span className="text-lg">🏆</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#F0F2F5]">Instalar ProCoach</div>
        <div className="text-xs text-[#8B8FA8]">Acesse rápido pelo celular</div>
      </div>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA] text-[#0F1117] text-xs font-semibold flex-shrink-0"
      >
        <Download size={13} /> Instalar
      </button>
      <button onClick={handleDismiss} className="p-1 text-[#8B8FA8] flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
