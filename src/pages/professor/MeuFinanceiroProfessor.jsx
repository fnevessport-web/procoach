import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, ChevronDown, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { useAulasAnoProfessor, useBoletosProfessor, useRemoverAnexoBoleto } from '../../hooks/useFinanceiro'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const MESES_EXT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Confirmação antes de anexar (evita o erro de subir a NF de um mês na janela de outro,
// já que nada aqui impede o professor de estar no mês errado sem perceber) e antes de
// excluir (ação sem volta, já que não guarda histórico do que foi removido).
function ModalConfirmarAnexo({ acao, tipo, mesLabel, enviando, onConfirmar, onCancelar }) {
  const rotulo = tipo === 'boleto' ? 'o Boleto' : 'a Nota Fiscal'
  const ehExcluir = acao === 'excluir'
  return (
    <Modal open onClose={onCancelar} title={ehExcluir ? 'Excluir anexo' : 'Confirmar anexo'} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          {ehExcluir ? (
            <>Excluir {rotulo} de <b style={{ color: 'var(--color-action-primary)' }}>{mesLabel}</b> anexado(a)? Essa ação não pode ser desfeita.</>
          ) : (
            <>Você está anexando {rotulo} referente à prestação de serviço de{' '}
              <b style={{ color: 'var(--color-action-primary)' }}>{mesLabel}</b>.</>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancelar} style={{
            flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)',
            background: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={onConfirmar} disabled={enviando} style={{
            flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
            background: ehExcluir ? 'var(--color-state-danger)' : 'var(--color-action-primary)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>{enviando ? 'Enviando...' : ehExcluir ? 'Excluir' : 'Confirmar'}</button>
        </div>
      </div>
    </Modal>
  )
}

// Tela de autoatendimento do professor — só pagamentos (sem dados pessoais misturados,
// diferente da aba Financeiro de ProfessoresPage.jsx/Meu Perfil). Contexto Financeiro é
// Escuro por regra do redesign, então usa os tokens -dark-* direto, como o Financeiro do
// gestor (FinanceiroPage.jsx).
export function MeuFinanceiroProfessor() {
  const qc = useQueryClient()
  const { perfil } = useAppStore()
  const professorId = perfil?.professor_id
  const hoje = new Date()

  const [anoSel, setAnoSel] = useState(hoje.getFullYear())
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1)
  const [empresaSel, setEmpresaSel] = useState('procopio')
  const [enviando, setEnviando] = useState('')
  const [excluindo, setExcluindo] = useState('')
  const [erro, setErro] = useState('')
  const [dialogAnexo, setDialogAnexo] = useState(null) // { acao: 'anexar'|'excluir', tipo: 'boleto'|'nf', file? } | null
  const removerAnexo = useRemoverAnexoBoleto()

  const { data: professor, isLoading: carregandoProfessor } = useQuery({
    queryKey: ['meu_financeiro_professor', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase.from('professores').select('*').eq('id', professorId).single()
      if (error) throw error
      return data
    },
  })

  const ehMultiEmpresa = !!(professor?.trabalha_procopio && professor?.trabalha_beach)
  const empresaAtual = ehMultiEmpresa ? empresaSel : (professor?.trabalha_beach ? 'beach_arena' : 'procopio')

  const { data: aulasAno = [], isLoading: carregandoAulas } = useAulasAnoProfessor({ professorId, professor })
  const { data: boletos = [] } = useBoletosProfessor(professorId)

  const aulasDaEmpresa = aulasAno.filter(a => a.empresa === empresaAtual)

  function aulasDoMes(mes, ano) {
    return aulasDaEmpresa.filter(a => {
      const d = new Date(a.data_aula + 'T12:00')
      return d.getMonth() + 1 === mes && d.getFullYear() === ano
    })
  }

  const aulasMesSel = aulasDoMes(mesSel, anoSel)
  const valorMesSel = aulasMesSel.reduce((acc, a) => acc + (a.valor || 0), 0)
  const boletoMesSel = boletos.find(b => b.mes === mesSel && b.ano === anoSel && b.empresa === empresaAtual)

  const carregando = carregandoProfessor || (!!professorId && carregandoAulas)

  // Upload de Boleto/NF — onConflict precisa bater com a constraint real de
  // boletos_professor (professor_id, mes, ano, empresa), ver nota em useFinanceiro.js.
  async function handleUpload(tipo, file) {
    if (!file || !professorId) return
    setEnviando(tipo)
    setErro('')
    try {
      const path = `professores/${professorId}/${tipo}_${empresaAtual}_${anoSel}_${mesSel}.pdf`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      const campo = tipo === 'boleto' ? 'boleto_url' : 'nf_url'
      const payload = { professor_id: professorId, mes: mesSel, ano: anoSel, empresa: empresaAtual, [campo]: publicUrl }
      if (tipo === 'boleto') payload.status = boletoMesSel?.status || 'pendente'
      const { error: dbErr } = await supabase.from('boletos_professor')
        .upsert(payload, { onConflict: 'professor_id,mes,ano,empresa' })
      if (dbErr) throw dbErr
      qc.invalidateQueries({ queryKey: ['boletos', professorId] })
    } catch (err) {
      setErro(`Erro ao anexar ${tipo === 'boleto' ? 'boleto' : 'NF'}: ${err.message}`)
    } finally {
      setEnviando('')
    }
  }

  async function handleExcluir(tipo) {
    setExcluindo(tipo)
    setErro('')
    try {
      const campo = tipo === 'boleto' ? 'boleto_url' : 'nf_url'
      await removerAnexo.mutateAsync({ professorId, mes: mesSel, ano: anoSel, empresa: empresaAtual, campo })
    } catch (err) {
      setErro(`Erro ao excluir ${tipo === 'boleto' ? 'boleto' : 'NF'}: ${err.message}`)
    } finally {
      setExcluindo('')
    }
  }

  function selecionarArquivo(tipo, file) {
    if (!file) return
    setDialogAnexo({ acao: 'anexar', tipo, file })
  }

  async function confirmarDialogAnexo() {
    if (!dialogAnexo) return
    const { acao, tipo, file } = dialogAnexo
    setDialogAnexo(null)
    if (acao === 'anexar') await handleUpload(tipo, file)
    else await handleExcluir(tipo)
  }

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear()]
  const mesLabelSel = `${MESES_EXT[mesSel - 1].toUpperCase()}/${anoSel}`

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: '4px 0 16px' }}>
        Financeiro
      </h1>

      {carregando ? (
        <Loading text="Carregando..." />
      ) : !professorId ? (
        <div style={{ color: 'var(--color-text-dark-secondary)', fontSize: '13px' }}>
          Nenhum cadastro de professor vinculado a este acesso.
        </div>
      ) : (
        <>
          {ehMultiEmpresa && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {[{ id: 'procopio', label: 'Procópio', cor: 'var(--color-action-primary)' }, { id: 'beach_arena', label: 'Beach Arena', cor: 'var(--color-state-info)' }].map(op => (
                <button key={op.id} onClick={() => setEmpresaSel(op.id)} style={{
                  flex: 1, padding: '9px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  border: `1px solid ${empresaAtual === op.id ? op.cor : 'var(--color-border-dark)'}`,
                  background: empresaAtual === op.id ? `${op.cor}22` : 'var(--color-surface-dark-raised)',
                  color: empresaAtual === op.id ? op.cor : 'var(--color-text-dark-secondary)',
                }}>{op.label}</button>
              ))}
            </div>
          )}

          {/* Ano */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {anos.map(a => (
              <button key={a} onClick={() => setAnoSel(a)} style={{
                padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                background: anoSel === a ? 'var(--color-action-primary)' : 'var(--color-surface-dark-raised)',
                color: anoSel === a ? 'white' : 'var(--color-text-dark-secondary)',
              }}>{a}</button>
            ))}
          </div>

          {/* Grade de meses */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {MESES.map((m, i) => {
              const mes = i + 1
              const doMes = aulasDoMes(mes, anoSel)
              const valor = doMes.reduce((acc, a) => acc + (a.valor || 0), 0)
              const isSel = mesSel === mes
              const isAtual = mes === hoje.getMonth() + 1 && anoSel === hoje.getFullYear()
              return (
                <button key={m} onClick={() => setMesSel(mes)} style={{
                  padding: '10px 6px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
                  background: isSel ? 'rgba(165,76,46,0.18)' : 'var(--color-surface-dark-raised)',
                  border: isSel ? '1px solid var(--color-action-primary)' : isAtual ? '1px solid rgba(165,76,46,0.35)' : '1px solid var(--color-border-dark-subtle)',
                }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: isSel ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)' }}>{m}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-dark-primary)', margin: '3px 0' }}>{doMes.length > 0 ? doMes.length : '—'}</div>
                  {valor > 0 && <div style={{ fontSize: '9px', color: 'var(--color-state-success)' }}>{fmtBRL(valor)}</div>}
                </button>
              )
            })}
          </div>

          {/* Mês selecionado */}
          <div style={{
            backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '14px',
            border: '1px solid rgba(165,76,46,0.2)', padding: '16px', marginBottom: '14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {MESES_EXT[mesSel - 1]}/{anoSel}
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{fmtBRL(valorMesSel)}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', marginTop: '4px' }}>
              {aulasMesSel.length} {aulasMesSel.length === 1 ? 'aula' : 'aulas'}
            </div>
            {boletoMesSel?.status === 'pago' && (
              <div style={{ display: 'inline-block', marginTop: '8px', padding: '2px 10px', borderRadius: '6px', backgroundColor: 'rgba(75,139,106,0.15)', color: 'var(--color-state-success)', fontSize: '11px', fontWeight: '700' }}>
                ✓ Pago
              </div>
            )}
          </div>

          {/* Anexar Boleto / NF */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
              <label style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px', borderRadius: '12px', cursor: enviando ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '600',
                backgroundColor: boletoMesSel?.boleto_url ? 'rgba(75,139,106,0.12)' : 'var(--color-surface-dark-raised)',
                color: boletoMesSel?.boleto_url ? 'var(--color-state-success)' : 'var(--color-text-dark-secondary)',
                border: boletoMesSel?.boleto_url ? '1px solid rgba(75,139,106,0.35)' : '1px dashed var(--color-border-dark)',
              }}>
                <input type="file" accept=".pdf" style={{ display: 'none' }} disabled={!!enviando}
                  onChange={e => { selecionarArquivo('boleto', e.target.files?.[0]); e.target.value = '' }} />
                <Upload size={14} />{enviando === 'boleto' ? 'Enviando...' : boletoMesSel?.boleto_url ? 'Boleto ✓' : 'Anexar boleto'}
              </label>
              {boletoMesSel?.boleto_url && (
                <button onClick={() => setDialogAnexo({ acao: 'excluir', tipo: 'boleto' })} disabled={!!excluindo} title="Excluir boleto" style={{
                  flexShrink: 0, padding: '12px', borderRadius: '12px', border: '1px solid rgba(180,71,47,0.3)',
                  background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
              <label style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px', borderRadius: '12px', cursor: enviando ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '600',
                backgroundColor: boletoMesSel?.nf_url ? 'rgba(75,139,106,0.12)' : 'var(--color-surface-dark-raised)',
                color: boletoMesSel?.nf_url ? 'var(--color-state-success)' : 'var(--color-text-dark-secondary)',
                border: boletoMesSel?.nf_url ? '1px solid rgba(75,139,106,0.35)' : '1px dashed var(--color-border-dark)',
              }}>
                <input type="file" accept=".pdf" style={{ display: 'none' }} disabled={!!enviando}
                  onChange={e => { selecionarArquivo('nf', e.target.files?.[0]); e.target.value = '' }} />
                <FileText size={14} />{enviando === 'nf' ? 'Enviando...' : boletoMesSel?.nf_url ? 'NF ✓' : 'Anexar NF'}
              </label>
              {boletoMesSel?.nf_url && (
                <button onClick={() => setDialogAnexo({ acao: 'excluir', tipo: 'nf' })} disabled={!!excluindo} title="Excluir NF" style={{
                  flexShrink: 0, padding: '12px', borderRadius: '12px', border: '1px solid rgba(180,71,47,0.3)',
                  background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {dialogAnexo && (
            <ModalConfirmarAnexo
              acao={dialogAnexo.acao}
              tipo={dialogAnexo.tipo}
              mesLabel={mesLabelSel}
              enviando={dialogAnexo.acao === 'anexar' ? enviando === dialogAnexo.tipo : excluindo === dialogAnexo.tipo}
              onConfirmar={confirmarDialogAnexo}
              onCancelar={() => setDialogAnexo(null)}
            />
          )}

          {erro && (
            <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(180,71,47,0.15)', border: '1px solid rgba(180,71,47,0.4)', fontSize: '12px', color: 'var(--color-state-danger)', marginBottom: '14px' }}>
              {erro}
            </div>
          )}

          {/* Aulas do mês */}
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Aulas do mês
          </div>
          {aulasMesSel.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-dark-muted)', textAlign: 'center', padding: '20px 0' }}>
              Nenhuma aula neste mês
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {aulasMesSel.map(a => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', backgroundColor: 'var(--color-surface-dark-raised)', borderRadius: '9px',
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-dark-primary)', fontWeight: '600' }}>
                      {new Date(a.data_aula + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    {a.horario && <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginLeft: '8px' }}>{a.horario.slice(0, 5)}</span>}
                    {a.turmas?.nome && <span style={{ fontSize: '11px', color: 'var(--color-text-dark-muted)', marginLeft: '8px' }}>{a.turmas.nome}</span>}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-state-success)' }}>{fmtBRL(a.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
