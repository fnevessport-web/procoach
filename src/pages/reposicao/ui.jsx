import { useEffect, useRef } from 'react'
import { CalendarDays, Check, Clock, MapPin, User } from 'lucide-react'
import { estadoVagas, faixaHorario, rotuloDiaLongo, rotuloNivel, nomeProfessor, COR_ADULTO, COR_KIDS } from './constantes'

// Página pública, contexto Claro (ver CLAUDE.md) — tokens -light-* direto. Como html/body do app
// têm overflow:hidden global, a tela precisa do próprio contêiner de scroll (mesmo motivo do
// EventoInscricaoPage). `resetKey` volta o scroll pro topo a cada troca de etapa.
export function Pagina({ children, largura = 560, resetKey }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollTo(0, 0) }, [resetKey])
  return (
    <div ref={ref} style={{
      position: 'fixed', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      backgroundColor: 'var(--color-surface-light-base)', color: 'var(--color-text-light-primary)',
    }}>
      <style>{`
        @keyframes repoPulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-live) 55%, transparent); }
          70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
        @keyframes repoSobe { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div style={{ maxWidth: `${largura}px`, margin: '0 auto', padding: '20px 16px 120px', boxSizing: 'border-box' }}>
        <Cabecalho />
        {children}
      </div>
    </div>
  )
}

// Procopio (empresa por trás do agendamento) em destaque, com o Beyond menor e mais discreto ao
// lado, separados por um traço vertical. logobeyond_preto.png tem uma margem transparente enorme
// (o texto ocupa só ~19% da altura do canvas), então a imagem é renderizada maior e recortada por
// um contêiner com overflow:hidden, em vez de esticar a altura do cabeçalho.
function Cabecalho() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
      <img src="/images/logoprocopio_preto.png" alt="Procopio" style={{ height: '78px', objectFit: 'contain', display: 'block' }} />
      <div style={{ width: '1px', height: '34px', backgroundColor: 'var(--color-border-light)' }} />
      <div style={{ height: '26px', width: '96px', overflow: 'hidden', position: 'relative', flexShrink: 0, opacity: 0.7 }}>
        <img src="/images/logobeyond_preto.png" alt="Beyond The Club" style={{
          position: 'absolute', top: '50%', left: '50%', height: '100px', width: '100px', transform: 'translate(-50%, -50%)',
        }} />
      </div>
    </div>
  )
}

export function Titulo({ kicker, children, sub }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      {kicker && (
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-action-primary)', marginBottom: '6px' }}>
          {kicker}
        </div>
      )}
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '27px', lineHeight: 1.2, fontWeight: 700, margin: 0, color: 'var(--color-text-light-primary)' }}>
        {children}
      </h1>
      {sub && <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--color-text-light-secondary)', margin: '10px 0 0' }}>{sub}</p>}
    </div>
  )
}

export function Cartao({ children, style }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
      borderRadius: '14px', padding: '16px', boxSizing: 'border-box', ...style,
    }}>{children}</div>
  )
}

// Aviso suave (não é alerta de erro) — fundo tingido da cor de estado.
export function Nota({ cor = 'var(--color-state-info)', icone, children, style }) {
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '12px',
      backgroundColor: `color-mix(in srgb, ${cor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 35%, transparent)`,
      fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-light-primary)', ...style,
    }}>
      {icone && <span style={{ color: cor, flexShrink: 0, marginTop: '2px', display: 'flex' }}>{icone}</span>}
      <div>{children}</div>
    </div>
  )
}

const VARIANTES = {
  primario: { bg: 'var(--color-action-primary)', cor: 'var(--color-action-on-primary)', borda: 'transparent' },
  secundario: { bg: 'transparent', cor: 'var(--color-text-light-secondary)', borda: 'var(--color-border-light)' },
  presente: { bg: 'var(--color-brand-verde-court)', cor: 'var(--color-text-dark-primary)', borda: 'transparent' },
  suave: { bg: 'transparent', cor: 'var(--color-text-light-muted)', borda: 'transparent' },
}

export function Botao({ variante = 'primario', disabled, onClick, children, type = 'button', style }) {
  const v = VARIANTES[variante]
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '14px 16px', borderRadius: '12px', fontSize: '15px', fontWeight: 700,
      border: `1px solid ${v.borda}`, backgroundColor: disabled ? 'var(--color-action-disabled)' : v.bg,
      color: disabled ? 'var(--color-action-on-primary)' : v.cor, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxSizing: 'border-box',
      ...(variante === 'suave' ? { fontWeight: 600, fontSize: '13px', textDecoration: 'underline', padding: '10px' } : null),
      ...style,
    }}>{children}</button>
  )
}

// Barra fixa no rodapé com a ação principal — sempre à vista em listas longas.
export function BarraInferior({ children }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 16px 16px',
      backgroundColor: 'color-mix(in srgb, var(--color-surface-light-base) 92%, transparent)', backdropFilter: 'blur(8px)',
      borderTop: '1px solid var(--color-border-light)',
    }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}

export function Campo({ label, dica, children }) {
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>{label}</div>
      {children}
      {dica && <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)', marginTop: '5px' }}>{dica}</div>}
    </div>
  )
}

export function Modal({ children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backgroundColor: 'color-mix(in srgb, var(--color-brand-verde-court) 60%, transparent)' }}>
      <div style={{
        width: '100%', maxWidth: '420px', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box', padding: '22px',
        borderRadius: '16px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
        animation: 'repoSobe 0.18s ease-out',
      }}>{children}</div>
    </div>
  )
}

// Indicador "ao vivo" — uso legítimo do accent-live (vagas atualizando em tempo real).
export function AoVivo({ children = 'Vagas atualizadas em tempo real' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light-muted)' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-accent-live)', animation: 'repoPulse 2s infinite' }} />
      {children}
    </div>
  )
}

export function BadgePublico({ kids, children }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px',
      backgroundColor: kids ? COR_KIDS : `color-mix(in srgb, ${COR_ADULTO} 14%, transparent)`,
      color: kids ? 'var(--color-brand-verde-court)' : COR_ADULTO,
      border: kids ? 'none' : `1px solid color-mix(in srgb, ${COR_ADULTO} 40%, transparent)`,
    }}>{children}</span>
  )
}

// Um card de horário. A régua de "pips" mostra as vagas: preenchido = ocupada, cor = livre.
export function CardSlot({ slot, selecionado, onClick, mostrarModalidade, restrito }) {
  const estado = estadoVagas(slot)
  const lotado = estado.chave === 'lotado'
  const ocupadas = slot.capacidade - Math.max(0, slot.vagas_restantes)
  const kids = slot.publico === 'kids'
  return (
    <button type="button" onClick={() => onClick(slot)} style={{
      textAlign: 'left', cursor: lotado ? 'not-allowed' : 'pointer', borderRadius: '12px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: '7px', width: '100%', opacity: lotado ? 0.55 : restrito ? 0.6 : 1, transition: 'all 0.12s',
      // a borda de 2px quando selecionado tira 1px de padding pra o card não "pular" de tamanho
      backgroundColor: selecionado ? 'color-mix(in srgb, var(--color-action-primary) 10%, var(--color-surface-light-raised))' : 'var(--color-surface-light-raised)',
      border: selecionado ? '2px solid var(--color-action-primary)' : '1px solid var(--color-border-light)',
      padding: selecionado ? '11px 12px' : '12px 13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 800, color: 'var(--color-text-light-primary)' }}>
          <Clock size={14} style={{ color: 'var(--color-text-light-muted)' }} />{faixaHorario(slot)}
        </span>
        {selecionado
          ? <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={14} strokeWidth={3} /></span>
          : <span style={{
              fontSize: '13px', fontWeight: 800, color: estado.cor, whiteSpace: 'nowrap', flexShrink: 0,
              padding: '3px 9px', borderRadius: '999px', backgroundColor: `color-mix(in srgb, ${estado.cor} 14%, transparent)`,
            }}>{estado.texto}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
        {mostrarModalidade && <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>{slot.modalidade}</span>}
        {rotuloNivel(slot) && <BadgePublico kids={kids}>{rotuloNivel(slot)}</BadgePublico>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
        {slot.quadra && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} />{slot.quadra}</span>}
        {slot.professor && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} />{nomeProfessor(slot.professor)}</span>}
      </div>

      <div style={{ display: 'flex', gap: '3px' }}>
        {Array.from({ length: slot.capacidade }, (_, i) => (
          <span key={i} style={{
            flex: 1, height: '4px', borderRadius: '2px', maxWidth: '28px',
            backgroundColor: i < ocupadas ? 'var(--color-border-light)' : estado.cor,
          }} />
        ))}
      </div>
      {restrito && (
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light-muted)' }}>Somente para quem faz aula individual</div>
      )}
    </button>
  )
}

// Lista agrupada por dia, com o cabeçalho de cada data.
export function SlotsPorDia({ slots, selecionadosIds = [], onClick, mostrarModalidade, restrito }) {
  const grupos = []
  for (const s of slots) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.data === s.data_aula) ultimo.itens.push(s)
    else grupos.push({ data: s.data_aula, itens: [s] })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {grupos.map(g => (
        <section key={g.data}>
          {/* Faixa cheia (mesmo verde-court do cabeçalho/tiles de presente) em vez de texto solto —
              some marcar a virada de dia com a tela rolando rápido era fácil de passar despercebido. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px',
            backgroundColor: 'var(--color-brand-verde-court)', position: 'sticky', top: '8px', zIndex: 1,
          }}>
            <CalendarDays size={16} style={{ color: 'var(--color-brand-lima)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-dark-primary)' }}>
              {rotuloDiaLongo(g.data)}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
            {g.itens.map(s => (
              <CardSlot key={s.slot_id} slot={s} mostrarModalidade={mostrarModalidade} restrito={restrito ? restrito(s) : false}
                selecionado={selecionadosIds.includes(s.slot_id)} onClick={onClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function Chip({ ativo, onClick, children, cor = 'var(--color-action-primary)', corTexto = 'var(--color-action-on-primary)', style }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '9px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
      backgroundColor: ativo ? cor : 'var(--color-surface-light-overlay)', color: ativo ? corTexto : 'var(--color-text-light-secondary)',
      border: `1px solid ${ativo ? cor : 'var(--color-border-light)'}`, ...style,
    }}>{children}</button>
  )
}

// Aviso em janela (choque de horário, limite atingido...) com uma ou mais ações empilhadas.
export function ModalAviso({ icone, cor = 'var(--color-state-warning)', titulo, children, acoes }) {
  return (
    <Modal>
      <div style={{ textAlign: 'center' }}>
        {icone && (
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cor, backgroundColor: `color-mix(in srgb, ${cor} 14%, transparent)`,
          }}>{icone}</div>
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{titulo}</div>
        <div style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--color-text-light-secondary)', marginBottom: '18px' }}>{children}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{acoes}</div>
      </div>
    </Modal>
  )
}
