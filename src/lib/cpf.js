export function apenasDigitosCPF(v) {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

// Formata progressivamente conforme digita (000.000.000-00) — sem preencher com
// placeholder as casas que faltam, porque isso trava o campo (o valor mascarado já
// nasce "cheio" e bloqueia digitar mais nada). O hint visual de bolinha cinza fica
// só no placeholder nativo do input, exibido quando o campo está vazio.
export function mascararCPF(v) {
  const d = apenasDigitosCPF(v)
  if (!d) return ''
  let out = d.slice(0, 3)
  if (d.length > 3) out += '.' + d.slice(3, 6)
  if (d.length > 6) out += '.' + d.slice(6, 9)
  if (d.length > 9) out += '-' + d.slice(9, 11)
  return out
}

// Login do professor é o CPF, não e-mail — usamos um e-mail sintético (nunca enviado
// de verdade) só pra satisfazer o Supabase Auth, que exige e-mail como identificador.
// Isso também garante 1 CPF = 1 conta só (o Supabase já rejeita e-mail duplicado).
export function cpfParaEmailSintetico(v) {
  return `${apenasDigitosCPF(v)}@procoach.local`
}
