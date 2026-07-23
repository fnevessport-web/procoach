import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useReposicoesDoAluno } from '../hooks/useAulas'
import { calcStatusPorPrazo } from '../constants/reposicao'
import { Loading } from './ui/Loading'
import { GradeSemanalReposicao } from './GradeSemanalReposicao'

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
  // { modalidadeId, proximaFalta } | null — mesma grade semanal usada em AulasAdmin.jsx pra
  // escolher a aula de reposição, agora acessível direto daqui em vez do fluxo antigo
  // (/agenda-aluno).
  const [agendando, setAgendando] = useState(null)

  if (isLoading) return <Loading />
  if (!reposicoes?.length) {
    return <div style={{ fontSize: '12px', color: 'var(--color-text-light-muted)' }}>Nenhuma reposição registrada</div>
  }

  // Clica no card e vai direto pra aula — prioriza a reposição (é a mais relevante quando já
  // existe); se ainda tá pendente, sem destino marcado, abre a aula onde a falta aconteceu.
  function abrirAula(dataStr, aulaId) {
    if (!dataStr || !aulaId) return
    navigate('/aulas', { state: { data: dataStr, highlightAulaId: aulaId } })
  }

  // A baixa é sempre FIFO (a falta pendente mais antiga da modalidade) — não importa em qual
  // card "Agendar reposição" foi clicado, então recalcula sempre a mais antiga de verdade pra
  // a faixa "vai baixar" da grade não mostrar uma data errada.
  function iniciarAgendamento(modalidadeId) {
    const pendentesModalidade = (reposicoes || [])
      .filter(r => r.status === 'pendente' && r.modalidades?.id === modalidadeId)
      .sort((a, b) => (a.aula_origem?.data_aula || '').localeCompare(b.aula_origem?.data_aula || ''))
    const maisAntiga = pendentesModalidade[0]
    setAgendando({
      modalidadeId,
      proximaFalta: maisAntiga?.aula_origem?.data_aula ? { dataAula: maisAntiga.aula_origem.data_aula } : null,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {reposicoes.map(r => {
        const status = calcStatusPorPrazo(r.data_limite)
        const cor = r.status === 'expirada' ? 'var(--color-text-light-secondary)' : r.status === 'agendada' ? 'var(--color-state-success)' : status.cor
        const temDestino = r.status !== 'pendente' && r.aula_reposicao?.data_aula
        const clicavel = temDestino ? r.aula_reposicao_id : r.aula_origem_id
        const dataClicavel = temDestino ? r.aula_reposicao.data_aula : r.aula_origem?.data_aula

        return (
          <button
            key={r.id}
            onClick={() => abrirAula(dataClicavel, clicavel)}
            style={{
              padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
              textAlign: 'left', cursor: clicavel ? 'pointer' : 'default', width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', fontWeight: '600' }}>
                {r.modalidades?.nome || 'Modalidade não identificada'}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '5px',
                backgroundColor: `${cor}22`, color: cor, textTransform: 'uppercase',
              }}>
                {STATUS_LABEL[r.status] || r.status}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Faltou</div>
                <div style={{ color: 'var(--color-text-light-primary)', fontWeight: '600', marginTop: '2px' }}>{fmtData(r.aula_origem?.data_aula)}</div>
              </div>
              <span style={{ color: temDestino ? 'var(--color-state-success)' : 'var(--color-state-info)', fontSize: '16px', flexShrink: 0 }}>→</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: temDestino ? 'var(--color-state-success)' : 'var(--color-state-info)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {r.status === 'pendente' ? 'Ainda por repor' : 'Repôs em'}
                </div>
                <div style={{ color: 'var(--color-text-light-primary)', fontWeight: '600', marginTop: '2px' }}>
                  {temDestino ? fmtData(r.aula_reposicao.data_aula) : '—'}
                </div>
                {temDestino && (r.aula_reposicao?.turmas?.nome || r.aula_reposicao?.turmas?.quadras?.nome) && (
                  <div style={{ color: 'var(--color-text-light-secondary)', fontSize: '11px', marginTop: '1px' }}>
                    {r.aula_reposicao.turmas?.nome || r.aula_reposicao.turmas?.quadras?.nome}
                  </div>
                )}
              </div>
            </div>

            {r.status === 'pendente' && (
              <>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-text-light-muted)' }}>Prazo: {fmtData(r.data_limite)}</span>
                    <span style={{ color: status.cor, fontWeight: '600' }}>{status.label}</span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${status.progresso}%`, height: '100%', backgroundColor: status.cor, borderRadius: '2px' }} />
                  </div>
                </div>
                <div
                  onClick={e => { e.stopPropagation(); iniciarAgendamento(r.modalidades?.id) }}
                  style={{
                    width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', border: 'none',
                    background: 'rgba(165,76,46,0.12)', color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  Agendar reposição
                </div>
              </>
            )}
          </button>
        )
      })}

      {agendando && (
        <GradeSemanalReposicao
          aluno={{ id: alunoId, nome: alunoNome }}
          modalidadeId={agendando.modalidadeId}
          proximaFalta={agendando.proximaFalta}
          onVoltar={() => setAgendando(null)}
          onFecharTudo={() => setAgendando(null)}
        />
      )}
    </div>
  )
}
