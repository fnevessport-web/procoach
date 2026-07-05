import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        <Header />
        <main className="app-main">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
