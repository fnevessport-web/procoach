import { createClient } from '@supabase/supabase-js'

// Função serverless — login é por CPF (sem e-mail real), então não tem como mandar
// link de recuperação por e-mail. Em vez disso, avisa os gestores (via tabela `alertas`,
// mesma usada pelo sino no cabeçalho) que alguém esqueceu a senha, pra resetarem manual
// (isso já existe hoje dentro do cadastro do professor/colaborador).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' })
  }

  const cpfDigitos = String(req.body?.cpf || '').replace(/\D/g, '')
  if (cpfDigitos.length !== 11) {
    return res.status(400).json({ error: 'Informe um CPF válido (11 dígitos)' })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { data: professor } = await admin
      .from('professores').select('id, nome').eq('cpf', cpfDigitos).maybeSingle()

    // Resposta sempre igual, ache ou não o CPF — não revela se existe cadastro ou não
    if (professor) {
      const { data: gestores } = await admin
        .from('perfis_usuario').select('user_id').in('role', ['admin', 'coordenador'])

      for (const g of gestores || []) {
        await admin.from('alertas').insert({
          usuario_id: g.user_id,
          tipo: 'esqueci_senha',
          referencia_id: professor.id,
          prioridade: 'alta',
          mensagem: `${professor.nome} esqueceu a senha (CPF ${cpfDigitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}) — entre no cadastro dele(a) pra redefinir.`,
        })
      }
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao registrar aviso' })
  }
}
