import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { apenasDigitosCPF, cpfParaEmailSintetico } from '../lib/cpf'

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const { user, perfil, setUser, setPerfil, reset, setSessaoRecuperacao } = useAppStore()

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        fetchPerfil(session.user.id)
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      // Sessão veio de um link de recuperação de senha (Esqueci minha senha / Resetar senha
      // do gestor) — força a troca de senha mesmo que primeiro_acesso já seja false, senão o
      // link só loga o usuário de volta sem nunca deixar ele definir uma senha nova.
      if (_event === 'PASSWORD_RECOVERY') setSessaoRecuperacao(true)
      if (session?.user) {
        setUser(session.user)
        // Só busca o perfil se ainda não tiver carregado
        if (!useAppStore.getState().perfil) {
          // loading já pode estar false de um check anterior sem sessão (ex: tela de
          // login) — sem isso, App.jsx renderiza as rotas com perfil ainda nulo, o role
          // cai no fallback mais restrito por um instante e já redireciona pra fora da Home
          setLoading(true)
          fetchPerfil(session.user.id)
        } else {
          setLoading(false)
        }
      } else {
        reset()
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchPerfil(userId) {
    try {
      const { data } = await supabase
        .from('perfis_usuario')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) {
        setPerfil(data)
      } else {
        // Sem perfil ainda cadastrado: entra com o papel mais restrito por padrão —
        // quem gerencia o sistema promove pra role correto depois
        const { data: newPerfil } = await supabase
          .from('perfis_usuario')
          .insert({ user_id: userId, role: 'auxiliar', nome: 'Novo usuário' })
          .select()
          .single()
        setPerfil(newPerfil)
      }
    } catch {
      // Falha ao buscar perfil: nunca presumir acesso total — cai fechado
      setPerfil({ role: 'auxiliar' })
    } finally {
      setLoading(false)
    }
  }

  // Professor loga com CPF (não tem e-mail próprio no sistema); os demais papéis logam
  // com e-mail normal. Se o que foi digitado não tem "@", assume CPF e converte pro
  // e-mail sintético usado internamente pra criar a conta desse professor.
  async function signIn(emailOuCpf, senha) {
    const identificador = emailOuCpf.includes('@')
      ? emailOuCpf
      : cpfParaEmailSintetico(apenasDigitosCPF(emailOuCpf))
    const { data, error } = await supabase.auth.signInWithPassword({ email: identificador, password: senha })
    if (error) throw error
    return data
  }

  async function signUp(email, senha, nome) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, perfil, loading, signIn, signUp, signOut }
}