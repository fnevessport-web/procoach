// Pesquisa de satisfação de sócios/alunos — avaliam a experiência das aulas de tênis do
// Beyond the Club e os professores individualmente. Conteúdo fixo (mesma pesquisa em toda
// campanha criada em Cadastros > Pesquisa); só nome/data da campanha variam.

// Só estes 13 professores entram na pesquisa — lista fechada, pedida explicitamente (nem
// todo professor cadastrado no ProCoach dá aula de tênis do Beyond). Busca no banco é por
// nome exato via RPC listar_professores_pesquisa_socios — por isso aqui é o nome COMPLETO
// cadastrado no ProCoach (conferido direto no banco), não o nome curto usado na conversa:
// "Bruno Nunes" -> "Bruno Nunes Ferreira Nascimento", "Charles Melo" -> "Charles de Melo
// Silva", etc. Mesma convenção usada no resto do app (Home, aulas...), que sempre mostra o
// nome completo cadastrado, nunca uma versão abreviada.
export const NOMES_PROFESSORES_PESQUISA_SOCIOS = [
  'Bruno Borges da Silva', 'Bruno Nunes Ferreira Nascimento', 'Charles de Melo Silva',
  'Douglas Paixão Prier de Saone', 'Eric Jun Domiciano Higashi', 'João Vitor Martins de França',
  'Kelly Gomes Rodrigues', 'Lucas Miguel', 'Marcelo Ribeiro Rocha', 'Marcelo Villalobo Faria',
  'Nayara Santos', 'Tiago Guedes', 'Wendel Anjos',
]

export const TEXTO_INTRO_PESQUISA_SOCIOS = 'Olá, associado! A Procópio, empresa responsável pela operação das aulas de tênis do Beyond, quer muito ouvir você. Nosso objetivo é entregar uma experiência cada vez melhor, mais profissional e à altura do que você merece, e ninguém melhor do que você, que vive as aulas na prática, para nos dizer o que está funcionando e o que podemos melhorar. Esta é uma pesquisa sem identificação, você não precisa colocar seu nome. Leva pouquíssimos minutos. Obrigado por construirmos juntos um tênis cada vez melhor dentro do Beyond the Club.'

export const TEXTO_PERGUNTA_NPS = 'De 0 a 10, o quanto você recomendaria as aulas de tênis do Beyond a um amigo ou familiar?'
export const TEXTO_PERGUNTA_MOTIVO_NPS = 'O que motivou a sua nota?'
export const TEXTO_PERGUNTA_PROFESSORES = 'Com quais professores você já teve aula?'

// As 5 perguntas repetidas pra cada professor selecionado — chave usada dentro de
// `avaliacoes.<professor_id>` no JSONB de resposta (ver salvar_resposta_pesquisa_socios).
export const PERGUNTAS_POR_PROFESSOR = [
  { chave: 'nota_tecnica', texto: 'Qualidade técnica das aulas' },
  { chave: 'nota_didatica', texto: 'Didática e dinâmica do professor' },
  { chave: 'nota_pontualidade', texto: 'Pontualidade ao iniciar e encerrar a aula' },
  { chave: 'nota_respeito', texto: 'Respeito, empatia e atenção individual' },
  { chave: 'nota_evolucao', texto: 'Sinto que evoluí no meu tênis com este professor' },
]
export const TEXTO_COMENTARIO_PROFESSOR = 'Experiência, elogios, críticas e sugestões sobre este professor (opcional)'

export const TEXTO_PERGUNTA_FINAL = 'Deixe aqui qualquer comentário, sugestão ou observação sobre o tênis do Beyond que não foi coberto acima (opcional).'
