// Primeiro nome + sobrenome (último nome, ignorando os do meio) — o suficiente pra
// distinguir professores homônimos (ex: dois "Bruno", dois "Marcelo" na mesma unidade)
// nos espaços apertados da grade de aulas, sem lotar o card com o nome completo.
export function nomeCurto(nomeCompleto) {
  if (!nomeCompleto) return ''
  const partes = nomeCompleto.trim().split(/\s+/)
  if (partes.length <= 1) return partes[0] || ''
  return `${partes[0]} ${partes[partes.length - 1]}`
}
