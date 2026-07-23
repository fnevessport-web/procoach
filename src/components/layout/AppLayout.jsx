import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { temaDaRota } from '../../constants/temaPorRota'

export function AppLayout({ children }) {
  const { pathname } = useLocation()

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        <Header />
        <main className={`app-main ${temaDaRota(pathname)}`}>
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
