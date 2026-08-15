import { useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import { CalendarDays, DollarSign } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { useAulas } from '../../hooks/useAulas'
import { useAlunos } from '../../hooks/useAlunos'
import { useContratantes } from '../../hooks/useContratantes'
import { useValoresParticular } from '../../hooks/useValoresParticular'
import { usePagamentosAlunos, usePagamentosContratantes } from '../../hooks/useFinanceiroParticular'
import { BarraAdimplencia } from './FinanceiroParticular'
import { Loading } from '../../components/ui/Loading'

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function labelAula(aula) {
  return aula.turmas?.nome || aula.contratantes?.nome || aula.presencas?.[0]?.alunos?.nome || 'Aula avulsa'
}
function horarioAula(aula) {
  return aula.turmas?.horario_inicio?.slice(0, 5) || aula.horario?.slice(0, 5) || '—'
}

function ordenar(lista) {
  return [...lista].sort((a, b) => horarioAula(a).localeCompare(horarioAula(b)))
}

function SecaoAulas({ titulo, aulas, carregando }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '16px',
      border: '1px solid rgba(165,76,46,0.2)', padding: '18px', marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
          {titulo}
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{aulas.length}</div>
      </div>
      {carregando ? <Loading text="Carregando..." /> : aulas.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-dark-muted)', textAlign: 'center', padding: '8px 0' }}>
          Nenhuma aula agendada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ordenar(aulas).map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '10px', backgroundColor: 'var(--color-surface-dark-overlay)',
            }}>
              <div style={{
                width: '40px', flexShrink: 0, fontSize: '11px', fontWeight: '700',
                color: 'var(--color-action-primary)', textAlign: 'center',
              }}>{horarioAula(a)}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', fontWeight: '600' }}>{labelAula(a)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Home do modo Particular (profissional autônomo assinante). Fase 2: "aulas hoje"/"aulas
// amanhã" de verdade, sem indicador de "ao vivo" (pedido explícito) e sem nenhum widget de
// CLUBE — nada de Ranking/Pontuação Beyond aqui, mesmo que existam componentes prontos pra
// isso; essa página não importa nada de src/pages/home/HomePage.jsx. O resumo financeiro
// abaixo é o do próprio Particular (FinanceiroParticular.jsx), não do clube.
export function HomeParticular() {
  const navigate = useNavigate()
  const { perfil, empresaSelecionada } = useAppStore()
  const empresaId = empresaSelecionada?.id

  const hoje = format(new Date(), 'yyyy-MM-dd')
  const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const { data: aulasHoje = [], isLoading: carregandoHoje } = useAulas({ empresaId, data: hoje })
  const { data: aulasAmanha = [], isLoading: carregandoAmanha } = useAulas({ empresaId, data: amanha })

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: '0 0 6px' }}>
        Olá, {perfil?.nome?.split(' ')[0] || 'professor'}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', margin: '0 0 20px' }}>
        Sua prática particular no ProCoach.
      </p>

      <ResumoFinanceiro empresaId={empresaId} />

      <SecaoAulas titulo="Aulas hoje" aulas={aulasHoje} carregando={carregandoHoje} />
      <SecaoAulas titulo="Aulas amanhã" aulas={aulasAmanha} carregando={carregandoAmanha} />

      <button
        onClick={() => navigate('/aulas')}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          width: '100%', padding: '16px', borderRadius: '16px',
          backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid rgba(165,76,46,0.25)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
          backgroundColor: 'rgba(165,76,46,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CalendarDays size={20} color="var(--color-action-primary)" />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>Ver Agenda completa</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>
            Organizar sua semana de aulas
          </div>
        </div>
      </button>

      <button
        onClick={() => navigate('/financeiro')}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          width: '100%', padding: '16px', borderRadius: '16px', marginTop: '10px',
          backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid rgba(165,76,46,0.25)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
          backgroundColor: 'rgba(165,76,46,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DollarSign size={20} color="var(--color-action-primary)" />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>Ver Financeiro</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>
            Adimplência, comprovantes e vencimentos
          </div>
        </div>
      </button>
    </div>
  )
}

// Valor estimado (tudo que está agendado no mês) x valor real (só o que já aconteceu) +
// mini-gráfico de adimplência do mês corrente — mesma lógica de useValoresParticular/
// FinanceiroParticular.jsx, versão compacta pro dashboard.
function ResumoFinanceiro({ empresaId }) {
  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const ano = hoje.getFullYear()

  const { data: valores, isLoading: carregandoValores } = useValoresParticular({ empresaId, mes, ano })
  const { data: alunos = [] } = useAlunos(null, empresaId)
  const { data: contratantes = [] } = useContratantes(empresaId)
  const { data: pagamentosAlunos = [] } = usePagamentosAlunos({ empresaId, mes, ano })
  const { data: pagamentosContratantes = [] } = usePagamentosContratantes({ empresaId, mes, ano })

  if (carregandoValores) return null

  const idsPagosAlunos = new Set(pagamentosAlunos.filter(p => p.status === 'pago').map(p => p.aluno_id))
  const idsPagosContratantes = new Set(pagamentosContratantes.filter(p => p.status === 'pago').map(p => p.contratante_id))
  const contratantesTerceiro = contratantes.filter(c => c.tipo === 'terceiro')
  const totalCobrancas = alunos.length + contratantesTerceiro.length
  const pagos = alunos.filter(a => idsPagosAlunos.has(a.id)).length + contratantesTerceiro.filter(c => idsPagosContratantes.has(c.id)).length

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '16px',
      border: '1px solid rgba(165,76,46,0.2)', padding: '18px', marginBottom: '14px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '12px' }}>
        Financeiro do mês
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: totalCobrancas > 0 ? '14px' : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: 'var(--color-text-dark-muted)', marginBottom: '2px' }}>Estimado</div>
          <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{fmtBRL(valores?.estimado)}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: 'var(--color-text-dark-muted)', marginBottom: '2px' }}>Real (aulas dadas)</div>
          <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--color-state-success)' }}>{fmtBRL(valores?.real)}</div>
        </div>
      </div>
      {totalCobrancas > 0 && <BarraAdimplencia pagos={pagos} pendentes={totalCobrancas - pagos} />}
    </div>
  )
}
