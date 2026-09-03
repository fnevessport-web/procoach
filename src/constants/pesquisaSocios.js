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

// Nome completo (cadastro) fica só pra achar o registro certo no banco — mostrar o nome
// inteiro do professor pro sócio que vai responder (ou pra diretoria no relatório) pareceu
// invasivo demais, então a EXIBIÇÃO usa o nome curto pelo qual a pessoa é conhecida no dia a
// dia (primeiro nome + um sobrenome — os mesmos nomes usados originalmente pra pedir essa
// pesquisa, antes de eu descobrir o nome completo de cada um no cadastro). Não mexe no
// cadastro de professores em si, só troca o texto mostrado dentro da pesquisa de sócios.
const NOME_EXIBICAO_POR_NOME_COMPLETO = {
  'Bruno Borges da Silva': 'Bruno Borges',
  'Bruno Nunes Ferreira Nascimento': 'Bruno Nunes',
  'Charles de Melo Silva': 'Charles Melo',
  'Douglas Paixão Prier de Saone': 'Douglas Paixão',
  'Eric Jun Domiciano Higashi': 'Eric Jun',
  'João Vitor Martins de França': 'João França',
  'Kelly Gomes Rodrigues': 'Kelly Gomes',
  'Lucas Miguel': 'Lucas Miguel',
  'Marcelo Ribeiro Rocha': 'Marcelo Rocha',
  'Marcelo Villalobo Faria': 'Marcelo Villalobo',
  'Nayara Santos': 'Nayara Santos',
  'Tiago Guedes': 'Tiago Guedes',
  'Wendel Anjos': 'Wendel Anjos',
}
export function nomeExibicaoProfessor(nomeCompleto) {
  return NOME_EXIBICAO_POR_NOME_COMPLETO[nomeCompleto] || nomeCompleto
}

export const TEXTO_INTRO_PESQUISA_SOCIOS = 'Olá, associado! A Procópio, empresa responsável pela operação das aulas de tênis do Beyond, quer muito ouvir você. Nosso objetivo é entregar uma experiência cada vez melhor, mais profissional e à altura do que você merece, e ninguém melhor do que você, que vive as aulas na prática, para nos dizer o que está funcionando e o que podemos melhorar. Esta é uma pesquisa sem identificação, você não precisa colocar seu nome. Leva pouquíssimos minutos. Obrigado por construirmos juntos um tênis cada vez melhor dentro do Beyond the Club.'

// "outro associado", não "amigo ou familiar" — só sócio pode fazer aula no Beyond, amigo/
// familiar de fora não tem como se inscrever, então recomendar pra eles não faz sentido
// nesse contexto (pedido explícito depois do primeiro teste real).
export const TEXTO_PERGUNTA_NPS = 'De 0 a 10, o quanto você recomendaria as aulas de tênis do Beyond a outro associado?'
export const TEXTO_PERGUNTA_MOTIVO_NPS = 'O que motivou a sua nota?'
export const TEXTO_PERGUNTA_PROFESSORES = 'Com quais professores você já teve aula?'

// Opção extra na lista de professores pra quem teve aula mas não lembra com quem — poucos
// casos, mas sem essa opção a pessoa ou inventava um nome ou pulava a avaliação inteira.
// `id` é uma string fixa (não é UUID de professor de verdade) só pra funcionar como chave
// nos mesmos lugares que um professor_id funcionaria (professores_ids[], avaliacoes.<id>);
// nunca é gravado na tabela `professores`.
export const ID_PROFESSOR_NAO_LEMBRO = 'nao-lembro-nome'
export const NOME_PROFESSOR_NAO_LEMBRO = 'Não lembro o nome'

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
