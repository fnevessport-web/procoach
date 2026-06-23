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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    }
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
        <AppRouter />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1D27',
              color: '#F0F2F5',
              border: '1px solid #2A2D3E',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#00D4AA', secondary: '#0F1117' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#0F1117' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
