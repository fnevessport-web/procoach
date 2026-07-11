// Classificação gerencial (verde/amarelo/vermelho) de indicadores em % — mesma faixa já usada
// informalmente pra "presença baixa" por aluno (< 75%), agora aplicada também aos agregados
// (taxa de presença, taxa de realização) pra ficar consistente do card individual até o resumo
// executivo do clube.
export const CORES_SEMAFORO = { bom: '#22c55e', atencao: '#fcc825', critico: '#EF4444', info: '#3b82f6' }
export const LABEL_SEMAFORO = { bom: 'Bom', atencao: 'Atenção', critico: 'Crítico', info: 'Info' }

export function classificarPct(pct, { bom = 75, atencao = 50 } = {}) {
  if (pct >= bom) return 'bom'
  if (pct >= atencao) return 'atencao'
  return 'critico'
}

export function corPct(pct, limites) {
  return CORES_SEMAFORO[classificarPct(pct, limites)]
}
