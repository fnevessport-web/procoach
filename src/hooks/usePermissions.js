import useAppStore from '../store/useAppStore'

// 'admin' é o valor histórico gravado no banco para quem hoje seria "gestor" —
// tratado como sinônimo aqui pra não precisar de migração de dado nem mexer na
// constraint do banco (perfis_usuario_role_check já aceita coordenador/financeiro/auxiliar).
const ALIASES_ROLE = { admin: 'gestor' }

const PERMISSOES_POR_ROLE = {
  gestor: {
    podeAcessarCadastros: true,
    podeEditarCadastros: true,
    podeCadastrarAluno: true,
    podeVerTodosSalarios: true,
    podeAcessarFinanceiro: true,
    podeEditarFinanceiro: true,
    podeAcessarKPIs: true,
    podeEditarAulas: true,
    podeEditarPropriaAula: true,
    podeVerInboxGeral: true,
    podeVerSino: true,
    podeVerDisponibilidade: true,
    podeEditarAvaliacaoTecnica: true,
    podeIncluirAlunoAula: true,
    homeRoute: '/',
  },
  financeiro: {
    podeAcessarCadastros: true,
    podeEditarCadastros: false,
    podeCadastrarAluno: false,
    podeVerTodosSalarios: true,
    podeAcessarFinanceiro: true,
    podeEditarFinanceiro: true,
    podeAcessarKPIs: true,
    podeEditarAulas: false,
    podeEditarPropriaAula: false,
    podeVerInboxGeral: false,
    podeVerSino: true,
    podeVerDisponibilidade: true,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: false,
    homeRoute: '/',
  },
  coordenador: {
    podeAcessarCadastros: true,
    podeEditarCadastros: true,
    podeCadastrarAluno: true,
    podeVerTodosSalarios: true,
    podeAcessarFinanceiro: false,
    podeEditarFinanceiro: false,
    podeAcessarKPIs: true,
    podeEditarAulas: true,
    podeEditarPropriaAula: true,
    podeVerInboxGeral: false,
    podeVerSino: true,
    podeVerDisponibilidade: true,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: true,
    homeRoute: '/',
  },
  professor: {
    podeAcessarCadastros: true,
    podeEditarCadastros: false,
    podeCadastrarAluno: true,
    podeVerTodosSalarios: false,
    podeAcessarFinanceiro: false,
    podeEditarFinanceiro: false,
    podeAcessarKPIs: false,
    podeEditarAulas: false,
    podeEditarPropriaAula: true,
    podeVerInboxGeral: false,
    podeVerSino: true,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: false,
    homeRoute: '/dashboard-professor',
  },
  auxiliar: {
    podeAcessarCadastros: false,
    podeEditarCadastros: false,
    podeCadastrarAluno: false,
    podeVerTodosSalarios: false,
    podeAcessarFinanceiro: false,
    podeEditarFinanceiro: false,
    podeAcessarKPIs: false,
    podeEditarAulas: false,
    podeEditarPropriaAula: false,
    podeVerInboxGeral: false,
    podeVerSino: false,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: false,
    homeRoute: '/aulas',
  },
  leitura: {
    podeAcessarCadastros: false,
    podeEditarCadastros: false,
    podeCadastrarAluno: false,
    podeVerTodosSalarios: false,
    podeAcessarFinanceiro: false,
    podeEditarFinanceiro: false,
    podeAcessarKPIs: false,
    podeEditarAulas: false,
    podeEditarPropriaAula: false,
    podeVerInboxGeral: false,
    podeVerSino: false,
    podeVerDisponibilidade: true,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: false,
    homeRoute: '/',
  },
  // Recepção do clube — vê a grade de aulas igual todo mundo, pode incluir aluno na lista de
  // presença e marcar presente/falta (podeIncluirAlunoAula), mas continua sem nenhum acesso
  // administrativo (não edita turma, não move horário, não exclui aula, não substitui
  // professor, sem financeiro/cadastros/KPIs) — só essa fatia específica da grade.
  recepcao: {
    podeAcessarCadastros: false,
    podeEditarCadastros: false,
    podeCadastrarAluno: false,
    podeVerTodosSalarios: false,
    podeAcessarFinanceiro: false,
    podeEditarFinanceiro: false,
    podeAcessarKPIs: false,
    podeEditarAulas: false,
    podeEditarPropriaAula: false,
    podeVerInboxGeral: false,
    podeVerSino: false,
    podeVerDisponibilidade: true,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: true,
    homeRoute: '/aulas',
  },
  // Auxiliar de quadra — contratado só pra tocar a Agenda no dia a dia (chamada/falta dos
  // alunos): edição igual ao coordenador (turma, horário, incluir aluno, presença/falta),
  // mas nunca exclui nada sozinho — excluir aula ou remover aluno pede o PIN combinado com a
  // coordenação (ver precisaPinParaExcluir em AulasCoordenador.jsx). Vê Disponibilidade, mas
  // nada de Cadastros (dados pessoais de aluno/professor), Financeiro nem Relatórios/KPIs.
  // Diferente do role "auxiliar" (fallback de segurança + tablet do balcão, só leitura) —
  // não reaproveita ele pra não afrouxar essa proteção.
  auxiliar_quadra: {
    podeAcessarCadastros: false,
    podeEditarCadastros: false,
    podeCadastrarAluno: false,
    podeVerTodosSalarios: false,
    podeAcessarFinanceiro: false,
    podeEditarFinanceiro: false,
    podeAcessarKPIs: false,
    podeEditarAulas: true,
    podeEditarPropriaAula: false,
    podeVerInboxGeral: false,
    podeVerSino: false,
    podeVerDisponibilidade: true,
    podeEditarAvaliacaoTecnica: false,
    podeIncluirAlunoAula: true,
    precisaPinParaExcluir: true,
    homeRoute: '/aulas',
  },
  // Profissional autônomo assinante (empresas.tipo === 'particular') — dono da própria
  // agenda/prática, isolado do clube (ver App.jsx: rotas do modo Particular nem importam as
  // telas de clube). Cadastros/Avaliação liberados (CadastroParticular.jsx); Financeiro/KPIs
  // ficam false até essas telas existirem de verdade (Fase 3+) — enquanto isso, RouteGuard
  // bloqueia essas rotas de graça (mesmo mecanismo já usado pros outros roles restritos),
  // então não tem como acessar telas de clube nem por URL direta.
  dono_particular: {
    podeAcessarCadastros: true, // só desbloqueia CadastroParticular.jsx — a rota /cadastros
    // do modo Particular (App.jsx, bloco isParticular) nunca importa a CadastrosPage do clube.
    podeEditarCadastros: true,
    podeCadastrarAluno: true,
    podeVerTodosSalarios: false,
    podeAcessarFinanceiro: false, // Fase 3+
    podeEditarFinanceiro: false,
    podeAcessarKPIs: false, // Fase 3+
    podeEditarAulas: true,
    podeEditarPropriaAula: true,
    podeVerInboxGeral: false,
    podeVerSino: false,
    podeVerDisponibilidade: false,
    podeEditarAvaliacaoTecnica: true, // é o único "dono" da própria avaliação, sem coordenação acima
    podeIncluirAlunoAula: false,
    homeRoute: '/',
  },
}

export function resolverRole(roleBruto) {
  const role = roleBruto || 'auxiliar'
  return ALIASES_ROLE[role] || role
}

export function permissoesDoRole(roleBruto) {
  const role = resolverRole(roleBruto)
  return PERMISSOES_POR_ROLE[role] || PERMISSOES_POR_ROLE.auxiliar
}

export function usePermissions() {
  const { perfil, empresaSelecionada } = useAppStore()
  // Role vem da empresa ativa na sessão (usuario_empresas.role); sem empresa selecionada
  // ainda (single-tenant / fase de transição), cai pro role global de perfis_usuario
  const roleBruto = empresaSelecionada?.role || perfil?.role
  const role = resolverRole(roleBruto)
  return { role, ...permissoesDoRole(roleBruto) }
}
