import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  TrendingUp, TrendingDown, Download, Search, CalendarDays, CheckCircle2, CloudRain,
  Ban, LineChart, PartyPopper, Users, ThumbsUp, ThumbsDown, FileText, BrainCircuit,
  BarChart3, LandPlot, Trophy,
} from 'lucide-react'
import { useRelatorioMensal, useListaAlunosAtivos, buscarRelatorioCompleto, buscarListaAlunosAtivos, gerarInsights } from '../../hooks/useRelatorioMensal'
import { useModalidades } from '../../hooks/useModalidades'
import { EMPRESAS, MODALIDADE_EMPRESA, ICONES_MODALIDADES } from '../../constants/modalidades'
import { classificarPct, CORES_SEMAFORO, LABEL_SEMAFORO } from '../../constants/semaforo'
import { Input } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import { exportarRelatorioCompletoPDF, exportarRelatorioCompletoPNG, exportarListaAlunosPDF } from '../../lib/relatorioPdf'
import toast from 'react-hot-toast'

// Tela de análise (Relatório Mensal) — contexto Escuro, tokens --color-*-dark-* diretos, igual
// Home/Ranking/Financeiro. O PDF/PNG gerado por relatorioPdf.js continua com a identidade
// Beyond/Procópio de sempre (intocado) — só esta TELA entrou no redesign.
const toastStyle = { background: 'var(--color-surface-dark-raised)', color: 'var(--color-text-dark-primary)', border: '1px solid var(--color-border-dark)' }
const COR_UNIDADE = { procopio: 'var(--color-action-primary)', beach_arena: 'var(--color-state-info)' }
const inputBuscaStyle = {
  width: '100%', padding: '10px 14px 10px 36px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-dark-overlay)', border: '1px solid var(--color-border-dark)',
  color: 'var(--color-text-dark-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

export function KPIsPage() {
  // "Mês atual" por padrão vai do dia 1 até hoje (o mês ainda não fechou) — mesma regra do
  // botão "Mês atual" logo abaixo, pra clicar nele nunca parecer que "não fez nada" quando é
  // exatamente o que já vem selecionado ao abrir a tela.
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState([])
  const [modalidadesSelecionadas, setModalidadesSelecionadas] = useState([])
  const [gerando, setGerando] = useState(null)
  const [aba, setAba] = useState('completo')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [gerandoLista, setGerandoLista] = useState(false)
  const { data: modalidades } = useModalidades()

  const modalidadesDisponiveis = (modalidades || []).filter(m => unidadesSelecionadas.includes(MODALIDADE_EMPRESA[m.nome]))

  // Preview ao vivo dos cards: com 1 unidade marcada, mostra só ela; com 0 ou 2, mostra as duas
  // combinadas (mesma leitura que "Ambas" tinha no dropdown antigo).
  const empresaPreview = unidadesSelecionadas.length === 1 ? unidadesSelecionadas[0] : null
  const { data: rel, isLoading } = useRelatorioMensal({
    periodoInicio, periodoFim, empresa: empresaPreview, modalidades: modalidadesSelecionadas,
  })
  const insights = rel ? gerarInsights(rel) : []

  const { data: listaAlunos, isLoading: isLoadingLista } = useListaAlunosAtivos({
    periodoInicio, periodoFim, empresa: empresaPreview, modalidades: modalidadesSelecionadas,
  })
  const listaAlunosFiltrada = (listaAlunos || []).filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase()))

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

  // Pra pintar o botão certo de destacado: compara o período atual com o que cada
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

  // Um PDF por unidade marcada, mesmo padrão do relatório completo — se as duas estiverem
  // marcadas, gera um pra cada em vez de misturar Procópio e Beach Arena numa tabela só.
  async function handleGerarLista() {
    if (unidadesSelecionadas.length === 0) {
      return toast.error('Selecione Procópio, Beach Arena ou as duas', { style: toastStyle })
    }
    setGerandoLista(true)
    try {
      for (const empresaAlvo of unidadesSelecionadas) {
        const modalidadesDaUnidade = modalidadesSelecionadas.filter(m => MODALIDADE_EMPRESA[m] === empresaAlvo)
        const filtroModalidades = modalidadesSelecionadas.length > 0 ? modalidadesDaUnidade : null
        const linhas = await buscarListaAlunosAtivos({ periodoInicio, periodoFim, empresa: empresaAlvo, modalidades: filtroModalidades })
        await exportarListaAlunosPDF(linhas, { empresa: empresaAlvo, periodo: { inicio: periodoInicio, fim: periodoFim } })
      }
      toast.success(unidadesSelecionadas.length > 1 ? 'PDFs gerados!' : 'PDF gerado!', { style: toastStyle })
    } catch (err) {
      toast.error('Erro ao gerar lista: ' + err.message, { style: toastStyle })
    } finally {
      setGerandoLista(false)
    }
  }

  const mesInicio = periodoInicio.slice(0, 7)
  const mesFim = periodoFim.slice(0, 7)
  const periodoSuspeito = mesInicio !== mesFim

  return (
    <div className="fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: 0 }}>
          Relatório Mensal
        </h1>
      </div>

      {/* Aba: relatório completo (KPIs/insights) x lista simplificada de alunos ativos */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => setAba('completo')} style={{
          flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: aba === 'completo' ? 'var(--color-surface-dark-raised)' : 'transparent',
          outline: aba === 'completo' ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border-dark)',
          color: aba === 'completo' ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)', fontSize: '12px', fontWeight: '600',
        }}>Relatório Completo</button>
        <button onClick={() => setAba('lista')} style={{
          flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: aba === 'lista' ? 'var(--color-surface-dark-raised)' : 'transparent',
          outline: aba === 'lista' ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border-dark)',
          color: aba === 'lista' ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)', fontSize: '12px', fontWeight: '600',
        }}>Lista de Alunos</button>
      </div>

      {/* 1. Unidade — sempre o primeiro passo. Pode marcar as duas. */}
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unidade</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {EMPRESAS.map(e => {
          const ativo = unidadesSelecionadas.includes(e.valor)
          const cor = COR_UNIDADE[e.valor]
          return (
            <button key={e.valor} onClick={() => toggleUnidade(e.valor)} style={{
              flex: 1, padding: '18px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              background: ativo ? cor : 'var(--color-surface-dark-raised)',
              outline: ativo ? 'none' : '1px solid var(--color-border-dark)',
              color: ativo ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-secondary)',
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
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Modalidade <span style={{ textTransform: 'none', color: 'var(--color-text-dark-muted)' }}>(nenhuma marcada = todas)</span>
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
                  background: ativo ? cor : 'var(--color-surface-dark-raised)',
                  outline: ativo ? 'none' : '1px solid var(--color-border-dark)',
                }}>
                  {icone && (
                    <img src={icone} alt="" style={{
                      width: '22px', height: '22px', objectFit: 'contain',
                      filter: ativo ? 'invert(1)' : 'none', opacity: ativo ? 1 : 0.6,
                    }} />
                  )}
                  <span style={{
                    fontSize: '10px', fontWeight: '600', textAlign: 'center', lineHeight: 1.2,
                    color: ativo ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-secondary)',
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
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Período</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={selecionarMesAtual} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
            outline: ehMesAtual ? 'none' : '1px solid var(--color-border-dark)',
            background: ehMesAtual ? 'var(--color-action-primary)' : 'var(--color-surface-dark-raised)',
            color: ehMesAtual ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-secondary)',
            fontSize: '12px', fontWeight: ehMesAtual ? '700' : '400', cursor: 'pointer',
          }}>Mês atual</button>
          <button onClick={selecionarMesPassado} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
            outline: ehMesPassado ? 'none' : '1px solid var(--color-border-dark)',
            background: ehMesPassado ? 'var(--color-action-primary)' : 'var(--color-surface-dark-raised)',
            color: ehMesPassado ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-secondary)',
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
        backgroundColor: periodoSuspeito ? 'rgba(180,71,47,0.08)' : 'var(--color-surface-dark-raised)',
        border: periodoSuspeito ? '1px solid rgba(180,71,47,0.35)' : '1px solid var(--color-border-dark)',
        fontSize: '12px', color: periodoSuspeito ? 'var(--color-state-danger)' : 'var(--color-text-dark-secondary)',
      }}>
        Período selecionado: <strong>{format(new Date(periodoInicio + 'T12:00'), 'dd/MM/yyyy')} a {format(new Date(periodoFim + 'T12:00'), 'dd/MM/yyyy')}</strong>
        {periodoSuspeito && ' — atenção: as datas caem em meses diferentes, confira se é isso mesmo antes de gerar.'}
      </div>

      {aba === 'completo' && (
      <>
      {/* 4. Gerar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        <button onClick={() => handleGerar('pdf')} disabled={!!gerando} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px',
          borderRadius: '12px', border: 'none', cursor: unidadesSelecionadas.length === 0 ? 'not-allowed' : 'pointer',
          background: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: '14px', fontWeight: '700',
          opacity: gerando && gerando !== 'pdf' ? 0.5 : 1,
        }}>
          <Download size={16} /> {gerando === 'pdf' ? 'Gerando PDF...' : 'Gerar Relatório em PDF'}
        </button>
        <button onClick={() => handleGerar('png')} disabled={!!gerando} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px',
          borderRadius: '12px', border: '1px solid var(--color-border-dark)', cursor: unidadesSelecionadas.length === 0 ? 'not-allowed' : 'pointer',
          background: 'var(--color-surface-dark-raised)', color: 'var(--color-text-dark-primary)', fontSize: '14px', fontWeight: '700',
          opacity: gerando && gerando !== 'png' ? 0.5 : 1,
        }}>
          <Download size={16} /> {gerando === 'png' ? 'Gerando PNG...' : 'Gerar Relatório em PNG (via ZIP)'}
        </button>
      </div>

      {isLoading ? <Loading /> : rel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>

          <SectionTitle>Resumo executivo</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KpiCard icon={CalendarDays} label="Aulas Programadas" value={rel.aulasProgramadas} dot="var(--color-action-primary)" />
            <KpiCard icon={CheckCircle2} label="Aulas Dadas" value={rel.aulasDadas} dot="var(--color-state-success)" />
            <KpiCard icon={CloudRain} label="Canceladas" value={rel.aulasCanceladas} dot="var(--color-state-info)" />
            <KpiCard icon={Ban} label="Sem Aluno" value={rel.aulasSemAluno} dot="var(--color-text-dark-secondary)" />
            <KpiCard icon={LineChart} label="Taxa Realização" value={`${rel.taxaRealizacao}%`} dot={CORES_SEMAFORO[classificarPct(rel.taxaRealizacao, { bom: 85, atencao: 65 })]} />
            <KpiCard icon={PartyPopper} label="Aulas em Feriado" value={rel.aulasEmFeriado} dot="var(--color-state-info)" />
          </div>

          <SectionTitle>Participação dos associados</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KpiCard icon={Users} label="Alunos Únicos" value={rel.alunosUnicos} dot="var(--color-action-primary)" />
            <KpiCard icon={ThumbsUp} label="Presenças" value={rel.presentes} dot="var(--color-state-success)" />
            <KpiCard icon={ThumbsDown} label="Faltas" value={rel.faltas} dot="var(--color-state-danger)" />
            <KpiCard icon={FileText} label="Falta Justificada" value={rel.faltasJustificadas} dot="var(--color-state-warning)" />
          </div>
          <div style={{
            padding: '16px', borderRadius: '16px', backgroundColor: 'var(--color-surface-dark-raised)',
            border: `1px solid ${CORES_SEMAFORO[classificarPct(rel.taxaPresenca)]}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)' }}>Taxa de presença</span>
              <SeloSemaforo pct={rel.taxaPresenca} />
            </div>
            <span style={{ fontSize: '20px', fontWeight: '700', color: CORES_SEMAFORO[classificarPct(rel.taxaPresenca)] }}>{rel.taxaPresenca}%</span>
          </div>

          {/* Vagas disponíveis — retrato de agora (matrícula não é histórica), não do
              período do relatório como o resto da tela. Turma em grupo = 4 vagas,
              individual = 1, mesma convenção do mapa de calor. */}
          {rel.vagas && (
            <>
              <div style={{
                padding: '16px', borderRadius: '16px', backgroundColor: 'var(--color-surface-dark-raised)',
                border: `1px solid ${CORES_SEMAFORO[classificarPct(rel.vagas.pctPreenchido, { bom: 70, atencao: 40 })]}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)' }}>Vagas preenchidas</span>
                  <SeloSemaforo pct={rel.vagas.pctPreenchido} limites={{ bom: 70, atencao: 40 }} />
                </div>
                <span style={{ fontSize: '20px', fontWeight: '700', color: CORES_SEMAFORO[classificarPct(rel.vagas.pctPreenchido, { bom: 70, atencao: 40 })] }}>
                  {rel.vagas.totalAtivos}/{rel.vagas.totalCapacidade} ({rel.vagas.pctPreenchido}%)
                </span>
              </div>

              {rel.vagas.turmasInativas.length > 0 && (
                <Bloco icon={Ban} titulo={`Turmas sem nenhum aluno ativo (${rel.vagas.turmasInativas.length}) — candidatas a fechar ou remanejar`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '280px', overflowY: 'auto' }}>
                    {rel.vagas.turmasInativas.map(t => (
                      <div key={t.turmaId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                        <span style={{ color: 'var(--color-text-dark-primary)' }}>{t.turma}</span>
                        <span style={{ color: 'var(--color-text-dark-secondary)', flexShrink: 0 }}>{t.capacidade} vaga{t.capacidade === 1 ? '' : 's'} livre{t.capacidade === 1 ? '' : 's'}</span>
                      </div>
                    ))}
                  </div>
                </Bloco>
              )}
            </>
          )}

          {/* Insights Executivos */}
          {insights.length > 0 && (
            <Bloco icon={BrainCircuit} titulo="Insights executivos">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {insights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                      backgroundColor: CORES_SEMAFORO[ins.severidade],
                    }} />
                    <span style={{ fontSize: '12.5px', color: 'var(--color-text-dark-secondary)', lineHeight: '1.5' }}>{ins.texto}</span>
                  </div>
                ))}
              </div>
            </Bloco>
          )}

          {/* Cancelamentos por motivo */}
          {Object.keys(rel.motivosCancelamento).length > 0 && (
            <Bloco icon={CloudRain} titulo="Cancelamentos por motivo">
              <BarrasProporcao
                itens={Object.entries(rel.motivosCancelamento).map(([nome, total]) => ({ nome, total }))}
                total={rel.aulasCanceladas}
              />
            </Bloco>
          )}

          {/* Perfil de uso */}
          {Object.keys(rel.porTipoParticipacao).length > 0 && (
            <Bloco icon={Users} titulo="Perfil de uso">
              <BarrasProporcao
                itens={Object.entries(rel.porTipoParticipacao).map(([nome, total]) => ({ nome: rotuloTipo(nome), total }))}
                total={Object.values(rel.porTipoParticipacao).reduce((a, b) => a + b, 0)}
              />
            </Bloco>
          )}

          {/* Por modalidade */}
          {rel.porModalidade.length > 0 && (
            <Bloco icon={BarChart3} titulo="Uso por modalidade">
              <BarrasProporcao
                itens={rel.porModalidade.map(m => ({ nome: m.nome, total: m.aulas }))}
                total={rel.aulasProgramadas}
              />
            </Bloco>
          )}

          {/* Por unidade */}
          {rel.porEmpresa.length > 1 && (
            <Bloco icon={LandPlot} titulo="Uso por unidade">
              <BarrasProporcao
                itens={rel.porEmpresa.map(e => ({ nome: rotuloEmpresa(e.empresa), total: e.aulas }))}
                total={rel.aulasProgramadas}
              />
            </Bloco>
          )}

          {/* Comparação com mês anterior */}
          <SectionTitle>Comparação com o mês anterior</SectionTitle>
          {rel.comparativo.semHistoricoAnterior ? (
            <div style={{
              padding: '14px 16px', borderRadius: '14px', backgroundColor: 'var(--color-surface-dark-raised)',
              border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: 'var(--color-text-dark-secondary)',
            }}>
              Sem dados do mês anterior pra comparar — ainda não há histórico suficiente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ComparativoLinha label="Aulas dadas" atual={rel.aulasDadas} anterior={rel.comparativo.aulasDadasAnterior} variacao={rel.comparativo.variacaoAulasDadas} />
              <ComparativoLinha label="Taxa de presença" atual={`${rel.taxaPresenca}%`} anterior={`${rel.comparativo.taxaPresencaAnterior}%`} variacao={rel.comparativo.variacaoTaxaPresenca} />
              <ComparativoLinha label="Alunos únicos" atual={rel.alunosUnicos} anterior={rel.comparativo.alunosUnicosAnterior} variacao={rel.comparativo.variacaoAlunosUnicos} />
            </div>
          )}

          {/* Ranking de professores */}
          {rel.rankingProfessores.length > 0 && (
            <Bloco icon={Trophy} titulo="Aulas por professor">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rel.rankingProfessores.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--color-text-dark-primary)' }}>{p.nome}</span>
                    <span style={{ color: 'var(--color-text-dark-secondary)' }}>{p.total} aulas</span>
                  </div>
                ))}
              </div>
            </Bloco>
          )}
        </div>
      ) : null}
      </>
      )}

      {aba === 'lista' && (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <button onClick={handleGerarLista} disabled={gerandoLista} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px',
          borderRadius: '12px', border: 'none', cursor: unidadesSelecionadas.length === 0 ? 'not-allowed' : 'pointer',
          background: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontSize: '14px', fontWeight: '700',
          opacity: gerandoLista ? 0.5 : 1,
        }}>
          <Download size={16} /> {gerandoLista ? 'Gerando PDF...' : 'Exportar Lista em PDF'}
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <input
          style={inputBuscaStyle}
          placeholder="Buscar aluno pelo nome..."
          value={buscaAluno}
          onChange={e => setBuscaAluno(e.target.value)}
        />
        <Search size={14} color="var(--color-text-dark-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      {isLoadingLista ? <Loading /> : (
        <>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '10px' }}>
            {listaAlunosFiltrada.length} aluno{listaAlunosFiltrada.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {listaAlunosFiltrada.map(a => (
              <div key={`${a.turmaId}_${a.alunoId}`} style={{
                padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--color-surface-dark-raised)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-dark-primary)' }}>{a.nome}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textAlign: 'right' }}>{a.turma}{a.nivel ? ` — ${a.nivel}` : ''}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginBottom: '10px' }}>
                  {a.diaSemana}{a.horario ? ` · ${a.horario}` : ''}
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <MiniStat label="Aulas" value={a.totalAulas} cor="var(--color-text-dark-secondary)" />
                  <MiniStat label="Presença" value={a.presentes} cor="var(--color-state-success)" />
                  <MiniStat label="Falta" value={a.faltas} cor="var(--color-state-danger)" />
                  <MiniStat label="Falta Just." value={a.faltasJustificadas} cor="var(--color-state-warning)" />
                  <MiniStat label="Frequência" value={`${a.pctFrequencia}%`} cor={CORES_SEMAFORO[classificarPct(a.pctFrequencia)]} />
                </div>
              </div>
            ))}
            {listaAlunosFiltrada.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-dark-secondary)', fontSize: '13px' }}>
                Nenhum aluno ativo encontrado{unidadesSelecionadas.length === 0 ? ' — selecione uma unidade acima' : ''}.
              </div>
            )}
          </div>
        </>
      )}
      </>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px' }}>
      {children}
    </div>
  )
}

function Bloco({ icon: Icon, titulo, children }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '16px',
      backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid rgba(255,255,255,0.06)',
      width: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: '600', color: 'var(--color-text-dark-primary)', marginBottom: '12px' }}>
        {Icon && <Icon size={14} />} {titulo}
      </div>
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
            <span style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)' }}>{item.nome}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>{item.total}{total > 0 ? ` (${Math.round((item.total / total) * 100)}%)` : ''}</span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-border-dark)' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${total > 0 ? (item.total / total) * 100 : 0}%`,
              background: 'var(--color-action-primary)',
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
      padding: '14px 16px', borderRadius: '14px', backgroundColor: 'var(--color-surface-dark-raised)',
      border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)' }}>{label}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-dark-primary)', marginTop: '4px' }}>{atual} vs {anterior} anterior</div>
      </div>
      {variacao !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: '700',
          color: variacao >= 0 ? 'var(--color-state-success)' : 'var(--color-state-danger)',
        }}>
          {variacao >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {variacao > 0 ? '+' : ''}{variacao}%
        </div>
      )}
    </div>
  )
}

function SeloSemaforo({ pct, limites }) {
  const status = classificarPct(pct, limites)
  return (
    <span style={{
      fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '6px',
      textTransform: 'uppercase', letterSpacing: '0.3px',
      color: CORES_SEMAFORO[status], backgroundColor: `${CORES_SEMAFORO[status]}22`,
    }}>
      {LABEL_SEMAFORO[status]}
    </span>
  )
}

function rotuloTipo(tipo) {
  const rotulos = { mensalista: 'Mensalista', reposicao: 'Reposição', avulso: 'Avulso', cortesia: 'Cortesia' }
  return rotulos[tipo] || tipo
}

function rotuloEmpresa(empresa) {
  return empresa === 'procopio' ? 'Procópio' : empresa === 'beach_arena' ? 'Beach Arena' : 'Outro'
}

function MiniStat({ label, value, cor }) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: '700', color: cor }}>{value}</div>
      <div style={{ fontSize: '9px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, dot }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '16px',
      backgroundColor: 'var(--color-surface-dark-raised)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {Icon && <Icon size={20} color="var(--color-text-dark-secondary)" />}
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--color-text-dark-primary)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>{label}</div>
    </div>
  )
}
