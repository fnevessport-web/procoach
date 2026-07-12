// Mapa nome-do-arquivo -> URL final (com hash), pros 40 SVGs de conquistas em
// src/assets/conquistas/. Usa import.meta.glob em vez de 40 imports estáticos — o campo
// `icone` de cada linha do catálogo (ex.: "aulas_30.svg") bate direto com a chave aqui.
const modulos = import.meta.glob('../assets/conquistas/*.svg', { eager: true, query: '?url', import: 'default' })

export const ICONE_CONQUISTA_URL = Object.fromEntries(
  Object.entries(modulos).map(([caminho, url]) => [caminho.split('/').pop(), url])
)
