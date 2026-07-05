import { createClient } from '@supabase/supabase-js'

// Login do professor é por CPF (e-mail sintético só existe pra satisfazer o Supabase Auth),
// então não dá pra mandar link de recuperação por e-mail como fazemos pros outros papéis.
// Aqui o gestor define uma senha nova diretamente; ao salvar, forçamos primeiro_acesso de
// volta pra true, então o professor é obrigado a trocar por uma senha só dele no próximo login.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' })
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: { user: chamador }, error: erroChamador } = await admin.auth.getUser(token)
  if (erroChamador || !chamador) {
    return res.status(401).json({ error: 'Sessão inválida' })
  }

  const { data: perfilChamador } = await admin
    .from('perfis_usuario')
    .select('role')
    .eq('user_id', chamador.id)
    .maybeSingle()
  const roleChamador = perfilChamador?.role === 'admin' ? 'gestor' : perfilChamador?.role
  if (roleChamador !== 'gestor') {
    return res.status(403).json({ error: 'Acesso não permitido' })
  }

  const { professorId, novaSenha } = req.body || {}
  if (!professorId || !novaSenha || String(novaSenha).length < 8) {
    return res.status(400).json({ error: 'Informe uma senha nova com pelo menos 8 caracteres' })
  }

  const { data: perfilProfessor } = await admin
    .from('perfis_usuario')
    .select('user_id')
    .eq('professor_id', professorId)
    .maybeSingle()
  if (!perfilProfessor) {
    return res.status(404).json({ error: 'Esse professor ainda não tem acesso criado' })
  }

  const { error: erroUpdate } = await admin.auth.admin.updateUserById(perfilProfessor.user_id, { password: novaSenha })
  if (erroUpdate) return res.status(400).json({ error: erroUpdate.message })

  await admin.from('perfis_usuario').update({ primeiro_acesso: true }).eq('user_id', perfilProfessor.user_id)

  return res.status(200).json({ ok: true })
}
