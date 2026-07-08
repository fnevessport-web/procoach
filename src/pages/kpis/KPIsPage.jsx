import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { useRelatorioMensal, buscarRelatorioMensal, buscarRelatorioPresencaAlunos } from '../../hooks/useRelatorioMensal'
import { useModalidades } from '../../hooks/useModalidades'
import { EMPRESAS } from '../../constants/modalidades'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import { exportarRelatorioPDF, exportarRelatorioPresencaPDF, exportarRelatorioPresencaPNG } from '../../lib/relatorioPdf'
import toast from 'react-hot-toast'

const toastStyle = { background: '#1a1a1a', color: '#F0F2F5', border: '1px solid #2a2a2a' }

export function KPIsPage() {
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [empresa, setEmpresa] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState(null)
  const [gerandoPresenca, setGerandoPresenca] = useState(null)
  const { data: modalidades } = useModalidades()
  const { data: rel, isLoading } = useRelatorioMensal({
    periodoInicio, periodoFim, empresa: empresa || null, modalidade: modalidade || null,
  })

  function selecionarMesAtual() {
    setPeriodoInicio(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setPeriodoFim(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  }
  function selecionarMesPassado() {
    const mesPassado = subMonths(new Date(), 1)
    setPeriodoInicio(format(startOfMonth(mesPassado), 'yyyy-MM-dd'))
    setPeriodoFim(format(endOfMonth(mesPassado), 'yyyy-MM-dd'))
  }

  // Cada unidade sempre vira um PDF separado — independe do filtro de Unidade da tela.
  async function handleExportarPDF(empresaAlvo) {
    setGerandoPdf(empresaAlvo)
    try {
      const dados = await buscarRelatorioMensal({ periodoInicio, periodoFim, empresa: empresaAlvo, modalidade: null })
      await exportarRelatorioPDF(dados, { inicio: periodoInicio, fim: periodoFim }, { empresa: empresaAlvo })
      toast.success('PDF gerado!', { style: toastStyle })
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + err.message, { style: toastStyle })
    } finally {
      setGerandoPdf(null)
    }
  }

  // Lista de presença por aluno, separada por modalidade, pra unidade inteira no período
  // selecionado. Se o filtro de Modalidade da tela estiver marcado (não "Todas"), o export sai
  // só com aquela modalidade — senão traz todas juntas, em seções. PDF serve pra imprimir/
  // enviar; PNG (fundo transparente, em partes por modalidade) serve pra colar direto dentro de
  // outro relatório em alta resolução.
  async function handleExportarPresenca(empresaAlvo, formato) {
    const chave = `${empresaAlvo}-${formato}`
    setGerandoPresenca(chave)
    try {
      const dados = await buscarRelatorioPresencaAlunos({ periodoInicio, periodoFim, empresa: empresaAlvo })
      if (modalidade) dados.porModalidade = dados.porModalidade.filter(g => g.modalidade === modalidade)
      if (formato === 'pdf') {
        await exportarRelatorioPresencaPDF(dados.porModalidade, dados.periodo, { empresa: empresaAlvo })
        toast.success('PDF gerado!', { style: toastStyle })
      } else {
        const total = await exportarRelatorioPresencaPNG(dados.porModalidade, dados.periodo, { empresa: empresaAlvo })
        toast.success(
          total > 1 ? `${total} imagens PNG geradas — baixadas num .zip!` : `${total} imagem PNG gerada!`,
          { style: toastStyle }
        )
      }
    } catch (err) {
      toast.error('Erro ao gerar relatório: ' + err.message, { style: toastStyle })
    } finally {
      setGerandoPresenca(null)
    }
  }

  return (
    <div className="fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          Relatório Mensal
        </h1>
      </div>

      {rel && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {EMPRESAS.map(e => (
            <button key={e.valor} onClick={() => handleExportarPDF(e.valor)} disabled={!!gerandoPdf} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px',
              borderRadius: '10px', border: '1px solid #2a2a2a', background: '#1a1a1a',
              color: '#F0F2F5', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              opacity: gerandoPdf && gerandoPdf !== e.valor ? 0.5 : 1,
            }}>
              <Download size={13} /> {gerandoPdf === e.valor ? 'Gerando...' : `Exportar ${e.label}`}
            </button>
          ))}
        </div>
      )}

      {rel && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
            {modalidade ? `Presença por aluno — só ${modalidade}` : 'Presença por aluno (todas as modalidades, em seções)'}
          </div>
          {EMPRESAS.map(e => (
            <div key={e.valor} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1, fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center' }}>{e.label}</div>
              <button onClick={() => handleExportarPresenca(e.valor, 'pdf')} disabled={!!gerandoPresenca} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px',
                borderRadius: '10px', border: '1px solid rgba(252,200,37,0.3)', background: 'rgba(252,200,37,0.06)',
                color: '#fcc825', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                opacity: gerandoPresenca && gerandoPresenca !== `${e.valor}-pdf` ? 0.5 : 1,
              }}>
                <Download size={13} /> {gerandoPresenca === `${e.valor}-pdf` ? 'Gerando...' : 'PDF'}
              </button>
              <button onClick={() => handleExportarPresenca(e.valor, 'png')} disabled={!!gerandoPresenca} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px',
                borderRadius: '10px', border: '1px solid rgba(207,27,155,0.3)', background: 'rgba(207,27,155,0.06)',
                color: '#cf1b9b', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                opacity: gerandoPresenca && gerandoPresenca !== `${e.valor}-png` ? 0.5 : 1,
              }}>
                <Download size={13} /> {gerandoPresenca === `${e.valor}-png` ? 'Gerando...' : 'PNG'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={selecionarMesAtual} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid #2a2a2a',
            background: '#1a1a1a', color: '#888', fontSize: '12px', cursor: 'pointer',
          }}>Mês atual</button>
          <button onClick={selecionarMesPassado} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid #2a2a2a',
            background: '#1a1a1a', color: '#888', fontSize: '12px', cursor: 'pointer',
          }}>Mês passado</button>
        </div>
        <Input type="date" label="De" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
        <Input type="date" label="Até" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
        <Select label="Unidade" value={empresa} onChange={e => setEmpresa(e.target.value)}>
          <option value="">Ambas</option>
          {EMPRESAS.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
        </Select>
        <Select label="Modalidade" value={modalidade} onChange={e => setModalidade(e.target.value)}>
          <option value="">Todas</option>
          {modalidades?.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
        </Select>
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
