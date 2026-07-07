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

  const { professorId, nome, cpf, senha, role, primeiroAcesso } = req.body || {}
  const cpfDigitos = String(cpf || '').replace(/\D/g, '')
  if (!professorId || cpfDigitos.length !== 11 || !senha) {
    return res.status(400).json({ error: 'Informe um CPF válido (11 dígitos) e uma senha' })
  }
  if (String(senha).length < 8) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' })
  }
  // 'gestor' é o nome usado na UI; 'admin' é o valor histórico gravado no banco (ver
  // usePermissions.js). Só aceita os 4 tipos que o cadastro oferece — nunca confia em
  // qualquer outro valor vindo do corpo da requisição.
  const ROLES_VALIDOS = { professor: 'professor', gestor: 'admin', financeiro: 'financeiro', auxiliar: 'auxiliar' }
  const roleFinal = ROLES_VALIDOS[role] || 'professor'

  // Login do professor é o CPF, não e-mail. Usamos um e-mail sintético (nunca enviado de
  // verdade) só pra satisfazer o Supabase Auth, que exige e-mail como identificador — isso
  // também garante 1 CPF = 1 conta só, já que o Supabase rejeita e-mail duplicado.
  const emailSintetico = `${cpfDigitos}@procoach.local`

  try {
    const { data: novoUsuario, error: erroCriar } = await admin.auth.admin.createUser({
      email: emailSintetico,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (erroCriar) {
      const mensagem = erroCriar.message?.includes('already been registered')
        ? 'Esse CPF já tem um acesso criado (talvez em outro cadastro de professor)'
        : erroCriar.message
      return res.status(400).json({ error: mensagem })
    }

    const { error: erroPerfil } = await admin.from('perfis_usuario').insert({
      user_id: novoUsuario.user.id,
      professor_id: professorId,
      role: roleFinal,
      nome,
      primeiro_acesso: primeiroAcesso ?? true,
    })
    if (erroPerfil) {
      // Sem isso, o login fica órfão (sem perfil) e trava qualquer nova tentativa com
      // esse CPF, porque o e-mail sintético já estaria "registrado" pro Supabase Auth.
      await admin.auth.admin.deleteUser(novoUsuario.user.id)
      return res.status(400).json({ error: erroPerfil.message })
    }

    await admin.from('professores').update({ cpf: cpfDigitos }).eq('id', professorId)

    return res.status(200).json({ ok: true, userId: novoUsuario.user.id })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao criar usuário' })
  }
}
