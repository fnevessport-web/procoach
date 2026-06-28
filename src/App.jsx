import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { PageLoading } from './components/ui/Loading'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { HomePage } from './pages/home/HomePage'
import { AulasPage } from './pages/aulas/AulasPage'
import { CadastrosPage } from './pages/cadastros/CadastrosPage'
import { FinanceiroPage } from './pages/financeiro/FinanceiroPage'
import { KPIsPage } from './pages/kpis/KPIsPage'
import { InstallBanner } from './components/ui/InstallBanner'
import { DisponibilidadePage } from './pages/disponibilidade/DisponibilidadePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 }
  }
})

function AppRouter() {
  const { user, perfil, loading } = useAuth()

  if (loading) return <PageLoading />
  if (!user) return <LoginPage />

  const role = perfil?.role || 'professor'

  return (
    <AppLayout>
      <InstallBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/aulas" element={<AulasPage />} />
        {(role === 'admin' || role === 'coordenador') && (
          <>
            <Route path="/cadastros" element={<CadastrosPage />} />
            <Route path="/cadastros/professores" element={<CadastrosPage />} />
            <Route path="/cadastros/alunos" element={<CadastrosPage />} />
            <Route path="/cadastros/turmas" element={<CadastrosPage />} />
            <Route path="/kpis" element={<KPIsPage />} />
          </>
        )}
        {role === 'admin' && (
          <Route path="/financeiro" element={<FinanceiroPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
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