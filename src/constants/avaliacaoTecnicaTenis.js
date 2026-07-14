// Textos de apoio da avaliação técnica de Tênis (5 domínios, 19 subitens, nota 1-10 — ver
// migração 016). Ficam como constante em vez de coluna no banco: são texto de referência
// fixo (não dado de avaliação), então ajustar uma frase não deveria exigir migração nenhuma.
// As chaves batem com modalidade_dimensoes.chave.

// Mesma régua 1-10 pra todos os subitens — não muda de um pro outro, só o texto de cada
// subitem muda (DESCRICOES_SUBITENS_TENIS, abaixo).
export const FAIXAS_REFERENCIA_1_10 = [
  { chave: 'base', label: 'Base', faixa: '1-3', descricao: 'Fundamento em construção.' },
  { chave: 'dominio', label: 'Domínio', faixa: '4-6', descricao: 'Execução consistente, ainda com variação.' },
  { chave: 'precisao', label: 'Precisão', faixa: '7-8', descricao: 'Sólido na maioria das situações, inclusive sob pressão.' },
  { chave: 'elite', label: 'Elite', faixa: '9-10', descricao: 'Referência técnica, executa com excelência mesmo sob pressão.' },
]

export const DESCRICOES_SUBITENS_TENIS = {
  saque_empunhadura: 'Avalia se o aluno segura a raquete de forma adequada ao tipo de saque que está executando (contínua, oriental, etc.), permitindo gerar efeito e potência com eficiência.',
  saque_biomecanica: 'Avalia a mecânica do movimento como um todo: lançamento de bola, rotação de tronco e ombros, extensão do braço e transferência de peso — a "engrenagem" completa do golpe.',
  saque_efeitos: 'Avalia a capacidade de imprimir efeito na bola (slice, kick, plano), variando a trajetória e dificultando a devolução do adversário.',
  saque_direcao: 'Avalia a precisão em colocar o saque no alvo pretendido dentro do quadrado de serviço (aberto, corpo, T).',
  saque_potencia: 'Avalia a velocidade e força imprimidas na bola, sempre equilibrada com controle e consistência.',

  fundo_tecnica: 'Avalia a execução dos golpes de fundo de quadra (direita e esquerda): preparação, contato com a bola e finalização do movimento.',
  fundo_direcao: 'Avalia a capacidade de direcionar a bola para o local pretendido, tanto em bolas cruzadas quanto paralelas.',
  fundo_profundidade: 'Avalia a capacidade de jogar a bola próxima à linha de fundo do adversário, dificultando o ataque dele e ganhando tempo de reação.',
  fundo_potencia: 'Avalia a força aplicada aos golpes de fundo, mantendo controle e sem comprometer a consistência.',
  fundo_movimentacao: 'Avalia o deslocamento em quadra durante a troca de bola: recuperação da posição central, ajuste de pés antes do golpe e ocupação inteligente do espaço.',

  rede_tecnica: 'Avalia a postura, empunhadura e execução geral dos fundamentos de rede, incluindo aproximação e posicionamento antes do golpe.',
  rede_voleios: 'Avalia a execução dos voleios de direita e esquerda: controle do bloqueio da bola, direção e definição do ponto.',
  rede_smash: 'Avalia a execução do golpe aéreo de finalização: posicionamento sob a bola, timing e potência no fechamento do ponto.',

  tatica_decisao: 'Avalia a escolha da jogada mais adequada para cada situação do ponto (atacar, defender, construir), considerando o contexto da partida.',
  tatica_leitura: 'Avalia a capacidade de identificar o instante certo para agir — perceber quando atacar, quando recuar, quando arriscar ou quando apenas manter a bola em jogo.',
  tatica_adaptacao: 'Avalia a capacidade de ajustar o plano de jogo durante a partida, conforme o padrão do adversário, o placar e as circunstâncias momentâneas.',

  condicionamento_resistencia: 'Avalia a capacidade de manter o nível de rendimento físico e técnico ao longo de toda a aula ou partida, sem queda de desempenho.',
  condicionamento_velocidade: 'Avalia a rapidez de deslocamento até a bola e a capacidade de mudar de direção e recuperar a posição em quadra.',
  condicionamento_forca: 'Avalia a capacidade de gerar força nos golpes e nos deslocamentos, sustentando a intensidade do jogo.',
}
