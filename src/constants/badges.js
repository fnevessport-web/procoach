// Badges de conquista do aluno — rótulos/ícones exibidos no Card do Aluno. As regras de
// CONCESSÃO automática (quando cada badge é dado) ainda vivem em useAlunos.js
// (verificarEConcederBadges) pros 4 tipos originais; os tipos técnicos (evolução de PC
// Score, dimensão em nível avançado etc.) chegam aqui junto com as regras que os concedem
// numa entrega futura — a trava fixa de tipo_badge no banco já foi solta (migração 009)
// exatamente pra essa lista crescer sem precisar de migração nova a cada badge.
export const BADGES = {
  primeira_aula: { emoji: '🎉', label: 'Primeira aula' },
  '10_aulas': { emoji: '🔟', label: '10 aulas' },
  evoluiu_nivel: { emoji: '📈', label: 'Evoluiu de nível' },
  '3_meses_sem_falta': { emoji: '🏆', label: '3 meses sem falta' },
}
