import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronLeft, Check } from 'lucide-react'
import {
  useAlunos, useAlunoCompleto, useDimensoesModalidade, useAvaliacoesModalidade,
  useSalvarAvaliacao, useAtualizarNivelModalidade,
} from '../../hooks/useAlunos'
import { calcularPcScore, nivelPorPcScore } from '../../lib/pcScore'
import { Input, Textarea } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
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

export function AvaliarAluno() {
  const location = useLocation()
  const navigate = useNavigate()
  const { perfil } = useAppStore()
  const professorId = perfil?.professor_id

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
          Avaliar aluno
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
              modalidadeId={modalidadeId}
              modalidadeNome={modalidadeNome}
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
function FormularioAvaliacao({ aluno, alunoId, alunoNome, professorId, modalidadeId, modalidadeNome, onVoltar, onSalvo }) {
  const [nivelAtual, setNivelAtual] = useState(null)
  const [novoNivel, setNovoNivel] = useState('')
  const [valores, setValores] = useState({})
  const [notaManual, setNotaManual] = useState(null)
  const [comentario, setComentario] = useState('')
  const [dataAvaliacao, setDataAvaliacao] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [etapa, setEtapa] = useState('preenchimento') // 'preenchimento' | 'resumo'

  const { data: dimensoes, isLoading: loadingDimensoes } = useDimensoesModalidade(modalidadeId)
  const { data: avaliacoesAnteriores } = useAvaliacoesModalidade(alunoId, modalidadeId)
  const salvarAvaliacao = useSalvarAvaliacao()
  const atualizarNivel = useAtualizarNivelModalidade()

  useEffect(() => {
    supabase.from('aluno_modalidade_nivel').select('nivel').eq('aluno_id', alunoId).eq('modalidade_id', modalidadeId).eq('ativo', true).maybeSingle()
      .then(({ data }) => setNivelAtual(data?.nivel || null))
  }, [alunoId, modalidadeId])

  const notaCalculada = useMemo(() => media(Object.values(valores)), [valores])
  const notaGeral = notaManual != null ? notaManual : notaCalculada
  const salvando = salvarAvaliacao.isPending || atualizarNivel.isPending
  const todasPreenchidas = !!dimensoes?.length && Object.keys(valores).length >= dimensoes.length

  // PC Score ao vivo — só é possível calcular pra Tênis (única modalidade com pesos
  // configurados em pcScore.js por enquanto); pra outras, cai em faixaEtaria null e o
  // resumo mostra "sem PC Score" sem bloquear o salvamento (nota_geral continua valendo
  // normalmente pra elas, como já era antes desta entrega).
  const resultadoPcScore = useMemo(() => {
    if (!todasPreenchidas || !aluno) return null
    return calcularPcScore({
      dimensoes: valores,
      modalidadeNome,
      dataNascimento: aluno.data_nascimento,
      faixaManual: aluno.faixa_etaria_manual,
      dataAvaliacao,
    })
  }, [todasPreenchidas, valores, modalidadeNome, aluno, dataAvaliacao])

  const ehTenis = modalidadeNome === 'Tênis'
  const faltaFaixaEtaria = ehTenis && todasPreenchidas && !resultadoPcScore?.faixaEtaria

  function handleAvancar() {
    if (!todasPreenchidas) {
      return toast.error('Preencha todas as dimensões antes de continuar', { style: toastStyle })
    }
    setEtapa('resumo')
  }

  async function handleConfirmar() {
    try {
      const historicoPcScore = (avaliacoesAnteriores || [])
        .slice(-4)
        .filter(a => a.pc_score != null)
        .map(a => ({ dataAvaliacao: a.data_avaliacao, pcScore: a.pc_score }))

      await salvarAvaliacao.mutateAsync({
        alunoId, modalidadeId, professorId, alunoNome, modalidadeNome,
        dimensoes: valores,
        notaGeral,
        notaGeralManual: notaManual != null,
        comentario,
        dataAvaliacao,
        pcScore: resultadoPcScore?.pcScore ?? null,
        faixaEtaria: resultadoPcScore?.faixaEtaria ?? null,
        historicoPcScore,
      })
      if (novoNivel && novoNivel !== nivelAtual) {
        await atualizarNivel.mutateAsync({ alunoId, modalidadeId, nivel: novoNivel })
      }
      toast.success('✅ Avaliação registrada!', { style: toastStyle })
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
            Confira sua avaliação
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>{alunoNome}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
              {modalidadeNome} · {format(new Date(dataAvaliacao + 'T12:00'), 'dd/MM/yyyy')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {Object.entries(valores).map(([nome, nota]) => (
              <div key={nome} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: '9px', backgroundColor: '#111', border: '1px solid #2a2a2a',
              }}>
                <span style={{ fontSize: '13px', color: '#F0F2F5' }}>{nome}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#fcc825' }}>{nota}/5</span>
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
          disabled={salvando || faltaFaixaEtaria}
          style={{
            width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '14px', fontWeight: '600',
            cursor: (salvando || faltaFaixaEtaria) ? 'not-allowed' : 'pointer',
            opacity: faltaFaixaEtaria ? 0.5 : 1,
          }}
        >
          <Check size={16} /> {salvando ? 'Salvando...' : 'Confirmar avaliação'}
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

      {/* Dimensões técnicas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {dimensoes?.map(d => (
          <div key={d.id}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{d.nome_dimensao}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setValores(v => ({ ...v, [d.nome_dimensao]: n }))} style={{
                  flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '700',
                  background: valores[d.nome_dimensao] === n ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                  color: valores[d.nome_dimensao] === n ? 'white' : '#555',
                  outline: valores[d.nome_dimensao] === n ? 'none' : '1px solid #2a2a2a',
                }}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Nota geral */}
      <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Nota geral</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: '#fcc825' }}>
            {notaGeral != null ? notaGeral.toFixed(1) : '—'}
          </span>
        </div>
        {notaManual == null ? (
          <button onClick={() => setNotaManual(notaCalculada || 3)} style={{
            fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer',
          }}>calculada automaticamente — sobrescrever manualmente</button>
        ) : (
          <div>
            <input
              type="range" min="1" max="5" step="0.5"
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
    </div>
  )
}
