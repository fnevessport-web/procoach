import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronLeft, Check, Info } from 'lucide-react'
import {
  useAlunos, useAlunoCompleto, useDimensoesModalidade, useAvaliacoesModalidade,
  useSalvarAvaliacao, useEditarAvaliacao, useAtualizarNivelModalidade,
} from '../../hooks/useAlunos'
import { useProfessores } from '../../hooks/useProfessores'
import { calcularPcScore, calcularMediasDominios, nivelPorPcScore } from '../../lib/pcScore'
import { DESCRICOES_SUBITENS_TENIS, FAIXAS_REFERENCIA_1_10 } from '../../constants/avaliacaoTecnicaTenis'
import { Input, Textarea } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { SeletorFaixaEtariaManual } from '../../components/SeletorFaixaEtariaManual'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import toast from 'react-hot-toast'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const NIVEIS_ALUNO = [
  'Iniciante 1', 'Iniciante 2',
  'Intermediário 1', 'Intermediário 2',
  'Avançado',
  'Kids Iniciante', 'Kids Intermediário', 'Kids Avançado',
]

function media(valores) {
  if (!valores.length) return null
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
}

function formataNota(n) {
  return n.toFixed(1).replace('.', ',')
}

export function AvaliarAluno() {
  const location = useLocation()
  const navigate = useNavigate()
  const { perfil } = useAppStore()
  // Login de professor já traz o vínculo pronto em perfis_usuario.professor_id — nesse caso
  // a avaliação é sempre dele mesmo, sem escolha. Gestor/coordenador/financeiro/auxiliar não
  // têm esse vínculo (não são "um professor"), então precisam escolher em nome de quem estão
  // lançando a avaliação — sem isso, professor_id chegava nulo no insert e o Postgres rejeitava
  // (NOT NULL constraint), travando a tela pra quem não fosse professor logado.
  const professorIdProprio = perfil?.professor_id
  const [professorSelecionadoId, setProfessorSelecionadoId] = useState('')
  const { professores: todosProfessores } = useProfessores()
  const professorId = professorIdProprio || professorSelecionadoId || null
  const professorNome = professorIdProprio
    ? perfil?.nome
    : todosProfessores.find(p => p.id === professorSelecionadoId)?.nome

  // Edição de avaliação já lançada (capacidade exclusiva de gestor — ver EvolucaoTecnicaTenis.jsx
  // "Histórico completo") chega via location.state com a linha inteira da avaliação, evitando
  // um fetch novo já que quem navegou pra cá já tinha ela carregada.
  const avaliacaoParaEditar = location.state?.avaliacaoParaEditar || null

  const [alunoId, setAlunoId] = useState(location.state?.alunoId || null)
  const [alunoNome, setAlunoNome] = useState(location.state?.alunoNome || '')
  const [modalidadeId, setModalidadeId] = useState(location.state?.modalidadeId || null)
  const [busca, setBusca] = useState('')
  const [modalidadesAluno, setModalidadesAluno] = useState([])

  const { data: todosAlunos } = useAlunos()
  // Dados completos do aluno (data_nascimento, faixa_etaria_manual) — precisa ser a query
  // "viva" do react-query, não um snapshot, pra reagir sozinha quando a faixa manual for
  // definida inline dentro do formulário (useAtualizarFaixaEtariaManual invalida essa mesma
  // chave, então esse hook refaz o fetch e o componente re-renderiza com o valor novo).
  const { data: aluno } = useAlunoCompleto(alunoId)

  useEffect(() => {
    if (!alunoId) return
    supabase.from('alunos_modalidades').select('modalidade_id, modalidades(id, nome, cor_hex)').eq('aluno_id', alunoId)
      .then(({ data }) => setModalidadesAluno((data || []).map(m => m.modalidades).filter(Boolean)))
  }, [alunoId])

  const alunosFiltrados = busca.length >= 2
    ? (todosAlunos || []).filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
    : []

  function selecionarAluno(a) {
    setAlunoId(a.id)
    setAlunoNome(a.nome)
    setModalidadeId(null)
    setBusca('')
  }

  const modalidadeNome = modalidadesAluno.find(m => m.id === modalidadeId)?.nome || ''

  return (
    <div className="fade-in" style={{ minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 22px' }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: '#fcc825', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          {avaliacaoParaEditar ? 'Editar avaliação' : 'Avaliar aluno'}
        </h1>
      </div>

      {!alunoId ? (
        <div>
          <input
            autoFocus
            placeholder="Buscar aluno..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '10px', border: 'none',
              outline: '1px solid #2a2a2a', backgroundColor: '#1a1a1a',
              color: '#F0F2F5', fontSize: '14px', boxSizing: 'border-box', marginBottom: '10px',
            }}
          />
          {alunosFiltrados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alunosFiltrados.map(a => (
                <button key={a.id} onClick={() => selecionarAluno(a)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderRadius: '10px', border: 'none', backgroundColor: '#1a1a1a',
                  color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                }}>
                  {a.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(252,200,37,0.08)',
            border: '1px solid rgba(252,200,37,0.25)', marginBottom: '16px',
          }}>
            <span style={{ fontSize: '14px', color: '#F0F2F5', fontWeight: '600' }}>{alunoNome}</span>
            <button onClick={() => { setAlunoId(null); setAlunoNome(''); setModalidadeId(null) }} style={{
              background: 'none', border: 'none', color: '#fcc825', fontSize: '12px', cursor: 'pointer',
            }}>trocar aluno</button>
          </div>

          {!professorIdProprio && !avaliacaoParaEditar && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                Avaliação em nome de qual professor?
              </div>
              <select
                value={professorSelecionadoId}
                onChange={e => setProfessorSelecionadoId(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px', border: 'none',
                  outline: '1px solid #2a2a2a', backgroundColor: '#1a1a1a',
                  color: '#F0F2F5', fontSize: '13px', boxSizing: 'border-box',
                }}
              >
                <option value="">Selecione o professor...</option>
                {todosProfessores.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          )}

          {!modalidadeId ? (
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Modalidade</div>
              {modalidadesAluno.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#444' }}>Esse aluno não está matriculado em nenhuma modalidade</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {modalidadesAluno.map(m => (
                    <button key={m.id} onClick={() => setModalidadeId(m.id)} style={{
                      padding: '12px 14px', borderRadius: '10px', border: 'none', textAlign: 'left', cursor: 'pointer',
                      backgroundColor: '#1a1a1a', color: '#F0F2F5', fontSize: '13px', fontWeight: '600',
                    }}>
                      {m.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <FormularioAvaliacao
              key={modalidadeId}
              aluno={aluno}
              alunoId={alunoId}
              alunoNome={alunoNome}
              professorId={professorId}
              professorNome={professorNome}
              modalidadeId={modalidadeId}
              modalidadeNome={modalidadeNome}
              avaliacaoParaEditar={avaliacaoParaEditar}
              onVoltar={() => setModalidadeId(null)}
              onSalvo={() => navigate(-1)}
            />
          )}
        </>
      )}
    </div>
  )
}

// Componente separado e keyed por modalidadeId — trocar de modalidade remonta com estado
// limpo de propósito (sem precisar de um efeito resetando manualmente cada campo).
function FormularioAvaliacao({ aluno, alunoId, alunoNome, professorId, professorNome, modalidadeId, modalidadeNome, avaliacaoParaEditar, onVoltar, onSalvo }) {
  const [nivelAtual, setNivelAtual] = useState(null)
  const [novoNivel, setNovoNivel] = useState('')
  const [valores, setValores] = useState(() => avaliacaoParaEditar?.dimensoes || {})
  const [notaManual, setNotaManual] = useState(() => avaliacaoParaEditar?.nota_geral_manual ? avaliacaoParaEditar.nota_geral : null)
  const [comentario, setComentario] = useState(avaliacaoParaEditar?.comentario || '')
  const [dataAvaliacao, setDataAvaliacao] = useState(avaliacaoParaEditar?.data_avaliacao || format(new Date(), 'yyyy-MM-dd'))
  const [etapa, setEtapa] = useState('preenchimento') // 'preenchimento' | 'resumo'
  const [subitemAberto, setSubitemAberto] = useState(null) // definição do subitem com a ajuda aberta, ou null

  const { data: dimensoes, isLoading: loadingDimensoes } = useDimensoesModalidade(modalidadeId)
  const { data: avaliacoesAnteriores } = useAvaliacoesModalidade(alunoId, modalidadeId)
  const salvarAvaliacao = useSalvarAvaliacao()
  const editarAvaliacao = useEditarAvaliacao()
  const atualizarNivel = useAtualizarNivelModalidade()

  useEffect(() => {
    supabase.from('aluno_modalidade_nivel').select('nivel').eq('aluno_id', alunoId).eq('modalidade_id', modalidadeId).eq('ativo', true).maybeSingle()
      .then(({ data }) => setNivelAtual(data?.nivel || null))
  }, [alunoId, modalidadeId])

  // Domínios têm subitens agrupados (ex.: Tênis — Saque, Jogo de Fundo...); sem domínio é o
  // modelo antigo, cada dimensão solta (Padel, Beach Tennis...) — os dois convivem no mesmo
  // formulário, só muda como agrupa visualmente.
  const gruposDominio = useMemo(() => {
    const grupos = {}
    const soltas = []
    ;(dimensoes || []).forEach(d => {
      if (d.dominio) {
        if (!grupos[d.dominio]) grupos[d.dominio] = []
        grupos[d.dominio].push(d)
      } else {
        soltas.push(d)
      }
    })
    return { grupos: Object.entries(grupos), soltas }
  }, [dimensoes])

  // Escala do formulário: 10 pro Tênis (novo modelo), 5 pras demais (modelo antigo) — lida
  // direto de escala_max em vez de checar o nome da modalidade, então uma modalidade nova
  // com escala diferente já funciona sem mexer nessa tela.
  const escalaMax = useMemo(() => Math.max(5, ...(dimensoes || []).map(d => d.escala_max || 5)), [dimensoes])

  // Médias ao vivo — reaproveita a mesma função usada no cálculo do PC Score (calcularPcScore
  // usa exatamente essa lista de "unidades" por baixo), então o número que o professor vê
  // enquanto preenche é sempre o mesmo que vai valer no resumo e no PC Score final.
  const unidades = useMemo(() => calcularMediasDominios(valores, dimensoes), [valores, dimensoes])
  const notaCalculada = useMemo(() => media(unidades.map(u => u.media)), [unidades])
  const notaGeral = notaManual != null ? notaManual : notaCalculada
  const salvando = salvarAvaliacao.isPending || editarAvaliacao.isPending || atualizarNivel.isPending
  const todasPreenchidas = !!dimensoes?.length && Object.keys(valores).length >= dimensoes.length

  // PC Score ao vivo — só calcula depois de todas as notas preenchidas (senão a média fica
  // artificialmente alta/baixa pelo que falta). Pra modalidades sem pesos configurados em
  // PESOS_POR_MODALIDADE (todas exceto Tênis, por enquanto) cai no padrão peso 1.0, então o
  // cálculo funciona igual — só não é exibido pra elas (ver `ehTenis` abaixo).
  const resultadoPcScore = useMemo(() => {
    if (!todasPreenchidas || !aluno) return null
    return calcularPcScore({
      dimensoes: valores,
      definicoesDimensoes: dimensoes,
      modalidadeNome,
      dataNascimento: aluno.data_nascimento,
      faixaManual: aluno.faixa_etaria_manual,
      dataAvaliacao,
    })
  }, [todasPreenchidas, valores, dimensoes, modalidadeNome, aluno, dataAvaliacao])

  const ehTenis = modalidadeNome === 'Tênis'
  const faltaFaixaEtaria = ehTenis && todasPreenchidas && !resultadoPcScore?.faixaEtaria

  function handleAvancar() {
    if (!todasPreenchidas) {
      return toast.error('Preencha todas as dimensões antes de continuar', { style: toastStyle })
    }
    setEtapa('resumo')
  }

  async function handleConfirmar() {
    if (!avaliacaoParaEditar && !professorId) {
      return toast.error('Selecione o professor responsável pela avaliação antes de confirmar.', { style: toastStyle })
    }
    try {
      let mensagemSucesso = '✅ Avaliação atualizada!'
      if (avaliacaoParaEditar) {
        await editarAvaliacao.mutateAsync({
          avaliacaoId: avaliacaoParaEditar.id, alunoId, modalidadeId,
          dimensoes: valores,
          notaGeral,
          notaGeralManual: notaManual != null,
          comentario,
          dataAvaliacao,
          pcScore: resultadoPcScore?.pcScore ?? null,
          faixaEtaria: resultadoPcScore?.faixaEtaria ?? null,
        })
      } else {
        const historicoPcScore = (avaliacoesAnteriores || [])
          .slice(-4)
          .filter(a => a.pc_score != null)
          .map(a => ({ dataAvaliacao: a.data_avaliacao, pcScore: a.pc_score }))

        const avaliacaoSalva = await salvarAvaliacao.mutateAsync({
          alunoId, modalidadeId, professorId, professorNome, alunoNome, modalidadeNome,
          dimensoes: valores,
          notaGeral,
          notaGeralManual: notaManual != null,
          comentario,
          dataAvaliacao,
          pcScore: resultadoPcScore?.pcScore ?? null,
          faixaEtaria: resultadoPcScore?.faixaEtaria ?? null,
          historicoPcScore,
        })
        mensagemSucesso = avaliacaoSalva?.status === 'pendente'
          ? '✅ Avaliação registrada — aguardando confirmação do(s) outro(s) professor(es).'
          : '✅ Avaliação registrada!'
      }
      if (novoNivel && novoNivel !== nivelAtual) {
        await atualizarNivel.mutateAsync({ alunoId, modalidadeId, nivel: novoNivel })
      }
      toast.success(mensagemSucesso, { style: toastStyle })
      onSalvo()
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  if (loadingDimensoes) return <Loading />

  if (etapa === 'resumo') {
    const nivelPcScore = resultadoPcScore?.pcScore != null ? nivelPorPcScore(resultadoPcScore.pcScore) : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <button onClick={() => setEtapa('preenchimento')} style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer',
        }}>← Voltar e editar</button>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            {avaliacaoParaEditar ? 'Confira a edição' : 'Confira sua avaliação'}
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>{alunoNome}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
              {modalidadeNome} · {format(new Date(dataAvaliacao + 'T12:00'), 'dd/MM/yyyy')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
            {unidades.map(u => (
              <div key={u.nome} style={{ borderRadius: '9px', backgroundColor: '#111', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', backgroundColor: u.subitens.length > 1 ? 'rgba(252,200,37,0.06)' : 'transparent',
                }}>
                  <span style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: u.subitens.length > 1 ? '700' : '400' }}>{u.nome}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825' }}>{formataNota(u.media)}{u.subitens.length === 1 ? `/${u.subitens[0].escalaMax}` : ''}</span>
                </div>
                {u.subitens.length > 1 && (
                  <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {u.subitens.map(s => (
                      <div key={s.chave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>{s.nome}</span>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>{s.nota}/{s.escalaMax}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {ehTenis && (
            <div style={{
              padding: '14px', borderRadius: '12px', marginBottom: '10px',
              backgroundColor: nivelPcScore ? `${nivelPcScore.cor}12` : 'rgba(249,115,22,0.08)',
              border: `1px solid ${nivelPcScore ? nivelPcScore.cor + '33' : 'rgba(249,115,22,0.25)'}`,
            }}>
              {resultadoPcScore?.pcScore != null ? (
                <>
                  <div style={{ fontSize: '10px', color: nivelPcScore.cor, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>
                    PC Score calculado
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '26px', fontWeight: '800', color: nivelPcScore.cor }}>{resultadoPcScore.pcScore}</span>
                    <span style={{ fontSize: '12px', color: nivelPcScore.cor, fontWeight: '600' }}>{nivelPcScore.label}</span>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: '12px', color: '#f97316', marginBottom: '10px' }}>
                    Falta a faixa etária do aluno pra calcular o PC Score — escolha uma pra continuar:
                  </div>
                  <SeletorFaixaEtariaManual alunoId={alunoId} valorAtual={aluno?.faixa_etaria_manual} compacto />
                </div>
              )}
            </div>
          )}

          {comentario && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#111', fontSize: '12px', color: '#888', fontStyle: 'italic', marginBottom: '10px' }}>
              "{comentario}"
            </div>
          )}
        </div>

        <button
          onClick={handleConfirmar}
          disabled={salvando || faltaFaixaEtaria || !professorId}
          style={{
            width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '14px', fontWeight: '600',
            cursor: (salvando || faltaFaixaEtaria || !professorId) ? 'not-allowed' : 'pointer',
            opacity: (faltaFaixaEtaria || !professorId) ? 0.5 : 1,
          }}
        >
          <Check size={16} /> {salvando ? 'Salvando...' : avaliacaoParaEditar ? 'Salvar edição' : 'Confirmar avaliação'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button onClick={onVoltar} style={{
        alignSelf: 'flex-start', background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer',
      }}>← trocar modalidade</button>

      {/* Data da avaliação */}
      <Input
        type="date" label="Data da avaliação"
        value={dataAvaliacao} onChange={e => e.target.value && setDataAvaliacao(e.target.value)}
      />

      {/* Dimensões técnicas — agrupadas por domínio quando existe (Tênis), lista solta senão */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {gruposDominio.grupos.map(([nomeDominio, subitens]) => {
          const mediaDominio = unidades.find(u => u.nome === nomeDominio && u.subitens.length > 1)
          return (
            <div key={nomeDominio}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#fcc825', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {nomeDominio}
                </div>
                {mediaDominio && (
                  <div style={{ fontSize: '11px', color: '#888' }}>média {formataNota(mediaDominio.media)}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {subitens.map(d => (
                  <CampoSubitem key={d.id} d={d} valor={valores[d.chave]}
                    onEscolher={n => setValores(v => ({ ...v, [d.chave]: n }))}
                    onAbrirAjuda={() => setSubitemAberto(d)} />
                ))}
              </div>
            </div>
          )
        })}

        {gruposDominio.soltas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {gruposDominio.soltas.map(d => (
              <CampoSubitem key={d.id} d={d} valor={valores[d.chave]}
                onEscolher={n => setValores(v => ({ ...v, [d.chave]: n }))}
                onAbrirAjuda={() => setSubitemAberto(d)} />
            ))}
          </div>
        )}
      </div>

      {/* Nota geral */}
      <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Nota geral</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: '#fcc825' }}>
            {notaGeral != null ? formataNota(notaGeral) : '—'}
          </span>
        </div>
        {notaManual == null ? (
          <button onClick={() => setNotaManual(notaCalculada || escalaMax / 2)} style={{
            fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer',
          }}>calculada automaticamente — sobrescrever manualmente</button>
        ) : (
          <div>
            <input
              type="range" min="1" max={escalaMax} step="0.5"
              value={notaManual}
              onChange={e => setNotaManual(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <button onClick={() => setNotaManual(null)} style={{
              fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer',
            }}>voltar pro cálculo automático</button>
          </div>
        )}
      </div>

      {/* Comentário */}
      <Textarea
        label="Comentário (opcional)"
        placeholder="Ex: Melissa evoluiu muito o voleio, mas ainda trava no saque com efeito"
        value={comentario}
        onChange={e => setComentario(e.target.value)}
      />

      {/* Nível */}
      <div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
          Nível atual: {nivelAtual || 'não definido'} — atualizar? (opcional)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {NIVEIS_ALUNO.map(n => (
            <button key={n} onClick={() => setNovoNivel(novoNivel === n ? '' : n)} style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: novoNivel === n ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
              outline: novoNivel === n ? 'none' : '1px solid #2a2a2a',
              color: novoNivel === n ? 'white' : '#888',
              fontSize: '12px', cursor: 'pointer', fontWeight: novoNivel === n ? '600' : '400',
            }}>{n}</button>
          ))}
        </div>
      </div>

      <button onClick={handleAvancar} style={{
        width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
        background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
        color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
      }}>
        Continuar — revisar antes de salvar
      </button>

      <Modal open={!!subitemAberto} onClose={() => setSubitemAberto(null)} title={subitemAberto?.nome_dimensao} size="sm">
        {subitemAberto && <AjudaSubitem d={subitemAberto} />}
      </Modal>
    </div>
  )
}

// Um subitem/dimensão: título + ícone de ajuda (só aparece se houver texto de apoio pra essa
// chave — hoje só os 19 subitens do Tênis têm, ver DESCRICOES_SUBITENS_TENIS) + botões de
// nota de 1 até a escala daquele subitem (10 no modelo novo, 5 no antigo).
function CampoSubitem({ d, valor, onEscolher, onAbrirAjuda }) {
  const escala = d.escala_max || 5
  const temAjuda = !!DESCRICOES_SUBITENS_TENIS[d.chave]
  // Escala 1-10 (Tênis) quebra em 2 linhas de 5 — 10 botões numa linha só fica pequeno
  // demais pra tocar no celular. Escala 1-5 (modelo antigo) continua numa linha só, como
  // sempre foi.
  const linhas = escala > 5
    ? [Array.from({ length: 5 }, (_, i) => i + 1), Array.from({ length: escala - 5 }, (_, i) => i + 6)]
    : [Array.from({ length: escala }, (_, i) => i + 1)]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#888' }}>{d.nome_dimensao}</span>
        {temAjuda && (
          <button onClick={onAbrirAjuda} title="O que estamos avaliando aqui?" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#555',
            padding: '2px', display: 'flex', alignItems: 'center',
          }}>
            <Info size={13} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {linhas.map((linha, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px' }}>
            {linha.map(n => (
              <button key={n} onClick={() => onEscolher(n)} style={{
                flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: '700',
                background: valor === n ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                color: valor === n ? 'white' : '#555',
                outline: valor === n ? 'none' : '1px solid #2a2a2a',
              }}>{n}</button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Conteúdo do modal de ajuda: frase do que está sendo avaliado + as 4 faixas de referência
// (mesma régua 1-10 pra qualquer subitem).
function AjudaSubitem({ d }) {
  const descricao = DESCRICOES_SUBITENS_TENIS[d.chave]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {d.dominio && (
        <div style={{ fontSize: '10px', color: '#fcc825', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
          {d.dominio}
        </div>
      )}
      {descricao && (
        <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', margin: 0 }}>{descricao}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {FAIXAS_REFERENCIA_1_10.map(f => (
          <div key={f.chave} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#111', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fcc825' }}>{f.faixa}</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#F0F2F5' }}>{f.label}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>{f.descricao}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
