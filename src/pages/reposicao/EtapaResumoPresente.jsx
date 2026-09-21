import { useState } from 'react'
import { ChevronLeft, Gift, TriangleAlert } from 'lucide-react'
import { ordenarSlots } from './constantes'
import { confirmarPresente } from './api'
import { LinhaAula } from './EtapaConfirmarReposicao'
import { Titulo, Nota, Botao, BarraInferior } from './ui'

export function EtapaResumoPresente({ presentes, inscricaoId, onVoltar, onConfirmado, onSlotsEsgotados }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    setErro('')
    setEnviando(true)
    try {
      const r = await confirmarPresente({ inscricaoId, slotIds: presentes.map(p => p.slot_id) })
      if (r?.ok) { onConfirmado(); return }
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

      <Titulo kicker="Resumo do presente" sub="Estas são as aulas gratuitas que você escolheu. Confira o dia, o horário e o professor.">
        Suas aulas de presente
      </Titulo>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {ordenarSlots(presentes).map(p => <LinhaAula key={p.slot_id} slot={p} />)}
      </div>

      <Nota cor="var(--color-brand-verde-card)" icone={<Gift size={16} />}>
        Aulas de presente são <strong>gratuitas</strong> e valem 1 por modalidade.
      </Nota>

      {erro && <Nota cor="var(--color-state-danger)" icone={<TriangleAlert size={16} />} style={{ marginTop: '14px' }}>{erro}</Nota>}

      <BarraInferior>
        <Botao disabled={enviando} onClick={confirmar}>{enviando ? 'Confirmando...' : 'OK, confirmar minhas aulas'}</Botao>
      </BarraInferior>
    </div>
  )
}
