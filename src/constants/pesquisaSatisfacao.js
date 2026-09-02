// Acesso à aba "Pesquisa" travado num usuário específico (o dono), não no role "gestor" —
// existe uma segunda conta com esse role (George Procópio) que não deve ver essa pesquisa
// em particular. A trava de verdade é a RLS de pesquisas_satisfacao/pesquisa_respostas
// (030_pesquisa_restringe_dono.sql, mesmo user_id abaixo); essa constante só evita a aba
// aparecer no front pra quem o banco já ia bloquear de qualquer forma.
export const USER_ID_DONO_PESQUISA = 'a44110f0-cb53-4555-a6b2-2dfe13f03192'

// Texto de introdução da página pública (/pesquisa/:token) — de propósito NÃO usa as
// palavras "anônima" nem "confidencial": o sistema identifica cada resposta por professor
// (fica na aba dele, dá pra exportar PDF com o nome), então prometer anonimato seria
// enganoso. "Não precisa colocar seu nome" é literalmente verdade (não tem campo de nome
// no formulário) sem prometer o que o sistema não entrega.
export const TEXTO_INTRO_PESQUISA = 'Esta é uma pesquisa de satisfação feita pra nos ajudar a crescer juntos. Você não precisa colocar seu nome — queremos sua visão real, inclusive críticas construtivas e sugestões, que são as mais úteis. Nada aqui será usado contra ninguém; o objetivo é melhorar o ambiente e a operação pra todos. Nas perguntas com estrelas, 1 estrela é a nota mais baixa e 5 estrelas é a nota mais alta. Seja franco, é isso que faz valer a pena.'

// Perguntas da Pesquisa de Satisfação dos professores — usadas tanto na página pública
// (/pesquisa/:token, onde o professor responde) quanto na aba "Pesquisa" do cadastro
// (onde o gestor lê as respostas), pra combinar pergunta+resposta pelo mesmo `id`.
// Tipos: 'estrelas' (1-5, obrigatória), 'nps' (0-10, obrigatória), 'texto' (livre, opcional).
export const PERGUNTAS_PESQUISA_SATISFACAO = [
  { id: 'p1', tipo: 'estrelas', texto: 'Meu trabalho é reconhecido e valorizado.' },
  { id: 'p2', tipo: 'estrelas', texto: 'Sinto que pertenço a um time, não que sou só um prestador de serviço.' },
  { id: 'p3', tipo: 'nps', texto: 'De 0 a 10, o quanto você recomendaria trabalhar aqui a um amigo?' },
  { id: 'p4', tipo: 'texto', texto: 'Qual o principal motivo da sua nota?' },
  { id: 'p5', tipo: 'estrelas', texto: 'Recebo o suporte que preciso da gestão no dia a dia.' },
  { id: 'p6', tipo: 'estrelas', texto: 'Consigo levar problemas e sugestões sem receio de retaliação.' },
  { id: 'p7', tipo: 'estrelas', texto: 'Recebo retorno sobre meu trabalho com regularidade.' },
  { id: 'p8', tipo: 'estrelas', texto: 'A coordenação técnica (os Head Coaches) me dá o apoio técnico e pedagógico que preciso.' },
  { id: 'p9', tipo: 'estrelas', texto: 'Tenho o material necessário para dar boas aulas.' },
  { id: 'p10', tipo: 'estrelas', texto: 'Os processos do dia a dia (reposição, faltas, avisos) funcionam bem.' },
  { id: 'p11', tipo: 'estrelas', texto: 'Tenho oportunidades de aprender e crescer aqui.' },
  { id: 'p12', tipo: 'estrelas', texto: 'Recebo incentivo para me capacitar (cursos, clínicas).' },
  { id: 'p13', tipo: 'texto', texto: 'Se você assumisse a operação amanhã, qual seria a primeira coisa que mudaria?' },
  { id: 'p14', tipo: 'texto', texto: 'Que decisão você acha que a gestão hesita em tomar e já deveria ter tomado?' },
  { id: 'p15', tipo: 'texto', texto: 'Se você detectar turmas deficitárias, como você resolveria o problema? (lembrando que você está dentro de um clube, seguindo regras do clube — não existe hipótese de aumento de valor na mensalidade)' },
  { id: 'p16', tipo: 'texto', texto: 'Espaço aberto para qualquer sugestão, crítica ou ideia.' },
]
