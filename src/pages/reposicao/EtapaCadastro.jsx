import { useState } from 'react'
import { CloudRain, Gift, Plus, Trash2 } from 'lucide-react'
import { mascararTelefoneBR, apenasDigitosTelefone } from '../../lib/telefone'
import {
  DIAS, HORARIOS, NIVEIS_ADULTO, NIVEIS_KIDS, TURMA_VAZIA, MODALIDADES_PRESENTE, MAX_REPOSICOES,
  COR_ADULTO, COR_KIDS, estiloInput,
} from './constantes'
import { Titulo, Cartao, Nota, Botao, Campo, Chip } from './ui'

const MAX_TURMAS = 3

function validar(dados) {
  if (dados.nome.trim().split(/\s+/).filter(Boolean).length < 2) return 'Informe o nome completo do aluno.'
  if (dados.telefone.length < 10) return 'Informe o telefone com DDD.'
  for (const t of dados.turmas) {
    if (!t.dias.length) return 'Marque ao menos um dia da semana da sua turma atual.'
    if (!t.horario) return 'Marque o horário da sua turma atual.'
    if (!t.formato) return 'Informe se a sua aula é Individual ou em Grupo.'
    if (t.formato === 'grupo' && !t.nivel) return 'Escolha o nível da sua turma.'
  }
  return ''
}

function BlocoTurma({ turma, indice, total, onChange, onRemover }) {
  const set = patch => onChange({ ...turma, ...patch })
  const toggleDia = key => set({ dias: turma.dias.includes(key) ? turma.dias.filter(d => d !== key) : [...turma.dias, key] })

  return (
    <Cartao style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-light-muted)' }}>Turma {indice + 1}</span>
          <button type="button" onClick={onRemover} aria-label="Remover turma" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)', display: 'flex', padding: '4px' }}>
            <Trash2 size={16} />
          </button>
        </div>
      )}

      <Campo label="Dias da semana">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
          {DIAS.map(d => <Chip key={d.key} ativo={turma.dias.includes(d.key)} onClick={() => toggleDia(d.key)} style={{ padding: '10px 0', fontSize: '12px' }}>{d.label}</Chip>)}
        </div>
      </Campo>

      <Campo label="Horário da aula">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {HORARIOS.map(h => (
            <Chip key={h} ativo={turma.horario === h} onClick={() => set({ horario: h })} style={{ padding: '10px 0', fontSize: '12px' }}>
              {Number(h.slice(0, 2))}h
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Tipo de aula">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Chip ativo={turma.formato === 'individual'} onClick={() => set({ formato: 'individual', nivel: '' })}>Individual</Chip>
          <Chip ativo={turma.formato === 'grupo'} onClick={() => set({ formato: 'grupo' })}>Grupo</Chip>
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

  const setTurma = (i, t) => setDados(d => ({ ...d, turmas: d.turmas.map((x, j) => (j === i ? t : x)) }))

  return (
    <form onSubmit={enviar} style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Aulas extras">Vamos repor as suas aulas</Titulo>

      <Cartao style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <CloudRain size={22} style={{ color: 'var(--color-state-info)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)' }}>
            <p style={{ margin: '0 0 10px' }}>
              Nas últimas semanas a chuva nos impediu de realizar muitas aulas de Tênis. Nós, da Procópio,
              nos preocupamos com a entrega que fazemos aos nossos alunos e, por isso, estamos abrindo
              <strong style={{ color: 'var(--color-text-light-primary)' }}> aulas extras de reposição</strong>.
            </p>
            <p style={{ margin: 0 }}>
              Para conseguirmos atender toda a nossa demanda, cada pessoa pode agendar até
              <strong style={{ color: 'var(--color-text-light-primary)' }}> {MAX_REPOSICOES} aulas de reposição</strong> neste
              primeiro momento. Se depois disso ainda houver aulas a repor, faremos novos agendamentos —
              ninguém ficará sem a sua reposição.
            </p>
          </div>
        </div>
      </Cartao>

      <div style={{
        borderRadius: '14px', padding: '16px', marginBottom: '22px', boxSizing: 'border-box',
        backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
          <Gift size={18} style={{ color: 'var(--color-brand-lima)' }} /> E temos um presente para você
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.65, color: 'var(--color-text-dark-secondary)' }}>
          Como agradecimento pela paciência, todos os nossos alunos ganham <strong style={{ color: 'var(--color-text-dark-primary)' }}>1 aula gratuita</strong> para
          conhecer as outras modalidades que a Procópio opera. Você pode experimentar todas elas,
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
        Se tiver aulas em horários diferentes, adicione outra turma.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {dados.turmas.map((t, i) => (
          <BlocoTurma key={i} turma={t} indice={i} total={dados.turmas.length}
            onChange={nt => setTurma(i, nt)}
            onRemover={() => setDados(d => ({ ...d, turmas: d.turmas.filter((_, j) => j !== i) }))} />
        ))}
        {dados.turmas.length < MAX_TURMAS && (
          <Botao variante="secundario" onClick={() => setDados(d => ({ ...d, turmas: [...d.turmas, { ...TURMA_VAZIA }] }))} style={{ fontSize: '13px', padding: '11px' }}>
            <Plus size={15} /> Adicionar outra turma
          </Botao>
        )}
      </div>

      {erro && <Nota cor="var(--color-state-danger)" style={{ marginTop: '16px' }}>{erro}</Nota>}

      <div style={{ marginTop: '22px' }}>
        <Botao type="submit">Ver horários disponíveis</Botao>
      </div>
    </form>
  )
}
