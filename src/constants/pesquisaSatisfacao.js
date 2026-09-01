// Perguntas da Pesquisa de Satisfação dos professores — usadas tanto na página pública
// (/pesquisa/:token, onde o professor responde) quanto na aba "Pesquisa" do cadastro
// (onde o gestor lê as respostas), pra combinar pergunta+resposta pelo mesmo `id`.
//
// PLACEHOLDER: ainda não recebi as perguntas reais — essas 5 abaixo são só pra deixar o
// fluxo inteiro funcionando de ponta a ponta (link, envio, leitura) enquanto isso. Trocar
// esse array pelas perguntas de verdade é a única mudança necessária depois.
// Acesso à aba "Pesquisa" travado num usuário específico (o dono), não no role "gestor" —
// existe uma segunda conta com esse role (George Procópio) que não deve ver essa pesquisa
// em particular. A trava de verdade é a RLS de pesquisas_satisfacao/pesquisa_respostas
// (030_pesquisa_restringe_dono.sql, mesmo user_id abaixo); essa constante só evita a aba
// aparecer no front pra quem o banco já ia bloquear de qualquer forma.
export const USER_ID_DONO_PESQUISA = 'a44110f0-cb53-4555-a6b2-2dfe13f03192'

export const PERGUNTAS_PESQUISA_SATISFACAO = [
  { id: 'p1', tipo: 'estrelas', texto: 'De 1 a 5, o quanto você está satisfeito(a) em trabalhar na ProCoach?' },
  { id: 'p2', tipo: 'estrelas', texto: 'De 1 a 5, como você avalia a comunicação com a coordenação?' },
  { id: 'p3', tipo: 'estrelas', texto: 'De 1 a 5, como você avalia a organização da grade de horários?' },
  { id: 'p4', tipo: 'texto', texto: 'O que poderia melhorar na sua experiência como professor aqui?' },
  { id: 'p5', tipo: 'texto', texto: 'Algum comentário adicional?' },
]
