import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarCheck, Check, CloudRain, FileDown, ListPlus, MessageCircle, Phone, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { abrirWhatsApp, mascararTelefoneBR } from '../../lib/telefone'
import { Loading } from '../../components/ui/Loading'
import { DIAS_SEMANA, FAIXAS_HORARIO, diaCurto, partesNivel } from '../reposicaoOficial/regras'

// Visão interna do link oficial de reposição (/reposicao, grade regular): quem agendou pelo
// link, saldo de créditos de chuva em aberto e a lista de espera (pra abrir aula extra quando
// juntar quórum). Grava/consulta direto nas tabelas (usuário logado), ver
// scripts/2026-10-29_reposicao_link_oficial.sql.

const cartao = {
  backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
  borderRadius: '12px', boxSizing: 'border-box',
}

function useAgendamentosLink() {
  return useQuery({
    queryKey: ['repo-link-agendamentos'],
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reposicoes')
        .select(`id, agendado_em, status, historico, alunos(nome, telefone, telefone_responsavel),
          origem:aulas!aula_origem_id(data_aula, turmas(horario_inicio)),
          destino:aulas!aula_reposicao_id(data_aula, status_aula, turmas(horario_inicio, niveis(nome), professores:professor_titular_id(nome)))`)
        .eq('agendado_via', 'link')
        .order('agendado_em', { ascending: false })
        .limit(500)
      if (error) throw error
      return data || []
    },
  })
}

function useResumoCreditos() {
  return useQuery({
    queryKey: ['repo-link-creditos'],
    staleTime: 60000,
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('reposicoes')
        .select('aluno_id, data_limite, aulas!aula_origem_id!inner(status_aula, motivo_cancelamento)')
        .eq('status', 'pendente')
        .eq('aulas.status_aula', 'cancelada')
        .eq('aulas.motivo_cancelamento', 'Chuva')
        .gte('data_limite', hoje)
        .limit(5000)
      if (error) throw error
      const em7 = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')
      return {
        creditos: data.length,
        alunos: new Set(data.map(r => r.aluno_id)).size,
        vencendo: data.filter(r => r.data_limite <= em7).length,
      }
    },
  })
}

function useListaEspera() {
  return useQuery({
    queryKey: ['repo-lista-espera'],
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from('reposicao_lista_espera').select('*').order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

const rotuloDia = k => DIAS_SEMANA.find(d => d.key === k)?.label || k
const rotuloFaixa = k => FAIXAS_HORARIO.find(f => f.key === k)?.label || k

async function baixarPdfListaEspera(lista) {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text('Lista de espera de reposição · Tênis', 12, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Procopio · gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} · ${lista.length} pessoas aguardando`, 12, 22)
  autoTable(doc, {
    startY: 27, margin: { left: 12, right: 12 },
    head: [['Aluno', 'Telefone', 'Nível', 'Formato', 'Dias', 'Horários', 'Observação', 'Desde']],
    body: lista.map(l => [l.nome, l.telefone, l.nivel || '', l.formato || '', l.dias.map(rotuloDia).join(', '),
      l.faixas.map(rotuloFaixa).join(', '), l.observacao || '', format(new Date(l.criado_em), 'dd/MM')]),
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 43, 36], textColor: [240, 234, 216] },
  })
  doc.save(`Lista_Espera_Reposicao_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

function AbaAgendamentos() {
  const { data = [], isLoading } = useAgendamentosLink()
  const [busca, setBusca] = useState('')
  const filtrados = data.filter(r => !busca || (r.alunos?.nome || '').toLowerCase().includes(busca.toLowerCase()))
  if (isLoading) return <Loading />
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '12px', maxWidth: '360px' }}>
        <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light-muted)' }} />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar aluno"
          style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: '10px', border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
      </div>
      {filtrados.length === 0 ? (
        <div style={{ ...cartao, padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)' }}>Nenhum agendamento pelo link ainda.</div>
      ) : (
        <div style={{ ...cartao, overflow: 'hidden' }}>
          {filtrados.map(r => {
            const d = r.destino
            const cancelada = d?.status_aula === 'cancelada' || r.status !== 'agendada'
            const tel = r.alunos?.telefone || r.alunos?.telefone_responsavel
            return (
              <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', padding: '11px 14px', borderBottom: '1px solid var(--color-border-light-subtle)' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{r.alunos?.nome}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-light-muted)' }}>
                    agendou em {r.agendado_em ? format(new Date(r.agendado_em), 'dd/MM HH:mm') : '—'}
                    {r.origem?.data_aula ? ` · repõe a aula de ${diaCurto(r.origem.data_aula)}` : ''}
                  </div>
                </div>
                <div style={{ flex: '1 1 220px', fontSize: '13px' }}>
                  {d ? (
                    <span style={{ textDecoration: cancelada ? 'line-through' : 'none', color: cancelada ? 'var(--color-text-light-muted)' : 'var(--color-text-light-primary)' }}>
                      <strong>{diaCurto(d.data_aula)} · {d.turmas?.horario_inicio?.slice(0, 5)}</strong> · {partesNivel(d.turmas?.niveis?.nome).titulo}
                      {d.turmas?.professores?.nome ? ` · Prof. ${d.turmas.professores.nome.split(' ')[0]}` : ''}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-state-warning)', fontWeight: 600 }}>Crédito devolvido (aula cancelada por chuva)</span>
                  )}
                </div>
                {tel && (
                  <button type="button" onClick={() => abrirWhatsApp(tel)} title="WhatsApp" style={{ border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', backgroundColor: 'rgba(37,211,102,0.12)', color: '#25D166', display: 'flex' }}>
                    <MessageCircle size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AbaListaEspera({ podeEditar }) {
  const qc = useQueryClient()
  const { data = [], isLoading } = useListaEspera()
  const [verTodos, setVerTodos] = useState(false)
  const atualizar = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('reposicao_lista_espera').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repo-lista-espera'] }),
    onError: () => toast.error('Não foi possível atualizar.'),
  })

  const aguardando = data.filter(l => l.status === 'aguardando')
  const lista = verTodos ? data : aguardando

  // Mapa dia × faixa: quantas pessoas aguardando cabem em cada combinação, pra enxergar onde já
  // dá quórum de uma aula extra.
  const mapa = useMemo(() => {
    const m = {}
    aguardando.forEach(l => l.dias.forEach(d => l.faixas.forEach(f => { m[`${d}|${f}`] = (m[`${d}|${f}`] || 0) + 1 })))
    return m
  }, [aguardando])
  const maximo = Math.max(1, ...Object.values(mapa))

  if (isLoading) return <Loading />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ ...cartao, padding: '14px', overflowX: 'auto' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Onde já dá quórum (pessoas aguardando por dia e horário)</div>
        <table style={{ borderCollapse: 'separate', borderSpacing: '4px', fontSize: '12px' }}>
          <thead>
            <tr>
              <th />
              {DIAS_SEMANA.map(d => <th key={d.key} style={{ fontWeight: 700, color: 'var(--color-text-light-muted)', padding: '2px 6px' }}>{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {FAIXAS_HORARIO.map(f => (
              <tr key={f.key}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-light-secondary)', paddingRight: '6px' }}>{f.label}</td>
                {DIAS_SEMANA.map(d => {
                  const n = mapa[`${d.key}|${f.key}`] || 0
                  return (
                    <td key={d.key} style={{
                      width: '46px', height: '32px', textAlign: 'center', borderRadius: '8px', fontWeight: 800,
                      backgroundColor: n ? `color-mix(in srgb, var(--color-action-primary) ${Math.round(15 + 70 * n / maximo)}%, transparent)` : 'var(--color-surface-light-base)',
                      color: n / maximo > 0.5 ? 'var(--color-action-on-primary)' : 'var(--color-text-light-primary)',
                    }}>{n || ''}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--color-text-light-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={verTodos} onChange={e => setVerTodos(e.target.checked)} /> Mostrar também atendidos e cancelados
        </label>
        <button type="button" onClick={() => baixarPdfListaEspera(aguardando)} disabled={!aguardando.length} style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
        }}><FileDown size={14} /> Baixar PDF da lista</button>
      </div>

      {lista.length === 0 ? (
        <div style={{ ...cartao, padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)' }}>Ninguém na lista de espera.</div>
      ) : (
        <div style={{ ...cartao, overflow: 'hidden' }}>
          {lista.map(l => (
            <div key={l.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', padding: '11px 14px', borderBottom: '1px solid var(--color-border-light-subtle)', opacity: l.status === 'aguardando' ? 1 : 0.55 }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{l.nome}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-light-muted)' }}>
                  {l.nivel || 'nível não informado'} · {l.formato || ''} · desde {format(new Date(l.criado_em), 'dd/MM')}
                  {l.status !== 'aguardando' ? ` · ${l.status}` : ''}
                </div>
              </div>
              <div style={{ flex: '2 1 260px', fontSize: '12.5px', color: 'var(--color-text-light-secondary)' }}>
                <strong style={{ color: 'var(--color-text-light-primary)' }}>{l.dias.map(rotuloDia).join(' · ')}</strong> · {l.faixas.map(rotuloFaixa).join(', ')}
                {l.observacao && <div style={{ fontStyle: 'italic', marginTop: '2px' }}>"{l.observacao}"</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => abrirWhatsApp(l.telefone)} title={l.telefone} style={{ border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', backgroundColor: 'rgba(37,211,102,0.12)', color: '#25D166', display: 'flex' }}>
                  <MessageCircle size={15} />
                </button>
                {podeEditar && l.status === 'aguardando' && (
                  <>
                    <button type="button" onClick={() => atualizar.mutate({ id: l.id, status: 'atendido' })} title="Marcar como atendido" style={{ border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-state-success) 12%, transparent)', color: 'var(--color-state-success)', display: 'flex' }}>
                      <Check size={15} />
                    </button>
                    <button type="button" onClick={() => atualizar.mutate({ id: l.id, status: 'cancelado' })} title="Tirar da lista" style={{ border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-state-danger) 10%, transparent)', color: 'var(--color-state-danger)', display: 'flex' }}>
                      <X size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Telefones novos informados no link por quem entrou pelo nome (o digitado não batia com o
// cadastro). A equipe confere e aplica no campo certo (scripts/2026-10-29b_reposicao_link_correcoes.sql).
function useTelefonesNovos() {
  return useQuery({
    queryKey: ['repo-telefones-novos'],
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from('repo_telefone_atualizacoes').select('*').order('criado_em', { ascending: false }).limit(300)
      if (error) throw error
      return data || []
    },
  })
}

const CAMPOS_TELEFONE = [['telefone', 'Aluno'], ['telefone_responsavel', 'Responsável'], ['telefone_responsavel_2', 'Responsável 2']]

function AbaTelefones({ podeEditar }) {
  const qc = useQueryClient()
  const { data = [], isLoading } = useTelefonesNovos()
  const [verTodos, setVerTodos] = useState(false)
  const aplicar = useMutation({
    mutationFn: async ({ item, campo }) => {
      if (campo) {
        const { error } = await supabase.from('alunos').update({ [campo]: item.telefone_novo }).eq('id', item.aluno_id)
        if (error) throw error
      }
      const { error } = await supabase.from('repo_telefone_atualizacoes').update({ status: campo ? 'aplicado' : 'descartado' }).eq('id', item.id)
      if (error) throw error
    },
    onSuccess: (_, { campo }) => {
      toast.success(campo ? 'Cadastro atualizado.' : 'Pedido descartado.')
      qc.invalidateQueries({ queryKey: ['repo-telefones-novos'] })
    },
    onError: () => toast.error('Não foi possível atualizar.'),
  })

  const lista = verTodos ? data : data.filter(t => t.status === 'pendente')
  if (isLoading) return <Loading />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--color-text-light-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={verTodos} onChange={e => setVerTodos(e.target.checked)} /> Mostrar também aplicados e descartados
      </label>
      {lista.length === 0 ? (
        <div style={{ ...cartao, padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light-muted)' }}>Nenhum telefone novo para conferir.</div>
      ) : (
        <div style={{ ...cartao, overflow: 'hidden' }}>
          {lista.map(t => {
            const antigos = CAMPOS_TELEFONE.filter(([c]) => t.telefones_cadastrados?.[c])
            return (
              <div key={t.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', padding: '11px 14px', borderBottom: '1px solid var(--color-border-light-subtle)', opacity: t.status === 'pendente' ? 1 : 0.55 }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{t.nome}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-light-muted)' }}>
                    {format(new Date(t.criado_em), 'dd/MM HH:mm')}{t.status !== 'pendente' ? ` · ${t.status}` : ''}
                  </div>
                </div>
                <div style={{ flex: '2 1 260px', fontSize: '12.5px', color: 'var(--color-text-light-secondary)' }}>
                  <div><strong style={{ color: 'var(--color-text-light-primary)', fontSize: '14px' }}>{mascararTelefoneBR(t.telefone_novo)}</strong> novo</div>
                  <div style={{ marginTop: '2px' }}>
                    {antigos.length ? antigos.map(([c, r]) => `${r}: ${mascararTelefoneBR(t.telefones_cadastrados[c])}`).join(' · ') : 'sem telefone no cadastro'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button type="button" onClick={() => abrirWhatsApp(t.telefone_novo)} title="WhatsApp do número novo" style={{ border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', backgroundColor: 'rgba(37,211,102,0.12)', color: '#25D166', display: 'flex' }}>
                    <MessageCircle size={15} />
                  </button>
                  {podeEditar && t.status === 'pendente' && (
                    <>
                      {CAMPOS_TELEFONE.map(([campo, rotulo]) => (
                        <button key={campo} type="button" disabled={aplicar.isPending} onClick={() => aplicar.mutate({ item: t, campo })} title={`Salvar como telefone: ${rotulo}`} style={{
                          border: '1px solid var(--color-border-light)', cursor: 'pointer', padding: '6px 9px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700,
                          backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-primary)',
                        }}>{rotulo}</button>
                      ))}
                      <button type="button" disabled={aplicar.isPending} onClick={() => aplicar.mutate({ item: t, campo: null })} title="Descartar" style={{ border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-state-danger) 10%, transparent)', color: 'var(--color-state-danger)', display: 'flex' }}>
                        <X size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PainelLinkOficial({ podeEditar }) {
  const [aba, setAba] = useState('agendamentos')
  const { data: resumo } = useResumoCreditos()
  const { data: agend = [] } = useAgendamentosLink()
  const { data: espera = [] } = useListaEspera()
  const { data: telefones = [] } = useTelefonesNovos()
  const qtdEspera = espera.filter(l => l.status === 'aguardando').length
  const qtdTelefones = telefones.filter(t => t.status === 'pendente').length

  const stat = (rotulo, valor, cor, Icone) => (
    <div style={{ ...cartao, padding: '10px 12px', flex: '1 1 150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-light-muted)' }}>{Icone && <Icone size={13} />}{rotulo}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: cor || 'var(--color-text-light-primary)' }}>{valor ?? '…'}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {stat('créditos de chuva em aberto', resumo?.creditos, 'var(--color-state-info)', CloudRain)}
        {stat('alunos com crédito', resumo?.alunos)}
        {stat('vencem em 7 dias', resumo?.vencendo, resumo?.vencendo ? 'var(--color-state-danger)' : undefined)}
        {stat('agendados pelo link', agend.filter(r => r.status === 'agendada').length, 'var(--color-action-primary)', CalendarCheck)}
        {stat('na lista de espera', qtdEspera, undefined, ListPlus)}
        {stat('telefones novos', qtdTelefones, qtdTelefones ? 'var(--color-state-warning)' : undefined, Phone)}
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border-light)', marginBottom: '16px' }}>
        {[['agendamentos', 'Agendamentos pelo link'], ['espera', `Lista de espera (${qtdEspera})`], ['telefones', `Telefones novos (${qtdTelefones})`]].map(([k, r]) => (
          <button key={k} type="button" onClick={() => setAba(k)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, marginBottom: '-1px',
            color: aba === k ? 'var(--color-action-primary)' : 'var(--color-text-light-muted)',
            borderBottom: `2px solid ${aba === k ? 'var(--color-action-primary)' : 'transparent'}`,
          }}>{r}</button>
        ))}
      </div>

      {aba === 'agendamentos' && <AbaAgendamentos />}
      {aba === 'espera' && <AbaListaEspera podeEditar={podeEditar} />}
      {aba === 'telefones' && <AbaTelefones podeEditar={podeEditar} />}
    </div>
  )
}
