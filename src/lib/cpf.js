export function apenasDigitosCPF(v) {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

// Preenche as casas ainda não digitadas com • (bolinha cinza) no lugar de zero
export function mascararCPF(v) {
  const d = apenasDigitosCPF(v)
  if (!d) return ''
  const pad = d.padEnd(11, '•')
  return `${pad.slice(0, 3)}.${pad.slice(3, 6)}.${pad.slice(6, 9)}-${pad.slice(9, 11)}`
}

// Login do professor é o CPF, não e-mail — usamos um e-mail sintético (nunca enviado
// de verdade) só pra satisfazer o Supabase Auth, que exige e-mail como identificador.
// Isso também garante 1 CPF = 1 conta só (o Supabase já rejeita e-mail duplicado).
export function cpfParaEmailSintetico(v) {
  return `${apenasDigitosCPF(v)}@procoach.local`
}
