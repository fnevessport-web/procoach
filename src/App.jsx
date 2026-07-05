import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { usePermissions } from './hooks/usePermissions'
import { PageLoading } from './components/ui/Loading'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { HomePage } from './pages/home/HomePage'
import { ModalidadePage } from './pages/modalidades/ModalidadePage'
import { AulasPage } from './pages/aulas/AulasPage'
import { CadastrosPage } from './pages/cadastros/CadastrosPage'
import { FinanceiroPage } from './pages/financeiro/FinanceiroPage'
import { KPIsPage } from './pages/kpis/KPIsPage'
import { MensagensPage } from './pages/mensagens/MensagensPage'
import { InstallBanner } from './components/ui/InstallBanner'
import { DisponibilidadePage } from './pages/disponibilidade/DisponibilidadePage'

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
  const permissoes = usePermissions()

  if (loading) return <PageLoading />
  if (!user) return <LoginPage />

  const { homeRoute, podeAcessarCadastros, podeAcessarFinanceiro, podeAcessarKPIs } = permissoes

  return (
    <AppLayout>
      <InstallBanner />
      <Routes>
        <Route path="/" element={homeRoute === '/' ? <HomePage /> : <Navigate to={homeRoute} replace />} />
        <Route path="/modalidade/:nomeModalidade" element={
          <RouteGuard permitido={homeRoute === '/'} homeRoute={homeRoute}><ModalidadePage /></RouteGuard>
        } />
        <Route path="/aulas" element={<AulasPage />} />
        <Route path="/mensagens" element={<MensagensPage />} />
        <Route path="/cadastros" element={
          <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
        } />
        <Route path="/cadastros/professores" element={
          <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
        } />
        <Route path="/cadastros/alunos" element={
          <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
        } />
        <Route path="/cadastros/turmas" element={
          <RouteGuard permitido={podeAcessarCadastros} homeRoute={homeRoute}><CadastrosPage /></RouteGuard>
        } />
        <Route path="/kpis" element={
          <RouteGuard permitido={podeAcessarKPIs} homeRoute={homeRoute}><KPIsPage /></RouteGuard>
        } />
        <Route path="/financeiro" element={
          <RouteGuard permitido={podeAcessarFinanceiro} homeRoute={homeRoute}><FinanceiroPage /></RouteGuard>
        } />
        <Route path="*" element={<Navigate to={homeRoute} replace />} />
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
          {/* App com autenticação */}
          <Route path="/*" element={<AppRouter />} />
        </Routes>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#F0F2F5',
              border: '1px solid rgba(252,200,37,0.3)',
              borderRadius: '10px',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1a1a1a' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#1a1a1a' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}