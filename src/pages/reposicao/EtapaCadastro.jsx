import { useState } from 'react'
import { CalendarCheck, CloudRain, Gift, Info, Plus, Trash2, User, Users } from 'lucide-react'
import { mascararTelefoneBR, apenasDigitosTelefone } from '../../lib/telefone'
import {
  DIAS, HORARIOS, NIVEIS_ADULTO, NIVEIS_KIDS, TURMA_VAZIA, MODALIDADES_PRESENTE, MAX_REPOSICOES,
  COR_ADULTO, COR_KIDS, estiloInput, WHATSAPP_EXIBIDO, WHATSAPP_LINK_GRADE_REGULAR,
} from './constantes'
import { Titulo, Cartao, Nota, Botao, Campo, Chip } from './ui'

const MAX_POR_TIPO = 3

// Individual = verde-court, Grupo = saibro: a cor do bloco inteiro (borda, chips marcados) diz de
// qual tipo de aula ele é. As cores adulto/Kids ficam só nos chips de nível, dentro do Grupo.
const TIPOS = [
  { chave: 'individual', rotulo: 'Aula Individual', sub: 'Só você e o professor', Icone: User,
    cor: 'var(--color-brand-verde-court)', corTexto: 'var(--color-text-dark-primary)' },
  { chave: 'grupo', rotulo: 'Aula em Grupo', sub: 'Turma com outros alunos', Icone: Users,
    cor: 'var(--color-action-primary)', corTexto: 'var(--color-action-on-primary)' },
]

function validar(dados) {
  if (dados.nome.trim().split(/\s+/).filter(Boolean).length < 2) return 'Informe o nome completo do aluno.'
  if (dados.telefone.length < 10) return 'Informe o telefone com DDD.'
  if (!dados.turmas.length) return 'Marque o tipo da sua aula atual: Individual, Grupo ou os dois.'
  for (const t of dados.turmas) {
    const de = t.formato === 'individual' ? 'da aula Individual' : 'da turma em Grupo'
    if (!t.dias.length) return `Marque ao menos um dia da semana ${de}.`
    if (!t.horario) return `Marque o horário ${de}.`
    if (t.formato === 'grupo' && !t.nivel) return 'Escolha o nível da sua turma em Grupo.'
  }
  return ''
}

function BlocoTurma({ turma, tipo, ordem, total, onChange, onRemover }) {
  const set = patch => onChange({ ...turma, ...patch })
  const toggleDia = key => set({ dias: turma.dias.includes(key) ? turma.dias.filter(d => d !== key) : [...turma.dias, key] })
  const { cor, corTexto, Icone } = tipo

  return (
    <Cartao style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: `5px solid ${cor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: cor === 'var(--color-brand-verde-court)' ? cor : 'var(--color-action-primary)' }}>
          <Icone size={16} /> {tipo.rotulo}{total > 1 ? ` · horário ${ordem}` : ''}
        </span>
        {total > 1 && (
          <button type="button" onClick={onRemover} aria-label="Remover este horário" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)', display: 'flex', padding: '4px' }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <Campo label="Dias da semana">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
          {DIAS.map(d => <Chip key={d.key} ativo={turma.dias.includes(d.key)} onClick={() => toggleDia(d.key)} cor={cor} corTexto={corTexto} style={{ padding: '10px 0', fontSize: '12px' }}>{d.label}</Chip>)}
        </div>
      </Campo>

      <Campo label="Horário da aula">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {HORARIOS.map(h => (
            <Chip key={h} ativo={turma.horario === h} onClick={() => set({ horario: h })} cor={cor} corTexto={corTexto} style={{ padding: '10px 0', fontSize: '12px' }}>
              {Number(h.slice(0, 2))}h
            </Chip>
          ))}
        </div>
      </Campo>

      {turma.formato === 'grupo' && (
        <Campo label="Nível / turma">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {NIVEIS_ADULTO.map(n => <Chip key={n} ativo={turma.nivel === n} onClick={() => set({ nivel: n })} cor={COR_ADULTO}>{n}</Chip>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {NIVEIS_KIDS.map(n => <Chip key={n} ativo={turma.nivel === n} onClick={() => set({ nivel: n })} cor={COR_KIDS} corTexto="var(--color-brand-verde-court)">{n}</Chip>)}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '11px', color: 'var(--color-text-light-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><i style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: COR_ADULTO }} />Aulas adulto</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><i style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: COR_KIDS }} />Aulas Kids</span>
          </div>
        </Campo>
      )}
    </Cartao>
  )
}

export function EtapaCadastro({ dados, setDados, onContinuar }) {
  const [erro, setErro] = useState('')

  function enviar(e) {
    e.preventDefault()
    const msg = validar(dados)
    if (msg) { setErro(msg); return }
    setErro('')
    onContinuar()
  }

  const temTipo = chave => dados.turmas.some(t => t.formato === chave)
  const alternarTipo = chave => setDados(d => ({
    ...d,
    turmas: temTipo(chave) ? d.turmas.filter(t => t.formato !== chave) : [...d.turmas, { ...TURMA_VAZIA, formato: chave }],
  }))
  const setTurma = (i, t) => setDados(d => ({ ...d, turmas: d.turmas.map((x, j) => (j === i ? t : x)) }))
  const removerTurma = i => setDados(d => ({ ...d, turmas: d.turmas.filter((_, j) => j !== i) }))
  const adicionarHorario = chave => setDados(d => ({ ...d, turmas: [...d.turmas, { ...TURMA_VAZIA, formato: chave }] }))

  return (
    <form onSubmit={enviar} style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Aulas extras">Vamos repor as suas aulas</Titulo>

      <Cartao style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <CloudRain size={22} style={{ color: 'var(--color-state-info)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)' }}>
            <p style={{ margin: '0 0 10px' }}>
              Nas últimas semanas a chuva nos impediu de realizar muitas aulas de Tênis. Nós, da Procopio,
              nos preocupamos com a entrega que fazemos aos nossos alunos e, por isso, estamos abrindo
              <strong style={{ color: 'var(--color-text-light-primary)' }}> aulas extras de reposição</strong>.
            </p>
            <p style={{ margin: 0 }}>
              Para conseguirmos atender toda a nossa demanda, cada pessoa pode agendar até
              <strong style={{ color: 'var(--color-text-light-primary)' }}> {MAX_REPOSICOES} aulas de reposição</strong> nestas
              <strong style={{ color: 'var(--color-text-light-primary)' }}> aulas extras</strong>, que não existem na nossa grade
              de aulas habitual. Elas são uma opção a mais: a ideia é justamente ampliar as possibilidades, e não limitar a
              reposição a estes horários.
            </p>
          </div>
        </div>
      </Cartao>

      <Nota cor="var(--color-state-info)" icone={<CalendarCheck size={18} />} style={{ marginBottom: '12px', fontSize: '14px', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 800, marginBottom: '4px' }}>Tem mais aulas a repor?</div>
        Você também pode repor nas <strong>turmas da grade regular</strong>, conforme a disponibilidade de vagas. Essas vagas você
        mesmo consulta no <strong>app do Beyond</strong>, e o agendamento deve ser feito e confirmado direto com a Procopio, pelo
        WhatsApp{' '}
        <a href={WHATSAPP_LINK_GRADE_REGULAR} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-action-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{WHATSAPP_EXIBIDO}</a>.
        Se depois disso ainda houver aulas a repor, faremos novos agendamentos — ninguém ficará sem a sua reposição.
      </Nota>

      <div style={{
        borderRadius: '14px', padding: '16px', marginBottom: '22px', boxSizing: 'border-box',
        backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
          <Gift size={18} style={{ color: 'var(--color-brand-lima)' }} /> E temos um presente para você
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.65, color: 'var(--color-text-dark-secondary)' }}>
          Como agradecimento pela paciência, todos os nossos alunos ganham <strong style={{ color: 'var(--color-text-dark-primary)' }}>1 aula gratuita</strong> para
          conhecer as outras modalidades que a Procopio opera. Você pode experimentar todas elas,
          mas é <strong style={{ color: 'var(--color-text-dark-primary)' }}>1 aula por modalidade</strong>:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {MODALIDADES_PRESENTE.map(m => (
            <span key={m.nome} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px 5px 6px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
              backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)',
            }}>
              <img src={m.img} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />{m.nome}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
        <Campo label="Nome completo do aluno">
          <input style={estiloInput} value={dados.nome} placeholder="Nome e sobrenome" autoComplete="name"
            onChange={e => setDados(d => ({ ...d, nome: e.target.value }))} />
        </Campo>
        <Campo label="Telefone (WhatsApp)">
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ ...estiloInput, width: 'auto', flexShrink: 0, color: 'var(--color-text-light-muted)' }}>+55</span>
            <input style={{ ...estiloInput, flex: 1 }} inputMode="numeric" placeholder="(11) 99999-9999" autoComplete="tel-national"
              value={mascararTelefoneBR(dados.telefone)}
              onChange={e => setDados(d => ({ ...d, telefone: apenasDigitosTelefone(e.target.value) }))} />
          </div>
        </Campo>
      </div>

      <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, margin: '26px 0 4px' }}>Sua turma atual de Tênis</div>
      <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-text-light-muted)', margin: '0 0 12px' }}>
        Usamos essas informações para nos organizarmos e para evitar choque com as aulas que você já tem.
      </p>

      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>
        Que tipo de aula você faz? <span style={{ fontWeight: 500, color: 'var(--color-text-light-muted)' }}>(pode marcar os dois)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {TIPOS.map(t => {
          const ativo = temTipo(t.chave)
          return (
            <button key={t.chave} type="button" onClick={() => alternarTipo(t.chave)} style={{
              cursor: 'pointer', textAlign: 'left', padding: '14px 12px', borderRadius: '14px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', gap: '4px', transition: 'all 0.12s',
              backgroundColor: ativo ? t.cor : 'var(--color-surface-light-overlay)', color: ativo ? t.corTexto : 'var(--color-text-light-primary)',
              border: `2px solid ${ativo ? t.cor : 'var(--color-border-light)'}`,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 800 }}><t.Icone size={17} />{t.rotulo}</span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>{t.sub}</span>
            </button>
          )
        })}
      </div>

      <Nota cor="var(--color-state-info)" icone={<Info size={16} />} style={{ marginBottom: '14px' }}>
        Quem faz <strong>só aula em Grupo</strong> repõe em aulas de Grupo. Quem faz <strong>aula Individual</strong> pode repor
        em aulas Individuais ou de Grupo.
      </Nota>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {TIPOS.filter(t => temTipo(t.chave)).map(t => {
          const doTipo = dados.turmas.map((tm, i) => ({ tm, i })).filter(x => x.tm.formato === t.chave)
          return (
            <div key={t.chave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {doTipo.map(({ tm, i }, n) => (
                <BlocoTurma key={i} turma={tm} tipo={t} ordem={n + 1} total={doTipo.length}
                  onChange={nt => setTurma(i, nt)} onRemover={() => removerTurma(i)} />
              ))}
              {doTipo.length < MAX_POR_TIPO && (
                <Botao variante="secundario" onClick={() => adicionarHorario(t.chave)} style={{ fontSize: '13px', padding: '11px' }}>
                  <Plus size={15} /> Adicionar outro horário de {t.chave === 'individual' ? 'aula Individual' : 'Grupo'}
                </Botao>
              )}
            </div>
          )
        })}
      </div>

      {erro && <Nota cor="var(--color-state-danger)" style={{ marginTop: '16px' }}>{erro}</Nota>}

      <div style={{ marginTop: '22px' }}>
        <Botao type="submit">Ver horários disponíveis</Botao>
      </div>
    </form>
  )
}
