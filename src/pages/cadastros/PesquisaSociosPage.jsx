import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Copy, Check, FileText, ChevronLeft, ChevronRight, Star, ClipboardList, User } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { Modal } from '../../components/ui/Modal'
import { FotoProfessor } from '../../components/ui/FotoProfessor'
import {
  useCampanhasPesquisaSocios, useCriarCampanhaPesquisaSocios,
  useRespostasCampanha, useProfessoresPesquisaSocios,
} from '../../hooks/usePesquisaSocios'
import { PERGUNTAS_POR_PROFESSOR, ID_PROFESSOR_NAO_LEMBRO } from '../../constants/pesquisaSocios'
import { exportarPesquisaSociosPDF } from '../../lib/pesquisaSociosPdf'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-light-primary)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const CORES_FAIXA_NPS = (nota) => nota >= 9 ? 'var(--color-state-success)' : nota >= 7 ? 'var(--color-state-warning)' : 'var(--color-state-danger)'

function EstrelasDisplay({ value }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={14} fill={n <= value ? 'var(--color-action-primary)' : 'none'} color="var(--color-action-primary)" />
      ))}
    </div>
  )
}

// Mesmo avatar de silhueta escura da tela pública (PesquisaSociosPublicaPage.jsx) pra quem
// respondeu "Não lembro o nome" — sem isso, FotoProfessor cairia no fallback de iniciais
// coloridas ("NL" laranja), que não faz sentido pra um pseudo-professor.
function AvatarNaoLembro({ size }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: '#2E2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <User size={size * 0.58} color="#7A7A7A" fill="#7A7A7A" />
    </div>
  )
}

// `id` explícito em vez de ler de dentro de um objeto `prof` — os dois call-sites usam
// formatos de objeto diferentes (um vem de `dados.porProfessor`, com chave `profId`; o
// outro vem direto da lista de `professores`, com chave `id`), mais simples pedir o id já
// resolvido do que a função adivinhar qual chave ler.
function FotoOuAvatarNaoLembro({ id, foto_url, nome, size }) {
  if (id === ID_PROFESSOR_NAO_LEMBRO) return <AvatarNaoLembro size={size} />
  return <FotoProfessor src={foto_url} nome={nome} size={size} redondo />
}

// Mesmo padrão de "copiar com 1 clique" já duplicado em ProfessoresPage.jsx (PixCopiavel) e
// EventosPage.jsx — não existe componente compartilhado hoje pra isso, segue a convenção.
function LinkCopiavel({ texto }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button onClick={copiar} style={{
      display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
      padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(165,76,46,0.3)',
      backgroundColor: 'rgba(165,76,46,0.08)', cursor: 'pointer', fontSize: '12px', color: 'var(--color-action-primary)',
    }}>
      {copiado ? <Check size={14} /> : <Copy size={14} />}
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copiado ? 'Copiado!' : texto}
      </span>
    </button>
  )
}

// Agrega as respostas brutas em números prontos pra gráfico/card — mesmo cálculo usado em
// pesquisaSociosPdf.js (duplicado de propósito: um roda em tela com recharts, o outro vira
// tabela no PDF, formatos de saída diferentes o suficiente pra não valer a pena compartilhar).
function useAgregados(respostas, professores) {
  return useMemo(() => {
    const total = respostas.length
    const distribuicaoNps = Array.from({ length: 11 }, (_, nota) => ({ nota, qtd: 0 }))
    let somaNps = 0, qtdComNps = 0, promotores = 0, neutros = 0, detratores = 0

    respostas.forEach(r => {
      const nps = r.respostas?.nps
      if (typeof nps === 'number' && nps >= 0 && nps <= 10) {
        distribuicaoNps[nps].qtd++
        somaNps += nps
        qtdComNps++
        if (nps >= 9) promotores++
        else if (nps >= 7) neutros++
        else detratores++
      }
    })
    const notaMedia = qtdComNps > 0 ? somaNps / qtdComNps : 0
    const npsScore = qtdComNps > 0 ? Math.round(((promotores - detratores) / qtdComNps) * 100) : 0

    const porProfessorMap = {}
    respostas.forEach(r => {
      Object.entries(r.respostas?.avaliacoes || {}).forEach(([profId, notas]) => {
        if (!porProfessorMap[profId]) porProfessorMap[profId] = { somas: {}, qtd: 0 }
        porProfessorMap[profId].qtd++
        PERGUNTAS_POR_PROFESSOR.forEach(p => {
          porProfessorMap[profId].somas[p.chave] = (porProfessorMap[profId].somas[p.chave] || 0) + (Number(notas[p.chave]) || 0)
        })
      })
    })
    const porProfessor = Object.entries(porProfessorMap).map(([profId, entry]) => {
      const prof = professores.find(p => p.id === profId)
      const metricas = PERGUNTAS_POR_PROFESSOR.map(p => ({ pergunta: p.texto, chave: p.chave, valor: entry.somas[p.chave] / entry.qtd }))
      const mediaGeral = metricas.reduce((s, m) => s + m.valor, 0) / metricas.length
      return { profId, nome: prof?.nome || 'Professor removido', foto_url: prof?.foto_url, qtd: entry.qtd, metricas, mediaGeral }
    }).sort((a, b) => b.mediaGeral - a.mediaGeral)

    return { total, distribuicaoNps, notaMedia, npsScore, promotores, neutros, detratores, porProfessor }
  }, [respostas, professores])
}

function CardDesempenhoProfessor({ prof }) {
  return (
    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '14px', padding: '14px', backgroundColor: 'var(--color-surface-light-overlay)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <FotoOuAvatarNaoLembro id={prof.profId} foto_url={prof.foto_url} nome={prof.nome} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{prof.nome}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)' }}>{prof.qtd} avaliação{prof.qtd === 1 ? '' : 'ões'}</div>
        </div>
        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{prof.mediaGeral.toFixed(1)}</div>
      </div>
      <div style={{ width: '100%', height: 150 }}>
        <ResponsiveContainer>
          <BarChart data={prof.metricas} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <XAxis type="number" domain={[0, 5]} hide />
            <YAxis type="category" dataKey="pergunta" width={110} tick={{ fontSize: 9, fill: 'var(--color-text-light-secondary)' }} />
            <Bar dataKey="valor" fill="var(--color-action-primary)" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AbaGeral({ campanha }) {
  const link = `${window.location.origin}/pesquisa-socios/${campanha.token}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Campanha</div>
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{campanha.nome}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
          Criada em {format(new Date(campanha.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Link público — envie aos sócios (reutilizável, aceita respostas quantas vezes precisar)
        </div>
        <LinkCopiavel texto={link} />
      </div>
    </div>
  )
}

function AbaResultados({ campanha, respostas, professores, carregando }) {
  const dados = useAgregados(respostas, professores)
  const [exportando, setExportando] = useState(false)

  async function handleExportar() {
    setExportando(true)
    try {
      await exportarPesquisaSociosPDF(campanha, respostas, professores)
    } catch (err) {
      toast.error('Erro ao exportar: ' + err.message, { style: toastStyle })
    } finally {
      setExportando(false)
    }
  }

  if (carregando) return <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Carregando...</div>
  if (dados.total === 0) return <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Ainda sem respostas.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleExportar} disabled={exportando} style={{
          display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px',
          border: '1px solid rgba(165,76,46,0.3)', backgroundColor: 'rgba(165,76,46,0.08)',
          color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600', cursor: exportando ? 'not-allowed' : 'pointer', opacity: exportando ? 0.6 : 1,
        }}>
          <FileText size={13} /> {exportando ? 'Gerando...' : 'Exportar PDF'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Respostas', valor: String(dados.total) },
          { label: 'Nota média NPS', valor: dados.notaMedia.toFixed(1) },
          { label: 'NPS Score', valor: String(dados.npsScore) },
        ].map(c => (
          <div key={c.label} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{c.valor}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginTop: '4px' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '8px' }}>Distribuição de notas (NPS 0–10)</div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={dados.distribuicaoNps} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="nota" tick={{ fontSize: 10, fill: 'var(--color-text-light-secondary)' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-text-light-secondary)' }} />
              <Bar dataKey="qtd" radius={[4, 4, 0, 0]}>
                {dados.distribuicaoNps.map(d => <Cell key={d.nota} fill={CORES_FAIXA_NPS(d.nota)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {dados.porProfessor.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '8px' }}>Desempenho por professor</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {dados.porProfessor.map(p => <CardDesempenhoProfessor key={p.profId} prof={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function AbaRespostasIndividuais({ respostas, professores, carregando }) {
  const [indice, setIndice] = useState(0)

  if (carregando) return <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Carregando...</div>
  if (respostas.length === 0) return <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Ainda sem respostas.</div>

  const idx = Math.min(indice, respostas.length - 1)
  const r = respostas[idx].respostas || {}
  const profsAvaliados = (r.professores_ids || []).map(id => ({ id, prof: professores.find(p => p.id === id), notas: r.avaliacoes?.[id] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setIndice(i => Math.max(0, i - 1))} disabled={idx === 0} style={{
          padding: '6px', borderRadius: '8px', border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
          cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1,
        }}>
          <ChevronLeft size={16} color="var(--color-text-light-primary)" />
        </button>
        <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', textAlign: 'center' }}>
          Resposta {idx + 1} de {respostas.length}
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-muted)' }}>
            {format(new Date(respostas[idx].respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
        <button onClick={() => setIndice(i => Math.min(respostas.length - 1, i + 1))} disabled={idx === respostas.length - 1} style={{
          padding: '6px', borderRadius: '8px', border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
          cursor: idx === respostas.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === respostas.length - 1 ? 0.4 : 1,
        }}>
          <ChevronRight size={16} color="var(--color-text-light-primary)" />
        </button>
      </div>

      <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '14px' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '4px' }}>NPS</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: CORES_FAIXA_NPS(r.nps ?? 0) }}>{r.nps ?? '—'}</div>
        {r.motivo_nota && <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', marginTop: '8px', lineHeight: '1.5' }}>{r.motivo_nota}</div>}
      </div>

      {profsAvaliados.map(({ id, prof, notas }) => (
        <div key={id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <FotoOuAvatarNaoLembro id={id} foto_url={prof?.foto_url} nome={prof?.nome || '?'} size={32} />
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{prof?.nome || 'Professor removido'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {PERGUNTAS_POR_PROFESSOR.map(p => (
              <div key={p.chave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>{p.texto}</span>
                <EstrelasDisplay value={notas?.[p.chave] || 0} />
              </div>
            ))}
          </div>
          {notas?.comentario && (
            <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', marginTop: '10px', lineHeight: '1.5', borderTop: '1px solid var(--color-border-light)', paddingTop: '10px' }}>
              {notas.comentario}
            </div>
          )}
        </div>
      ))}

      {r.comentario_final && (
        <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Comentário final</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)', lineHeight: '1.5' }}>{r.comentario_final}</div>
        </div>
      )}
    </div>
  )
}

function DetalheCampanha({ campanha, onClose }) {
  const [aba, setAba] = useState('geral')
  const { data: respostas = [], isLoading: carregandoRespostas } = useRespostasCampanha(campanha.id)
  const { data: professores = [] } = useProfessoresPesquisaSocios()

  return createPortal((
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '94dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '20px 20px 0 0',
        padding: '20px 16px 32px', boxSizing: 'border-box',
      }}>
        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--color-text-light-muted)', borderRadius: '2px', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light-secondary)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: 'var(--color-surface-light-base)', borderRadius: '10px', padding: '4px' }}>
          {[
            { key: 'geral', label: 'Geral' },
            { key: 'resultados', label: 'Resultados' },
            { key: 'respostas', label: 'Respostas' },
          ].map(a => (
            <button key={a.key} onClick={() => setAba(a.key)} style={{
              flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              background: aba === a.key ? 'var(--color-action-primary)' : 'transparent',
              color: aba === a.key ? 'white' : 'var(--color-text-light-secondary)',
            }}>
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'geral' && <AbaGeral campanha={campanha} />}
        {aba === 'resultados' && <AbaResultados campanha={campanha} respostas={respostas} professores={professores} carregando={carregandoRespostas} />}
        {aba === 'respostas' && <AbaRespostasIndividuais respostas={respostas} professores={professores} carregando={carregandoRespostas} />}
      </div>
    </div>
  ), document.body)
}

export function PesquisaSociosPage() {
  const { data: campanhas = [], isLoading } = useCampanhasPesquisaSocios()
  const criarCampanha = useCriarCampanhaPesquisaSocios()
  const [modalNovaCampanha, setModalNovaCampanha] = useState(false)
  const [nomeNovaCampanha, setNomeNovaCampanha] = useState('')
  const [campanhaAberta, setCampanhaAberta] = useState(null)

  async function handleCriar() {
    if (!nomeNovaCampanha.trim()) return
    try {
      await criarCampanha.mutateAsync(nomeNovaCampanha.trim())
      setModalNovaCampanha(false)
      setNomeNovaCampanha('')
      toast.success('Campanha criada!', { style: toastStyle })
    } catch (err) {
      toast.error('Erro ao criar: ' + err.message, { style: toastStyle })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)' }}>
          Pesquisa de satisfação dos sócios sobre as aulas de tênis — crie uma campanha por ciclo, cada uma com link e resultados próprios.
        </div>
      </div>

      <button onClick={() => setModalNovaCampanha(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: '12px', borderRadius: '12px', border: 'none',
        backgroundColor: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
      }}>
        <Plus size={16} /> Nova campanha
      </button>

      {isLoading && <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-light-muted)', padding: '20px' }}>Carregando...</div>}

      {!isLoading && campanhas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-light-muted)' }}>
          <ClipboardList size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <div style={{ fontSize: '13px' }}>Nenhuma campanha criada ainda.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {campanhas.map(c => (
          <button key={c.id} onClick={() => setCampanhaAberta(c)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
            padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-surface-light-overlay)', cursor: 'pointer', textAlign: 'left',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-light-primary)' }}>{c.nome}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                {format(new Date(c.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-action-primary)', backgroundColor: 'rgba(165,76,46,0.08)', padding: '4px 10px', borderRadius: '999px', flexShrink: 0 }}>
              {c.qtdRespostas} resposta{c.qtdRespostas === 1 ? '' : 's'}
            </div>
          </button>
        ))}
      </div>

      <Modal open={modalNovaCampanha} onClose={() => setModalNovaCampanha(false)} title="Nova campanha de pesquisa" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Nome da campanha</div>
            <input
              style={inputStyle}
              placeholder="Ex.: Pesquisa Sócios Setembro/2026"
              value={nomeNovaCampanha}
              onChange={e => setNomeNovaCampanha(e.target.value)}
              autoFocus
            />
          </div>
          <button onClick={handleCriar} disabled={criarCampanha.isPending || !nomeNovaCampanha.trim()} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', borderRadius: '12px', border: 'none',
            backgroundColor: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '700',
            cursor: (criarCampanha.isPending || !nomeNovaCampanha.trim()) ? 'not-allowed' : 'pointer',
            opacity: (criarCampanha.isPending || !nomeNovaCampanha.trim()) ? 0.6 : 1,
          }}>
            {criarCampanha.isPending ? 'Criando...' : 'Criar campanha'}
          </button>
        </div>
      </Modal>

      {campanhaAberta && <DetalheCampanha campanha={campanhaAberta} onClose={() => setCampanhaAberta(null)} />}
    </div>
  )
}
