import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('Erro não tratado:', erro, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <div style={{
          minHeight: '100vh', width: '100%', backgroundColor: 'var(--color-surface-dark-base)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center', boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-dark-primary)', margin: '0 0 8px' }}>
            Algo deu errado
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', margin: '0 0 20px', maxWidth: '320px' }}>
            {this.state.erro?.message || 'Erro inesperado ao carregar a página.'}
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: '12px 24px', borderRadius: '12px', border: 'none',
            background: 'var(--color-action-primary)', color: 'white',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          }}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
