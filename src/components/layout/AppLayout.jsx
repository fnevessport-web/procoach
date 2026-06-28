import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      backgroundImage: 'url(/images/bg-texture.png)',
      backgroundSize: 'cover', backgroundAttachment: 'fixed',
      backgroundPosition: 'center',
    }}>
      <Header />
      <main style={{
        flex: 1, paddingBottom: '96px',
        maxWidth: '480px', width: '100%', margin: '0 auto',
        padding: '0 16px 96px',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}