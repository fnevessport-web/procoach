// Página de apresentação (/apresentacao-campeonatos) com prévia própria de link (Open Graph).
// O WhatsApp/Instagram não rodam JavaScript: leem só o HTML inicial. Esta função devolve o mesmo
// index.html do app (a página abre normal no navegador), trocando título, descrição e imagem da
// prévia. A rota é ligada no vercel.json.
const TITULO = 'Procopio · Sistema de gestão de torneios'
const DESCRICAO = 'Sorteio ao vivo, placar em tempo real, telão do clube e o celular de cada atleta conectados. Veja a demonstração do Mixed Doubles Challenge.'

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const base = `https://${host}`
  const resp = await fetch(`${base}/index.html`)
  let html = await resp.text()

  // tira as etiquetas de prévia genéricas do app e põe as da apresentação
  html = html
    .replace(/<meta\s+(property|name)="(og|twitter):[^"]*"[^>]*>\s*/g, '')
    .replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${DESCRICAO}" />`)
    .replace(/<title>[^<]*<\/title>/, `<title>${TITULO}</title>`)
  const tags = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Procopio'],
    ['property', 'og:title', TITULO],
    ['property', 'og:description', DESCRICAO],
    ['property', 'og:url', `${base}/apresentacao-campeonatos`],
    ['property', 'og:image', `${base}/apresentacao/og.jpg`],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:locale', 'pt_BR'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', TITULO],
    ['name', 'twitter:description', DESCRICAO],
    ['name', 'twitter:image', `${base}/apresentacao/og.jpg`],
  ].map(([a, k, v]) => `    <meta ${a}="${k}" content="${v}" />`).join('\n')
  html = html.replace('</head>', `${tags}\n  </head>`)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600')
  res.status(200).send(html)
}
