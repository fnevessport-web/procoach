// Guarda só DDD + número (sem "55") — é o formato que o resto do app já espera
// pra montar link do WhatsApp (wa.me/55 + telefone). O "+55" é só visual no campo.
export function apenasDigitosTelefone(v) {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

export function mascararTelefoneBR(v) {
  const d = apenasDigitosTelefone(v)
  if (!d) return '+55'
  const ddd = d.slice(0, 2)
  const numero = d.slice(2)
  let texto = `+55 (${ddd}`
  if (ddd.length === 2) texto += ')'
  if (numero) {
    texto += numero.length > 5 ? ` ${numero.slice(0, 5)}-${numero.slice(5)}` : ` ${numero}`
  }
  return texto
}
