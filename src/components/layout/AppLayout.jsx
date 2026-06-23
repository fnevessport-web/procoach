import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0F1117]">
      <Header />
      <main className="flex-1 pb-24 max-w-5xl w-full mx-auto px-4 py-5">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
