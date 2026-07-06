// Feriados nacionais + estaduais/municipais de SP, calculados sem depender de serviço externo.
// Móveis (Carnaval, Sexta-feira Santa, Corpus Christi) usam o algoritmo padrão de cálculo da
// Páscoa (Anonymous Gregorian algorithm), válido pra qualquer ano do calendário gregoriano.

function calcularPascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

function addDias(data, dias) {
  const d = new Date(data)
  d.setDate(d.getDate() + dias)
  return d
}

function paraChave(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${mes}-${dia}`
}

const FIXOS = {
  '01-01': 'Confraternização Universal',
  '01-25': 'Aniversário de São Paulo',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '07-09': 'Revolução Constitucionalista (SP)',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal',
}

const cacheMoveisPorAno = {}

function getMoveisDoAno(ano) {
  if (cacheMoveisPorAno[ano]) return cacheMoveisPorAno[ano]
  const pascoa = calcularPascoa(ano)
  const moveis = {
    [paraChave(addDias(pascoa, -47))]: 'Carnaval',
    [paraChave(addDias(pascoa, -2))]: 'Sexta-feira Santa',
    [paraChave(addDias(pascoa, 60))]: 'Corpus Christi',
  }
  cacheMoveisPorAno[ano] = moveis
  return moveis
}

// dataStr no formato 'yyyy-MM-dd' — retorna o nome do feriado ou null
export function getFeriado(dataStr) {
  if (!dataStr) return null
  const [anoStr, mesStr, diaStr] = dataStr.split('-')
  const chave = `${mesStr}-${diaStr}`
  if (FIXOS[chave]) return FIXOS[chave]
  const moveis = getMoveisDoAno(Number(anoStr))
  return moveis[chave] || null
}

export function ehFeriado(dataStr) {
  return !!getFeriado(dataStr)
}
