import { useMemo, useState } from 'react'
import { ArrowLeftRight, Check, ChevronLeft, Gift, TriangleAlert, X } from 'lucide-react'
import { MODALIDADES_PRESENTE, IMG_MODALIDADE, encontrarConflito, faixaHorario, rotuloDiaCurto } from './constantes'
import { useVagas } from './api'
import { Titulo, Nota, Botao, BarraInferior, AoVivo, SlotsPorDia, ModalAviso } from './ui'

function MiniCard({ slot, onRemover }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px 8px 8px', borderRadius: '12px', boxSizing: 'border-box',
      backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
      borderLeft: '3px solid var(--color-brand-lima)',
    }}>
      <span style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: 'var(--color-brand-verde-court)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img src={IMG_MODALIDADE[slot.modalidade]} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 800 }}>{slot.modalidade}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>{rotuloDiaCurto(slot.data_aula)} · {faixaHorario(slot)}</div>
      </div>
      <button type="button" onClick={onRemover} aria-label={`Remover ${slot.modalidade}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-muted)', display: 'flex', padding: '6px' }}>
        <X size={16} />
      </button>
    </div>
  )
}

function TileModalidade({ modalidade, escolhida, vagasAbertas, carregando, larguraTotal, onClick }) {
  const semVagas = !carregando && vagasAbertas === 0
  return (
    <button type="button" onClick={onClick} style={{
      position: 'relative', cursor: 'pointer', textAlign: 'center', padding: '18px 10px 14px', borderRadius: '16px', boxSizing: 'border-box',
      gridColumn: larguraTotal ? '1 / -1' : undefined,
      backgroundColor: 'var(--color-surface-dark-base)', color: 'var(--color-text-dark-primary)', opacity: semVagas && !escolhida ? 0.6 : 1,
      border: escolhida ? '2px solid var(--color-brand-lima)' : '1px solid var(--color-border-dark)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'transform 0.12s',
    }}>
      {escolhida && (
        <span style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--color-brand-lima)', color: 'var(--color-brand-verde-court)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      <img src={modalidade.img} alt="" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700 }}>{modalidade.nome}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: escolhida ? 'var(--color-brand-lima)' : 'var(--color-text-dark-secondary)' }}>
        {escolhida ? 'Aula escolhida' : carregando ? '...' : semVagas ? 'Sem vagas no momento' : `${vagasAbertas} ${vagasAbertas === 1 ? 'horário' : 'horários'} com vaga`}
      </span>
    </button>
  )
}

export function EtapaPresente({ dados, reposicoes, presentes, setPresentes, onResumo, onPular }) {
  const { data: slots, isLoading, isError } = useVagas('presente')
  const [aberta, setAberta] = useState(null) // nome da modalidade em visualização
  const [aviso, setAviso] = useState(null)   // { titulo, texto, acoes? }

  const porModalidade = useMemo(() => {
    const m = {}
    for (const s of slots || []) (m[s.modalidade] ||= []).push(s)
    return m
  }, [slots])

  const escolhidaDe = nome => presentes.find(p => p.modalidade === nome)
  const restantes = presentes.length >= MODALIDADES_PRESENTE.length
    ? []
    : MODALIDADES_PRESENTE.filter(m => !escolhidaDe(m.nome)).map(m => m.nome)

  function escolher(slot) {
    // outros = tudo que já está agendado, exceto a escolha anterior da MESMA modalidade (que este slot vai substituir)
    const outros = [...reposicoes, ...presentes.filter(p => p.modalidade !== slot.modalidade)]
    const conflito = encontrarConflito(slot, { turmas: dados.turmas, outros })
    if (conflito) {
      setAviso({ titulo: 'Horário já ocupado', texto: conflito.texto })
      return
    }
    setPresentes(ps => [...ps.filter(p => p.modalidade !== slot.modalidade), slot])
    setAberta(null)
  }

  function clicarSlot(slot) {
    const atual = escolhidaDe(slot.modalidade)
    if (atual?.slot_id === slot.slot_id) {
      setPresentes(ps => ps.filter(p => p.slot_id !== slot.slot_id))
      return
    }
    if (slot.vagas_restantes <= 0) {
      setAviso({ titulo: 'Horário lotado', texto: 'Esse horário já não tem mais vagas. Escolha outro, por favor.' })
      return
    }
    if (atual) {
      // Regra do presente: 1 aula por modalidade — oferece trocar ou conhecer outra modalidade.
      setAviso({
        titulo: `Você já escolheu ${slot.modalidade}`,
        texto: restantes.length
          ? `O presente vale 1 aula por modalidade, e você já agendou ${slot.modalidade} (${rotuloDiaCurto(atual.data_aula)}, ${faixaHorario(atual)}). Vejo aqui que você ainda tem voucher para conhecer: ${restantes.join(', ')}. Gostaria de agendar uma aula?`
          : `O presente vale 1 aula por modalidade, e você já agendou ${slot.modalidade} (${rotuloDiaCurto(atual.data_aula)}, ${faixaHorario(atual)}). Você já escolheu todas as modalidades — se preferir, pode trocar o horário.`,
        acoes: (
          <>
            {restantes.length > 0 && <Botao onClick={() => { setAviso(null); setAberta(null) }}>Sim, ver outras modalidades</Botao>}
            <Botao variante="secundario" onClick={() => { setAviso(null); escolher(slot) }}><ArrowLeftRight size={15} /> Trocar para este horário</Botao>
            <Botao variante="suave" onClick={() => setAviso(null)}>Manter como está</Botao>
          </>
        ),
      })
      return
    }
    escolher(slot)
  }

  // ---- visão de uma modalidade: dias e horários ---------------------------------------
  if (aberta) {
    const mod = MODALIDADES_PRESENTE.find(m => m.nome === aberta)
    const lista = porModalidade[aberta] || []
    return (
      <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
        <button type="button" onClick={() => setAberta(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, marginBottom: '12px' }}>
          <ChevronLeft size={16} /> Voltar às modalidades
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <span style={{ width: '58px', height: '58px', borderRadius: '16px', backgroundColor: 'var(--color-brand-verde-court)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={mod.img} alt="" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
          </span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-action-primary)' }}>Aula gratuita</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, lineHeight: 1.15 }}>{mod.nome}</div>
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}><AoVivo /></div>
        {lista.length === 0
          ? <Nota cor="var(--color-state-warning)">No momento não há horários abertos de {mod.nome}. Volte em breve ou escolha outra modalidade.</Nota>
          : <SlotsPorDia slots={lista} selecionadosIds={presentes.map(p => p.slot_id)} onClick={clicarSlot} />}
        {aviso && <AvisoPresente aviso={aviso} onFechar={() => setAviso(null)} />}
      </div>
    )
  }

  // ---- visão principal: presente + quadrados das modalidades -------------------------------
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Um presente para você"
        sub="A Procopio, em parceria com a Beach Arena, presenteia você com 1 aula gratuita em cada uma das nossas outras modalidades. Sair do saibro por uma hora também é jogo — venha descobrir o quanto o esporte pode ser ainda maior.">
        Que tal aproveitar um pouco mais de esporte?
      </Titulo>

      <Nota cor="var(--color-brand-verde-card)" icone={<Gift size={16} />} style={{ marginBottom: '16px' }}>
        Você pode escolher <strong>todas as modalidades</strong>, mas é <strong>1 aula por modalidade</strong>. Toque em uma delas para ver os dias e horários.
      </Nota>

      {presentes.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-light-muted)', marginBottom: '8px' }}>
            Suas escolhas ({presentes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {presentes.map(p => <MiniCard key={p.slot_id} slot={p} onRemover={() => setPresentes(ps => ps.filter(x => x.slot_id !== p.slot_id))} />)}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '12px' }}><AoVivo /></div>
      {isError && <Nota cor="var(--color-state-danger)" icone={<TriangleAlert size={16} />} style={{ marginBottom: '12px' }}>Não conseguimos carregar os horários agora. Atualize a página em instantes.</Nota>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {MODALIDADES_PRESENTE.map((m, i) => (
          <TileModalidade key={m.nome} modalidade={m} carregando={isLoading}
            larguraTotal={i === MODALIDADES_PRESENTE.length - 1 && MODALIDADES_PRESENTE.length % 2 === 1}
            escolhida={!!escolhidaDe(m.nome)}
            vagasAbertas={(porModalidade[m.nome] || []).filter(s => s.vagas_restantes > 0).length}
            onClick={() => setAberta(m.nome)} />
        ))}
      </div>

      {presentes.length === 0 && (
        <Botao variante="presente" onClick={onPular} style={{ fontSize: '14px', fontWeight: 600 }}>
          Prefiro não experimentar outras modalidades agora
        </Botao>
      )}

      {presentes.length > 0 && (
        <BarraInferior>
          <Botao onClick={onResumo}>Concluir escolhas ({presentes.length})</Botao>
        </BarraInferior>
      )}

      {aviso && <AvisoPresente aviso={aviso} onFechar={() => setAviso(null)} />}
    </div>
  )
}

function AvisoPresente({ aviso, onFechar }) {
  return (
    <ModalAviso icone={<TriangleAlert size={24} />} titulo={aviso.titulo}
      acoes={aviso.acoes || <Botao onClick={onFechar}>Voltar para o agendamento</Botao>}>
      {aviso.texto}
    </ModalAviso>
  )
}
