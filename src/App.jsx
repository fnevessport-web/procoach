import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { usePermissions } from './hooks/usePermissions'
import { useMinhasEmpresas } from './hooks/useEmpresas'
import useAppStore from './store/useAppStore'
import { PageLoading } from './components/ui/Loading'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { EsqueciSenha } from './pages/auth/EsqueciSenha'
import { TrocarSenha } from './pages/auth/TrocarSenha'
import { SelecionarEmpresaPage } from './pages/auth/SelecionarEmpresaPage'
import { HomePage } from './pages/home/HomePage'
import { HomeLeitura } from './pages/home/HomeLeitura'
import { ModalidadePage } from './pages/modalidades/ModalidadePage'
import { AulasPage } from './pages/aulas/AulasPage'
import { CadastrosPage } from './pages/cadastros/CadastrosPage'
import { AlunoCardPage } from './pages/cadastros/AlunoCardPage'
import { AgendaAluno } from './pages/aluno/AgendaAluno'
import { FinanceiroPage } from './pages/financeiro/FinanceiroPage'
import { KPIsPage } from './pages/kpis/KPIsPage'
import { RelatoriosLeituraPage } from './pages/kpis/RelatoriosLeituraPage'
import { MensagensPage } from './pages/mensagens/MensagensPage'
import { DashboardProfessor } from './pages/professor/DashboardProfessor'
import { MeuPerfilProfessor } from './pages/professor/MeuPerfilProfessor'
import { MeuFinanceiroProfessor } from './pages/professor/MeuFinanceiroProfessor'
import { MeusAlunosProfessor } from './pages/professor/MeusAlunosProfessor'
import { AvaliarAluno } from './pages/professor/AvaliarAluno'
import { RankingPage } from './pages/ranking/RankingPage'
import { ModalTurmaAtivada } from './components/ModalTurmaAtivada'
import { InstallBanner } from './components/ui/InstallBanner'
import { DisponibilidadePage } from './pages/disponibilidade/DisponibilidadePage'
import { DisponibilidadeTurmasPage } from './pages/disponibilidade/DisponibilidadeTurmasPage'
import { EventoInscricaoPage } from './pages/eventos/EventoInscricaoPage'
import { PoliticaPrivacidadePage } from './pages/legal/PoliticaPrivacidadePage'
import { ComoFuncionaAPontuacaoPage } from './pages/legal/ComoFuncionaAPontuacaoPage'
import { ComoFuncionaORankingPage } from './pages/legal/ComoFuncionaORankingPage'
import { HomeParticular } from './pages/particular/HomeParticular'
import { AgendaParticular } from './pages/particular/AgendaParticular'
import { CadastroParticular } from './pages/particular/CadastroParticular'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 }
  }
})

// Rota protegida: se o role atual não tem a flag exigida, avisa e manda pra home do próprio role
function RouteGuard({ permitido, homeRoute, children }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!permitido) {
      toast.error('Acesso não permitido')
      navigate(homeRoute, { replace: true })
    }
  }, [permitido, homeRoute])

  if (!permitido) return null
  return children
}

function AppRouter() {
  const { user, perfil, loading } = useAuth()
  const { empresaSelecionada, setEmpresaSelecionada, sessaoRecuperacao } = useAppStore()
  const { data: empresas = [], isLoading: loadingEmpresas } = useMinhasEmpresas(user?.id)
  const permissoes = usePermissions()

  // Só uma empresa vinculada: entra direto nela, sem tela de escolha
  useEffect(() => {
    if (!empresaSelecionada && empresas.length === 1) {
      setEmpresaSelecionada(empresas[0])
    }
  }, [empresas, empresaSelecionada])

  if (loading) return <PageLoading />
  if (!user) return <LoginPage />

  // Primeiro acesso (ou sessão vinda de link de recuperação de senha): troca obrigatória antes de qualquer outra tela
  if (perfil?.primeiro_acesso || sessaoRecuperacao) return <TrocarSenha />

  if (loadingEmpresas) return <PageLoading />

  // Duas ou mais empresas vinculadas: precisa escolher antes de entrar no app
  if (empresas.length > 1 && !empresaSelecionada) {
    return <SelecionarEmpresaPage empresas={empresas} onSelecionar={setEmpresaSelecionada} />
  }

  const { role, homeRoute, podeAcessarCadastros, podeAcessarFinanceiro, podeAcessarKPIs, podeVerDisponibilidade } = permissoes
  // Conta Particular (profissional autônomo assinante) — universo de rotas totalmente à parte
  // do clube, nunca importa AulasPage/AulasCoordenador nem nenhuma outra tela de Procópio/Beach
  // Arena/Beyond. Ver src/pages/particular/.
  const isParticular = empresaSelecionada?.tipo === 'particular'

  return (
    <AppLayout>
      {!isParticular && <ModalTurmaAtivada />}
      <InstallBanner />
      <Routes>
        {isParticular ? (
          <>
            <Route path="/" element={<HomeParticular />} />
            <Route path="/aulas" element={<AgendaParticular />} />
            <Route path="/cadastros" element={<CadastroParticular />} />
            {/* AvaliarAluno é o mesmo componente do clube (src/pages/professor/AvaliarAluno.jsx)
                — seguro de reaproveitar aqui porque CadastroParticular sempre navega já com
                alunoId/modalidadeId em location.state, então a busca de aluno do clube (sem
                escopo de empresa) nunca chega a renderizar numa sessão Particular. */}
            <Route path="/avaliar-aluno" element={<AvaliarAluno />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={
              homeRoute !== '/' ? <Navigate to={homeRoute} replace /> : role === 'leitura' ? <HomeLeitura /> : <HomePage />
            } />
            <Route path="/modalidade/:nomeModalidade" element={
              <RouteGuard permitido={homeRoute === '/'} homeRoute={homeRoute}><ModalidadePage /></RouteGuard>
            } />
            <Route path="/aulas" element={<AulasPage />} />
            <Route path="/dashboard-professor" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><DashboardProfessor /></RouteGuard>
            } />
            <Route path="/meu-perfil" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><MeuPerfilProfessor /></RouteGuard>
            } />
            <Route path="/meu-financeiro" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><MeuFinanceiroProfessor /></RouteGuard>
            } />
            <Route path="/meus-alunos" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><MeusAlunosProfessor /></RouteGuard>
            } />
            <Route path="/avaliar-aluno" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><AvaliarAluno /></RouteGuard>
            } />
            <Route path="/mensagens" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><MensagensPage /></RouteGuard>
            } />
            <Route path="/ranking" element={
              <RouteGuard permitido={role !== 'leitura'} homeRoute={homeRoute}><RankingPage /></RouteGuard>
            } />
            <Route path="/cadastros" element={
              <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
            } />
            <Route path="/cadastros/professores" element={
              <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
            } />
            <Route path="/cadastros/alunos" element={
              <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
            } />
            <Route path="/cadastros/alunos/:id" element={
              <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><AlunoCardPage /></RouteGuard>
            } />
            <Route path="/cadastros/turmas" element={
              <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
            } />
            <Route path="/agenda-aluno" element={
              <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><AgendaAluno /></RouteGuard>
            } />
            <Route path="/kpis" element={
              <RouteGuard permitido={podeAcessarKPIs} homeRoute={homeRoute}><KPIsPage /></RouteGuard>
            } />
            <Route path="/relatorios-leitura" element={
              <RouteGuard permitido={role === 'leitura' || role === 'recepcao'} homeRoute={homeRoute}><RelatoriosLeituraPage /></RouteGuard>
            } />
            <Route path="/disponibilidade-turmas" element={
              <RouteGuard permitido={podeVerDisponibilidade} homeRoute={homeRoute}><DisponibilidadeTurmasPage /></RouteGuard>
            } />
            <Route path="/financeiro" element={
              <RouteGuard permitido={podeAcessarFinanceiro} homeRoute={homeRoute}><FinanceiroPage /></RouteGuard>
            } />
            <Route path="*" element={<Navigate to={homeRoute} replace />} />
          </>
        )}
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rota pública — sem login */}
          <Route path="/disponibilidade/:token" element={<DisponibilidadePage />} />
          <Route path="/eventos/:slug" element={<EventoInscricaoPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
          <Route path="/pontuacao" element={<ComoFuncionaAPontuacaoPage />} />
          <Route path="/regras-ranking" element={<ComoFuncionaORankingPage />} />
          {/* App com autenticação */}
          <Route path="/*" element={<AppRouter />} />
        </Routes>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--color-surface-dark-raised)',
              color: 'var(--color-text-dark-primary)',
              border: '1px solid rgba(165,76,46,0.3)',
              borderRadius: '10px',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: 'var(--color-state-success)', secondary: 'var(--color-surface-dark-raised)' } },
            error: { iconTheme: { primary: 'var(--color-state-danger)', secondary: 'var(--color-surface-dark-raised)' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}