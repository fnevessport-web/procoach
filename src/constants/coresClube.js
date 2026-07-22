// Paleta editorial "papel timbrado" do clube — mesmos valores usados como arrays RGB em
// src/lib/relatorioPdf.js (COR_CREME/COR_TINTA/COR_SALVIA/COR_LARANJA/COR_VINHO/COR_MARINHO),
// aqui em hex pra reaproveitar em CSS/JSX fora do PDF (ex.: página pública de eventos).
export const CORES_CLUBE = {
  creme: '#F1EFEA',
  tinta: '#1A1818',
  salvia: '#A3BFAE',
  laranja: '#C1652F',
  vinho: '#6B1B27',
  marinho: '#1B293D',
  textoSuave: '#6E6A64',
  branco: '#FFFFFF',
}

// 4 estados de disponibilidade de vaga por slot — usa só as cores da marca (não semáforo
// genérico), pedido explícito do clube: vinho=lotado, laranja=quase esgotando, salvia=bastante
// vaga, marinho=livre (ninguém inscrito ainda).
//
// salviaEscura (não salvia puro) pro estado "bastante vaga": o salvia da marca (#A3BFAE) é bem
// mais claro/menos saturado que vinho/laranja/marinho (mesma família, tom escurecido/saturado
// pra ter peso visual equivalente) — usado puro, ficava com aparência "apagada"/quase
// transparente ao lado dos outros 3 estados, como se não tivesse vaga nenhuma.
export const COR_VAGA = {
  lotado: CORES_CLUBE.vinho,
  quase_esgotando: CORES_CLUBE.laranja,
  bastante_vaga: '#3F835B',
  livre: CORES_CLUBE.marinho,
}

export const LABEL_VAGA = {
  lotado: 'Lotado',
  quase_esgotando: 'Últimas vagas',
  bastante_vaga: 'Vagas disponíveis',
  livre: 'Vagas disponíveis',
}

// Limiares pedidos pelo clube (pra capacidade padrão de 4): 4 vagas=azul(livre), 3 e 2=verde
// (bastante vaga), 1=amarelo (quase esgotando), 0=vermelho (lotado). Generalizado por contagem
// de vagas restantes (não por %) pra funcionar igual em qualquer capacidade de slot.
export function classificarVaga(confirmados, capacidade) {
  const restantes = capacidade - confirmados
  if (restantes <= 0) return 'lotado'
  if (confirmados === 0) return 'livre'
  if (restantes === 1) return 'quase_esgotando'
  return 'bastante_vaga'
}
