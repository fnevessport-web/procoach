import { createClient } from '@supabase/supabase-js'

// Função serverless (roda só no servidor da Vercel) — é o único lugar onde a
// SUPABASE_SERVICE_ROLE_KEY existe. Nunca importe/exponha essa chave em código
// que roda no navegador (pasta src/).
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

  // Identifica quem está chamando a partir do token da própria sessão dele
  const { data: { user: chamador }, error: erroChamador } = await admin.auth.getUser(token)
  if (erroChamador || !chamador) {
    return res.status(401).json({ error: 'Sessão inválida' })
  }

  // Nunca confia em role mandado pelo corpo da requisição — confere direto no banco
  const { data: perfilChamador } = await admin
    .from('perfis_usuario')
    .select('role')
    .eq('user_id', chamador.id)
    .maybeSingle()
  const roleChamador = perfilChamador?.role === 'admin' ? 'gestor' : perfilChamador?.role
  if (roleChamador !== 'gestor') {
    return res.status(403).json({ error: 'Acesso não permitido' })
  }

  const { professorId, nome, email, senha } = req.body || {}
  if (!professorId || !email || !senha) {
    return res.status(400).json({ error: 'Dados incompletos' })
  }
  if (String(senha).length < 8) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' })
  }

  try {
    const { data: novoUsuario, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (erroCriar) return res.status(400).json({ error: erroCriar.message })

    const { error: erroPerfil } = await admin.from('perfis_usuario').insert({
      user_id: novoUsuario.user.id,
      professor_id: professorId,
      role: 'professor',
      nome,
      primeiro_acesso: true,
    })
    if (erroPerfil) return res.status(400).json({ error: erroPerfil.message })

    return res.status(200).json({ ok: true, userId: novoUsuario.user.id })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao criar usuário' })
  }
}
