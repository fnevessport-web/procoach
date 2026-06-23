import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [modo, setModo] = useState('login')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ email: '', senha: '', nome: '' })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      if (modo === 'login') {
        await signIn(form.email, form.senha)
      } else {
        await signUp(form.email, form.senha, form.nome)
      }
    } catch (err) {
      setErro(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4 border border-[#00D4AA]/30">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-3xl font-bold text-[#F0F2F5]">ProCoach</h1>
          <p className="text-[#8B8FA8] text-sm mt-2">Gestão esportiva inteligente</p>
        </div>

        <div className="bg-[#1A1D27] rounded-2xl border border-[#2A2D3E] p-6">
          <div className="flex gap-2 mb-6 p-1 bg-[#0F1117] rounded-xl">
            {['login', 'cadastro'].map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setErro('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  modo === m
                    ? 'bg-[#00D4AA] text-[#0F1117]'
                    : 'text-[#8B8FA8] hover:text-[#F0F2F5]'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Criar Conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {modo === 'cadastro' && (
              <Input
                label="Nome completo"
                placeholder="Seu nome"
                value={form.nome}
                onChange={e => update('nome', e.target.value)}
                required
              />
            )}
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={form.senha}
              onChange={e => update('senha', e.target.value)}
              required
            />

            {erro && (
              <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#EF4444]">
                {erro}
              </div>
            )}

            <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
              {modo === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[#4A4D65] mt-6">
          ProCoach © {new Date().getFullYear()} — Gestão esportiva
        </p>
      </div>
    </div>
  )
}
