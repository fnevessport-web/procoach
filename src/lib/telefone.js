// Guarda só DDD + número (sem "55") — é o formato que o resto do app já espera
// pra montar link do WhatsApp (wa.me/55 + telefone). O "+55" é exibido como prefixo
// fixo fora do campo editável — nunca deve entrar no value do input, senão vira
// dado ao ser re-extraído a cada tecla digitada.
export function apenasDigitosTelefone(v) {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

// No computador, whatsapp:// abre direto o app instalado, sem a página intermediária do
// api.whatsapp.com a cada contato (o navegador só pergunta na 1ª vez; marcar "Sempre permitir").
// No celular wa.me já abre o app sozinho. Aceita telefone com ou sem "55" na frente.
export function linkWhatsApp(telefone) {
  const d = (telefone || '').replace(/\D/g, '')
  const comDdi = d.length > 11 ? d : `55${d}`
  const ehCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return ehCelular ? `https://wa.me/${comDdi}` : `whatsapp://send?phone=${comDdi}`
}

// whatsapp:// não precisa (nem deve) abrir aba nova — ficaria uma aba em branco pra trás.
export function abrirWhatsApp(telefone) {
  const link = linkWhatsApp(telefone)
  if (link.startsWith('whatsapp:')) window.location.href = link
  else window.open(link, '_blank')
}

export function mascararTelefoneBR(v) {
  const d = apenasDigitosTelefone(v)
  if (!d) return ''
  const ddd = d.slice(0, 2)
  const numero = d.slice(2)
  let texto = `(${ddd}`
  if (ddd.length === 2) texto += ')'
  if (numero) {
    texto += numero.length > 5 ? ` ${numero.slice(0, 5)}-${numero.slice(5)}` : ` ${numero}`
  }
  return texto
}
