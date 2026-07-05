export async function buscarCep(cep, setForm) {
  const c = cep.replace(/\D/g, '')
  if (c.length !== 8) return
  try {
    const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
    const data = await res.json()
    if (!data.erro) {
      setForm(f => ({
        ...f,
        endereco: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
      }))
    }
  } catch {}
}
