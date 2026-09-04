import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MessageCircle, FileText, Star, Upload, Copy, Check, Camera, X, Plus, Trash2, Pencil, Lock, KeyRound, Eye, EyeOff, MoreVertical, Ban, RotateCcw, Save, Landmark, TriangleAlert } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { usePermissions } from '../../hooks/usePermissions'
import { confirmarAulasElegiveis } from '../../hooks/useAulas'
import { useEmpresaVinculada } from '../../hooks/useProfessores'
import { usePesquisaSatisfacao, useRespostasPesquisa } from '../../hooks/usePesquisaSatisfacao'
import { PERGUNTAS_PESQUISA_SATISFACAO, USER_ID_DONO_PESQUISA } from '../../constants/pesquisaSatisfacao'
import { exportarPesquisaSatisfacaoPDF } from '../../lib/pesquisaSatisfacaoPdf'
import useAppStore from '../../store/useAppStore'
import toast from 'react-hot-toast'
import { apenasDigitosCPF, mascararCPF, cpfParaEmailSintetico } from '../../lib/cpf'
import { buscarCep } from '../../lib/cep'
import { nomeCurto } from '../../lib/nomes'
import { BANCOS, ESTADOS } from '../../constants/geografia'
import { calcularValorAula } from '../../constants/modalidades'
import { DashboardProfessor } from '../professor/DashboardProfessor'

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

// Resumo minimalista de uma linha do audit_log — cobre os formatos gravados em
// AulasCoordenador.jsx (aluno adicionado/removido, status manual, nível/horário da turma)
function formatarHistorico(log) {
  const dn = log.dados_novos || {}
  if (dn.adicionados?.length || dn.removidos?.length) {
    const partes = []
    if (dn.adicionados?.length) partes.push(`Adicionou ${dn.adicionados.join(', ')}`)
    if (dn.removidos?.length) partes.push(`Removeu ${dn.removidos.join(', ')}`)
    return partes.join(' · ')
  }
  if (dn.status_aula) {
    const label = dn.status_aula === 'nao_dada' ? 'Sem Aula' : dn.status_aula === 'cancelada' ? 'Cancelada' : dn.status_aula
    return `Marcou aula como "${label}"`
  }
  if (dn.nivel) return `Mudou nível da turma pra ${dn.nivel} (${dn.escopo})`
  if (dn.horario) return `Moveu aula pra ${dn.horario}${dn.quadra ? ' · ' + dn.quadra : ''} (${dn.escopo})`
  return `Alterou ${log.tabela}`
}

const CRITERIOS = [
  { key: 'nota_a', label: 'Qualidade no Atendimento' },
  { key: 'nota_b', label: 'Didática de Aula' },
  { key: 'nota_c', label: 'Pontualidade' },
  { key: 'nota_d', label: 'Comprometimento e Flexibilidade' },
  { key: 'nota_e', label: 'Aparência em Geral' },
]

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
}

// Tipo de colaborador escolhido no cadastro -> funcao (label exibido no card) + role
// (permissão real, ver src/hooks/usePermissions.js). 'gestor' na UI = 'admin' no banco
// (valor histórico), mesma coisa que a API /api/criar-professor-usuario já resolve.
const TIPOS_COLABORADOR = [
  { value: 'professor', label: 'Professor', funcao: 'professor' },
  { value: 'gestor', label: 'Gestor', funcao: 'gerente' },
  { value: 'financeiro', label: 'Financeiro', funcao: 'financeiro' },
  { value: 'auxiliar', label: 'Auxiliar', funcao: 'auxiliar' },
  { value: 'auxiliar_quadra', label: 'Auxiliar de Quadra', funcao: 'auxiliar_quadra' },
]

// Mesmo mapeamento funcao -> role usado no cadastro do zero (TIPOS_COLABORADOR), mas pra
// quando o colaborador já existe (cardAberto.funcao) e só está ganhando acesso agora — usado
// em handleCriarAcesso pra a API criar o perfil com o role certo em vez de cair no default
// 'professor' dela (bug que já fez financeiro/gerente virar professor no perfis_usuario).
const FUNCAO_PARA_ROLE = { professor: 'professor', gerente: 'gestor', financeiro: 'financeiro', auxiliar: 'auxiliar', coordenador: 'coordenador', auxiliar_quadra: 'auxiliar_quadra' }

const FORM_VAZIO = {
  id: null, nome: '', email: '', telefone: '', instagram: '', apelido: '',
  tem_cref: false, numero_cref: '', cref_url: '',
  cnpj: '', razao_social: '',
  modalidade_id: '', modalidades_ids: [], valor_aula: '', valor_aula_beach: '', trabalha_procopio: true, trabalha_beach: false, salario_fixo_procopio: '', salario_fixo_beach: '', funcao: 'professor', ativo: true,
  nascimento: '', cidade_nascimento: '', estado_nascimento: '',
  cpf: '', cep: '', endereco: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado: '', data_inicio: '',
  banco: '', agencia: '', conta: '', tipo_conta: 'corrente', tipo_pagamento: 'pix', chave_pix: '',
  nome_titular: '', cpf_titular: '', titular_proprio: false,
  banco_beach: '', agencia_beach: '', conta_beach: '', tipo_conta_beach: 'corrente', tipo_pagamento_beach: 'pix', chave_pix_beach: '',
  nome_titular_beach: '', cpf_titular_beach: '', titular_proprio_beach: false,
}

function StarRating({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => !disabled && onChange(n)}
          style={{ background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '2px' }}>
          <Star size={20} fill={n <= value ? 'var(--color-action-primary)' : 'none'} color={n <= value ? 'var(--color-action-primary)' : 'var(--color-text-light-muted)'} />
        </button>
      ))}
    </div>
  )
}

function PixCopiavel({ pix }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(pix)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button onClick={copiar} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 14px', borderRadius: '8px',
      border: '1px solid rgba(165,76,46,0.3)',
      backgroundColor: 'rgba(165,76,46,0.08)',
      cursor: 'pointer', fontSize: '12px', color: 'var(--color-action-primary)', width: '100%',
    }}>
      {copiado ? <Check size={13} /> : <Copy size={13} />}
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copiado ? 'Copiado!' : pix}
      </span>
    </button>
  )
}

// Link + histórico de respostas da Pesquisa de Satisfação — só renderizada quando
// ehDonoPesquisa (ver filtro das abas), mas o RLS de pesquisas_satisfacao/
// pesquisa_respostas (030_pesquisa_restringe_dono.sql) é quem garante isso de verdade:
// travada num user_id específico (USER_ID_DONO_PESQUISA), nem outros gestores recebem
// dado nenhum, mesmo que alguém force essa aba a aparecer editando o front. O link é
// reutilizável de propósito — o professor pode responder quantas vezes quiser, cada envio
// vira uma linha nova aqui embaixo, nenhuma resposta anterior é sobrescrita ou apagada.
function AbaPesquisaSatisfacao({ professorNome, pesquisa, carregando, respostas, carregandoRespostas }) {
  if (carregando) return <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Carregando...</div>
  if (!pesquisa) return <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Não foi possível carregar a pesquisa.</div>

  const link = `${window.location.origin}/pesquisa/${pesquisa.token}`
  const mensagemWhats = `Oi ${professorNome}! Preparamos uma pesquisa rápida e confidencial pra entender como está sua experiência na ProCoach — leva menos de 2 minutos e só a coordenação vê suas respostas.\n\n${link}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={labelStyle}>Link individual — envie só pra essa pessoa (pode reenviar, o link não expira nem trava)</div>
        <PixCopiavel pix={link} />
      </div>

      <div>
        <div style={labelStyle}>Mensagem pronta pro WhatsApp (com o link já dentro)</div>
        <PixCopiavel pix={mensagemWhats} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {respostas.length === 0 ? 'Nenhuma resposta ainda' : `${respostas.length} resposta${respostas.length > 1 ? 's' : ''} recebida${respostas.length > 1 ? 's' : ''}`}
        </div>
        {respostas.length > 0 && (
          <button onClick={() => exportarPesquisaSatisfacaoPDF(professorNome, respostas)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px',
            border: '1px solid rgba(165,76,46,0.3)', backgroundColor: 'rgba(165,76,46,0.08)',
            color: 'var(--color-action-primary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
          }}>
            <FileText size={12} /> Exportar PDF
          </button>
        )}
      </div>

      {carregandoRespostas ? (
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '12px' }}>Carregando respostas...</div>
      ) : respostas.map((r, i) => (
        <div key={r.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={13} color="var(--color-state-success)" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-state-success)' }}>
              {i === 0 ? 'Mais recente' : `Resposta ${respostas.length - i}`} — {format(new Date(r.respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          {PERGUNTAS_PESQUISA_SATISFACAO.map(p => {
            const resposta = r.respostas?.[p.id]
            return (
              <div key={p.id} style={{ backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--color-border-light-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>{p.texto}</div>
                {p.tipo === 'estrelas' && <StarRating value={Number(resposta) || 0} disabled />}
                {p.tipo === 'nps' && (
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-action-primary)' }}>
                    {resposta != null ? `${resposta}/10` : <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--color-text-light-muted)' }}><em>Sem resposta</em></span>}
                  </div>
                )}
                {p.tipo === 'texto' && (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)' }}>{resposta || <em style={{ color: 'var(--color-text-light-muted)' }}>Sem resposta</em>}</div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Um bloco inteiro de dados bancários — usado 1x quando o professor trabalha numa empresa só,
// 2x (Procópio + Beach Arena, campos com sufixo "_beach" pro segundo) quando trabalha nas duas,
// já que forma de pagamento pode ser diferente em cada uma (ex: Boleto na Procópio, PIX na
// Beach Arena, ou PIX de banco/chave diferente em cada uma). Mesma ideia de valor_aula/
// valor_aula_beach, só que pros 8 campos de pagamento em vez de 1.
function BlocoDadosBancarios({ sufixo, titulo, cor, form, set, cardAberto }) {
  const campo = nome => `${nome}${sufixo}`
  const v = nome => form[campo(nome)]
  const upd = nome => e => set(campo(nome), e.target.value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '10px', color: cor, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>{titulo}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div><div style={labelStyle}>Banco</div>
          <select style={inputStyle} value={v('banco')} onChange={upd('banco')}>
            <option value="">Selecione</option>
            {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
          </select></div>
        <div><div style={labelStyle}>Tipo Pagamento</div>
          <select style={inputStyle} value={v('tipo_pagamento')} onChange={upd('tipo_pagamento')}>
            <option value="pix">PIX</option>
            <option value="boleto">Boleto</option>
          </select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div><div style={labelStyle}>Agência</div><input style={inputStyle} placeholder="0000" value={v('agencia')} onChange={upd('agencia')} /></div>
        <div><div style={labelStyle}>Conta</div><input style={inputStyle} placeholder="00000-0" value={v('conta')} onChange={upd('conta')} /></div>
        <div><div style={labelStyle}>Tipo</div>
          <select style={inputStyle} value={v('tipo_conta')} onChange={upd('tipo_conta')}>
            <option value="corrente">Corrente</option>
            <option value="poupanca">Poupança</option>
          </select></div>
      </div>
      <div><div style={labelStyle}>Chave PIX</div><input style={inputStyle} placeholder="CPF, e-mail, telefone..." value={v('chave_pix')} onChange={upd('chave_pix')} /></div>
      {cardAberto[campo('chave_pix')] && <PixCopiavel pix={cardAberto[campo('chave_pix')]} />}
      {cardAberto[campo('banco')] === 'Itaú' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(201,138,60,0.08)', borderRadius: '8px', border: '1px solid rgba(201,138,60,0.2)' }}>
            <Landmark size={15} color="var(--color-state-warning)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--color-state-warning)', fontWeight: '600' }}>Correntista Itaú — pagar via PIX</span>
          </div>
          {v('nome_titular') && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '6px', paddingLeft: '2px' }}>{v('nome_titular')}</div>
          )}
        </div>
      )}

      {/* Dados do titular da conta */}
      <div style={{ backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', border: '1px solid var(--color-border-light)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados bancários do titular</div>
        <button
          type="button"
          onClick={() => {
            const novoVal = !v('titular_proprio')
            set(campo('titular_proprio'), novoVal)
            if (novoVal) {
              set(campo('nome_titular'), cardAberto.nome || '')
              set(campo('cpf_titular'), cardAberto.cpf || '')
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: v('titular_proprio') ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-raised)',
            outline: v('titular_proprio') ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)',
            color: v('titular_proprio') ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', fontSize: '12px',
          }}
        >
          <span style={{ fontSize: '14px' }}>{v('titular_proprio') ? '✓' : '○'}</span>
          Titular é o próprio professor
        </button>
        <div><div style={labelStyle}>Nome completo do titular</div>
          <input style={inputStyle} placeholder="Nome como está no banco..." value={v('nome_titular')} onChange={e => { set(campo('nome_titular'), e.target.value); set(campo('titular_proprio'), false) }} />
        </div>
        <div><div style={labelStyle}>CPF do titular</div>
          <input style={inputStyle} placeholder="•••.•••.•••-••" inputMode="numeric" value={mascararCPF(v('cpf_titular'))} onChange={e => { set(campo('cpf_titular'), apenasDigitosCPF(e.target.value)); set(campo('titular_proprio'), false) }} />
        </div>
      </div>
    </div>
  )
}

export function ModalDetalhesDia({ professorId, dataStr, onClose }) {
  const { data: aulas = [], isLoading } = useQuery({
    queryKey: ['aulas_dia_prof_detalhe', professorId, dataStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, turma_id, observacoes,
          turmas(nome, horario_inicio, niveis(nome)),
          presencas(presente, status_presenca, tipo_participacao, alunos(nome))
        `)
        .eq('professor_executou_id', professorId)
        .eq('data_aula', dataStr)
        .eq('status_aula', 'dada')
        .order('id')
      if (error) throw error
      return data || []
    },
    enabled: !!professorId && !!dataStr,
    staleTime: 30000,
  })

  const parteObs = obs => (obs || '').split('·').map(s => s.trim())
  const getNome = a => a.turmas?.nome || parteObs(a.observacoes)[3] || 'Avulsa'
  const getHorario = a => a.turmas?.horario_inicio?.slice(0, 5) || parteObs(a.observacoes)[2] || ''
  const getNivel = a => a.turmas?.niveis?.nome || parteObs(a.observacoes)[3] || ''
  const dataLabel = format(new Date(dataStr + 'T12:00'), "dd 'de' MMMM", { locale: ptBR })

  // Via portal pro <body>: sem isso, o WebKit mobile prende esse position:fixed dentro do
  // .app-main (overflow-y + scroll-touch) e o modal fica cortado, sem cobrir a tela toda.
  // Este modal só é renderizado a partir do DashboardProfessor.jsx (contexto Escuro) — mesmo
  // definido fisicamente nesta página (Claro), usa tokens -dark-* diretos de propósito.
  return createPortal((
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', boxSizing: 'border-box',
        maxHeight: '82dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}>
        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-text-dark-muted)', borderRadius: '2px', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{dataLabel}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px' }}>{aulas.length} aula{aulas.length !== 1 ? 's' : ''} confirmada{aulas.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="var(--color-state-danger)" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-dark-secondary)', fontSize: '13px', padding: '24px' }}>Carregando...</div>
          ) : aulas.map(aula => {
            const horario = getHorario(aula)
            const nivel = getNivel(aula)
            const nome = getNome(aula)
            const presencas = (aula.presencas || []).filter(p => p.alunos)
            const presentes = presencas.filter(p => p.status_presenca === 'presente').length
            const ausentes = presencas.filter(p => p.status_presenca !== 'presente').length
            return (
              <div key={aula.id} style={{ backgroundColor: 'var(--color-surface-dark-overlay)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--color-border-dark)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: presencas.length > 0 ? '8px' : 0 }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-dark-primary)' }}>{nome}</div>
                    {nivel && nivel !== nome && <div style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)', marginTop: '1px' }}>{nivel}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {horario && <span style={{ fontSize: '11px', color: 'var(--color-action-primary)', fontWeight: '600' }}>{horario}</span>}
                    {presencas.length > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-dark-secondary)' }}>
                        <span style={{ color: 'var(--color-state-success)' }}>✓{presentes}</span>{' '}
                        {ausentes > 0 && <span style={{ color: 'var(--color-state-danger)' }}>✗{ausentes}</span>}
                      </span>
                    )}
                  </div>
                </div>
                {presencas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {presencas.map((p, i) => {
                      const cortesia = p.tipo_participacao === 'cortesia'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 0', borderTop: '1px solid var(--color-surface-dark-raised)' }}>
                          {p.status_presenca === 'presente'
                            ? <span style={{ color: 'var(--color-state-success)', fontSize: '13px', fontWeight: '700', lineHeight: 1 }}>✓</span>
                            : <span style={{ color: 'var(--color-state-danger)', fontSize: '13px', fontWeight: '700', lineHeight: 1 }}>✗</span>
                          }
                          <span style={{ fontSize: '12px', fontWeight: cortesia ? '700' : '400', color: cortesia ? 'var(--color-state-warning)' : p.status_presenca === 'presente' ? 'var(--color-text-dark-secondary)' : 'var(--color-text-dark-muted)' }}>{p.alunos?.nome || '—'}</span>
                          {cortesia && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(201,138,60,0.15)', color: 'var(--color-state-warning)', fontWeight: '600' }}>cortesia</span>}
                          {p.status_presenca === 'falta_justificada' && <span style={{ fontSize: '9px', color: 'var(--color-state-warning)', marginLeft: 'auto' }}>just.</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  ), document.body)
}

export default function ProfessoresPage({ autoAbrirProprio = false } = {}) {
  const qc = useQueryClient()
  const { podeVerTodosSalarios, podeEditarCadastros, role } = usePermissions()
  const { perfil } = useAppStore()
  // Conta vinculada a uma única empresa (ex: "Beach Arena - Financeiro") não pode ver
  // colaboradores da outra empresa nesta lista — ver useEmpresaVinculada.
  const empresaVinculada = useEmpresaVinculada()
  const [cardAberto, setCardAberto] = useState(null)
  const [menuCardId, setMenuCardId] = useState(null)
  const [aba, setAba] = useState('perfil')
  const [modalCriar, setModalCriar] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [tipoColaborador, setTipoColaborador] = useState(null)
  const [cpfNovoColaborador, setCpfNovoColaborador] = useState('')
  const [senhaNovoColaborador, setSenhaNovoColaborador] = useState('')
  const [novasNotas, setNovasNotas] = useState({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
  const [salvandoAval, setSalvandoAval] = useState(false)
  const [modalAval, setModalAval] = useState(false)
  const [avaliadores, setAvaliadores] = useState([{ nome: '', cargo: '' }])
  const [dataAvaliacao, setDataAvaliacao] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState(null)
  const [empresaBoletoSel, setEmpresaBoletoSel] = useState('procopio')
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [modalExtra, setModalExtra] = useState(false)
  const [formExtra, setFormExtra] = useState({ data_pagamento: format(new Date(), 'yyyy-MM-dd'), descricao: '', valor: '', empresa: '' })
  const [salvandoExtra, setSalvandoExtra] = useState(false)
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [filtroFuncao, setFiltroFuncao] = useState('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('todas')
  const [criandoAcesso, setCriandoAcesso] = useState(false)
  const [formAcesso, setFormAcesso] = useState({ cpf: '', senha: '', confirmacao: '' })
  const [mostrarSenhaAcesso, setMostrarSenhaAcesso] = useState(false)
  const [salvandoAcesso, setSalvandoAcesso] = useState(false)
  const [resetandoSenha, setResetandoSenha] = useState(false)
  const [mostrandoResetSenha, setMostrandoResetSenha] = useState(false)
  const [novaSenhaReset, setNovaSenhaReset] = useState('')
  const [mostrarNovaSenhaReset, setMostrarNovaSenhaReset] = useState(false)
  const [filtroAtivo, setFiltroAtivo] = useState('ativos')
  const [filtroAberto, setFiltroAberto] = useState(false)
  const fotoInputRef = useRef()
  const contratoInputRef = useRef()

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate()
  const diaAtual = hoje.getDate()
  const progressoMes = Math.round((diaAtual / diasNoMes) * 100)

  const { data: professores = [], isLoading } = useQuery({
    queryKey: ['professores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores').select('*, modalidades(nome)').order('nome')
      if (error) throw error
      return data || []
    },
  })

  useEffect(() => {
    if (autoAbrirProprio && !cardAberto && perfil?.professor_id) {
      const proprio = professores.find(p => p.id === perfil.professor_id)
      if (proprio) setCardAberto(proprio)
    }
  }, [autoAbrirProprio, professores, perfil?.professor_id])

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modalidades').select('*').order('nome')
      if (error) throw error
      return data || []
    },
  })

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_professor')
        .select('*')
        .eq('professor_id', cardAberto.id)
        .order('data_avaliacao', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const ehDonoPesquisa = perfil?.user_id === USER_ID_DONO_PESQUISA
  const { data: pesquisaSatisfacao, isLoading: carregandoPesquisa } = usePesquisaSatisfacao(cardAberto?.id, { enabled: ehDonoPesquisa })
  const { data: respostasPesquisa = [], isLoading: carregandoRespostas } = useRespostasPesquisa(pesquisaSatisfacao?.id, { enabled: ehDonoPesquisa })

  const { data: historicoProf = [] } = useQuery({
    queryKey: ['audit_log_professor', cardAberto?.cpf],
    enabled: !!cardAberto?.cpf && podeVerTodosSalarios,
    queryFn: async () => {
      const emailProf = cpfParaEmailSintetico(cardAberto.cpf)
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('usuario', emailProf)
        .order('criado_em', { ascending: false })
        .limit(50)
      if (error) throw error
      return data || []
    },
  })

  const { data: aulasProf = [] } = useQuery({
    queryKey: ['aulas_professor', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      // Só conta aula que já aconteceu (data_aula <= hoje) — aulas futuras já nascem com
      // status_aula='dada' por uma limitação de constraint no banco, mas isso não
      // significa que já foram dadas de verdade. paga_professor=true é quem realmente
      // confirma que a aula foi fechada/paga (mesmo filtro usado em useFinanceiro.js,
      // pra esse total bater com a aba Financeiro). Confirma as elegíveis antes de somar,
      // já que ninguém mais clica manualmente pra isso (ver confirmarAulasElegiveis).
      const hoje = format(new Date(), 'yyyy-MM-dd')
      await confirmarAulasElegiveis({ professorId: cardAberto.id })
      const { data, error } = await supabase
        .from('aulas')
        .select('id, data_aula, turma_id, status_aula, paga_professor, status, turmas(niveis(nome), modalidades(nome)), presencas(tipo_participacao)')
        .eq('professor_executou_id', cardAberto.id)
        .eq('status_aula', 'dada')
        .eq('paga_professor', true)
        .lte('data_aula', hoje)
        .order('data_aula', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const { data: perfilVinculado, isLoading: carregandoPerfilVinculado } = useQuery({
    queryKey: ['perfil_vinculado', cardAberto?.id],
    enabled: !!cardAberto?.id && podeEditarCadastros,
    queryFn: async () => {
      const { data } = await supabase
        .from('perfis_usuario')
        .select('user_id, nome')
        .eq('professor_id', cardAberto.id)
        .maybeSingle()
      return data || null
    },
  })

  async function handleCriarAcesso() {
    const cpfDigitos = apenasDigitosCPF(formAcesso.cpf)
    if (cpfDigitos.length !== 11 || formAcesso.senha.length < 8) {
      toast.error('Preencha o CPF completo e uma senha com pelo menos 8 caracteres')
      return
    }
    if (formAcesso.senha !== formAcesso.confirmacao) {
      toast.error('As senhas não coincidem')
      return
    }
    setSalvandoAcesso(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/criar-professor-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          professorId: cardAberto.id,
          nome: cardAberto.nome,
          cpf: cpfDigitos,
          senha: formAcesso.senha,
          role: FUNCAO_PARA_ROLE[cardAberto.funcao] || 'professor',
        }),
      })
      const resultado = await resp.json()
      if (!resp.ok) throw new Error(resultado.error || 'Erro ao criar acesso')
      toast.success('Acesso criado! Já pode entrar com essa senha usando o CPF como login.')
      setCriandoAcesso(false)
      setFormAcesso({ cpf: '', senha: '', confirmacao: '' })
      qc.invalidateQueries({ queryKey: ['perfil_vinculado', cardAberto.id] })
      qc.invalidateQueries({ queryKey: ['professores'] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvandoAcesso(false)
    }
  }

  async function handleResetarSenha() {
    if (novaSenhaReset.length < 8) {
      toast.error('Digite uma senha nova com pelo menos 8 caracteres')
      return
    }
    setResetandoSenha(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/resetar-senha-professor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ professorId: cardAberto.id, novaSenha: novaSenhaReset }),
      })
      const resultado = await resp.json()
      if (!resp.ok) throw new Error(resultado.error || 'Erro ao resetar senha')
      toast.success('Senha redefinida! Passe essa senha pro professor — ele vai ter que trocar por uma só dele no próximo login.')
      setMostrandoResetSenha(false)
      setNovaSenhaReset('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setResetandoSenha(false)
    }
  }

  const { data: boletos = [] } = useQuery({
    queryKey: ['boletos', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boletos_professor')
        .select('*')
        .eq('professor_id', cardAberto.id)
        .order('ano', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const { data: disponibilidades = [] } = useQuery({
    queryKey: ['disponibilidades', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disponibilidades')
        .select('*')
        .eq('professor_id', cardAberto.id)
      if (error) throw error
      return data || []
    },
  })

  const { data: pagamentosExtras = [] } = useQuery({
    queryKey: ['pagamentos_extras', cardAberto?.id],
    enabled: !!cardAberto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_extras')
        .select('*')
        .eq('professor_id', cardAberto.id)
        .order('data_pagamento', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function iniciarEdicao(prof) {
    setForm({
      id: prof.id, nome: prof.nome || '', email: prof.email || '',
      telefone: prof.telefone || '', instagram: prof.instagram || '',
      modalidade_id: prof.modalidade_id || '', modalidades_ids: prof.modalidades_ids || [], valor_aula: prof.valor_aula || '', valor_aula_beach: prof.valor_aula_beach || '', trabalha_procopio: prof.trabalha_procopio !== false, trabalha_beach: !!prof.trabalha_beach, salario_fixo_procopio: prof.salario_fixo_procopio || '', salario_fixo_beach: prof.salario_fixo_beach || '', funcao: prof.funcao || 'professor',
      ativo: prof.ativo !== false, nascimento: prof.nascimento || '',
      cidade_nascimento: prof.cidade_nascimento || '',
      estado_nascimento: prof.estado_nascimento || '',
      cpf: prof.cpf || '', cep: prof.cep || '',
      endereco: prof.endereco || '', numero: prof.numero || '',
      complemento: prof.complemento || '', bairro: prof.bairro || '',
      cidade: prof.cidade || '', estado: prof.estado || '',
      data_inicio: prof.data_inicio || '', banco: prof.banco || '',
      agencia: prof.agencia || '', conta: prof.conta || '',
      tipo_conta: prof.tipo_conta || 'corrente',
      tipo_pagamento: prof.tipo_pagamento || 'pix', chave_pix: prof.chave_pix || '',
      nome_titular: prof.nome_titular || '', cpf_titular: prof.cpf_titular || '', titular_proprio: false,
      banco_beach: prof.banco_beach || '', agencia_beach: prof.agencia_beach || '', conta_beach: prof.conta_beach || '',
      tipo_conta_beach: prof.tipo_conta_beach || 'corrente',
      tipo_pagamento_beach: prof.tipo_pagamento_beach || 'pix', chave_pix_beach: prof.chave_pix_beach || '',
      nome_titular_beach: prof.nome_titular_beach || '', cpf_titular_beach: prof.cpf_titular_beach || '', titular_proprio_beach: false,
      apelido: prof.apelido || '',
      tem_cref: prof.tem_cref || false,
      numero_cref: prof.numero_cref || '',
      cref_url: prof.cref_url || '',
      cnpj: prof.cnpj || '',
      razao_social: prof.razao_social || '',
    })
  }

  function abrirCard(prof) {
    setCardAberto(prof)
    iniciarEdicao(prof)
    setAba('perfil')
    setMesSelecionado(null)
    setNovasNotas({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
  }

  async function toggleAtivoProfessor(prof) {
    setMenuCardId(null)
    const novoAtivo = prof.ativo === false
    const acao = novoAtivo ? 'reativar' : 'inativar'
    if (!confirm(`Tem certeza que quer ${acao} ${prof.nome}?`)) return
    const { error } = await supabase.from('professores').update({ ativo: novoAtivo }).eq('id', prof.id)
    if (error) {
      toast.error('Erro ao atualizar professor')
      return
    }
    toast.success(novoAtivo ? 'Professor reativado' : 'Professor inativado')
    qc.invalidateQueries({ queryKey: ['professores'] })
  }

  async function excluirProfessorPermanente(prof) {
    setMenuCardId(null)
    if (!confirm(`Excluir permanentemente ${prof.nome}? Essa ação não pode ser desfeita — se o professor já tiver aulas, turmas ou pagamentos vinculados, prefira "Inativar" em vez de excluir.`)) return
    if (!confirm('Tem certeza mesmo? Essa é a última confirmação.')) return
    const { error } = await supabase.from('professores').delete().eq('id', prof.id)
    if (error) {
      toast.error('Não foi possível excluir: esse professor tem dados vinculados (aulas, turmas, pagamentos). Use "Inativar" em vez de excluir.')
      return
    }
    toast.success('Professor excluído permanentemente')
    if (cardAberto?.id === prof.id) setCardAberto(null)
    qc.invalidateQueries({ queryKey: ['professores'] })
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(), email: form.email || null,
      telefone: form.telefone || null, instagram: form.instagram || null,
      modalidade_id: form.modalidades_ids?.[0] || form.modalidade_id || null,
      modalidades_ids: form.modalidades_ids?.length > 0 ? form.modalidades_ids : null,
      funcao: form.funcao || 'professor',
      salario_fixo_procopio: form.salario_fixo_procopio ? parseFloat(String(form.salario_fixo_procopio).replace(',', '.')) : null,
      salario_fixo_beach: form.salario_fixo_beach ? parseFloat(String(form.salario_fixo_beach).replace(',', '.')) : null,
      valor_aula: form.valor_aula ? parseFloat(String(form.valor_aula).replace(',', '.')) : null,
      valor_aula_beach: form.valor_aula_beach ? parseFloat(String(form.valor_aula_beach).replace(',', '.')) : null,
      trabalha_procopio: form.trabalha_procopio,
      trabalha_beach: form.trabalha_beach,
      ativo: form.ativo, nascimento: form.nascimento || null,
      cidade_nascimento: form.cidade_nascimento || null,
      estado_nascimento: form.estado_nascimento || null,
      cpf: form.cpf || null, cep: form.cep || null,
      endereco: form.endereco || null, numero: form.numero || null,
      complemento: form.complemento || null, bairro: form.bairro || null,
      cidade: form.cidade || null, estado: form.estado || null,
      data_inicio: form.data_inicio || null, banco: form.banco || null,
      agencia: form.agencia || null, conta: form.conta || null,
      tipo_conta: form.tipo_conta || 'corrente',
      tipo_pagamento: form.tipo_pagamento || 'pix', chave_pix: form.chave_pix || null,
      nome_titular: form.nome_titular || null, cpf_titular: form.cpf_titular || null,
      banco_beach: form.banco_beach || null, agencia_beach: form.agencia_beach || null, conta_beach: form.conta_beach || null,
      tipo_conta_beach: form.tipo_conta_beach || 'corrente',
      tipo_pagamento_beach: form.tipo_pagamento_beach || 'pix', chave_pix_beach: form.chave_pix_beach || null,
      nome_titular_beach: form.nome_titular_beach || null, cpf_titular_beach: form.cpf_titular_beach || null,
      apelido: form.apelido || null,
      tem_cref: form.tem_cref || false,
      numero_cref: form.numero_cref || null,
      cref_url: form.cref_url || null,
      cnpj: form.cnpj || null,
      razao_social: form.razao_social || null,
    }
    try {
      if (form.id) {
        const { data } = await supabase.from('professores').update(payload).eq('id', form.id).select('*, modalidades(nome)').single()
        setCardAberto(data)
        qc.invalidateQueries({ queryKey: ['professores'] })
        // FinanceiroPage.jsx lê o Salário Fixo numa query própria ('colaboradores_salario_fixo',
        // staleTime de 5min) pra gerar o lançamento automático do mês — sem invalidar aqui, quem
        // salvasse o campo e fosse direto pro Financeiro via SPA (sem dar F5) via cache velho e o
        // colaborador não aparecia até o cache expirar sozinho.
        qc.invalidateQueries({ queryKey: ['colaboradores_salario_fixo'] })
        setCardAberto(null)
      } else {
        await supabase.from('professores').insert(payload)
        qc.invalidateQueries({ queryKey: ['professores'] })
        qc.invalidateQueries({ queryKey: ['colaboradores_salario_fixo'] })
        setModalCriar(false)
        setForm(FORM_VAZIO)
      }
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvando(false) }
  }

  // Cadastro de colaborador novo (qualquer tipo) já com acesso pronto num passo só —
  // cria a linha em `professores` (aparece no diretório, com foto/função) e na sequência
  // chama a mesma API de criar login usada pelo "Criar acesso" dentro do card, passando
  // o role certo. primeiroAcesso:false porque o gestor já está entregando a senha pronta
  // pra pessoa, sem burocracia de troca no primeiro login.
  async function handleCriarColaborador() {
    const cpfDigitos = apenasDigitosCPF(cpfNovoColaborador)
    if (!form.nome.trim()) return toast.error('Preencha o nome')
    if (!tipoColaborador) return toast.error('Escolha o tipo de colaborador')
    if (cpfDigitos.length !== 11) return toast.error('CPF precisa ter 11 dígitos')
    if (senhaNovoColaborador.length < 8) return toast.error('Senha precisa ter pelo menos 8 caracteres')

    const tipo = TIPOS_COLABORADOR.find(t => t.value === tipoColaborador)
    setSalvando(true)
    try {
      const { data: novoProf, error: erroProf } = await supabase.from('professores').insert({
        nome: form.nome.trim(),
        telefone: form.telefone || null,
        email: form.email || null,
        cpf: cpfDigitos,
        funcao: tipo.funcao,
        modalidade_id: tipoColaborador === 'professor' ? (form.modalidades_ids?.[0] || null) : null,
        modalidades_ids: tipoColaborador === 'professor' && form.modalidades_ids?.length > 0 ? form.modalidades_ids : null,
        ativo: true,
      }).select().single()
      if (erroProf) throw erroProf

      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/criar-professor-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          professorId: novoProf.id,
          nome: form.nome.trim(),
          cpf: cpfDigitos,
          senha: senhaNovoColaborador,
          role: tipoColaborador,
          primeiroAcesso: false,
        }),
      })
      const resultado = await resp.json()
      if (!resp.ok) {
        // Login falhou depois do cadastro já criado — desfaz o cadastro pra não deixar
        // duplicata órfã (sem isso, cada nova tentativa empilhava mais um registro igual).
        await supabase.from('professores').delete().eq('id', novoProf.id)
        throw new Error(resultado.error || 'Erro ao criar acesso')
      }

      toast.success(`${tipo.label} cadastrado! Já pode entrar com o CPF e a senha.`)
      qc.invalidateQueries({ queryKey: ['professores'] })
      setModalCriar(false)
      setForm(FORM_VAZIO)
      setTipoColaborador(null)
      setCpfNovoColaborador('')
      setSenhaNovoColaborador('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    setUploadandoFoto(true)
    e.target.value = ''
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `professores/${cardAberto.id}/foto_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('professores').update({ foto_url: publicUrl }).eq('id', cardAberto.id)
      setCardAberto(prev => ({ ...prev, foto_url: publicUrl }))
      qc.invalidateQueries({ queryKey: ['professores'] })
      toast.success('Foto atualizada!', { style: toastStyle })
    } catch (err) { toast.error('Erro ao subir foto: ' + err.message, { style: toastStyle }) }
    finally { setUploadandoFoto(false) }
  }

  async function handleUploadContrato(e) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    try {
      const path = `professores/${cardAberto.id}/contrato.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('professores').update({ contrato_url: publicUrl }).eq('id', cardAberto.id)
      setCardAberto(prev => ({ ...prev, contrato_url: publicUrl }))
      qc.invalidateQueries({ queryKey: ['professores'] })
    } catch (err) { alert('Erro upload contrato: ' + err.message) }
  }

  // boletos_professor é único por (professor_id, mes, ano, empresa) — onConflict tem que
  // bater exatamente com essa constraint, senão o upsert falha sempre com 42P10 (era o bug:
  // faltava `empresa` aqui, então nenhum professor conseguia anexar Boleto/NF pelo próprio
  // perfil). `empresa` vem de quem chama (ver bloco da aba Financeiro mais abaixo).
  async function handleUploadBoleto(e, mes, ano, empresa) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    try {
      const path = `professores/${cardAberto.id}/boleto_${empresa}_${ano}_${mes}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('boletos_professor').upsert({
        professor_id: cardAberto.id, mes, ano, empresa, boleto_url: publicUrl, status: 'pendente'
      }, { onConflict: 'professor_id,mes,ano,empresa' })
      if (dbErr) throw dbErr
      qc.invalidateQueries({ queryKey: ['boletos', cardAberto.id] })
    } catch (err) { alert('Erro upload boleto: ' + err.message) }
  }

  async function handleUploadNF(e, mes, ano, empresa) {
    const file = e.target.files?.[0]
    if (!file || !cardAberto?.id) return
    try {
      const path = `professores/${cardAberto.id}/nf_${empresa}_${ano}_${mes}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('boletos_professor').upsert({
        professor_id: cardAberto.id, mes, ano, empresa, nf_url: publicUrl,
      }, { onConflict: 'professor_id,mes,ano,empresa' })
      if (dbErr) throw dbErr
      qc.invalidateQueries({ queryKey: ['boletos', cardAberto.id] })
    } catch (err) { alert('Erro upload NF: ' + err.message) }
  }

  // Corrige anexo enviado no mês/empresa errada (ex: NF de julho subida na janela de agosto).
  async function handleExcluirAnexo(tipo, mes, ano, empresa) {
    if (!cardAberto?.id) return
    try {
      const campo = tipo === 'boleto' ? 'boleto_url' : 'nf_url'
      const { error } = await supabase.from('boletos_professor')
        .update({ [campo]: null })
        .eq('professor_id', cardAberto.id).eq('mes', mes).eq('ano', ano).eq('empresa', empresa)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['boletos', cardAberto.id] })
    } catch (err) { alert('Erro ao excluir: ' + err.message) }
  }

  async function handleSalvarAvaliacao() {
    const total = novasNotas.nota_a + novasNotas.nota_b + novasNotas.nota_c + novasNotas.nota_d + novasNotas.nota_e
    if (total === 0) return alert('Preencha pelo menos uma nota')
    const avaliadoresValidos = avaliadores.filter(a => a.nome.trim())
    if (avaliadoresValidos.length === 0) return alert('Adicione pelo menos um avaliador')
    const media = (total / 5).toFixed(2)
    setSalvandoAval(true)
    try {
      await supabase.from('avaliacoes_professor').insert({
        professor_id: cardAberto.id, ...novasNotas,
        media: parseFloat(media),
        data_avaliacao: dataAvaliacao,
        avaliadores: avaliadoresValidos,
      })
      qc.invalidateQueries({ queryKey: ['avaliacoes', cardAberto.id] })
      setNovasNotas({ nota_a: 0, nota_b: 0, nota_c: 0, nota_d: 0, nota_e: 0, observacao: '' })
      setAvaliadores([{ nome: '', cargo: '' }])
      setDataAvaliacao(format(new Date(), 'yyyy-MM-dd'))
      setModalAval(false)
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvandoAval(false) }
  }

  function calcularGanhosMes(mes, ano) {
    const doMes = aulasProf.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    })
    const qtd = doMes.length
    const valorAulas = doMes.reduce((acc, a) => acc + calcularValorAula(a, cardAberto), 0)
    const valorExtras = pagamentosExtras
      .filter(p => p.mes === mes && p.ano === ano)
      .reduce((acc, p) => acc + (p.valor || 0), 0)
    return { qtd, valor: valorAulas + valorExtras, valorAulas, valorExtras }
  }

  const extraEhMultiEmpresa = !!(cardAberto?.trabalha_procopio && cardAberto?.trabalha_beach)

  async function handleSalvarExtra() {
    if (!formExtra.descricao.trim() || !formExtra.valor) return alert('Preencha todos os campos')
    if (extraEhMultiEmpresa && !formExtra.empresa) return alert('Selecione a empresa (Procópio ou Beach Arena)')
    setSalvandoExtra(true)
    const d = new Date(formExtra.data_pagamento + 'T12:00')
    const empresaFinal = formExtra.empresa || (cardAberto.trabalha_beach ? 'beach_arena' : 'procopio')
    try {
      if (formExtra.id) {
        await supabase.from('pagamentos_extras').update({
          data_pagamento: formExtra.data_pagamento,
          descricao: formExtra.descricao,
          valor: parseFloat(String(formExtra.valor).replace(',', '.')),
          empresa: empresaFinal,
        }).eq('id', formExtra.id)
      } else {
        await supabase.from('pagamentos_extras').insert({
        professor_id: cardAberto.id,
        data_pagamento: formExtra.data_pagamento,
        descricao: formExtra.descricao,
        valor: parseFloat(String(formExtra.valor).replace(',', '.')),
        mes: d.getMonth() + 1,
        ano: d.getFullYear(),
        empresa: empresaFinal,
      })
      }
      qc.invalidateQueries({ queryKey: ['pagamentos_extras', cardAberto.id] })
      setFormExtra({ data_pagamento: format(new Date(), 'yyyy-MM-dd'), descricao: '', valor: '', empresa: '' })
      setModalExtra(false)
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSalvandoExtra(false) }
  }

  function getAulasDoDia(mes, ano) {
    const diasMap = {}
    aulasProf.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    }).forEach(a => {
      const dia = new Date(a.data_aula + 'T12:00').getDate()
      diasMap[dia] = (diasMap[dia] || 0) + 1
    })
    return diasMap
  }

  const ganhosMesAtual = calcularGanhosMes(mesAtual, anoAtual)
  const totalAulas = aulasProf.length
  const ganhosMostrar = mesSelecionado
    ? calcularGanhosMes(mesSelecionado.mes, mesSelecionado.ano)
    : ganhosMesAtual
  const labelMesMostrar = mesSelecionado
    ? `${MESES[mesSelecionado.mes - 1]} ${mesSelecionado.ano}`
    : `${MESES[mesAtual - 1]} ${anoAtual}`

  const dadosGrafico = Array.from({ length: 6 }, (_, i) => {
    const m = mesAtual - 5 + i
    const mes = m <= 0 ? m + 12 : m
    const ano = m <= 0 ? anoAtual - 1 : anoAtual
    return { mes, ano, label: MESES[mes - 1], qtd: calcularGanhosMes(mes, ano).qtd }
  })
  const maxGrafico = Math.max(...dadosGrafico.map(d => d.qtd), 1)

  const mesesFinanceiro = Array.from({ length: 12 }, (_, i) => {
    const m = mesAtual - i <= 0 ? mesAtual - i + 12 : mesAtual - i
    const a = mesAtual - i <= 0 ? anoAtual - 1 : anoAtual
    return { mes: m, ano: a }
  })

  const totalGeral = mesesFinanceiro.reduce((acc, { mes, ano }) => acc + calcularGanhosMes(mes, ano).valor, 0)

  const DIAS_SEMANA = ['segunda','terca','quarta','quinta','sexta','sabado','domingo']
  const DIAS_LABEL = ['SEG','TER','QUA','QUI','SEX','SAB','DOM']
  const HORARIOS_GRADE = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)
  const MODALIDADES_PROCOPIO = ['Tênis', 'Padel', 'Squash', 'Pickleball']
  const MODALIDADES_BEACH = ['Beach Tênis', 'Futevôlei', 'Vôlei de Praia']

  function getLogosEmpresas(prof) {
    const mods = prof.modalidades_ids || []
    const nomesProf = modalidades.filter(m => mods.includes(m.id)).map(m => m.nome)
    const temProcopio = nomesProf.some(n => MODALIDADES_PROCOPIO.some(p => n.toLowerCase().includes(p.toLowerCase())))
    const temBeach = nomesProf.some(n => MODALIDADES_BEACH.some(b => n.toLowerCase().includes(b.toLowerCase())))
    return { temProcopio, temBeach }
  }
  const COR_DISP = { disponivel: 'var(--color-state-success)', indisponivel: 'var(--color-state-danger)', talvez: 'var(--color-action-primary)' }
  const getStatusDisp = (dia, horario) => disponibilidades.find(d => d.dia_semana === dia && d.horario === horario)?.status || null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: 0 }}>Colaboradores</h2>
        {podeEditarCadastros && (
          <button onClick={() => { setForm(FORM_VAZIO); setModalCriar(true) }} style={{
            padding: '8px 16px', borderRadius: '10px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>+ Novo</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ position: 'relative', marginBottom: '16px', zIndex: 50 }}>
        <button onClick={() => setFiltroAberto(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: (filtroFuncao !== 'todos' || filtroEmpresa !== 'todas' || filtroAtivo !== 'ativos') ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-raised)',
          outline: (filtroFuncao !== 'todos' || filtroEmpresa !== 'todas' || filtroAtivo !== 'ativos') ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)',
          color: (filtroFuncao !== 'todos' || filtroEmpresa !== 'todas' || filtroAtivo !== 'ativos') ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', fontSize: '12px',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtrar
          {(filtroFuncao !== 'todos' || filtroEmpresa !== 'todas' || filtroAtivo !== 'ativos') && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-action-primary)', flexShrink: 0 }} />}
        </button>

        {filtroAberto && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setFiltroAberto(false)} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '6px',
              backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
              borderRadius: '12px', padding: '12px', zIndex: 50,
              minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Função</div>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'professor', label: 'Professores' },
                { key: 'gerente', label: 'Gerentes' },
                { key: 'auxiliar', label: 'Auxiliares' },
                { key: 'auxiliar_quadra', label: 'Auxiliares de Quadra' },
                { key: 'coordenador', label: 'Coordenadores' },
              ].map(f => (
                <button key={f.key} onClick={() => { setFiltroFuncao(f.key); setFiltroAberto(false) }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                  background: filtroFuncao === f.key ? 'rgba(165,76,46,0.1)' : 'transparent',
                  color: filtroFuncao === f.key ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
                }}>
                  {f.label}
                  {filtroFuncao === f.key && <span style={{ fontSize: '10px' }}>✓</span>}
                </button>
              ))}

              <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)', margin: '10px 0' }} />

              <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Empresa</div>
              {[
                { key: 'todas', label: 'Todas' },
                { key: 'procopio', label: 'Procopio' },
                { key: 'beach', label: 'Beach Arena' },
              ].map(f => (
                <button key={f.key} onClick={() => { setFiltroEmpresa(f.key); setFiltroAberto(false) }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                  background: filtroEmpresa === f.key ? 'rgba(61,107,122,0.1)' : 'transparent',
                  color: filtroEmpresa === f.key ? 'var(--color-state-info)' : 'var(--color-text-light-secondary)',
                }}>
                  {f.label}
                  {filtroEmpresa === f.key && <span style={{ fontSize: '10px' }}>✓</span>}
                </button>
              ))}

              <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)', margin: '10px 0' }} />

              <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Status</div>
              {[
                { key: 'ativos', label: 'Ativos', cor: 'var(--color-state-success)' },
                { key: 'inativos', label: 'Inativos', cor: 'var(--color-text-light-secondary)' },
                { key: 'todos', label: 'Todos', cor: 'var(--color-text-light-secondary)' },
              ].map(f => (
                <button key={f.key} onClick={() => { setFiltroAtivo(f.key); setFiltroAberto(false) }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', fontSize: '12px', marginBottom: '2px',
                  background: filtroAtivo === f.key ? 'rgba(75,139,106,0.08)' : 'transparent',
                  color: filtroAtivo === f.key ? f.cor : 'var(--color-text-light-secondary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: f.cor, flexShrink: 0 }} />
                    {f.label}
                  </div>
                  {filtroAtivo === f.key && <span style={{ fontSize: '10px' }}>✓</span>}
                </button>
              ))}

              {(filtroFuncao !== 'todos' || filtroEmpresa !== 'todas' || filtroAtivo !== 'ativos') && (
                <button onClick={() => { setFiltroFuncao('todos'); setFiltroEmpresa('todas'); setFiltroAtivo('ativos'); setFiltroAberto(false) }} style={{
                  width: '100%', marginTop: '8px', padding: '6px', borderRadius: '8px',
                  border: 'none', background: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)',
                  fontSize: '11px', cursor: 'pointer',
                }}>Limpar filtros</button>
              )}
            </div>
          </>
        )}
      </div>

      {isLoading ? <p style={{ color: 'var(--color-text-light-secondary)' }}>Carregando...</p> : (
        <div className="professores-grid">
          {professores.filter(prof => {
            // Sem permissão pra ver todos: só enxerga o próprio card (não vê salário/dados de colegas)
            if (!podeVerTodosSalarios && prof.id !== perfil?.professor_id) return false
            // Conta travada numa empresa nunca vê colaborador da outra
            if (empresaVinculada === 'beach_arena' && !prof.trabalha_beach) return false
            if (empresaVinculada === 'procopio' && !prof.trabalha_procopio) return false
            if (filtroAtivo === 'ativos' && prof.ativo === false) return false
            if (filtroAtivo === 'inativos' && prof.ativo !== false) return false
            if (filtroFuncao !== 'todos' && prof.funcao !== filtroFuncao) return false
            if (filtroEmpresa !== 'todas') {
              const mods = prof.modalidades_ids || []
              const nomesProf = modalidades.filter(m => mods.includes(m.id)).map(m => m.nome)
              const temProcopio = nomesProf.some(n => MODALIDADES_PROCOPIO.some(p => n.toLowerCase().includes(p.toLowerCase())))
              const temBeach = nomesProf.some(n => MODALIDADES_BEACH.some(b => n.toLowerCase().includes(b.toLowerCase())))
              if (filtroEmpresa === 'procopio' && !temProcopio) return false
              if (filtroEmpresa === 'beach' && !temBeach) return false
            }
            return true
          }).map(prof => (
            <div key={prof.id} onClick={() => abrirCard(prof)} className="professor-card" style={{ position: 'relative' }}>
              {podeEditarCadastros && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuCardId(menuCardId === prof.id ? null : prof.id) }}
                    style={{
                      position: 'absolute', top: '4px', right: '4px', zIndex: 2,
                      background: 'none', border: 'none', color: 'var(--color-text-light-secondary)', cursor: 'pointer',
                      padding: '4px', display: 'flex', borderRadius: '6px',
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {menuCardId === prof.id && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 3 }} onClick={e => { e.stopPropagation(); setMenuCardId(null) }} />
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute', top: '30px', right: '4px', zIndex: 4,
                          width: '170px', backgroundColor: 'var(--color-border-light-subtle)', border: '1px solid var(--color-border-light)',
                          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
                          textAlign: 'left',
                        }}
                      >
                        <button
                          onClick={() => toggleAtivoProfessor(prof)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 12px', fontSize: '12px', color: 'var(--color-text-light-primary)',
                            backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          {prof.ativo === false ? <RotateCcw size={13} /> : <Ban size={13} />}
                          {prof.ativo === false ? 'Reativar professor' : 'Inativar professor'}
                        </button>
                        <button
                          onClick={() => excluirProfessorPermanente(prof)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 12px', fontSize: '12px', color: 'var(--color-state-danger)',
                            backgroundColor: 'transparent', border: 'none', borderTop: '1px solid var(--color-border-light)', cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <Trash2 size={13} />
                          Excluir permanente
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="professor-avatar" style={{
                margin: '0 auto 10px',
                borderRadius: '50%',
                background: 'var(--color-action-primary)',
                padding: '2px', boxSizing: 'border-box',
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  backgroundColor: 'var(--color-surface-light-raised)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {prof.foto_url
                    ? <img src={prof.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-action-primary)' }}>
                        {prof.nome?.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </span>
                  }
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: prof.ativo !== false ? 'var(--color-state-success)' : 'var(--color-text-light-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light-primary)', lineHeight: 1.3 }}>
                  {prof.apelido || nomeCurto(prof.nome)}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '4px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {prof.funcao && prof.funcao !== 'professor'
                  ? prof.funcao.charAt(0).toUpperCase() + prof.funcao.slice(1)
                  : (prof.modalidades_ids || []).length > 0
                    ? modalidades.filter(m => (prof.modalidades_ids || []).includes(m.id)).map(m => m.nome).join(' · ')
                    : prof.modalidades?.nome || '—'
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {cardAberto && createPortal((
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setCardAberto(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxHeight: '94dvh', overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '20px 20px 0 0',
            padding: '20px 16px 32px', boxSizing: 'border-box',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-text-light-muted)', borderRadius: '2px', margin: '0 auto 20px' }} />

            <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadFoto} />
            <input ref={contratoInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUploadContrato} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <button onClick={() => setCardAberto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-secondary)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>

              {/* Foto maior + botão câmera + desde */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: 84, height: 84 }}>
                  <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--color-action-primary)', padding: '2px', boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--color-surface-light-raised)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cardAberto.foto_url
                        ? <a href={cardAberto.foto_url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                            <img src={cardAberto.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </a>
                        : <span style={{ fontSize: '26px', fontWeight: '700', color: 'var(--color-action-primary)' }}>
                            {cardAberto.nome?.split(' ').map(p => p[0]).slice(0, 2).join('')}
                          </span>
                      }
                    </div>
                  </div>
                  <button onClick={() => fotoInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', border: 'none', backgroundColor: 'var(--color-action-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploadandoFoto ? '...' : <Camera size={12} color="var(--color-surface-light-overlay)" />}
                  </button>
                </div>
                {cardAberto.data_inicio && (
                  <div style={{ fontSize: '9px', color: 'var(--color-text-light-muted)', textAlign: 'center', textTransform: 'capitalize' }}>
                    desde {format(new Date(cardAberto.data_inicio + 'T12:00'), "MMM/yyyy", { locale: ptBR })}
                  </div>
                )}
              </div>

              {/* Nome + contatos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-text-light-primary)', lineHeight: 1.2 }}>
                  {cardAberto.apelido || cardAberto.nome}
                  {cardAberto.apelido && <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', fontWeight: '400', marginTop: '2px' }}>{cardAberto.nome}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  {cardAberto.telefone && (
                    <button onClick={() => window.open(`https://wa.me/55${cardAberto.telefone.replace(/\D/g,'')}`, '_blank')} style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <MessageCircle size={15} color="#25D166" />
                    </button>
                  )}
                  {cardAberto.instagram && (
                    <button onClick={() => window.open(`https://instagram.com/${cardAberto.instagram.replace('@','').replace(/.*instagram\.com\//,'')}`, '_blank')} style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(61,107,122,0.15)', border: '1px solid rgba(61,107,122,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="var(--color-text-light-secondary)" stroke="none"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Logo empresa + aulas */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                {(() => {
                  const { temProcopio, temBeach } = getLogosEmpresas(cardAberto)
                  return (temProcopio || temBeach) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {temProcopio && <img src="/images/logoprocopio.png" alt="Procopio" style={{ height: '22px', objectFit: 'contain', opacity: 0.9 }} />}
                      {temProcopio && temBeach && <span style={{ color: 'var(--color-text-light-muted)', fontSize: '10px' }}>|</span>}
                      {temBeach && <img src="/images/beacharena.png" alt="Beach Arena" style={{ height: '22px', objectFit: 'contain', opacity: 0.9 }} />}
                    </div>
                  )
                })()}
                {cardAberto.funcao === 'professor' && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '34px', fontWeight: '900', color: 'var(--color-action-primary)', lineHeight: 1 }}>{totalAulas}</div>
                    <div style={{ fontSize: '8px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>Total de<br/>Aulas</div>
                  </div>
                )}
              </div>

            </div>

            {/* Acesso ao sistema (gestor) */}
            {podeEditarCadastros && (
              <div style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(165,76,46,0.15)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Lock size={13} color="var(--color-text-light-secondary)" />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acesso ao sistema</span>
                </div>

                {carregandoPerfilVinculado ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Carregando...</div>
                ) : perfilVinculado ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light-primary)' }}>
                        Login ativo <span style={{ color: 'var(--color-text-light-secondary)' }}>· CPF {mascararCPF(cardAberto.cpf) || '—'}</span>
                      </div>
                      {!mostrandoResetSenha && (
                        <button onClick={() => setMostrandoResetSenha(true)} style={{
                          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '9px',
                          backgroundColor: 'rgba(165,76,46,0.1)', border: '1px solid rgba(165,76,46,0.3)',
                          color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                          <KeyRound size={13} /> Resetar senha
                        </button>
                      )}
                    </div>

                    {mostrandoResetSenha && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', margin: 0 }}>
                          Defina uma senha temporária e passe pro professor — ele vai ser obrigado a trocar por uma senha só dele no próximo login.
                        </p>
                        <div style={{ position: 'relative' }}>
                          <input type={mostrarNovaSenhaReset ? 'text' : 'password'} placeholder="Senha temporária (mín. 8 caracteres)" value={novaSenhaReset}
                            onChange={e => setNovaSenhaReset(e.target.value)} style={{ ...inputStyle, paddingRight: '40px' }} />
                          <button type="button" onClick={() => setMostrarNovaSenhaReset(v => !v)} style={{
                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', color: 'var(--color-text-light-secondary)', cursor: 'pointer', padding: '4px', display: 'flex',
                          }}>
                            {mostrarNovaSenhaReset ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={handleResetarSenha} disabled={resetandoSenha} style={{
                            flex: 1, padding: '10px', borderRadius: '9px', border: 'none',
                            background: 'var(--color-action-primary)',
                            color: 'white', fontSize: '12px', fontWeight: '700',
                            cursor: resetandoSenha ? 'not-allowed' : 'pointer', opacity: resetandoSenha ? 0.7 : 1,
                          }}>
                            {resetandoSenha ? 'Salvando...' : 'Salvar senha nova'}
                          </button>
                          <button onClick={() => { setMostrandoResetSenha(false); setNovaSenhaReset('') }} style={{
                            padding: '10px 14px', borderRadius: '9px', border: '1px solid var(--color-border-light)',
                            backgroundColor: 'transparent', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer',
                          }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : criandoAcesso ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input placeholder="•••.•••.•••-•• (CPF do professor)" value={mascararCPF(formAcesso.cpf)} inputMode="numeric"
                      onChange={e => setFormAcesso(f => ({ ...f, cpf: apenasDigitosCPF(e.target.value) }))} style={inputStyle} />
                    <div style={{ position: 'relative' }}>
                      <input type={mostrarSenhaAcesso ? 'text' : 'password'} placeholder="Senha inicial (mín. 8 caracteres)" value={formAcesso.senha}
                        onChange={e => setFormAcesso(f => ({ ...f, senha: e.target.value }))} style={{ ...inputStyle, paddingRight: '40px' }} />
                      <button type="button" onClick={() => setMostrarSenhaAcesso(v => !v)} style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--color-text-light-secondary)', cursor: 'pointer', padding: '4px', display: 'flex',
                      }}>
                        {mostrarSenhaAcesso ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input type={mostrarSenhaAcesso ? 'text' : 'password'} placeholder="Confirmar senha" value={formAcesso.confirmacao}
                        onChange={e => setFormAcesso(f => ({ ...f, confirmacao: e.target.value }))} style={{ ...inputStyle, paddingRight: '40px' }} />
                      <button type="button" onClick={() => setMostrarSenhaAcesso(v => !v)} style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--color-text-light-secondary)', cursor: 'pointer', padding: '4px', display: 'flex',
                      }}>
                        {mostrarSenhaAcesso ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <button onClick={handleCriarAcesso} disabled={salvandoAcesso} style={{
                        flex: 1, padding: '10px', borderRadius: '9px', border: 'none',
                        background: 'var(--color-action-primary)',
                        color: 'white', fontSize: '12px', fontWeight: '700',
                        cursor: salvandoAcesso ? 'not-allowed' : 'pointer', opacity: salvandoAcesso ? 0.7 : 1,
                      }}>
                        {salvandoAcesso ? 'Criando...' : 'Criar acesso'}
                      </button>
                      <button onClick={() => { setCriandoAcesso(false); setFormAcesso({ cpf: '', senha: '', confirmacao: '' }) }} style={{
                        padding: '10px 14px', borderRadius: '9px', border: '1px solid var(--color-border-light)',
                        backgroundColor: 'transparent', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer',
                      }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setCriandoAcesso(true); setFormAcesso({ cpf: cardAberto.cpf || '', senha: '', confirmacao: '' }) }} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '9px',
                    backgroundColor: 'rgba(165,76,46,0.1)', border: '1px solid rgba(165,76,46,0.3)',
                    color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    <Lock size={13} /> Criar acesso ao sistema
                  </button>
                )}
              </div>
            )}

            {/* Acompanhamento de aulas/ganhos — só faz sentido pra quem é pago por aula (professor).
                Colaborador CLT (gestor/financeiro/auxiliar) recebe salário fixo, editável na aba Dados. */}
            {cardAberto.funcao === 'professor' && (<>
            {/* Financeiro resumo topo */}
            <div style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(165,76,46,0.15)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{labelMesMostrar} · {ganhosMostrar.qtd} aulas</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-action-primary)' }}>R$ {ganhosMostrar.valor.toFixed(2).replace('.', ',')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-light-secondary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Receita Extra</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: ganhosMostrar.valorExtras > 0 ? 'var(--color-state-info)' : 'var(--color-text-light-muted)' }}>
                      {ganhosMostrar.valorExtras > 0 ? `R$ ${ganhosMostrar.valorExtras.toFixed(2).replace('.', ',')}` : '—'}
                    </div>
                  </div>
                  <button onClick={() => setModalExtra(true)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-surface-light-overlay)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={14} color="var(--color-text-light-secondary)" />
                  </button>
                </div>
              </div>
              <div style={{ height: '3px', borderRadius: '2px', backgroundColor: 'var(--color-border-light)', overflow: 'hidden', marginBottom: '4px' }}>
                <div style={{ height: '100%', width: `${progressoMes}%`, background: 'var(--color-action-primary)', borderRadius: '2px' }} />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', textAlign: 'right' }}>Dia {diaAtual} de {diasNoMes} · {progressoMes}% do mês</div>
            </div>

            {/* Modal pagamento extra */}
            {modalExtra && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setModalExtra(false)}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '20px 20px 0 0', padding: '20px 16px', boxSizing: 'border-box' }}>
                  <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-text-light-muted)', borderRadius: '2px', margin: '0 auto 16px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '16px' }}>
                    {formExtra.id ? <><Pencil size={14} /> Editar Extra</> : '+ Pagamento Extra'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div><div style={labelStyle}>Data</div>
                      <input type="date" style={inputStyle} value={formExtra.data_pagamento} onChange={e => setFormExtra(f => ({ ...f, data_pagamento: e.target.value }))} /></div>
                    <div><div style={labelStyle}>Descrição</div>
                      <input style={inputStyle} placeholder="Ex: Evento, Diária, Bônus..." value={formExtra.descricao} onChange={e => setFormExtra(f => ({ ...f, descricao: e.target.value }))} /></div>
                    <div><div style={labelStyle}>Valor (R$)</div>
                      <input type="number" style={inputStyle} placeholder="0,00" value={formExtra.valor} onChange={e => setFormExtra(f => ({ ...f, valor: e.target.value }))} /></div>
                    {extraEhMultiEmpresa && (
                      <div><div style={labelStyle}>Empresa</div>
                        <select style={inputStyle} value={formExtra.empresa} onChange={e => setFormExtra(f => ({ ...f, empresa: e.target.value }))}>
                          <option value="">Selecione...</option>
                          <option value="procopio">Procópio</option>
                          <option value="beach_arena">Beach Arena</option>
                        </select></div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => setModalExtra(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={handleSalvarExtra} disabled={salvandoExtra} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        {salvandoExtra ? 'Salvando...' : <><Save size={14} /> Salvar</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gráfico evolução */}
            <div style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '14px', padding: '14px 16px', border: '1px solid var(--color-border-light)', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Evolução — últimos 6 meses</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '60px' }}>
                {dadosGrafico.map((d, i) => {
                  const isHL = mesSelecionado
                    ? (d.mes === mesSelecionado.mes && d.ano === mesSelecionado.ano)
                    : i === 5
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max((d.qtd / maxGrafico) * 48, d.qtd > 0 ? 4 : 0)}px`, background: isHL ? 'var(--color-action-primary)' : 'var(--color-border-light)' }} />
                      <div style={{ fontSize: '9px', color: isHL ? 'var(--color-action-primary)' : 'var(--color-text-light-muted)' }}>{d.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grid de meses */}
            <div style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '14px', padding: '14px 16px', border: '1px solid var(--color-border-light)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aulas por mês</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[anoAtual - 1, anoAtual].map(a => (
                    <button key={a} onClick={() => setAnoSelecionado(a)} style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', fontSize: '11px', background: anoSelecionado === a ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)', color: anoSelecionado === a ? 'white' : 'var(--color-text-light-secondary)', cursor: 'pointer' }}>{a}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {MESES.map((m, i) => {
                  const { qtd, valor } = calcularGanhosMes(i + 1, anoSelecionado)
                  const isAtual = i + 1 === mesAtual && anoSelecionado === anoAtual
                  const isSelecionado = mesSelecionado?.mes === i + 1 && mesSelecionado?.ano === anoSelecionado
                  return (
                    <button key={m} onClick={() => setMesSelecionado(isSelecionado ? null : { mes: i + 1, ano: anoSelecionado })} style={{
                      backgroundColor: isSelecionado ? 'rgba(61,107,122,0.18)' : isAtual ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-overlay)',
                      borderRadius: '10px', padding: '8px 6px',
                      border: isSelecionado ? '1px solid rgba(61,107,122,0.55)' : isAtual ? '1px solid rgba(165,76,46,0.3)' : '1px solid var(--color-border-light-subtle)',
                      cursor: 'pointer', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '10px', color: isSelecionado ? 'var(--color-state-info)' : isAtual ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', fontWeight: '600' }}>{m}</div>
                      <div style={{ fontSize: isSelecionado ? '16px' : '13px', fontWeight: '700', color: isSelecionado ? 'var(--color-state-success)' : 'var(--color-text-light-primary)', margin: '2px 0' }}>{qtd > 0 ? qtd : '—'}</div>
                      {valor > 0 && <div style={{ fontSize: '9px', color: isSelecionado ? 'var(--color-state-success)' : 'var(--color-state-success)', opacity: isSelecionado ? 1 : 0.7 }}>R${valor.toFixed(0)}</div>}
                    </button>
                  )
                })}
              </div>

{mesSelecionado && (() => {
                  const diasMap = getAulasDoDia(mesSelecionado.mes, mesSelecionado.ano)
                  const diasComAula = Object.keys(diasMap).sort((a, b) => Number(a) - Number(b))
                  const { qtd, valor } = calcularGanhosMes(mesSelecionado.mes, mesSelecionado.ano)
                  const extrasDoMes = pagamentosExtras.filter(p => p.mes === mesSelecionado.mes && p.ano === mesSelecionado.ano)
                  return (
                    <div style={{ marginTop: '12px', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(61,107,122,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-state-info)' }}>{MESES[mesSelecionado.mes - 1]}/{mesSelecionado.ano} · {qtd} aulas · R${valor.toFixed(2).replace('.', ',')}</div>
                        <button onClick={() => setMesSelecionado(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-light-secondary)', cursor: 'pointer' }}><X size={14} /></button>
                      </div>

                      {(() => {
                        // Quem trabalha nas duas empresas tem uma linha de boletos_professor
                        // por empresa (mesmo mês) — precisa saber qual delas está em edição.
                        const empresaAtual = extraEhMultiEmpresa ? empresaBoletoSel : (cardAberto.trabalha_beach ? 'beach_arena' : 'procopio')
                        const boleto = boletos.find(b => b.mes === mesSelecionado.mes && b.ano === mesSelecionado.ano && b.empresa === empresaAtual)
                        return (
                          <>
                            {extraEhMultiEmpresa && (
                              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                {[{ id: 'procopio', label: 'Procópio', cor: 'var(--color-action-primary)' }, { id: 'beach_arena', label: 'Beach Arena', cor: 'var(--color-state-info)' }].map(op => (
                                  <button key={op.id} onClick={() => setEmpresaBoletoSel(op.id)} style={{
                                    flex: 1, padding: '5px', borderRadius: '7px', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                                    border: `1px solid ${empresaAtual === op.id ? op.cor : 'var(--color-border-light)'}`,
                                    background: empresaAtual === op.id ? `${op.cor}18` : 'transparent',
                                    color: empresaAtual === op.id ? op.cor : 'var(--color-text-light-muted)',
                                  }}>{op.label}</button>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                              <label style={{ flex: 1, padding: '7px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', backgroundColor: boleto?.boleto_url ? 'rgba(75,139,106,0.1)' : 'var(--color-surface-light-overlay)', color: boleto?.boleto_url ? 'var(--color-state-success)' : 'var(--color-text-light-secondary)', outline: boleto?.boleto_url ? '1px solid rgba(75,139,106,0.3)' : '1px dashed var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUploadBoleto(e, mesSelecionado.mes, mesSelecionado.ano, empresaAtual)} />
                                <Upload size={11} />{boleto?.boleto_url ? 'Boleto ✓' : 'Boleto'}
                              </label>
                              {boleto?.boleto_url && (
                                <button onClick={() => handleExcluirAnexo('boleto', mesSelecionado.mes, mesSelecionado.ano, empresaAtual)} title="Excluir boleto" style={{ flexShrink: 0, padding: '7px', borderRadius: '8px', border: '1px solid rgba(180,71,47,0.3)', background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                              <label style={{ flex: 1, padding: '7px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', backgroundColor: boleto?.nf_url ? 'rgba(75,139,106,0.1)' : 'var(--color-surface-light-overlay)', color: boleto?.nf_url ? 'var(--color-state-success)' : 'var(--color-text-light-secondary)', outline: boleto?.nf_url ? '1px solid rgba(75,139,106,0.3)' : '1px dashed var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUploadNF(e, mesSelecionado.mes, mesSelecionado.ano, empresaAtual)} />
                                <FileText size={11} />{boleto?.nf_url ? 'NF ✓' : 'NF'}
                              </label>
                              {boleto?.nf_url && (
                                <button onClick={() => handleExcluirAnexo('nf', mesSelecionado.mes, mesSelecionado.ano, empresaAtual)} title="Excluir NF" style={{ flexShrink: 0, padding: '7px', borderRadius: '8px', border: '1px solid rgba(180,71,47,0.3)', background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </>
                        )
                      })()}

                      {diasComAula.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-light-muted)', textAlign: 'center', marginBottom: '8px' }}>Nenhuma aula confirmada</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                          {diasComAula.map(dia => {
                            const dataStr = `${mesSelecionado.ano}-${String(mesSelecionado.mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
                            return (
                              <button key={dia} onClick={() => setDiaSelecionado({ dataStr, professorId: cardAberto.id })} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '8px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-light-overlay)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-light-overlay)'}>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>Dia {String(dia).padStart(2, '0')}/{String(mesSelecionado.mes).padStart(2, '0')}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-state-success)' }}>{diasMap[dia]} {diasMap[dia] === 1 ? 'aula' : 'aulas'}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>›</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {extrasDoMes.length > 0 && (
                        <>
                          <div style={{ fontSize: '10px', color: 'var(--color-state-info)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '8px 0 6px' }}>Extras</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {extrasDoMes.map(ex => (
                              <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'rgba(61,107,122,0.06)', borderRadius: '8px', border: '1px solid rgba(61,107,122,0.15)' }}>
                                <div>
                                  <div style={{ fontSize: '12px', color: 'var(--color-text-light-primary)' }}>{ex.descricao}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)' }}>{format(new Date(ex.data_pagamento + 'T12:00'), 'dd/MM/yyyy')}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-state-info)' }}>R${Number(ex.valor).toFixed(2).replace('.', ',')}</span>
                                    <button onClick={() => { setFormExtra({ id: ex.id, data_pagamento: ex.data_pagamento, descricao: ex.descricao, valor: ex.valor, empresa: ex.empresa || '' }); setModalExtra(true) }} style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(165,76,46,0.1)', color: 'var(--color-action-primary)', cursor: 'pointer' }}>
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={async () => {
                                      if (!confirm('Excluir este extra?')) return
                                      await supabase.from('pagamentos_extras').delete().eq('id', ex.id)
                                      qc.invalidateQueries({ queryKey: ['pagamentos_extras', cardAberto.id] })
                                    }} style={{ padding: '3px 6px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer' }}>
                                      <X size={11} />
                                    </button>
                                  </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}
            </div>
            </>)}

            {/* Abas */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', padding: '4px' }}>
              {[
                { key: 'perfil', label: 'Dados' },
                { key: 'painel', label: 'Painel', somenteProfessor: true },
                { key: 'financeiro', label: 'Financeiro' },
                { key: 'avaliacoes', label: 'Avaliações', somenteGestor: true },
                { key: 'disponibilidade', label: 'Grade' },
                { key: 'historico', label: 'Histórico', somenteGestor: true },
                // Pesquisa de satisfação: mais restrito que "somenteGestor" (que também
                // libera financeiro/coordenador, e hoje uma segunda conta gestor além do
                // dono) — o requisito aqui foi "só EU", então trava num user_id específico
                // (USER_ID_DONO_PESQUISA), não no role.
                { key: 'pesquisa', label: 'Pesquisa', somenteDono: true },
              ].filter(a => (!a.somenteGestor || podeVerTodosSalarios) && (!a.somenteDono || ehDonoPesquisa) && (!a.somenteProfessor || cardAberto.funcao === 'professor')).map(a => (
                <button key={a.key} onClick={() => setAba(a.key)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer', background: aba === a.key ? 'var(--color-action-primary)' : 'transparent', color: aba === a.key ? 'white' : 'var(--color-text-light-secondary)' }}>{a.label}</button>
              ))}
            </div>

            {/* ABA PAINEL — mesmo painel em tempo real que o próprio professor vê (grade
                semanal, ao vivo agora, ganhos), só que o gestor está só olhando. */}
            {aba === 'painel' && cardAberto.funcao === 'professor' && (
              <DashboardProfessor professorIdProp={cardAberto.id} />
            )}

            {/* ABA DADOS */}
            {aba === 'perfil' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><div style={labelStyle}>Nome Completo</div><input style={inputStyle} placeholder="Nome completo *" value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contato</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Telefone</div><input style={inputStyle} placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} /></div>
                  <div><div style={labelStyle}>Instagram</div><input style={inputStyle} placeholder="@usuario" value={form.instagram} onChange={e => set('instagram', e.target.value)} /></div>
                </div>
                <div><div style={labelStyle}>E-mail</div><input style={inputStyle} placeholder="email@exemplo.com" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                <div><div style={labelStyle}>Apelido (opcional)</div><input style={inputStyle} placeholder="Ex: Cigano, Borges, Nunes..." value={form.apelido || ''} onChange={e => set('apelido', e.target.value)} /></div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Função</div>
                    <select style={inputStyle} value={form.funcao} onChange={e => set('funcao', e.target.value)}>
                      <option value="professor">Professor</option>
                      <option value="gerente">Gerente</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="auxiliar">Auxiliar</option>
                      <option value="auxiliar_quadra">Auxiliar de Quadra</option>
                      <option value="coordenador">Coordenador</option>
                    </select></div>
                </div>

                {/* Remuneração fica na aba Financeiro agora (Salário Fixo pra quem não é
                    professor, Valor por Aula pra quem é) — antes esse campo ficava aqui e
                    o gestor procurava na aba Financeiro sem achar, arriscando confundir com
                    o campo de valor por aula lá (que é por AULA, não por mês). */}

                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>CREF</div>
                <button onClick={() => set('tem_cref', !form.tem_cref)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                  borderRadius: '10px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                  background: form.tem_cref ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-overlay)',
                  outline: form.tem_cref ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)',
                  color: form.tem_cref ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', fontSize: '13px',
                }}>
                  <span>{form.tem_cref ? '✓' : '○'}</span>
                  <span>{form.tem_cref ? 'Possui CREF' : 'Possui CREF ou Liminar?'}</span>
                </button>

                {(form.tem_cref || cardAberto?.cref_url) && (
                  <>
                    <input style={inputStyle} placeholder="Número do CREF (ex: 123456-G/SP)"
                      value={form.numero_cref} onChange={e => set('numero_cref', e.target.value)} />
                    {cardAberto?.cref_url ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={cardAberto.cref_url} target="_blank" rel="noreferrer" style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                          borderRadius: '10px', border: '1px solid rgba(165,76,46,0.3)',
                          backgroundColor: 'rgba(165,76,46,0.06)', textDecoration: 'none', color: 'var(--color-action-primary)', fontSize: '13px',
                        }}>
                          <FileText size={14} /> Ver CREF
                        </a>
                        <label style={{
                          padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border-light)',
                          background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}>
                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (!file || !cardAberto?.id) return
                              const path = `professores/${cardAberto.id}/cref.${file.name.split('.').pop()}`
                              const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
                              if (error) return alert('Erro: ' + error.message)
                              const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
                              await supabase.from('professores').update({ cref_url: publicUrl }).eq('id', cardAberto.id)
                              setCardAberto(prev => ({ ...prev, cref_url: publicUrl }))
                            }} />
                          Substituir
                        </label>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '10px', borderRadius: '10px', border: '1px dashed var(--color-border-light)',
                        background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer', width: '100%',
                        boxSizing: 'border-box',
                      }}>
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file || !cardAberto?.id) return
                            const path = `professores/${cardAberto.id}/cref.${file.name.split('.').pop()}`
                            const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
                            if (error) return alert('Erro: ' + error.message)
                            const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
                            await supabase.from('professores').update({ cref_url: publicUrl }).eq('id', cardAberto.id)
                            setCardAberto(prev => ({ ...prev, cref_url: publicUrl }))
                          }} />
                        <Upload size={14} /> Upload do CREF (foto ou PDF)
                      </label>
                    )}
                  </>
                )}

                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Dados Pessoais</div>
                <div><div style={labelStyle}>Nascimento</div><input type="date" style={inputStyle} value={form.nascimento} onChange={e => set('nascimento', e.target.value)} /></div>
                <div><div style={labelStyle}>CPF</div><input style={inputStyle} placeholder="•••.•••.•••-••" inputMode="numeric" value={mascararCPF(form.cpf)} onChange={e => set('cpf', apenasDigitosCPF(e.target.value))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Cidade Nasc.</div><input style={inputStyle} placeholder="Cidade" value={form.cidade_nascimento} onChange={e => set('cidade_nascimento', e.target.value)} /></div>
                  <div><div style={labelStyle}>Estado Nasc.</div>
                    <select style={inputStyle} value={form.estado_nascimento} onChange={e => set('estado_nascimento', e.target.value)}>
                      <option value="">UF</option>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Início na empresa</div><input type="date" style={inputStyle} value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} /></div>
                  <div>
                    <div style={labelStyle}>Modalidades</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {modalidades.map(m => {
                        const selecionada = (form.modalidades_ids || []).includes(m.id)
                        return (
                          <button key={m.id} onClick={() => {
                            const atual = form.modalidades_ids || []
                            set('modalidades_ids', selecionada ? atual.filter(id => id !== m.id) : [...atual, m.id])
                          }} style={{
                            padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: selecionada ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
                            outline: selecionada ? 'none' : '1px solid var(--color-border-light)',
                            color: selecionada ? 'var(--color-surface-light-overlay)' : 'var(--color-text-light-secondary)',
                            fontSize: '11px', fontWeight: selecionada ? '700' : '400',
                            textAlign: 'center', lineHeight: 1.3,
                          }}>
                            {m.nome}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

<div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Dados do CNPJ</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>CNPJ</div>
                    <input style={inputStyle} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} /></div>
                  <div><div style={labelStyle}>Razão Social</div>
                    <input style={inputStyle} placeholder="Nome da empresa" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} /></div>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Endereço</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>CEP</div><input style={inputStyle} placeholder="00000-000" value={form.cep} onChange={e => { set('cep', e.target.value); buscarCep(e.target.value, setForm) }} /></div>
                  <div><div style={labelStyle}>Número</div><input style={inputStyle} placeholder="Nº" value={form.numero} onChange={e => set('numero', e.target.value)} /></div>
                </div>
                <div><div style={labelStyle}>Endereço</div><input style={inputStyle} placeholder="Rua / Avenida" value={form.endereco} onChange={e => set('endereco', e.target.value)} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><div style={labelStyle}>Bairro</div><input style={inputStyle} placeholder="Bairro" value={form.bairro} onChange={e => set('bairro', e.target.value)} /></div>
                  <div><div style={labelStyle}>Complemento</div><input style={inputStyle} placeholder="Apto..." value={form.complemento} onChange={e => set('complemento', e.target.value)} /></div>
                </div>

                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Contrato</div>
                {cardAberto.contrato_url ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={cardAberto.contrato_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(165,76,46,0.3)', backgroundColor: 'rgba(165,76,46,0.06)', textDecoration: 'none', color: 'var(--color-action-primary)', fontSize: '13px' }}>
                      <FileText size={14} /> Ver contrato
                    </a>
                    <button onClick={() => contratoInputRef.current?.click()} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer' }}>Substituir</button>
                  </div>
                ) : (
                  <button onClick={() => contratoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px', border: '1px dashed var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer', width: '100%' }}>
                    <Upload size={14} /> Upload do contrato (PDF)
                  </button>
                )}

                <button onClick={handleSalvar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px', width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : <><Save size={15} /> Salvar dados</>}
                </button>
              </div>
            )}

            {/* ABA FINANCEIRO */}
            {aba === 'financeiro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {form.trabalha_procopio && (
                  <BlocoDadosBancarios
                    sufixo="" cardAberto={cardAberto} form={form} set={set}
                    titulo={form.trabalha_procopio && form.trabalha_beach ? 'Dados Bancários — Procópio' : 'Dados Bancários'}
                    cor="var(--color-action-primary)"
                  />
                )}
                {form.trabalha_beach && (
                  <BlocoDadosBancarios
                    sufixo="_beach" cardAberto={cardAberto} form={form} set={set}
                    titulo={form.trabalha_procopio && form.trabalha_beach ? 'Dados Bancários — Beach Arena' : 'Dados Bancários'}
                    cor="var(--color-state-info)"
                  />
                )}
                {/* Empresa(s) onde atua */}
                <div>
                  <div style={labelStyle}>Empresa(s) onde atua</div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    {[{ key: 'trabalha_procopio', label: 'Procopio', cor: 'var(--color-action-primary)' }, { key: 'trabalha_beach', label: 'Beach Arena', cor: 'var(--color-state-info)' }].map(({ key, label, cor }) => (
                      <button key={key} onClick={() => set(key, !form[key])} style={{
                        flex: 1, padding: '8px', borderRadius: '10px', border: `1px solid ${form[key] ? cor : 'var(--color-border-light)'}`,
                        background: form[key] ? `${cor}18` : 'transparent',
                        color: form[key] ? cor : 'var(--color-text-light-muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: form[key] ? cor : 'var(--color-text-light-muted)', flexShrink: 0 }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remuneração: por aula pra professor (o valor varia por aula dada, ver
                    calcularValorAula); salário fixo mensal pra qualquer outra função (gerente,
                    financeiro, auxiliar, auxiliar de quadra, coordenador) — esses não dão aula,
                    então não faz sentido mostrar "valor por aula" pra eles (risco real: alguém
                    lançar o salário de R$1.500/mês nesse campo e o sistema entender R$1.500
                    POR AULA). O Financeiro gera automaticamente o lançamento "Salário fixo" todo
                    mês pra quem tem esse valor preenchido aqui — não precisa lançar na mão. */}
                {form.funcao === 'professor' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.trabalha_procopio && (
                      <div>
                        <div style={{ ...labelStyle, color: 'var(--color-action-primary)' }}>Valor por Aula — Procopio (R$)</div>
                        <input type="number" style={inputStyle} placeholder="0,00" value={form.valor_aula} onChange={e => set('valor_aula', e.target.value)} />
                      </div>
                    )}
                    {form.trabalha_beach && (
                      <div>
                        <div style={{ ...labelStyle, color: 'var(--color-state-info)' }}>Valor por Aula — Beach Arena (R$)</div>
                        <input type="number" style={inputStyle} placeholder="0,00" value={form.valor_aula_beach} onChange={e => set('valor_aula_beach', e.target.value)} />
                      </div>
                    )}
                  </div>
                ) : (
                  form.trabalha_procopio && form.trabalha_beach ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><div style={{ ...labelStyle, color: 'var(--color-action-primary)' }}>Salário Fixo — Procópio (R$/mês)</div>
                        <input type="number" style={inputStyle} placeholder="0,00" value={form.salario_fixo_procopio || ''} onChange={e => set('salario_fixo_procopio', e.target.value)} /></div>
                      <div><div style={{ ...labelStyle, color: 'var(--color-state-info)' }}>Salário Fixo — Beach Arena (R$/mês)</div>
                        <input type="number" style={inputStyle} placeholder="0,00" value={form.salario_fixo_beach || ''} onChange={e => set('salario_fixo_beach', e.target.value)} /></div>
                    </div>
                  ) : (
                    <div><div style={labelStyle}>Salário Fixo (R$/mês)</div>
                      <input type="number" style={inputStyle} placeholder="0,00"
                        value={(form.trabalha_beach ? form.salario_fixo_beach : form.salario_fixo_procopio) || ''}
                        onChange={e => set(form.trabalha_beach ? 'salario_fixo_beach' : 'salario_fixo_procopio', e.target.value)} /></div>
                  )
                )}
                {/* Status ativo/inativo */}
                <div>
                  <div style={labelStyle}>Status do Colaborador</div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    {[{ val: true, label: 'Ativo', cor: 'var(--color-state-success)' }, { val: false, label: 'Inativo', cor: 'var(--color-text-light-secondary)' }].map(({ val, label, cor }) => (
                      <button key={String(val)} onClick={() => set('ativo', val)} style={{
                        flex: 1, padding: '8px', borderRadius: '10px',
                        border: `1px solid ${form.ativo === val ? cor : 'var(--color-border-light)'}`,
                        background: form.ativo === val ? `${cor}18` : 'transparent',
                        color: form.ativo === val ? cor : 'var(--color-text-light-muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cor, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleSalvar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : <><Save size={14} /> Salvar dados bancários</>}
                </button>

                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px', marginBottom: '4px' }}>Histórico de pagamentos</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', marginBottom: '10px' }}>Clique num mês na grade "Aulas por mês" acima pra ver o resumo e anexar boleto/NF.</div>
                </div>

                {mesesFinanceiro.map(({ mes, ano }) => {
                  const { qtd, valor } = calcularGanhosMes(mes, ano)
                  if (qtd === 0) return null
                  return (
                    <div key={`${mes}-${ano}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '10px', padding: '10px 14px', border: mes === mesAtual && ano === anoAtual ? '1px solid rgba(165,76,46,0.2)' : '1px solid var(--color-border-light)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: mes === mesAtual && ano === anoAtual ? 'var(--color-action-primary)' : 'var(--color-text-light-primary)' }}>{MESES[mes - 1]}/{ano}</div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-state-success)' }}>R$ {valor.toFixed(2).replace('.', ',')}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)' }}>{qtd} aulas</div>
                      </div>
                    </div>
                  )
                })}

                <div style={{ backgroundColor: 'rgba(165,76,46,0.08)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(165,76,46,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total acumulado ({totalAulas} aulas)</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-action-primary)' }}>R$ {totalGeral.toFixed(2).replace('.', ',')}</div>
                </div>
              </div>
            )}

            {/* ABA AVALIAÇÕES */}
            {aba === 'avaliacoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {avaliacoes.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Histórico</div>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {avaliacoes.map((av, i) => {
                        const tomarAcao = av.media <= 2
                        return (
                          <div key={av.id} style={{ flexShrink: 0, width: '72px', textAlign: 'center', backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '10px', padding: '10px 8px', border: tomarAcao ? '1px solid rgba(180,71,47,0.5)' : '1px solid var(--color-border-light)' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: tomarAcao ? 'var(--color-state-danger)' : 'var(--color-action-primary)' }}>{avaliacoes.length - i}ª</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', margin: '4px 0' }}>
                              <Star size={10} fill="var(--color-action-primary)" color="var(--color-action-primary)" />
                              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{av.media}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-light-muted)' }}>{format(new Date(av.data_avaliacao + 'T12:00'), 'dd/MM/yy')}</div>
                            {tomarAcao && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '8px', color: 'var(--color-state-danger)', fontWeight: '600', marginTop: '4px' }}>
                                <TriangleAlert size={9} /> AÇÃO
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nova Avaliação</div>
                <div style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {CRITERIOS.map(c => (
                    <div key={c.key}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>{c.label}</div>
                      <StarRating value={novasNotas[c.key]} onChange={v => setNovasNotas(n => ({ ...n, [c.key]: v }))} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Observação (opcional)</div>
                    <textarea rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Pontos fortes, pontos de melhoria..." value={novasNotas.observacao} onChange={e => setNovasNotas(n => ({ ...n, observacao: e.target.value }))} />
                  </div>
                  <button onClick={() => setModalAval(true)} style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    ⭐ Salvar Avaliação
                  </button>

                  {modalAval && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setModalAval(false)}>
                      <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '20px 20px 0 0', padding: '20px 16px', boxSizing: 'border-box', maxHeight: '80dvh', overflowY: 'auto' }}>
                        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-text-light-muted)', borderRadius: '2px', margin: '0 auto 16px' }} />
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '4px' }}>Confirmar avaliação</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '16px' }}>{cardAberto.nome}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div><div style={labelStyle}>Data da avaliação</div>
                            <input type="date" style={inputStyle} value={dataAvaliacao} onChange={e => setDataAvaliacao(e.target.value)} /></div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avaliadores</div>
                          {avaliadores.map((av, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input style={inputStyle} placeholder="Nome do avaliador *" value={av.nome} onChange={e => setAvaliadores(prev => prev.map((a, j) => j === i ? { ...a, nome: e.target.value } : a))} />
                                <input style={inputStyle} placeholder="Cargo (ex: Gestor, Coord. Técnico)" value={av.cargo} onChange={e => setAvaliadores(prev => prev.map((a, j) => j === i ? { ...a, cargo: e.target.value } : a))} />
                              </div>
                              {avaliadores.length > 1 && (
                                <button onClick={() => setAvaliadores(prev => prev.filter((_, j) => j !== i))} style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer', marginTop: '2px' }}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => setAvaliadores(prev => [...prev, { nome: '', cargo: '' }])} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px dashed var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                            <Plus size={13} /> Adicionar avaliador
                          </button>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button onClick={() => setModalAval(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSalvarAvaliacao} disabled={salvandoAval} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              {salvandoAval ? 'Salvando...' : '⭐ Confirmar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {avaliacoes.map((av, i) => {
                  const tomarAcao = av.media <= 2
                  return (
                    <div key={av.id} style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px', padding: '14px', border: tomarAcao ? '1px solid rgba(180,71,47,0.4)' : '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
                          {avaliacoes.length - i}ª avaliação · {format(new Date(av.data_avaliacao + 'T12:00'), 'dd/MM/yyyy')}
                          {av.avaliadores?.length > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-light-muted)', marginTop: '2px' }}>
                              {av.avaliadores.map(a => `${a.nome}${a.cargo ? ` (${a.cargo})` : ''}`).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Star size={12} fill="var(--color-action-primary)" color="var(--color-action-primary)" />
                          <span style={{ fontSize: '13px', fontWeight: '700', color: tomarAcao ? 'var(--color-state-danger)' : 'var(--color-action-primary)' }}>{av.media}</span>
                          {tomarAcao && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--color-state-danger)', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(180,71,47,0.1)' }}>
                              <TriangleAlert size={10} /> TOMAR AÇÃO
                            </span>
                          )}
                        </div>
                      </div>
                      {CRITERIOS.map(c => (
                        <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)' }}>{c.label}</span>
                          <StarRating value={av[c.key]} disabled />
                        </div>
                      ))}
                      {av.observacao && <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid var(--color-border-light-subtle)', paddingTop: '8px' }}>{av.observacao}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ABA DISPONIBILIDADE */}
            {aba === 'disponibilidade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grade de disponibilidade</div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', paddingLeft: '36px' }}>
                    {DIAS_LABEL.map(d => (
                      <div key={d} style={{ width: '36px', flexShrink: 0, textAlign: 'center', fontSize: '9px', color: 'var(--color-text-light-secondary)', fontWeight: '600' }}>{d}</div>
                    ))}
                  </div>
                  {HORARIOS_GRADE.map(horario => (
                    <div key={horario} style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
                      <div style={{ width: '32px', flexShrink: 0, fontSize: '9px', color: 'var(--color-text-light-muted)', textAlign: 'right', paddingRight: '4px' }}>{horario}</div>
                      {DIAS_SEMANA.map(dia => {
                        const status = getStatusDisp(dia, horario)
                        return (
                          <div key={dia} style={{ width: '36px', height: '28px', flexShrink: 0, borderRadius: '6px', backgroundColor: status ? COR_DISP[status] + '25' : 'var(--color-surface-light-overlay)', border: `1px solid ${status ? COR_DISP[status] + '60' : 'var(--color-border-light-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {status && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COR_DISP[status] }} />}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
                  {[['disponivel','var(--color-state-success)','Disponível'],['talvez','var(--color-action-primary)','Talvez'],['indisponivel','var(--color-state-danger)','Indisponível']].map(([s,c,l]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c }} />
                      <span style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)' }}>{l}</span>
                    </div>
                  ))}
                </div>
                {disponibilidades.length === 0 && (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>
                    Professor ainda não preencheu a disponibilidade
                  </div>
                )}
              </div>
            )}

            {aba === 'historico' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {historicoProf.length === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>
                    Nenhuma ação registrada ainda.
                  </div>
                ) : historicoProf.map(log => (
                  <div key={log.id} style={{ backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--color-border-light-subtle)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-light-primary)' }}>{formatarHistorico(log)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginTop: '4px' }}>
                      {format(new Date(log.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ABA PESQUISA — link único de satisfação, respostas visíveis só pro dono
                (role 'gestor'/'admin'), nunca pro próprio professor nem pra outros papéis —
                ver 028_pesquisa_satisfacao.sql (RLS travada em role='admin' + RPC só pra
                leitura pública anônima do nome/status, nunca das respostas). */}
            {aba === 'pesquisa' && (
              <AbaPesquisaSatisfacao
                professorNome={cardAberto.nome}
                pesquisa={pesquisaSatisfacao}
                carregando={carregandoPesquisa}
                respostas={respostasPesquisa}
                carregandoRespostas={carregandoRespostas}
              />
            )}
          </div>
        </div>
      ), document.body)}

      {/* MODAL DETALHES DIA */}
      {diaSelecionado && (
        <ModalDetalhesDia
          professorId={diaSelecionado.professorId}
          dataStr={diaSelecionado.dataStr}
          onClose={() => setDiaSelecionado(null)}
        />
      )}

      {/* MODAL CRIAR */}
      {modalCriar && createPortal((
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={() => { setModalCriar(false); setTipoColaborador(null); setCpfNovoColaborador(''); setSenhaNovoColaborador('') }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '20px 20px 0 0', padding: '20px 16px', boxSizing: 'border-box', maxHeight: '85dvh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-text-light-muted)', borderRadius: '2px', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '16px' }}>Novo Colaborador</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={labelStyle}>Tipo de colaborador *</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {TIPOS_COLABORADOR.map(t => (
                    <button key={t.value} type="button" onClick={() => setTipoColaborador(t.value)} style={{
                      padding: '10px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: tipoColaborador === t.value ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
                      outline: tipoColaborador === t.value ? 'none' : '1px solid var(--color-border-light)',
                      color: tipoColaborador === t.value ? 'white' : 'var(--color-text-light-secondary)',
                      fontSize: '12px', fontWeight: tipoColaborador === t.value ? '700' : '400',
                      textAlign: 'center',
                    }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <input style={inputStyle} placeholder="Nome completo *" value={form.nome} onChange={e => set('nome', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={inputStyle} placeholder="•••.•••.•••-•• (CPF) *" value={mascararCPF(cpfNovoColaborador)} onChange={e => setCpfNovoColaborador(apenasDigitosCPF(e.target.value))} />
                <input style={inputStyle} type="password" placeholder="Senha de acesso *" value={senhaNovoColaborador} onChange={e => setSenhaNovoColaborador(e.target.value)} />
              </div>
              <input style={inputStyle} placeholder="Telefone (WhatsApp)" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
              <input style={inputStyle} placeholder="E-mail" value={form.email} onChange={e => set('email', e.target.value)} />

              {tipoColaborador === 'professor' && (
                <div>
                  <div style={labelStyle}>Modalidades</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {modalidades.map(m => {
                      const selecionada = (form.modalidades_ids || []).includes(m.id)
                      return (
                        <button key={m.id} type="button" onClick={() => {
                          const atual = form.modalidades_ids || []
                          set('modalidades_ids', selecionada ? atual.filter(id => id !== m.id) : [...atual, m.id])
                        }} style={{
                          padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          background: selecionada ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
                          outline: selecionada ? 'none' : '1px solid var(--color-border-light)',
                          color: selecionada ? 'var(--color-surface-light-overlay)' : 'var(--color-text-light-secondary)',
                          fontSize: '11px', fontWeight: selecionada ? '700' : '400',
                          textAlign: 'center', lineHeight: 1.3,
                        }}>
                          {m.nome}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => { setModalCriar(false); setTipoColaborador(null); setCpfNovoColaborador(''); setSenhaNovoColaborador('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)', background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCriarColaborador} disabled={salvando || !form.nome.trim() || !tipoColaborador} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}