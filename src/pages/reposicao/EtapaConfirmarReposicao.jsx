import { useState } from 'react'
import { CalendarCheck, ChevronLeft, Clock, MapPin, TriangleAlert, User } from 'lucide-react'
import { faixaHorario, rotuloDiaCurto, rotuloDiaLongo, rotuloNivel, rotuloProfessor, ordenarSlots, usaCreditoIndividualEmGrupo, TEXTO_DECLARACAO } from './constantes'
import { confirmarReposicao } from './api'
import { Titulo, Cartao, Nota, Botao, BarraInferior } from './ui'

// Linha de uma aula agendada — reaproveitada nas telas de confirmação, resumo e final.
export function LinhaAula({ slot, destaque, compacta, aviso }) {
  if (compacta) {
    // Versão enxuta pra tela final (o "print"): linha 1 = dia + horário e modalidade; linha 2 =
    // nível, quadra e professor em letra pequena. Cabe bastante aula numa única captura de tela.
    const detalhes = [rotuloNivel(slot), slot.quadra, rotuloProfessor(slot.professor)].filter(Boolean).join(' · ')
    return (
      <div style={{
        padding: '5px 10px', borderRadius: '9px', boxSizing: 'border-box',
        backgroundColor: destaque || 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', fontSize: '13px', fontWeight: 800 }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--color-action-primary)' }}>{rotuloDiaCurto(slot.data_aula)}</span> · {faixaHorario(slot)}
          </span>
          <span style={{ textAlign: 'right' }}>{slot.modalidade}</span>
        </div>
        {detalhes && <div style={{ fontSize: '11px', lineHeight: 1.3, color: 'var(--color-text-light-secondary)' }}>{detalhes}</div>}
        {aviso && <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-state-warning)' }}>{aviso}</div>}
      </div>
    )
  }
  return (
    <div style={{
      display: 'flex', gap: '12px', padding: '12px 14px', borderRadius: '12px', boxSizing: 'border-box',
      backgroundColor: destaque || 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-action-primary)', marginBottom: '2px' }}>{rotuloDiaLongo(slot.data_aula)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '17px', fontWeight: 800 }}>
          <Clock size={15} style={{ color: 'var(--color-text-light-muted)' }} />{faixaHorario(slot)}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
          {[slot.modalidade, rotuloNivel(slot)].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '3px' }}>
          {slot.quadra && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} />{slot.quadra}</span>}
          {slot.professor && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} />{rotuloProfessor(slot.professor)}</span>}
        </div>
        {aviso && <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-state-warning)', marginTop: '5px' }}>{aviso}</div>}
      </div>
    </div>
  )
}

// Confirma os horários de reposição (ou "sem reposição") + declaração. É aqui que a inscrição é
// gravada — o OK reserva as vagas de verdade, antes de seguir pro presente.
export function EtapaConfirmarReposicao({ dados, selecionados, onVoltar, onConfirmado, onSlotsEsgotados }) {
  const [aceito, setAceito] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    setErro('')
    setEnviando(true)
    try {
      const r = await confirmarReposicao({
        nome: dados.nome, telefone: dados.telefone, turmas: dados.turmas, slotIds: selecionados.map(s => s.slot_id),
      })
      if (r?.ok) { onConfirmado(r.inscricao_id); return }
      if (r?.codigo === 'esgotado' || r?.codigo === 'slot_invalido') onSlotsEsgotados(r.slot_ids || [])
      setErro(r?.mensagem || 'Não foi possível confirmar agora.')
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <button type="button" onClick={onVoltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, marginBottom: '12px' }}>
        <ChevronLeft size={16} /> Voltar e alterar
      </button>

      <Titulo kicker="Confirmação" sub="Confira os dados e os horários antes de confirmar.">
        {selecionados.length ? 'Sua reposição de Tênis' : 'Seus dados'}
      </Titulo>

      <Cartao style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-light-muted)', marginBottom: '4px' }}>Aluno</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700 }}>{dados.nome.trim()}</div>
      </Cartao>

      {selecionados.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          {ordenarSlots(selecionados).map(s => <LinhaAula key={s.slot_id} slot={s} aviso={usaCreditoIndividualEmGrupo(dados.turmas, s) ? 'Usa o seu crédito de aula individual' : undefined} />)}
        </div>
      ) : (
        <Nota icone={<CalendarCheck size={16} />} style={{ marginBottom: '18px' }}>
          Você não agendou nenhuma reposição agora. Tudo bem. Na próxima etapa você ainda pode escolher o seu presente, e depois é só falar com a gente pelo WhatsApp para verificarmos a sua reposição.
        </Nota>
      )}

      <label style={{
        display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px', borderRadius: '12px', cursor: 'pointer', boxSizing: 'border-box',
        backgroundColor: aceito ? 'color-mix(in srgb, var(--color-state-success) 10%, transparent)' : 'var(--color-surface-light-raised)',
        border: `1px solid ${aceito ? 'var(--color-state-success)' : 'var(--color-border-light)'}`,
      }}>
        <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)}
          style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'var(--color-action-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--color-text-light-primary)' }}>{TEXTO_DECLARACAO}</span>
      </label>

      {erro && <Nota cor="var(--color-state-danger)" icone={<TriangleAlert size={16} />} style={{ marginTop: '14px' }}>{erro}</Nota>}

      <BarraInferior>
        <Botao disabled={!aceito || enviando} onClick={confirmar}>{enviando ? 'Confirmando...' : 'OK, confirmar'}</Botao>
      </BarraInferior>
    </div>
  )
}
