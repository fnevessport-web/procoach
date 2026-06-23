import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const { user, perfil, setUser, setPerfil, reset } = useAppStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchPerfil(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchPerfil(session.user.id)
      } else {
        reset()
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
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
        // First user — create as admin
        const { data: newPerfil } = await supabase
          .from('perfis_usuario')
          .insert({ user_id: userId, role: 'admin', nome: 'Admin' })
          .select()
          .single()
        setPerfil(newPerfil)
      }
    } catch {
      setPerfil({ role: 'admin' })
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
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
