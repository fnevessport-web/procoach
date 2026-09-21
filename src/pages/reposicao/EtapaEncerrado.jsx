import { CheckCircle2 } from 'lucide-react'
import { WHATSAPP_EXIBIDO, WHATSAPP_LINK } from './constantes'

// Última tela, depois de "Finalizar": agradecimento e confirmação de que as aulas foram agendadas.
export function EtapaEncerrado({ dados, reposicoes, presentes, onNovo }) {
  const nada = reposicoes.length === 0 && presentes.length === 0
  const primeiroNome = dados.nome.trim().split(/\s+/)[0]
  return (
    <div style={{ animation: 'repoSobe 0.3s ease-out', textAlign: 'center', padding: '28px 4px 0' }}>
      <div style={{
        width: '84px', height: '84px', borderRadius: '50%', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-state-success)', backgroundColor: 'color-mix(in srgb, var(--color-state-success) 14%, transparent)',
      }}>
        <CheckCircle2 size={46} />
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', lineHeight: 1.2, fontWeight: 700, margin: '0 0 10px' }}>
        {nada ? 'Tudo certo!' : 'Aulas agendadas!'}
      </h1>
      <p style={{ fontSize: '16px', lineHeight: 1.65, color: 'var(--color-text-light-secondary)', margin: '0 0 6px' }}>
        {nada
          ? `Obrigado, ${primeiroNome}! Registramos as suas informações.`
          : `Obrigado, ${primeiroNome}! As suas aulas foram agendadas com sucesso.`}
      </p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--color-action-primary)', margin: '0 0 26px' }}>
        {nada ? 'A Procopio agradece o seu contato.' : 'Nos vemos em quadra!'}
      </p>

      {!nada && (
        <div style={{
          textAlign: 'left', padding: '14px 16px', borderRadius: '14px', marginBottom: '14px', boxSizing: 'border-box', fontSize: '13px', lineHeight: 1.65,
          backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-light-secondary)',
        }}>
          Caso não possa comparecer, pedimos que nos avise pelo WhatsApp{' '}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-action-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {WHATSAPP_EXIBIDO}
          </a>
          , assim conseguimos encaixar outros alunos.
        </div>
      )}

      <div style={{ fontSize: '13px', color: 'var(--color-text-light-muted)', marginBottom: '18px' }}>Você já pode fechar esta página.</div>

      <button type="button" onClick={onNovo} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-light-muted)', textDecoration: 'underline', padding: '6px' }}>
        Agendar para outro aluno
      </button>
    </div>
  )
}
