import { useState } from 'react'
import { createPortal } from 'react-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Check, Mail, CalendarClock, LayoutGrid, MessageSquareText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAulasDoRecado, useMarcarRecado, recadoNoPainel } from '../../hooks/useRecados'
import { nomeProfessor } from '../../lib/nomes'
import { GradeRecado } from './GradeRecado'

const dm = d => format(new Date(d + 'T12:00'), 'dd/MM')

// Cartão de um recado (painel do professor e pasta de recebidos).
export function CartaoRecado({ recado, onAbrir }) {
  const lido = !!recado.lido_em
  const turma = recado.tipo === 'turma'
  return (
    <button type="button" onClick={onAbrir} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: '12px', boxSizing: 'border-box',
      border: `1px solid ${lido ? 'var(--color-border-dark)' : 'var(--color-action-primary)'}`,
      backgroundColor: lido ? 'var(--color-surface-dark-raised)' : 'color-mix(in srgb, var(--color-action-primary) 16%, var(--color-surface-dark-raised))',
      opacity: lido ? 0.72 : 1, display: 'flex', gap: '10px', alignItems: 'flex-start',
    }}>
      <span style={{ marginTop: '2px', flexShrink: 0, color: lido ? 'var(--color-text-dark-muted)' : 'var(--color-action-primary)' }}>
        {turma ? <LayoutGrid size={16} /> : <MessageSquareText size={16} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
          {!lido && <span className="pulse-badge" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-action-primary)', flexShrink: 0 }} />}
          <b style={{ color: 'var(--color-text-dark-primary)' }}>{recado.autor_nome || 'Equipe'}</b>
          <span>· {formatDistanceToNow(new Date(recado.criado_em), { locale: ptBR, addSuffix: true })}</span>
          {lido && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700 }}>LIDO</span>}
        </span>
        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '13px', color: 'var(--color-text-dark-primary)', fontWeight: lido ? 400 : 600, marginTop: '3px', lineHeight: 1.4 }}>
          {recado.texto}
        </span>
        {turma && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(61,107,122,0.25)', color: 'var(--color-text-dark-primary)' }}>
            <CalendarClock size={11} /> {recado.aula_ids?.length} turma{recado.aula_ids?.length > 1 ? 's' : ''}{recado.valido_ate ? ` · até ${dm(recado.valido_ate)}` : ''}
          </span>
        )}
      </span>
    </button>
  )
}

// Leitura do recado: texto, turmas marcadas e a grade do dia com elas em destaque.
// Ao sair, a pessoa escolhe: marcar como lido (vai pra pasta Lidos) ou deixar não lido.
export function RecadoLeitura({ recado, onFechar, podeMarcar = true }) {
  const { data: aulas = [] } = useAulasDoRecado(recado.tipo === 'turma' ? recado.aula_ids : [])
  const marcar = useMarcarRecado()
  const datas = [...new Set(aulas.map(a => a.data_aula))].sort()
  const [diaGrade, setDiaGrade] = useState(null)
  const diaAtual = diaGrade || datas[0]

  async function sair(lido) {
    if (podeMarcar && lido !== !!recado.lido_em) {
      try { await marcar.mutateAsync({ id: recado.id, lido }) } catch (e) { toast.error(e.message); return }
      if (lido && recadoNoPainel({ ...recado, lido_em: 'x' })) toast.success(`Marcado como lido. Fica no painel até ${dm(recado.valido_ate)}, dia da aula.`)
      else if (lido) toast.success('Marcado como lido. Está na pasta Lidos.')
    }
    onFechar()
  }

  return createPortal((
    <div className="theme-dark" onClick={() => onFechar()} style={{ position: 'fixed', inset: 0, zIndex: 120, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'var(--color-surface-dark-base)', borderRadius: '20px 20px 0 0', border: '1px solid var(--color-border-dark)', padding: '18px 16px 22px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-action-primary)' }}>
              {recado.tipo === 'turma' ? 'Recado sobre turmas' : 'Recado'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-dark-primary)', marginTop: '2px' }}>De {recado.autor_nome || 'Equipe'}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>
              {format(new Date(recado.criado_em), "dd/MM 'às' HH:mm")}
              {recado.valido_ate && <> · fica no painel até {dm(recado.valido_ate)}</>}
            </div>
          </div>
          <button onClick={() => onFechar()} style={{ background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', lineHeight: 1.55, color: 'var(--color-text-dark-primary)', padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', marginBottom: '14px' }}>
          {recado.texto}
        </div>

        {recado.tipo === 'turma' && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-dark-secondary)', marginBottom: '8px' }}>Turmas do recado</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {aulas.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', backgroundColor: 'color-mix(in srgb, var(--color-action-primary) 14%, var(--color-surface-dark-raised))', border: '1px solid rgba(165,76,46,0.45)', fontSize: '12px', color: 'var(--color-text-dark-primary)' }}>
                  <b style={{ minWidth: '74px' }}>{format(new Date(a.data_aula + 'T12:00'), 'EEE dd/MM', { locale: ptBR })}</b>
                  <span><b>{a.turmas?.horario_inicio?.slice(0, 5)}</b> · {a.turmas?.quadras?.nome} · {a.turmas?.niveis?.nome} · {a.professores ? nomeProfessor(a.professores) : 'sem professor'} · {a.presencas?.length || 0} alunos</span>
                </div>
              ))}
            </div>
            {datas.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-dark-secondary)' }}>Grade completa</span>
                  {datas.length > 1 && datas.map(d => (
                    <button key={d} onClick={() => setDiaGrade(d)} style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${d === diaAtual ? 'var(--color-action-primary)' : 'var(--color-border-dark)'}`, backgroundColor: d === diaAtual ? 'var(--color-action-primary)' : 'transparent', color: d === diaAtual ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-secondary)' }}>{dm(d)}</button>
                  ))}
                  {datas.length === 1 && <span style={{ fontSize: '11px', color: 'var(--color-text-dark-muted)' }}>{format(new Date(diaAtual + 'T12:00'), "EEEE, dd/MM", { locale: ptBR })}</span>}
                </div>
                <GradeRecado key={diaAtual} data={diaAtual} selecionadas={recado.aula_ids} somenteSelecionadasNoFiltro />
              </>
            )}
          </>
        )}

        {podeMarcar ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => sair(false)} disabled={marcar.isPending} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent', color: 'var(--color-text-dark-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Mail size={15} /> Deixar como não lido
            </button>
            <button onClick={() => sair(true)} disabled={marcar.isPending} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Check size={15} /> Marcar como lido
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ), document.body)
}
