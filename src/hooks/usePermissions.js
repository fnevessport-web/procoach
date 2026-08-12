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
