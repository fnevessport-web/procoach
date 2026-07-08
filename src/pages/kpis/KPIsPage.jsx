import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { useRelatorioMensal, buscarRelatorioCompleto } from '../../hooks/useRelatorioMensal'
import { useModalidades } from '../../hooks/useModalidades'
import { EMPRESAS, MODALIDADE_EMPRESA, ICONES_MODALIDADES } from '../../constants/modalidades'
import { Input } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import { exportarRelatorioCompletoPDF, exportarRelatorioCompletoPNG } from '../../lib/relatorioPdf'
import toast from 'react-hot-toast'

const toastStyle = { background: '#1a1a1a', color: '#F0F2F5', border: '1px solid #2a2a2a' }
const COR_UNIDADE = { procopio: '#fcc825', beach_arena: '#cf1b9b' }

export function KPIsPage() {
  // "Mês atual" por padrão vai do dia 1 até hoje (o mês ainda não fechou) — mesma regra do
  // botão "Mês atual" logo abaixo, pra clicar nele nunca parecer que "não fez nada" quando é
  // exatamente o que já vem selecionado ao abrir a tela.
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState([])
  const [modalidadesSelecionadas, setModalidadesSelecionadas] = useState([])
  const [gerando, setGerando] = useState(null)
  const { data: modalidades } = useModalidades()

  const modalidadesDisponiveis = (modalidades || []).filter(m => unidadesSelecionadas.includes(MODALIDADE_EMPRESA[m.nome]))

  // Preview ao vivo dos cards: com 1 unidade marcada, mostra só ela; com 0 ou 2, mostra as duas
  // combinadas (mesma leitura que "Ambas" tinha no dropdown antigo).
  const empresaPreview = unidadesSelecionadas.length === 1 ? unidadesSelecionadas[0] : null
  const { data: rel, isLoading } = useRelatorioMensal({
    periodoInicio, periodoFim, empresa: empresaPreview, modalidades: modalidadesSelecionadas,
  })

  // Mês atual = do dia 1 até hoje (o mês ainda tá em andamento, não faz sentido pedir dado que
  // ainda não aconteceu). Mês passado = ciclo completo, dia 1 até o último dia daquele mês.
  function selecionarMesAtual() {
    setPeriodoInicio(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setPeriodoFim(format(new Date(), 'yyyy-MM-dd'))
  }
  function selecionarMesPassado() {
    const mesPassado = subMonths(new Date(), 1)
    setPeriodoInicio(format(startOfMonth(mesPassado), 'yyyy-MM-dd'))
    setPeriodoFim(format(endOfMonth(mesPassado), 'yyyy-MM-dd'))
  }

  // Pra pintar o botão certo de amarelo: compara o período atual com o que cada
  // botão gera, em vez de guardar um estado à parte (assim continua certo mesmo
  // se a pessoa mexer nos campos De/Até na mão e "cair" exatamente num dos dois).
  const mesPassadoRef = subMonths(new Date(), 1)
  const ehMesAtual = periodoInicio === format(startOfMonth(new Date()), 'yyyy-MM-dd')
    && periodoFim === format(new Date(), 'yyyy-MM-dd')
  const ehMesPassado = periodoInicio === format(startOfMonth(mesPassadoRef), 'yyyy-MM-dd')
    && periodoFim === format(endOfMonth(mesPassadoRef), 'yyyy-MM-dd')

  function toggleUnidade(valor) {
    const proximo = unidadesSelecionadas.includes(valor)
      ? unidadesSelecionadas.filter(v => v !== valor)
      : [...unidadesSelecionadas, valor]
    setUnidadesSelecionadas(proximo)
    // Some a unidade, some junto as modalidades dela que estavam marcadas — evita ficar com
    // filtro de modalidade "órfão" de uma unidade que não tá mais selecionada.
    setModalidadesSelecionadas(prev => prev.filter(nome => proximo.includes(MODALIDADE_EMPRESA[nome])))
  }

  function toggleModalidade(nome) {
    setModalidadesSelecionadas(prev => prev.includes(nome) ? prev.filter(v => v !== nome) : [...prev, nome])
  }

  // Um relatório completo por unidade marcada (capa + resumo + mapa de calor de cada
  // modalidade em escopo + presença por aluno) — se marcar as duas unidades, gera os dois de
  // uma vez, cada um com sua própria capa/logo, em vez de misturar tudo num documento só.
  async function handleGerar(formato) {
    if (unidadesSelecionadas.length === 0) {
      return toast.error('Selecione Procópio, Beach Arena ou as duas', { style: toastStyle })
    }
    setGerando(formato)
    try {
      let totalImagens = 0
      for (const empresaAlvo of unidadesSelecionadas) {
        const modalidadesDaUnidade = modalidadesSelecionadas.filter(m => MODALIDADE_EMPRESA[m] === empresaAlvo)
        const filtroModalidades = modalidadesSelecionadas.length > 0 ? modalidadesDaUnidade : null
        const dados = await buscarRelatorioCompleto({ periodoInicio, periodoFim, empresa: empresaAlvo, modalidades: filtroModalidades })
        if (formato === 'pdf') await exportarRelatorioCompletoPDF(dados, { empresa: empresaAlvo })
        else totalImagens += await exportarRelatorioCompletoPNG(dados, { empresa: empresaAlvo })
      }
      if (formato === 'pdf') {
        toast.success(unidadesSelecionadas.length > 1 ? 'PDFs gerados!' : 'PDF gerado!', { style: toastStyle })
      } else {
        toast.success(totalImagens > 1 ? `${totalImagens} imagens geradas — baixadas num .zip!` : 'Imagem gerada!', { style: toastStyle })
      }
    } catch (err) {
      toast.error('Erro ao gerar relatório: ' + err.message, { style: toastStyle })
    } finally {
      setGerando(null)
    }
  }

  const mesInicio = periodoInicio.slice(0, 7)
  const mesFim = periodoFim.slice(0, 7)
  const periodoSuspeito = mesInicio !== mesFim

  return (
    <div className="fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          Relatório Mensal
        </h1>
      </div>

      {/* 1. Unidade — sempre o primeiro passo. Pode marcar as duas. */}
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unidade</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {EMPRESAS.map(e => {
          const ativo = unidadesSelecionadas.includes(e.valor)
          const cor = COR_UNIDADE[e.valor]
          return (
            <button key={e.valor} onClick={() => toggleUnidade(e.valor)} style={{
              flex: 1, padding: '18px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              background: ativo ? cor : '#1a1a1a',
              outline: ativo ? 'none' : '1px solid #2a2a2a',
              color: ativo ? (e.valor === 'procopio' ? '#110f0f' : 'white') : '#888',
              fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {e.label}
            </button>
          )
        })}
      </div>

      {/* 2. Modalidade — só aparece depois de escolher unidade; nenhuma marcada = todas. */}
      {unidadesSelecionadas.length > 0 && (
        <>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Modalidade <span style={{ textTransform: 'none', color: '#444' }}>(nenhuma marcada = todas)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {modalidadesDisponiveis.map(m => {
              const ativo = modalidadesSelecionadas.includes(m.nome)
              const cor = COR_UNIDADE[MODALIDADE_EMPRESA[m.nome]]
              const icone = ICONES_MODALIDADES[m.nome]
              return (
                <button key={m.id} onClick={() => toggleModalidade(m.nome)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: ativo ? cor : '#1a1a1a',
                  outline: ativo ? 'none' : '1px solid #2a2a2a',
                }}>
                  {icone && (
                    <img src={icone} alt="" style={{
                      width: '22px', height: '22px', objectFit: 'contain',
                      filter: ativo ? 'invert(1)' : 'none', opacity: ativo ? 1 : 0.6,
                    }} />
                  )}
                  <span style={{
                    fontSize: '10px', fontWeight: '600', textAlign: 'center', lineHeight: 1.2,
                    color: ativo ? (MODALIDADE_EMPRESA[m.nome] === 'procopio' ? '#110f0f' : 'white') : '#888',
                  }}>
                    {m.nome}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 3. Data */}
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Período</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={selecionarMesAtual} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
            outline: ehMesAtual ? 'none' : '1px solid #2a2a2a',
            background: ehMesAtual ? '#fcc825' : '#1a1a1a',
            color: ehMesAtual ? '#110f0f' : '#888',
            fontSize: '12px', fontWeight: ehMesAtual ? '700' : '400', cursor: 'pointer',
          }}>Mês atual</button>
          <button onClick={selecionarMesPassado} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
            outline: ehMesPassado ? 'none' : '1px solid #2a2a2a',
            background: ehMesPassado ? '#fcc825' : '#1a1a1a',
            color: ehMesPassado ? '#110f0f' : '#888',
            fontSize: '12px', fontWeight: ehMesPassado ? '700' : '400', cursor: 'pointer',
          }}>Mês passado</button>
        </div>
        <Input type="date" label="De" value={periodoInicio} onChange={e => e.target.value && setPeriodoInicio(e.target.value)} />
        <Input type="date" label="Até" value={periodoFim} onChange={e => e.target.value && setPeriodoFim(e.target.value)} />
      </div>

      {/* Confirmação visível do período que será usado — pega o caso de alguém digitar uma
          data inválida (ex: 31/06) no input nativo: o navegador rejeita em silêncio e mantém
          o valor antigo, sem avisar visualmente. */}
      <div style={{
        padding: '10px 14px', borderRadius: '10px', marginBottom: '20px',
        backgroundColor: periodoSuspeito ? 'rgba(239,68,68,0.08)' : '#1a1a1a',
        border: periodoSuspeito ? '1px solid rgba(239,68,68,0.35)' : '1px solid #2a2a2a',
        fontSize: '12px', color: periodoSuspeito ? '#EF4444' : '#888',
      }}>
        Período selecionado: <strong>{format(new Date(periodoInicio + 'T12:00'), 'dd/MM/yyyy')} a {format(new Date(periodoFim + 'T12:00'), 'dd/MM/yyyy')}</strong>
        {periodoSuspeito && ' — atenção: as datas caem em meses diferentes, confira se é isso mesmo antes de gerar.'}
      </div>

      {/* 4. Gerar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        <button onClick={() => handleGerar('pdf')} disabled={!!gerando} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px',
          borderRadius: '12px', border: 'none', cursor: unidadesSelecionadas.length === 0 ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '14px', fontWeight: '700',
          opacity: gerando && gerando !== 'pdf' ? 0.5 : 1,
        }}>
          <Download size={16} /> {gerando === 'pdf' ? 'Gerando PDF...' : 'Gerar Relatório em PDF'}
        </button>
        <button onClick={() => handleGerar('png')} disabled={!!gerando} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px',
          borderRadius: '12px', border: '1px solid #2a2a2a', cursor: unidadesSelecionadas.length === 0 ? 'not-allowed' : 'pointer',
          background: '#1a1a1a', color: '#F0F2F5', fontSize: '14px', fontWeight: '700',
          opacity: gerando && gerando !== 'png' ? 0.5 : 1,
        }}>
          <Download size={16} /> {gerando === 'png' ? 'Gerando PNG...' : 'Gerar Relatório em PNG (via ZIP)'}
        </button>
      </div>

      {isLoading ? <Loading /> : rel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>

          <SectionTitle>Resumo executivo</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KpiCard emoji="📅" label="Aulas Programadas" value={rel.aulasProgramadas} dot="#fcc825" />
            <KpiCard emoji="✅" label="Aulas Dadas" value={rel.aulasDadas} dot="#22c55e" />
            <KpiCard emoji="🌧️" label="Canceladas" value={rel.aulasCanceladas} dot="#3b82f6" />
            <KpiCard emoji="🈳" label="Sem Aluno" value={rel.aulasSemAluno} dot="#888" />
            <KpiCard emoji="📈" label="Taxa Realização" value={`${rel.taxaRealizacao}%`} dot="#cf1b9b" />
            <KpiCard emoji="🎉" label="Aulas em Feriado" value={rel.aulasEmFeriado} dot="#a855f7" />
          </div>

          <SectionTitle>Participação dos associados</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KpiCard emoji="🙋" label="Alunos Únicos" value={rel.alunosUnicos} dot="#fcc825" />
            <KpiCard emoji="👍" label="Presenças" value={rel.presentes} dot="#22c55e" />
            <KpiCard emoji="👎" label="Faltas" value={rel.faltas} dot="#EF4444" />
            <KpiCard emoji="📄" label="Falta Justificada" value={rel.faltasJustificadas} dot="#d28c3c" />
          </div>
          <div style={{
            padding: '16px', borderRadius: '16px', backgroundColor: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', color: '#F0F2F5' }}>Taxa de presença</span>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#cf1b9b' }}>{rel.taxaPresenca}%</span>
          </div>

          {/* Cancelamentos por motivo */}
          {Object.keys(rel.motivosCancelamento).length > 0 && (
            <Bloco titulo="🌧️ Cancelamentos por motivo">
              <BarrasProporcao
                itens={Object.entries(rel.motivosCancelamento).map(([nome, total]) => ({ nome, total }))}
                total={rel.aulasCanceladas}
              />
            </Bloco>
          )}

          {/* Perfil de uso */}
          {Object.keys(rel.porTipoParticipacao).length > 0 && (
            <Bloco titulo="👥 Perfil de uso">
              <BarrasProporcao
                itens={Object.entries(rel.porTipoParticipacao).map(([nome, total]) => ({ nome: rotuloTipo(nome), total }))}
                total={Object.values(rel.porTipoParticipacao).reduce((a, b) => a + b, 0)}
              />
            </Bloco>
          )}

          {/* Por modalidade */}
          {rel.porModalidade.length > 0 && (
            <Bloco titulo="📊 Uso por modalidade">
              <BarrasProporcao
                itens={rel.porModalidade.map(m => ({ nome: m.nome, total: m.aulas }))}
                total={rel.aulasProgramadas}
              />
            </Bloco>
          )}

          {/* Por unidade */}
          {rel.porEmpresa.length > 1 && (
            <Bloco titulo="🏟️ Uso por unidade">
              <BarrasProporcao
                itens={rel.porEmpresa.map(e => ({ nome: rotuloEmpresa(e.empresa), total: e.aulas }))}
                total={rel.aulasProgramadas}
              />
            </Bloco>
          )}

          {/* Comparação com mês anterior */}
          <SectionTitle>Comparação com o mês anterior</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ComparativoLinha label="Aulas dadas" atual={rel.aulasDadas} anterior={rel.comparativo.aulasDadasAnterior} variacao={rel.comparativo.variacaoAulasDadas} />
            <ComparativoLinha label="Taxa de presença" atual={`${rel.taxaPresenca}%`} anterior={`${rel.comparativo.taxaPresencaAnterior}%`} variacao={rel.comparativo.variacaoTaxaPresenca} />
            <ComparativoLinha label="Alunos únicos" atual={rel.alunosUnicos} anterior={rel.comparativo.alunosUnicosAnterior} variacao={rel.comparativo.variacaoAlunosUnicos} />
          </div>

          {/* Ranking de professores */}
          {rel.rankingProfessores.length > 0 && (
            <Bloco titulo="🏆 Aulas por professor">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rel.rankingProfessores.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#F0F2F5' }}>{p.nome}</span>
                    <span style={{ color: '#888' }}>{p.total} aulas</span>
                  </div>
                ))}
              </div>
            </Bloco>
          )}
        </div>
      ) : null}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px' }}>
      {children}
    </div>
  )
}

function Bloco({ titulo, children }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '16px',
      backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
      width: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0F2F5', marginBottom: '12px' }}>{titulo}</div>
      {children}
    </div>
  )
}

function BarrasProporcao({ itens, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {itens.sort((a, b) => b.total - a.total).map(item => (
        <div key={item.nome}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: '#F0F2F5' }}>{item.nome}</span>
            <span style={{ fontSize: '11px', color: '#555' }}>{item.total}{total > 0 ? ` (${Math.round((item.total / total) * 100)}%)` : ''}</span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#222' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${total > 0 ? (item.total / total) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #fcc825, #cf1b9b)',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ComparativoLinha({ label, atual, anterior, variacao }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: '14px', backgroundColor: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: '12px', color: '#555' }}>{label}</div>
        <div style={{ fontSize: '13px', color: '#F0F2F5', marginTop: '4px' }}>{atual} vs {anterior} anterior</div>
      </div>
      {variacao !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: '700',
          color: variacao >= 0 ? '#22c55e' : '#EF4444',
        }}>
          {variacao >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {variacao > 0 ? '+' : ''}{variacao}%
        </div>
      )}
    </div>
  )
}

function rotuloTipo(tipo) {
  const rotulos = { mensalista: 'Mensalista', reposicao: 'Reposição', avulso: 'Avulso', cortesia: 'Cortesia' }
  return rotulos[tipo] || tipo
}

function rotuloEmpresa(empresa) {
  return empresa === 'procopio' ? 'Procópio' : empresa === 'beach_arena' ? 'Beach Arena' : 'Outro'
}

function KpiCard({ emoji, label, value, dot }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '16px',
      backgroundColor: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '22px', lineHeight: 1 }}>{emoji}</span>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }} />
      </div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: '#F0F2F5' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#555' }}>{label}</div>
    </div>
  )
}
