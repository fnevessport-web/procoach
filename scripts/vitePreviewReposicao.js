import fs from 'node:fs'
import path from 'node:path'

// Preview do link /reposicao (cartão que WhatsApp/redes montam ao colar o link).
//
// O app é uma SPA: todas as rotas servem o mesmo index.html, e os robôs de preview não rodam
// JavaScript — então o cartão é sempre o das meta tags do index.html ("Pesquisa de Satisfação",
// pensado pros links de pesquisa). Pra /reposicao ter título/texto próprios sem mexer nos demais
// links, este plugin gera, DEPOIS do build, uma cópia do index.html em dist/reposicao/index.html
// com as tags trocadas. A Vercel serve arquivo estático antes de aplicar o rewrite catch-all, e
// como os assets do index.html têm caminho absoluto (/assets/...), a cópia carrega o mesmo app.
const TITULO = 'ProCoach Gestão de Esportes'
const DESCRICAO = 'Procopio: sistema de agendamento de aulas. Escolha seus horários de reposição e aproveite as aulas de presente.'
const URL_PAGINA = 'https://procoachsport.com.br/reposicao'

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function previewReposicao() {
  let outDir = 'dist'
  return {
    name: 'preview-reposicao',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      const origem = path.join(outDir, 'index.html')
      if (!fs.existsSync(origem)) return
      let html = fs.readFileSync(origem, 'utf8')

      const trocas = [
        [/<meta property="og:title" content="[^"]*"\s*\/?>/,
          `<meta property="og:title" content="${esc(TITULO)}" />\n    <meta property="og:url" content="${URL_PAGINA}" />\n    <meta name="twitter:title" content="${esc(TITULO)}" />\n    <meta name="twitter:description" content="${esc(DESCRICAO)}" />`],
        [/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(DESCRICAO)}" />`],
        [/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(DESCRICAO)}" />`],
        [/<title>[^<]*<\/title>/, `<title>${esc(TITULO)}</title>`],
      ]
      for (const [regex, novo] of trocas) {
        if (regex.test(html)) html = html.replace(regex, novo)
        else this.warn(`preview-reposicao: tag não encontrada no index.html (${regex}) — o preview de /reposicao pode ficar genérico.`)
      }

      const destino = path.join(outDir, 'reposicao')
      fs.mkdirSync(destino, { recursive: true })
      fs.writeFileSync(path.join(destino, 'index.html'), html)
    },
  }
}
