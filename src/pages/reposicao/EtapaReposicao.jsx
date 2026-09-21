import { useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, Gift, Info, TriangleAlert } from 'lucide-react'
import { MAX_REPOSICOES, encontrarConflito, rotuloDiaCurto } from './constantes'
import { useVagas } from './api'
import { Titulo, Nota, Botao, BarraInferior, Chip, AoVivo, SlotsPorDia, ModalAviso } from './ui'

const FILTROS_NIVEL = [
  { chave: 'Iniciante', rotulo: 'Iniciante' }, { chave: 'Intermediário', rotulo: 'Intermediário' },
  { chave: 'Avançado', rotulo: 'Avançado' }, { chave: 'Kids', rotulo: 'Kids / Juvenil' }, { chave: 'Individual', rotulo: 'Individual' },
]

function passaFiltroNivel(slot, filtro) {
  if (filtro === 'todos') return true
  if (filtro === 'Individual') return slot.formato === 'individual'
  if (filtro === 'Kids') return slot.publico === 'kids'
  return slot.publico !== 'kids' && (slot.nivel || '').toLowerCase().startsWith(filtro.toLowerCase())
}

export function EtapaReposicao({ dados, selecionados, setSelecionados, onVoltar, onProsseguir, onNenhumHorario }) {
  const { data: slots, isLoading, isError } = useVagas('reposicao')
  const [dia, setDia] = useState('todos')
  const [nivel, setNivel] = useState('todos')
  const [aviso, setAviso] = useState(null) // { titulo, texto }

  const dias = useMemo(() => [...new Set((slots || []).map(s => s.data_aula))], [slots])
  const visiveis = useMemo(
    () => (slots || []).filter(s => (dia === 'todos' || s.data_aula === dia) && passaFiltroNivel(s, nivel)),
    [slots, dia, nivel],
  )
  const ids = selecionados.map(s => s.slot_id)

  function clicar(slot) {
    if (ids.includes(slot.slot_id)) {
      setSelecionados(sel => sel.filter(s => s.slot_id !== slot.slot_id))
      return
    }
    if (slot.vagas_restantes <= 0) {
      setAviso({ titulo: 'Horário lotado', texto: 'Esse horário já não tem mais vagas. Escolha outro, por favor.' })
      return
    }
    if (selecionados.length >= MAX_REPOSICOES) {
      setAviso({
        titulo: `Limite de ${MAX_REPOSICOES} aulas`,
        texto: `Para atendermos toda a nossa demanda, neste primeiro momento cada pessoa agenda até ${MAX_REPOSICOES} aulas de reposição. Se quiser trocar um horário, toque na aula escolhida para desmarcá-la. As demais reposições faremos em um novo agendamento.`,
      })
      return
    }
    const conflito = encontrarConflito(slot, { turmas: dados.turmas, outros: selecionados })
    if (conflito) {
      setAviso({ titulo: 'Horário já ocupado', texto: conflito.texto })
      return
    }
    setSelecionados(sel => [...sel, slot])
  }

  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <button type="button" onClick={onVoltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, marginBottom: '12px' }}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <Titulo kicker="Reposição de Tênis" sub={`Olá, ${dados.nome.trim().split(/\s+/)[0]}! Escolha até ${MAX_REPOSICOES} horários abaixo.`}>
        Escolha suas aulas de reposição
      </Titulo>

      <Nota cor="var(--color-state-info)" icone={<Info size={16} />} style={{ marginBottom: '14px' }}>
        Por causa da junção das turmas de reposição, as aulas estão classificadas apenas como
        <strong> Iniciante, Intermediário e Avançado</strong> (além das turmas Kids/Juvenil e Individual) — não é possível
        separar em Iniciante 1, Iniciante 2 etc., pois precisamos preencher as turmas. Escolha o horário que melhor se encaixa na sua rotina.
      </Nota>

      <div style={{ marginBottom: '14px' }}><AoVivo /></div>

      {isLoading && <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-light-muted)' }}>Carregando horários...</div>}
      {isError && <Nota cor="var(--color-state-danger)" icone={<TriangleAlert size={16} />}>Não conseguimos carregar os horários agora. Atualize a página em instantes.</Nota>}
      {slots && slots.length === 0 && (
        <Nota cor="var(--color-state-warning)" icone={<CalendarClock size={16} />}>
          Ainda não há horários de reposição publicados. Volte em breve — ou fale com a gente pelo WhatsApp.
        </Nota>
      )}

      {slots && slots.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <Chip ativo={dia === 'todos'} onClick={() => setDia('todos')} style={{ whiteSpace: 'nowrap' }}>Todos os dias</Chip>
              {dias.map(d => <Chip key={d} ativo={dia === d} onClick={() => setDia(d)} style={{ whiteSpace: 'nowrap' }}>{rotuloDiaCurto(d)}</Chip>)}
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <Chip ativo={nivel === 'todos'} onClick={() => setNivel('todos')} cor="var(--color-brand-verde-court)" corTexto="var(--color-text-dark-primary)" style={{ whiteSpace: 'nowrap' }}>Todos os níveis</Chip>
              {FILTROS_NIVEL.map(n => <Chip key={n.chave} ativo={nivel === n.chave} onClick={() => setNivel(n.chave)} cor="var(--color-brand-verde-court)" corTexto="var(--color-text-dark-primary)" style={{ whiteSpace: 'nowrap' }}>{n.rotulo}</Chip>)}
            </div>
          </div>

          {visiveis.length === 0
            ? <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)' }}>Nenhum horário com esses filtros.</div>
            : <SlotsPorDia slots={visiveis} selecionadosIds={ids} onClick={clicar} />}
        </>
      )}

      {selecionados.length === 0 && (
        <button type="button" onClick={onNenhumHorario} style={{
          marginTop: '28px', width: '100%', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box', padding: '16px', borderRadius: '14px',
          display: 'flex', alignItems: 'center', gap: '14px', border: 'none',
          backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)',
        }}>
          <span style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-brand-lima)', color: 'var(--color-brand-verde-court)' }}>
            <Gift size={20} />
          </span>
          <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1.45, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Nenhum horário me atende, mas gostaria de usar meu voucher para conhecer outras modalidades
          </span>
        </button>
      )}

      <BarraInferior>
        <Botao disabled={selecionados.length === 0} onClick={onProsseguir}>
          {selecionados.length === 0 ? 'Escolha ao menos 1 horário' : `Prosseguir com ${selecionados.length} de ${MAX_REPOSICOES} aula${selecionados.length > 1 ? 's' : ''}`}
        </Botao>
        {selecionados.length === 0 && (
          <Botao variante="suave" onClick={onNenhumHorario} style={{ padding: '4px' }}>Nenhum horário me atende — quero usar meu voucher</Botao>
        )}
      </BarraInferior>

      {aviso && (
        <ModalAviso icone={<TriangleAlert size={24} />} titulo={aviso.titulo}
          acoes={<Botao onClick={() => setAviso(null)}>Voltar para o agendamento</Botao>}>
          {aviso.texto}
        </ModalAviso>
      )}
    </div>
  )
}
