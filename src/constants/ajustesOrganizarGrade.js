// Ajustes que valem SÓ na tela Organizar Grade (/organizar-grade) — nunca mexem em turmas,
// matrículas nem presenças. Servem pra mostrar a grade como está no relatório do clube enquanto a
// sincronização do ProCoach não é aplicada. Pedido do gestor em 10/10/2026 pra reunião de
// definição das grades dos novos professores.

// Alunos por turma (turma_id) conforme o relatório Multiclubes de 07/10/2026 19h18:
// - ocultar: ainda matriculados no ProCoach, mas não estão mais na lista do clube;
// - incluir: estão na lista do clube e ainda não foram matriculados no ProCoach.
// Matrículas feitas à mão pela coordenação depois do relatório ficam como estão (não entram aqui).
// Quando a sincronização for aplicada de verdade, esvaziar este objeto.
export const AJUSTES_ALUNOS_GRADE = {
  '9581a681-4f1c-4977-b6d6-415c7cce6776': { ocultar: ['Thiago Pires Albano'] }, // Seg 21h Avançado
  'a7f1150d-b132-404e-b485-0df0dd00614b': { ocultar: ['Renyer Roberto Amaral dos Santos'] }, // Sex 15h Iniciante 1
  '464aebe4-2a7a-4e63-9447-b7e9a98a06e0': { ocultar: ['Bruna Zambello Barretti'] }, // Seg 19h Iniciante 1
  'ce5aa008-c28c-46c2-aef1-a7ae6b9bb165': { ocultar: ['Bruna Zambello Barretti'] }, // Qua 19h Iniciante 1
  '100550b3-bc1e-4a23-a070-73d68eca7eb1': { ocultar: ['Maria Fernanda Santos Abrão'] }, // Sáb 14h Kids 1
  'b37e0079-4d82-4ce2-8a3b-4cb13d8ec763': { ocultar: ['Maria Clara Vieira Swarowsky'] }, // Qui 15h Kids 1
  '0437df4b-c153-4cd2-a447-0f108d4c0f23': { ocultar: ['Rogerio Hanai Jukemura'] }, // Sáb 15h Kids 2
  '43b120d1-eb23-4cdb-b03a-7c998eb5a695': { ocultar: ['Joanna Martins Alves'] }, // Sex 17h Kids Intermediário
  'bb7036f5-dcbe-4629-a88a-b0d1ee646796': { incluir: ['Gustavo Martins Braga'] }, // Qua 20h Intermediário 1
  '9a2828a0-6b5d-4349-921a-a3f2121f137e': { incluir: ['Maria Isabela Fleck da Rosa Quintão'] }, // Sex 17h Kids 1
}

// Nome que aparece pro professor nesta tela (sobrepõe o apelido do cadastro só aqui).
export const NOMES_PROFESSOR_GRADE = {
  'd423db9d-262c-4d6b-97d4-ce301fe715eb': 'Marcelo Rocha', // Marcelo Ribeiro Rocha
}

const chaveNome = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()

// Aplica AJUSTES_ALUNOS_GRADE no mapa { [turma_id]: { data_aula, alunos: [nome] } } de useAlunosDaSemana.
export function aplicarAjustesAlunos(mapa) {
  const out = { ...(mapa || {}) }
  for (const [turmaId, { ocultar = [], incluir = [] }] of Object.entries(AJUSTES_ALUNOS_GRADE)) {
    const atual = out[turmaId] || { data_aula: null, alunos: [] }
    const fora = new Set(ocultar.map(chaveNome))
    const alunos = atual.alunos.filter(n => !fora.has(chaveNome(n)))
    const tem = new Set(alunos.map(chaveNome))
    incluir.forEach(n => { if (!tem.has(chaveNome(n))) alunos.push(n) })
    out[turmaId] = { ...atual, alunos }
  }
  return out
}
