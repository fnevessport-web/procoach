import { supabase } from './supabase'

export async function logAudit(tabela, registroId, acao, dadosAnteriores, dadosNovos) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('audit_log').insert({
      tabela,
      registro_id: String(registroId),
      acao,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      usuario: session?.user?.email || 'sistema'
    })
  } catch {
    // Audit logging is non-critical
  }
}
