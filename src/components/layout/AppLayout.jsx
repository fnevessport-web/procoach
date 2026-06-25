import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse at 20% 10%, rgba(252,200,37,0.07) 0%, transparent 45%),
        radial-gradient(ellipse at 80% 90%, rgba(67,12,58,0.45) 0%, transparent 55%),
        radial-gradient(ellipse at 50% 50%, rgba(207,27,155,0.04) 0%, transparent 65%),
        #110f0f
      `,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Header />
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '16px 16px 96px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}