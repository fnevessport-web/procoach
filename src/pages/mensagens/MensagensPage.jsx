import { MessageCircle } from 'lucide-react'

export function MensagensPage() {
  return (
    <div className="fade-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '80px 24px', minHeight: '60vh',
    }}>
      <MessageCircle size={48} color="#fcc825" style={{ opacity: 0.2, marginBottom: '20px' }} />
      <p style={{ fontSize: '14px', color: '#888', fontWeight: '600', margin: '0 0 6px' }}>Mensagens chegando em breve</p>
      <p style={{ fontSize: '12px', color: '#555', margin: 0, maxWidth: '260px', lineHeight: '1.5' }}>
        O sistema de conversas está sendo construído — em breve você poderá falar com o time direto por aqui.
      </p>
    </div>
  )
}
