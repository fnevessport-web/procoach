import { useQuery } from '@tanstack/react-query'
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns'
import { ArrowRight, CloudRain, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PainelFrequenciaMeses } from './PainelFrequenciaMeses'
import { Loading } from './ui/Loading'

// Bloco da ficha do aluno: saldo de reposição de chuva (grupo/individual, com prazo de 30 dias e
// o histórico de quando o crédito voltou porque a aula de reposição também choveu) + frequência
// do mês anterior e do atual. Mesma leitura que o aluno vê no link /reposicao (repo_painel).

const fmt = d => (d ? format(new Date(d + 'T12:00'), 'dd/MM') : '')

function statusFrequencia(p, hoje) {
  const a = p.aulas
  if (a.status_aula === 'cancelada') return a.motivo_cancelamento === 'Chuva' ? 'chuva' : 'cancelada'
  if (a.data_aula > hoje) return 'agendada'
  if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') return p.status_presenca
  if (a.data_aula === hoje && p.status_presenca !== 'presente') return 'agendada'
  return 'presente'
}

function useResumo(alunoId) {
  return useQuery({
    queryKey: ['resumo_reposicao_aluno', alunoId],
    enabled: !!alunoId,
    staleTime: 30000,
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd')
      const ini = format(startOfMonth(addMonths(new Date(), -1)), 'yyyy-MM-dd')
      const fim = format(endOfMonth(new Date()), 'yyyy-MM-dd')
      const [pres, repos] = await Promise.all([
        supabase.from('presencas')
          .select('status_presenca, aulas!inner(data_aula, status_aula, motivo_cancelamento)')
          .eq('aluno_id', alunoId).gte('aulas.data_aula', ini).lte('aulas.data_aula', fim),
        supabase.from('reposicoes')
          .select(`id, status, data_limite, historico, agendado_via,
            origem:aulas!aula_origem_id(data_aula, status_aula, motivo_cancelamento, turmas(horario_inicio, niveis(nome))),
            destino:aulas!aula_reposicao_id(data_aula, turmas(horario_inicio, niveis(nome)))`)
          .eq('aluno_id', alunoId),
      ])
      if (pres.error) throw pres.error
      const frequencia = (pres.data || []).map(p => ({ data: p.aulas.data_aula, status: statusFrequencia(p, hoje) }))
      const chuva = (repos.data || []).filter(r => r.origem?.status_aula === 'cancelada' && r.origem?.motivo_cancelamento === 'Chuva')
      return { frequencia, chuva, hoje }
    },
  })
}

function Tile({ rotulo, valor, cor }) {
  return (
    <div style={{ flex: '1 1 90px', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: cor || 'var(--color-text-light-primary)', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>{rotulo}</div>
    </div>
  )
}

export function ResumoReposicaoAluno({ alunoId }) {
  const { data, isLoading } = useResumo(alunoId)
  if (isLoading) return <Loading />
  if (!data) return null
  const { frequencia, chuva, hoje } = data

  const validos = chuva.filter(r => r.status === 'pendente' && (!r.data_limite || r.data_limite >= hoje))
  const ehInd = r => (r.origem?.turmas?.niveis?.nome || '').trim() === 'Individual'
  const grupo = validos.filter(r => !ehInd(r)).length
  const individual = validos.filter(ehInd).length
  const agendadas = chuva.filter(r => r.status === 'agendada').length
  const expiradas = chuva.filter(r => r.status === 'expirada' || (r.status === 'pendente' && r.data_limite && r.data_limite < hoje)).length
  const ordenados = [...chuva].sort((a, b) => (b.origem?.data_aula || '').localeCompare(a.origem?.data_aula || ''))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Tile rotulo="a repor em grupo" valor={grupo} cor={grupo ? 'var(--color-action-primary)' : undefined} />
        <Tile rotulo="a repor individual" valor={individual} cor={individual ? 'var(--color-state-info)' : undefined} />
        <Tile rotulo="já repostas / agendadas" valor={agendadas} cor="var(--color-state-success)" />
        <Tile rotulo="expiradas (30 dias)" valor={expiradas} cor={expiradas ? 'var(--color-state-danger)' : undefined} />
      </div>

      {ordenados.length > 0 && (
        <div style={{ borderRadius: '12px', border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)', padding: '2px 12px' }}>
          {ordenados.map(r => {
            const o = r.origem
            const vencida = r.status === 'expirada' || (r.status === 'pendente' && r.data_limite && r.data_limite < hoje)
            const cor = r.status === 'agendada' ? 'var(--color-state-success)' : vencida ? 'var(--color-text-light-muted)' : 'var(--color-action-primary)'
            const rotulo = r.status === 'agendada' ? (r.destino ? 'Agendada' : 'Reposta (grade extra)') : vencida ? 'Expirada' : `Pendente até ${fmt(r.data_limite)}`
            const historico = Array.isArray(r.historico) ? r.historico : []
            return (
              <div key={r.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--color-border-light-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', flexWrap: 'wrap' }}>
                  <CloudRain size={14} style={{ color: 'var(--color-state-info)', flexShrink: 0 }} />
                  <strong style={{ color: 'var(--color-text-light-primary)' }}>{fmt(o?.data_aula)} {o?.turmas?.horario_inicio?.slice(0, 5)}</strong>
                  <span style={{ color: 'var(--color-text-light-muted)' }}>{ehInd(r) ? 'individual' : 'grupo'}</span>
                  {historico.map((h, i) => (
                    <span key={i} title="Reposição também cancelada por chuva: crédito devolvido" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-state-warning)' }}>
                      <ArrowRight size={12} /> {fmt(h.data_aula)} <RotateCcw size={11} />
                    </span>
                  ))}
                  {r.destino && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-light-secondary)' }}>
                      <ArrowRight size={12} /> {fmt(r.destino.data_aula)} {r.destino.turmas?.horario_inicio?.slice(0, 5)}
                      {r.agendado_via === 'link' && <span style={{ fontSize: '10px', color: 'var(--color-text-light-muted)' }}>(pelo link)</span>}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: cor }}>{rotulo}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PainelFrequenciaMeses frequencia={frequencia} />
    </div>
  )
}
