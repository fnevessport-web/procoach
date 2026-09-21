import { CalendarSearch, ChevronLeft, Gift, MessageCircle } from 'lucide-react'
import { WHATSAPP_EXIBIDO, WHATSAPP_LINK_SEM_HORARIO } from './constantes'
import { Titulo, Cartao, Botao, BarraInferior } from './ui'

// Aparece quando a pessoa diz que nenhum horário de reposição atende: antes de levá-la ao
// presente, explica que a reposição dela não se perde e que ela deve falar com a Procopio pra
// conferirmos os horários da grade regular.
export function EtapaSemHorario({ onVoltar, onContinuar }) {
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <button type="button" onClick={onVoltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, marginBottom: '12px' }}>
        <ChevronLeft size={16} /> Voltar aos horários
      </button>

      <Titulo kicker="Antes de continuar" sub="Se nenhum dos horários de reposição se encaixou na sua rotina, tudo bem — a sua reposição não se perde.">
        Nenhum horário atendeu?
      </Titulo>

      <Cartao style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <CalendarSearch size={22} style={{ color: 'var(--color-action-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)' }}>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: 'var(--color-text-light-primary)' }}>Entre em contato com a nossa equipe</strong> para
              verificarmos, juntos, os horários que já existem na nossa grade regular. Você pode consultar as
              vagas dessas turmas no <strong style={{ color: 'var(--color-text-light-primary)' }}>app do Beyond</strong>; o
              agendamento é confirmado direto com a Procopio, pelo WhatsApp. Assim conseguimos encaixar você e fazer a sua reposição.
            </p>
            <p style={{ margin: 0 }}>
              O contato é pelo WhatsApp <strong style={{ color: 'var(--color-text-light-primary)', whiteSpace: 'nowrap' }}>{WHATSAPP_EXIBIDO}</strong>.
            </p>
          </div>
        </div>
        <a href={WHATSAPP_LINK_SEM_HORARIO} target="_blank" rel="noopener noreferrer" style={{
          marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '12px', textDecoration: 'none',
          backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)', fontSize: '14px', fontWeight: 700,
        }}>
          <MessageCircle size={17} /> Falar com a Procopio agora
        </a>
      </Cartao>

      <div style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--color-text-light-secondary)' }}>
        Você também pode continuar agora e escolher o seu <strong style={{ color: 'var(--color-text-light-primary)' }}>presente</strong>: 1 aula gratuita em cada uma das outras modalidades.
      </div>

      <BarraInferior>
        <Botao onClick={onContinuar}><Gift size={17} /> Entendi, quero escolher meu presente</Botao>
      </BarraInferior>
    </div>
  )
}
