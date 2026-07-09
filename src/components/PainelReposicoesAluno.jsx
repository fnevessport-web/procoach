import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useReposicoesDoAluno } from '../hooks/useAulas'
import { calcStatusPorPrazo } from '../constants/reposicao'
import { Loading } from './ui/Loading'

const STATUS_LABEL = {
  pendente: 'Pendente',
  agendada: 'Agendada',
  expirada: 'Expirada',
}

function fmtData(d) {
  return d ? format(new Date(d + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

// Painel "Minhas Reposições" (Fase 2) — embutido no card do aluno. Mostra os créditos de
// reposição gerados por cancelamento de aula (força maior), com prazo de 60 dias.
export function PainelReposicoesAluno({ alunoId, alunoNome }) {
  const navigate = useNavigate()
  const { data: reposicoes, isLoading } = useReposicoesDoAluno(alunoId)

  if (isLoading) return <Loading />
  if (!reposicoes?.length) {
    return <div style={{ fontSize: '12px', color: '#444' }}>Nenhuma reposição registrada</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {reposicoes.map(r => {
        const status = calcStatusPorPrazo(r.data_limite)
        const cor = r.status === 'expirada' ? '#555' : r.status === 'agendada' ? '#22c55e' : status.cor
        return (
          <div key={r.id} style={{
            padding: '12px 14px', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #2a2a2a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>
                {r.modalidades?.nome || 'Modalidade não identificada'}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '5px',
                backgroundColor: `${cor}22`, color: cor, textTransform: 'uppercase',
              }}>
                {STATUS_LABEL[r.status] || r.status}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              Gerada em {fmtData(r.created_at?.slice(0, 10))}
              {r.aula_origem?.data_aula && ` · falta de ${fmtData(r.aula_origem.data_aula)}`}
            </div>

            {r.status === 'pendente' && (
              <>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                    <span style={{ color: '#444' }}>Prazo: {fmtData(r.data_limite)}</span>
                    <span style={{ color: status.cor, fontWeight: '600' }}>{status.label}</span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${status.progresso}%`, height: '100%', backgroundColor: status.cor, borderRadius: '2px' }} />
                  </div>
                </div>
                <button
                  onClick={() => navigate('/agenda-aluno', { state: { alunoId, alunoNome, modalidadeId: r.modalidades?.id } })}
                  style={{
                    width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', border: 'none',
                    background: 'rgba(252,200,37,0.12)', color: '#fcc825', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Agendar reposição
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
