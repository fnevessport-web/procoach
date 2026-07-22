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
export const COR_VAGA = {
  lotado: CORES_CLUBE.vinho,
  quase_esgotando: CORES_CLUBE.laranja,
  bastante_vaga: CORES_CLUBE.salvia,
  livre: CORES_CLUBE.marinho,
}

export const LABEL_VAGA = {
  lotado: 'Lotado',
  quase_esgotando: 'Últimas vagas',
  bastante_vaga: 'Vagas disponíveis',
  livre: 'Vagas disponíveis',
}

export function classificarVaga(confirmados, capacidade) {
  const restantes = capacidade - confirmados
  if (confirmados === 0) return 'livre'
  if (restantes <= 0) return 'lotado'
  if (restantes <= Math.ceil(capacidade * 0.25)) return 'quase_esgotando'
  return 'bastante_vaga'
}
