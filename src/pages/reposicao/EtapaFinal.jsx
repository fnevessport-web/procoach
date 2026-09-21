import { format } from 'date-fns'
import { Camera, CalendarSearch, CalendarX2, CheckCircle2, Gift, MessageCircle, Phone, RotateCcw } from 'lucide-react'
import { WHATSAPP_EXIBIDO, WHATSAPP_LINK, ordenarSlots, usaCreditoIndividualEmGrupo } from './constantes'
import { LinhaAula } from './EtapaConfirmarReposicao'
import { Botao, Cartao, Nota } from './ui'

function BannerPrint() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '14px', boxSizing: 'border-box',
      backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)',
      boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-action-primary) 22%, transparent)',
    }}>
      <span style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'color-mix(in srgb, var(--color-action-on-primary) 18%, transparent)' }}>
        <Camera size={20} />
      </span>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, lineHeight: 1.15 }}>Tire um print desta tela</div>
        <div style={{ fontSize: '12px', lineHeight: 1.4, opacity: 0.92, marginTop: '2px' }}>
          Assim você não esquece os horários e sempre terá acesso aos seus agendamentos.
        </div>
      </div>
    </div>
  )
}

function Secao({ icone, titulo, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-light-muted)', margin: '0 0 6px' }}>
        {icone}{titulo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>{children}</div>
    </div>
  )
}

export function EtapaFinal({ dados, reposicoes, presentes, onNovo, onFinalizar }) {
  const nada = reposicoes.length === 0 && presentes.length === 0
  return (
    <div style={{ animation: 'repoSobe 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-state-success)', marginBottom: '6px' }}>
          {nada ? 'Tudo certo' : 'Agendamento concluído'}
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', lineHeight: 1.2, fontWeight: 700, margin: 0 }}>
          Obrigado, {dados.nome.trim().split(/\s+/)[0]}!
        </h1>
        <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--color-text-light-secondary)', margin: '6px 0 0' }}>
          {nada
            ? 'Registramos as suas informações. Se precisar de qualquer coisa, é só falar com a gente pelo WhatsApp.'
            : 'Confira abaixo e guarde o seu print.'}
        </p>
      </div>

      {!nada && <BannerPrint />}

      {!nada && (
        <Cartao style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderStyle: 'dashed', borderWidth: '2px', padding: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-light-muted)', marginBottom: '2px' }}>Aluno</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{dados.nome.trim()}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-muted)', marginTop: '2px' }}>
              Agendado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
            </div>
          </div>

          {reposicoes.length > 0 && (
            <Secao icone={<RotateCcw size={13} />} titulo={`Reposição de Tênis (${reposicoes.length})`}>
              {ordenarSlots(reposicoes).map(s => <LinhaAula key={s.slot_id} slot={s} compacta aviso={usaCreditoIndividualEmGrupo(dados.turmas, s) ? 'Usa o seu crédito de aula individual' : undefined} />)}
            </Secao>
          )}

          {presentes.length > 0 && (
            <Secao icone={<Gift size={13} />} titulo={`Aulas de presente (${presentes.length})`}>
              {ordenarSlots(presentes).map(s => <LinhaAula key={s.slot_id} slot={s} compacta destaque="color-mix(in srgb, var(--color-brand-lima) 22%, var(--color-surface-light-overlay))" />)}
            </Secao>
          )}
        </Cartao>
      )}

      <Botao onClick={onFinalizar} style={{ padding: '15px' }}><CheckCircle2 size={18} /> Finalizar</Botao>

      {reposicoes.length === 0 && presentes.length > 0 && (
        <Nota cor="var(--color-state-info)" icone={<CalendarSearch size={16} />}>
          <strong>Sobre a sua reposição:</strong> como nenhum horário atendeu, fale com a gente pelo WhatsApp para
          verificarmos os horários da nossa grade regular e encaixarmos você.
        </Nota>
      )}

      {!nada && (
        <Nota cor="var(--color-state-warning)" icone={<CalendarX2 size={16} />}>
          <strong>Não vai poder comparecer?</strong> Pedimos, por gentileza, que nos avise com antecedência.
          Assim conseguimos encaixar outros alunos e atender toda a demanda de reposição.
        </Nota>
      )}

      <Cartao style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
          <Phone size={16} style={{ color: 'var(--color-action-primary)' }} /> Fale com a Procopio
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.01em' }}>{WHATSAPP_EXIBIDO}</div>
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '12px', textDecoration: 'none',
          backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)', fontSize: '14px', fontWeight: 700,
        }}>
          <MessageCircle size={17} /> Chamar no WhatsApp
        </a>
      </Cartao>

      <button type="button" onClick={onNovo} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-light-muted)', textDecoration: 'underline', padding: '6px' }}>
        Agendar para outro aluno
      </button>
    </div>
  )
}
