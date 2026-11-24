import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { Repeat, CloudRain, MessageCircle, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { nomeProfessor } from '../../lib/nomes'
import { ModalCardAluno } from '../../components/ModalCardAluno'

// Dashboard (contexto Escuro): todos os alunos que vêm REPOR hoje (ou amanhã), por horário.
// Pedido de 23/11/2026: quando chove o clube avisa os fixos, mas quem está repondo só a Procopio
// sabe, e antes era preciso abrir turma por turma pra achar. Clicar no nome abre a ficha do aluno
// (contatos); o ícone do WhatsApp abre a conversa direto.
function useReposicoesDoDia(dia) {
  return useQuery({
    queryKey: ['home_reposicoes_dia', dia],
    staleTime: 60000,
    refetchInterval: 120000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presencas')
        .select(`aluno_id, status_presenca, criado_por_nome,
          alunos(id, nome, telefone, telefone_responsavel),
          aulas!inner(id, data_aula, horario, status_aula, motivo_cancelamento,
            turmas(horario_inicio, niveis(nome), quadras(nome), modalidades(nome)),
            professores!professor_executou_id(nome, apelido))`)
        .eq('tipo_participacao', 'reposicao')
        .eq('aulas.data_aula', dia)
      if (error) throw error
      return (data || [])
        .filter(p => p.alunos)
        .map(p => ({
          alunoId: p.aluno_id,
          nome: p.alunos.nome,
          telefone: p.alunos.telefone || p.alunos.telefone_responsavel || null,
          horario: (p.aulas.turmas?.horario_inicio || p.aulas.horario || '').slice(0, 5),
          nivel: p.aulas.turmas?.niveis?.nome?.trim() || '',
          quadra: p.aulas.turmas?.quadras?.nome || '',
          modalidade: p.aulas.turmas?.modalidades?.nome || '',
          professor: p.aulas.professores ? nomeProfessor(p.aulas.professores) : '',
          cancelada: p.aulas.status_aula === 'cancelada',
          chuva: p.aulas.status_aula === 'cancelada' && p.aulas.motivo_cancelamento === 'Chuva',
          avisouFalta: p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada',
          peloLink: (p.criado_por_nome || '').startsWith('Link de reposi'),
        }))
        .sort((a, b) => a.horario.localeCompare(b.horario) || a.nome.localeCompare(b.nome))
    },
  })
}

function textoWhats(r, ehHoje) {
  const primeiro = (r.nome || '').trim().split(' ')[0]
  const quando = `${ehHoje ? 'hoje' : 'amanhã'} às ${r.horario}`
  if (r.chuva) {
    return `Olá, ${primeiro}! Aqui é da Procopio. Por causa da chuva, a sua aula de reposição de ${quando} foi cancelada. A reposição voltou para o seu saldo e você pode agendar outro horário pelo link de reposição.`
  }
  return `Olá, ${primeiro}! Aqui é da Procopio, sobre a sua aula de reposição de ${quando}.`
}

export function ReposicoesDoDia() {
  const [ehHoje, setEhHoje] = useState(true)
  const dia = format(ehHoje ? new Date() : addDays(new Date(), 1), 'yyyy-MM-dd')
  const { data: lista = [], isLoading } = useReposicoesDoDia(dia)
  const [alunoFicha, setAlunoFicha] = useState(null)

  const porHorario = lista.reduce((acc, r) => { (acc[r.horario] ||= []).push(r); return acc }, {})
  const qtdChuva = lista.filter(r => r.chuva).length

  return (
    <div style={{
      marginBottom: '22px', borderRadius: '14px', padding: '14px 16px',
      backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid rgba(61,107,122,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
          <Repeat size={14} color="var(--color-state-info)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Reposições {ehHoje ? 'de hoje' : 'de amanhã'} · {lista.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {[['Hoje', true], ['Amanhã', false]].map(([rotulo, v]) => (
            <button key={rotulo} onClick={() => setEhHoje(v)} style={{
              padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              border: ehHoje === v ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border-dark)',
              backgroundColor: ehHoje === v ? 'rgba(165,76,46,0.15)' : 'transparent',
              color: ehHoje === v ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)',
            }}>{rotulo}</button>
          ))}
        </div>
      </div>

      {qtdChuva > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-state-info)', marginBottom: '10px' }}>
          <CloudRain size={12} style={{ flexShrink: 0 }} />
          {qtdChuva} {qtdChuva === 1 ? 'aluno teve a reposição cancelada' : 'alunos tiveram a reposição cancelada'} por chuva. O crédito já voltou; falta só avisar.
        </div>
      )}

      {isLoading ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-dark-muted)' }}>Carregando…</div>
      ) : lista.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-dark-muted)' }}>Nenhum aluno marcou reposição para {ehHoje ? 'hoje' : 'amanhã'}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(porHorario).map(([horario, itens]) => (
            <div key={horario}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-dark-primary)', marginBottom: '4px' }}>{horario}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {itens.map(r => (
                  <div key={`${r.alunoId}-${horario}-${r.nivel}`} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', borderRadius: '8px',
                    backgroundColor: 'var(--color-surface-dark-overlay)',
                  }}>
                    <button onClick={() => setAlunoFicha(r.alunoId)} title="Abrir ficha do aluno" style={{
                      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px',
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '100%', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-dark-primary)', textDecoration: 'underline', textDecorationColor: 'var(--color-border-dark)', textUnderlineOffset: '3px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span>
                        <ChevronRight size={12} color="var(--color-text-dark-muted)" style={{ flexShrink: 0 }} />
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {[r.nivel, r.professor && `Prof. ${r.professor}`, r.quadra].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    {r.chuva ? (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', backgroundColor: 'rgba(61,107,122,0.2)', color: 'var(--color-state-info)', flexShrink: 0 }}>chuva</span>
                    ) : r.cancelada ? (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', backgroundColor: 'rgba(180,71,47,0.15)', color: 'var(--color-state-danger)', flexShrink: 0 }}>cancelada</span>
                    ) : r.avisouFalta ? (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', backgroundColor: 'rgba(201,138,60,0.15)', color: 'var(--color-state-warning)', flexShrink: 0 }}>avisou falta</span>
                    ) : null}
                    {r.telefone && (
                      <button onClick={() => {
                        const base = r.telefone.replace(/\D/g, '')
                        const comDdi = base.length > 11 ? base : `55${base}`
                        const texto = encodeURIComponent(textoWhats(r, ehHoje))
                        const celular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                        if (celular) window.open(`https://wa.me/${comDdi}?text=${texto}`, '_blank')
                        else window.location.href = `whatsapp://send?phone=${comDdi}&text=${texto}`
                      }} title="Chamar no WhatsApp" style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px',
                        borderRadius: '8px', border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent',
                        color: 'var(--color-text-dark-secondary)', cursor: 'pointer',
                      }}>
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {alunoFicha && (
        <ModalCardAluno alunoId={alunoFicha} theme="theme-light" rotuloVoltar="Fechar" onClose={() => setAlunoFicha(null)} />
      )}
    </div>
  )
}
