import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy, Plus, ChevronDown, ChevronUp, Check, AlertTriangle, X, Award, HelpCircle } from 'lucide-react'
import {
  useClassificacaoRanking, useJogosEmAberto,
  useCriarJogo, useLancarPlacar, useConfirmarPlacar, useContestarPlacar, useCancelarJogo,
} from '../../hooks/useRanking'
import { useTorneios, useCriarTorneio, useAtualizarStatusTorneio } from '../../hooks/useTorneios'
import { useModalidades } from '../../hooks/useModalidades'
import { useQuadras } from '../../hooks/useQuadras'
import { useAlunos } from '../../hooks/useAlunos'
import { NIVEIS_ASSIDUIDADE } from '../../lib/pontuacaoBeyond'
import { cicloAtual } from '../../constants/rankingCategorias'
import { supabase } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function corNivel(nivel) {
  return NIVEIS_ASSIDUIDADE.find(n => n.chave === nivel)?.cor || '#555'
}

function Pill({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer',
        background: ativo ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
        outline: ativo ? 'none' : '1px solid #2a2a2a',
        color: ativo ? 'white' : '#888',
        fontSize: '12px', fontWeight: ativo ? '700' : '500', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// Busca + chips pra escolher N alunos de um lado do jogo (1 pra simples, 2 pra dupla).
function SeletorAlunosLado({ label, quantidade, selecionados, onMudar, excluirIds }) {
  const [busca, setBusca] = useState('')
  const { data: todosAlunos } = useAlunos()

  const sugestoes = busca.length >= 2
    ? (todosAlunos || [])
      .filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
      .filter(a => !selecionados.some(s => s.id === a.id) && !excluirIds.includes(a.id))
      .slice(0, 6)
    : []

  function adicionar(aluno) {
    if (selecionados.length >= quantidade) return
    onMudar([...selecionados, aluno])
    setBusca('')
  }
  function remover(alunoId) {
    onMudar(selecionados.filter(s => s.id !== alunoId))
  }

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
        {label} ({selecionados.length}/{quantidade})
      </div>
      {selecionados.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {selecionados.map(s => (
            <span key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 8px 5px 10px',
              borderRadius: '7px', backgroundColor: 'rgba(252,200,37,0.12)', color: '#fcc825',
              fontSize: '12px', fontWeight: '600',
            }}>
              {s.nome}
              <button onClick={() => remover(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fcc825', display: 'flex' }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {selecionados.length < quantidade && (
        <div style={{ position: 'relative' }}>
          <Input placeholder="Buscar aluno..." value={busca} onChange={e => setBusca(e.target.value)} />
          {sugestoes.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 5,
              backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '10px', overflow: 'hidden',
            }}>
              {sugestoes.map(a => (
                <button key={a.id} onClick={() => adicionar(a)} style={{
                  display: 'block', width: '100%', padding: '9px 12px', border: 'none', textAlign: 'left',
                  backgroundColor: 'transparent', color: '#F0F2F5', fontSize: '13px', cursor: 'pointer',
                }}>
                  {a.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModalCriarJogo({ modalidadeId, onClose }) {
  const { data: quadras } = useQuadras(modalidadeId)
  const { data: torneios } = useTorneios(modalidadeId)
  const criarJogo = useCriarJogo()
  const [tipo, setTipo] = useState('simples')
  const [origem, setOrigem] = useState('avulso')
  const [torneioId, setTorneioId] = useState('')
  const [dataJogo, setDataJogo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [quadraId, setQuadraId] = useState('')
  const [lado1, setLado1] = useState([])
  const [lado2, setLado2] = useState([])

  const torneiosAbertos = (torneios || []).filter(t => t.status === 'planejado' || t.status === 'em_andamento')
  const quantidade = tipo === 'dupla' ? 2 : 1
  const pronto = lado1.length === quantidade && lado2.length === quantidade && (origem === 'avulso' || !!torneioId)

  async function handleCriar() {
    try {
      await criarJogo.mutateAsync({
        modalidadeId, tipo, dataJogo, quadraId: quadraId || null,
        origem, torneioId: origem === 'torneio' ? torneioId : null,
        participantesLado1: lado1.map(a => a.id),
        participantesLado2: lado2.map(a => a.id),
      })
      toast.success('Jogo criado! Lance o placar depois da partida.', { style: toastStyle })
      onClose()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <Modal open onClose={onClose} title="Criar jogo" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Pill ativo={tipo === 'simples'} onClick={() => { setTipo('simples'); setLado1([]); setLado2([]) }}>Simples</Pill>
          <Pill ativo={tipo === 'dupla'} onClick={() => { setTipo('dupla'); setLado1([]); setLado2([]) }}>Dupla</Pill>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Origem</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Pill ativo={origem === 'avulso'} onClick={() => { setOrigem('avulso'); setTorneioId('') }}>Avulso</Pill>
            <Pill ativo={origem === 'torneio'} onClick={() => setOrigem('torneio')}>Torneio (pontos em dobro)</Pill>
          </div>
          {origem === 'torneio' && (
            !torneiosAbertos.length ? (
              <div style={{ fontSize: '11px', color: '#f97316', marginTop: '8px' }}>
                Nenhum torneio aberto nessa modalidade ainda — crie um na seção "Torneios internos".
              </div>
            ) : (
              <div style={{ marginTop: '8px' }}>
                <Select value={torneioId} onChange={e => setTorneioId(e.target.value)}>
                  <option value="">Selecione o torneio...</option>
                  {torneiosAbertos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Select>
              </div>
            )
          )}
        </div>

        <SeletorAlunosLado label="Lado 1" quantidade={quantidade} selecionados={lado1} onMudar={setLado1} excluirIds={lado2.map(a => a.id)} />
        <SeletorAlunosLado label="Lado 2" quantidade={quantidade} selecionados={lado2} onMudar={setLado2} excluirIds={lado1.map(a => a.id)} />

        <Input type="date" label="Data" value={dataJogo} onChange={e => setDataJogo(e.target.value)} />

        <Select label="Quadra (opcional)" value={quadraId} onChange={e => setQuadraId(e.target.value)}>
          <option value="">Não definida</option>
          {quadras?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </Select>

        <button
          onClick={handleCriar}
          disabled={!pronto || criarJogo.isPending}
          style={{
            padding: '12px', borderRadius: '10px', border: 'none', cursor: pronto ? 'pointer' : 'default',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
            fontSize: '14px', fontWeight: '700', opacity: pronto ? 1 : 0.5,
          }}
        >
          {criarJogo.isPending ? 'Criando...' : 'Criar jogo'}
        </button>
      </div>
    </Modal>
  )
}

function ModalCriarTorneio({ modalidadeId, categorias, onClose }) {
  const criarTorneio = useCriarTorneio()
  const [nome, setNome] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState('')

  async function handleCriar() {
    try {
      await criarTorneio.mutateAsync({ nome, modalidadeId, categoriaId: categoriaId || null, dataInicio, dataFim: dataFim || null })
      toast.success('Torneio criado!', { style: toastStyle })
      onClose()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <Modal open onClose={onClose} title="Criar torneio interno" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input label="Nome do torneio" placeholder="Ex: Torneio de Inverno 2026" value={nome} onChange={e => setNome(e.target.value)} />
        <Select label="Categoria (opcional — vazio vale pra todas)" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Input type="date" label="Data de início" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        <Input type="date" label="Data de fim (opcional)" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        <button
          onClick={handleCriar}
          disabled={!nome || !dataInicio || criarTorneio.isPending}
          style={{
            padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
            fontSize: '14px', fontWeight: '700', opacity: (!nome || !dataInicio) ? 0.5 : 1,
          }}
        >
          {criarTorneio.isPending ? 'Criando...' : 'Criar torneio'}
        </button>
      </div>
    </Modal>
  )
}

const LABEL_STATUS_TORNEIO = {
  planejado: { texto: 'Planejado', cor: '#888' },
  em_andamento: { texto: 'Em andamento', cor: '#22c55e' },
  encerrado: { texto: 'Encerrado', cor: '#555' },
  cancelado: { texto: 'Cancelado', cor: '#EF4444' },
}

function CardTorneio({ torneio }) {
  const atualizarStatus = useAtualizarStatusTorneio()
  const label = LABEL_STATUS_TORNEIO[torneio.status] || LABEL_STATUS_TORNEIO.planejado

  async function mudarStatus(novoStatus) {
    try {
      await atualizarStatus.mutateAsync({ torneioId: torneio.id, status: novoStatus })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>{torneio.nome}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {torneio.ranking_categorias?.nome || 'Todas as categorias'} ·{' '}
            {format(new Date(torneio.data_inicio + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR })}
            {torneio.data_fim ? ` a ${format(new Date(torneio.data_fim + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR })}` : ''}
          </div>
        </div>
        <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', flexShrink: 0, backgroundColor: `${label.cor}22`, color: label.cor }}>
          {label.texto}
        </span>
      </div>
      {(torneio.status === 'planejado' || torneio.status === 'em_andamento') && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          {torneio.status === 'planejado' && (
            <button onClick={() => mudarStatus('em_andamento')} disabled={atualizarStatus.isPending} style={{
              flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: '11px', fontWeight: '700',
            }}>
              Iniciar
            </button>
          )}
          {torneio.status === 'em_andamento' && (
            <button onClick={() => mudarStatus('encerrado')} disabled={atualizarStatus.isPending} style={{
              flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: 'rgba(255,255,255,0.06)', color: '#888', fontSize: '11px', fontWeight: '700',
            }}>
              Encerrar
            </button>
          )}
          <button onClick={() => mudarStatus('cancelado')} disabled={atualizarStatus.isPending} style={{
            padding: '7px 12px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '11px', cursor: 'pointer',
          }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

function FormularioPlacar({ jogo, onFechar }) {
  const lancarPlacar = useLancarPlacar()
  const [placar, setPlacar] = useState('')
  const [ladoVencedor, setLadoVencedor] = useState(1)
  const [wo, setWo] = useState(false)

  async function handleLancar() {
    try {
      await lancarPlacar.mutateAsync({ jogoId: jogo.id, placar: placar || (wo ? 'W.O.' : ''), ladoVencedor, wo })
      toast.success('Placar lançado — aguardando confirmação (ou auto-aprova em 48h).', { style: toastStyle })
      onFechar()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  const nomesLado = lado => jogo.ranking_jogo_participantes.filter(p => p.lado === lado).map(p => p.alunos?.nome).join(' / ')

  return (
    <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', backgroundColor: '#111', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Input placeholder="Placar (ex: 6-3, 6-4)" value={placar} onChange={e => setPlacar(e.target.value)} disabled={wo} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Pill ativo={ladoVencedor === 1} onClick={() => setLadoVencedor(1)}>Venceu: {nomesLado(1)}</Pill>
        <Pill ativo={ladoVencedor === 2} onClick={() => setLadoVencedor(2)}>Venceu: {nomesLado(2)}</Pill>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888', cursor: 'pointer' }}>
        <input type="checkbox" checked={wo} onChange={e => setWo(e.target.checked)} /> Foi W.O.
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onFechar} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button
          onClick={handleLancar}
          disabled={lancarPlacar.isPending || (!wo && !placar)}
          style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
        >
          {lancarPlacar.isPending ? 'Salvando...' : 'Salvar placar'}
        </button>
      </div>
    </div>
  )
}

function CardJogoEmAberto({ jogo }) {
  const [lancando, setLancando] = useState(false)
  const confirmarPlacar = useConfirmarPlacar()
  const contestarPlacar = useContestarPlacar()
  const cancelarJogo = useCancelarJogo()

  const participantes = jogo.ranking_jogo_participantes || []
  const nomesLado = lado => participantes.filter(p => p.lado === lado).map(p => p.alunos?.nome).join(' / ')
  const precisaPlacar = !jogo.placar
  const aguardandoConfirmacao = !!jogo.placar && jogo.status === 'pendente'

  async function handleConfirmar(participanteId) {
    try {
      await confirmarPlacar.mutateAsync({ participanteId, jogoId: jogo.id })
      toast.success('Placar confirmado!', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }
  async function handleContestar() {
    try {
      await contestarPlacar.mutateAsync({ jogoId: jogo.id })
      toast.success('Jogo marcado como contestado.', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }
  async function handleCancelar() {
    try {
      await cancelarJogo.mutateAsync({ jogoId: jogo.id })
      toast.success('Jogo cancelado.', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>{nomesLado(1)} <span style={{ color: '#555' }}>vs</span> {nomesLado(2)}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {format(new Date(jogo.data_jogo + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR })}
            {jogo.placar ? ` · ${jogo.placar}` : ''}
          </div>
        </div>
        <span style={{
          fontSize: '10px', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', flexShrink: 0,
          backgroundColor: jogo.status === 'contestado' ? 'rgba(239,68,68,0.15)' : 'rgba(252,200,37,0.15)',
          color: jogo.status === 'contestado' ? '#EF4444' : '#fcc825',
        }}>
          {jogo.status === 'contestado' ? 'Contestado' : precisaPlacar ? 'Sem placar' : 'Aguardando confirmação'}
        </span>
      </div>

      {precisaPlacar || jogo.status === 'contestado' ? (
        lancando ? (
          <FormularioPlacar jogo={jogo} onFechar={() => setLancando(false)} />
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={() => setLancando(true)} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '700',
            }}>
              {jogo.status === 'contestado' ? 'Lançar placar de novo' : 'Lançar placar'}
            </button>
            <button onClick={handleCancelar} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>
              Cancelar jogo
            </button>
          </div>
        )
      ) : aguardandoConfirmacao ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {participantes.map(p => (
            <button
              key={p.id}
              onClick={() => handleConfirmar(p.id)}
              disabled={confirmarPlacar.isPending}
              title={`Confirmar em nome de ${p.alunos?.nome}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e',
                fontSize: '11px', fontWeight: '600',
              }}
            >
              <Check size={12} /> {p.alunos?.nome}
            </button>
          ))}
          <button onClick={handleContestar} disabled={contestarPlacar.isPending} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', borderRadius: '8px',
            border: 'none', cursor: 'pointer', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: '11px', fontWeight: '600',
          }}>
            <AlertTriangle size={12} /> Contestar
          </button>
        </div>
      ) : null}
    </div>
  )
}

function LinhaClassificacao({ posicao, expandido, onToggle }) {
  const cor = corNivel(posicao.nivel)
  return (
    <div>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
        borderRadius: '10px', border: 'none', backgroundColor: '#1a1a1a', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ width: '26px', textAlign: 'center', fontSize: MEDALHAS[posicao.posicao] ? '16px' : '13px', fontWeight: '700', color: '#888', flexShrink: 0 }}>
          {MEDALHAS[posicao.posicao] || posicao.posicao}
        </span>
        {posicao.alunos?.foto_url ? (
          <img src={posicao.alunos.foto_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#430c3a', color: '#fcc825',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0,
          }}>
            {posicao.alunos?.nome?.split(' ').map(p => p[0]).slice(0, 2).join('')}
          </div>
        )}
        <span style={{ flex: 1, fontSize: '13px', color: '#F0F2F5', fontWeight: '600', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {posicao.alunos?.nome}
        </span>
        <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>{posicao.num_jogos}j</span>
        <span style={{
          fontSize: '9px', padding: '3px 7px', borderRadius: '6px', fontWeight: '700', flexShrink: 0,
          backgroundColor: `${cor}22`, color: cor,
        }}>
          {posicao.nivel}
        </span>
        <span style={{ fontSize: '15px', fontWeight: '800', color: '#fcc825', flexShrink: 0, minWidth: '44px', textAlign: 'right' }}>
          {posicao.pontuacao_beyond}
        </span>
        {expandido ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
      </button>
      {expandido && (
        <div style={{ padding: '8px 12px 8px 48px', fontSize: '11px', color: '#888' }}>
          Média: <strong style={{ color: '#ccc' }}>{posicao.media}</strong> pontos/jogo · Multiplicador de nível:{' '}
          <strong style={{ color: '#ccc' }}>×{posicao.multiplicador ?? NIVEIS_ASSIDUIDADE.find(n => n.chave === posicao.nivel)?.multiplicador}</strong>
        </div>
      )}
    </div>
  )
}

export function RankingPage() {
  const navigate = useNavigate()
  const { data: modalidades } = useModalidades()
  const [modalidadeIdSelecionada, setModalidadeIdSelecionada] = useState('')
  const [tipoRanking, setTipoRanking] = useState('geral')
  const [categoriaId, setCategoriaId] = useState('')
  const [genero, setGenero] = useState('masculino')
  const [expandidoId, setExpandidoId] = useState(null)
  const [criandoJogo, setCriandoJogo] = useState(false)
  const [criandoTorneio, setCriandoTorneio] = useState(false)
  const [jogosAbertosVisivel, setJogosAbertosVisivel] = useState(false)
  const [torneiosVisivel, setTorneiosVisivel] = useState(false)
  const [categorias, setCategorias] = useState([])

  const ciclo = cicloAtual()
  const tenis = modalidades?.find(m => m.nome === 'Tênis')
  // Sem seleção manual ainda, cai no Tênis assim que a lista de modalidades carrega — sem
  // useEffect só pra espelhar isso num state, o valor efetivo já nasce certo no render.
  const modalidadeId = modalidadeIdSelecionada || tenis?.id || ''

  useEffect(() => {
    if (!modalidadeId) return
    supabase.from('ranking_categorias').select('id, nome, ordem').eq('modalidade_id', modalidadeId).order('ordem')
      .then(({ data }) => {
        setCategorias(data || [])
        if (data?.length && !categoriaId) setCategoriaId(data[0].id)
      })
  }, [modalidadeId])

  const { data: posicoes, isLoading } = useClassificacaoRanking({
    modalidadeId, tipoRanking, categoriaId: tipoRanking === 'categoria' ? categoriaId : null, genero, ciclo,
  })
  const { data: jogosAbertos } = useJogosEmAberto({ modalidadeId })
  const { data: torneios } = useTorneios(modalidadeId)

  return (
    <div className="fade-in" style={{ paddingBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={20} color="#fcc825" />
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Ranking</h1>
        </div>
        <button
          onClick={() => navigate('/regras-ranking')}
          title="Regras do Ranking"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#444' }}
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <p style={{ fontSize: '12px', color: '#555', margin: '0 0 16px' }}>Pontuação Beyond · Ciclo {ciclo}</p>

      {modalidades?.length > 1 && (
        <div style={{ marginBottom: '10px' }}>
          <Select value={modalidadeId} onChange={e => { setModalidadeIdSelecionada(e.target.value); setCategoriaId('') }}>
            {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <Pill ativo={tipoRanking === 'geral'} onClick={() => setTipoRanking('geral')}>Geral</Pill>
        <Pill ativo={tipoRanking === 'categoria'} onClick={() => setTipoRanking('categoria')}>Categoria</Pill>
        <div style={{ width: '1px', backgroundColor: '#2a2a2a', margin: '2px 4px' }} />
        <Pill ativo={genero === 'masculino'} onClick={() => setGenero('masculino')}>Masculino</Pill>
        <Pill ativo={genero === 'feminino'} onClick={() => setGenero('feminino')}>Feminino</Pill>
      </div>

      {tipoRanking === 'categoria' && categorias.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {categorias.map(c => (
            <Pill key={c.id} ativo={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>{c.nome}</Pill>
          ))}
        </div>
      )}

      <button
        onClick={() => setCriandoJogo(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%',
          padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '18px',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '13px', fontWeight: '700',
        }}
      >
        <Plus size={15} /> Criar jogo
      </button>

      {isLoading ? <Loading /> : !posicoes?.length ? (
        <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '12px', color: '#555' }}>
          Ninguém classificado ainda nesse recorte — precisa de pelo menos 5 jogos aprovados na janela de 90 dias.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {posicoes.map(p => (
            <LinhaClassificacao
              key={p.id}
              posicao={p}
              expandido={expandidoId === p.id}
              onToggle={() => setExpandidoId(expandidoId === p.id ? null : p.id)}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setJogosAbertosVisivel(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: '12px 14px', borderRadius: '10px', border: '1px solid #2a2a2a', backgroundColor: '#1a1a1a',
          color: '#F0F2F5', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        }}
      >
        <span>Jogos em aberto {jogosAbertos?.length ? `(${jogosAbertos.length})` : ''}</span>
        {jogosAbertosVisivel ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
      </button>
      {jogosAbertosVisivel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {!jogosAbertos?.length ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#555' }}>Nenhum jogo em aberto.</div>
          ) : (
            jogosAbertos.map(jogo => <CardJogoEmAberto key={jogo.id} jogo={jogo} />)
          )}
        </div>
      )}

      <div style={{ marginTop: '10px' }}>
        <button
          onClick={() => setTorneiosVisivel(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            padding: '12px 14px', borderRadius: '10px', border: '1px solid #2a2a2a', backgroundColor: '#1a1a1a',
            color: '#F0F2F5', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={14} color="#fcc825" /> Torneios internos {torneios?.length ? `(${torneios.length})` : ''}
          </span>
          {torneiosVisivel ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
        </button>
        {torneiosVisivel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={() => setCriandoTorneio(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%',
                padding: '10px', borderRadius: '10px', border: '1px solid #2a2a2a', cursor: 'pointer',
                backgroundColor: '#111', color: '#F0F2F5', fontSize: '12px', fontWeight: '600',
              }}
            >
              <Plus size={14} /> Criar torneio
            </button>
            {!torneios?.length ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#555' }}>Nenhum torneio cadastrado ainda.</div>
            ) : (
              torneios.map(t => <CardTorneio key={t.id} torneio={t} />)
            )}
          </div>
        )}
      </div>

      {criandoJogo && (
        <ModalCriarJogo modalidadeId={modalidadeId} onClose={() => setCriandoJogo(false)} />
      )}
      {criandoTorneio && (
        <ModalCriarTorneio modalidadeId={modalidadeId} categorias={categorias} onClose={() => setCriandoTorneio(false)} />
      )}
    </div>
  )
}
