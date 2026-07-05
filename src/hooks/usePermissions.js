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
    homeRoute: '/aulas', // "Início" do professor é a grade do dia (AulasProfessor)
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
  const { perfil } = useAppStore()
  const role = resolverRole(perfil?.role)
  return { role, ...permissoesDoRole(perfil?.role) }
}
