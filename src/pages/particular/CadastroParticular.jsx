import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Handshake, Plus, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import useAppStore from '../../store/useAppStore'
import { useAlunos, useSalvarAluno, useDimensoesModalidade, useAvaliacoesModalidade, useHistoricoPresencaModalidade } from '../../hooks/useAlunos'
import { useContratantes, useCriarContratante, useExcluirContratante } from '../../hooks/useContratantes'
import { useModalidadeTenisId } from '../../hooks/useModalidadeTenisId'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Loading'
import { EvolucaoTecnicaTenis } from '../../components/EvolucaoTecnicaTenis'
import { exportarEvolucaoTecnicaPDFParticular } from '../../lib/relatorioPdfParticular'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = {
  fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
}

const ABAS = [
  { id: 'alunos', label: 'Alunos', icon: GraduationCap },
  { id: 'contratantes', label: 'Contratantes', icon: Handshake },
]

export function CadastroParticular() {
  const { empresaSelecionada } = useAppStore()
  const empresaId = empresaSelecionada?.id
  const [abaAtiva, setAbaAtiva] = useState('alunos')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-light-primary)', marginBottom: '16px' }}>
        Cadastro
      </h1>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {ABAS.map(aba => {
          const Icon = aba.icon
          const ativa = abaAtiva === aba.id
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                background: ativa ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
                color: ativa ? 'white' : 'var(--color-text-light-secondary)',
              }}
            >
              <Icon size={13} /> {aba.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {abaAtiva === 'alunos' ? <AbaAlunos empresaId={empresaId} /> : <AbaContratantes empresaId={empresaId} />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Aba Alunos
// ──────────────────────────────────────────────────────────────────────

const FORM_ALUNO_VAZIO = { nome: '', telefone: '', tipo_cobranca: 'por_aula', valor_aula: '', valor_fixo: '', direito_reposicao: true, dia_vencimento: '' }

function AbaAlunos({ empresaId }) {
  const { data: alunos = [], isLoading } = useAlunos(null, empresaId)
  const modalidadeTenisId = useModalidadeTenisId()
  const salvarAluno = useSalvarAluno()
  const [form, setForm] = useState(null) // FORM_ALUNO_VAZIO | null
  const [alunoAberto, setAlunoAberto] = useState(null)

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Preencha o nome')
    try {
      await salvarAluno.mutateAsync({
        nome: form.nome.trim(),
        telefone: form.telefone || null,
        empresa_id: empresaId,
        modalidade_id: modalidadeTenisId,
        tipo_cobranca: form.tipo_cobranca,
        valor_aula: form.tipo_cobranca === 'por_aula' ? Number(form.valor_aula) || null : null,
        valor_fixo: form.tipo_cobranca === 'fixo' ? Number(form.valor_fixo) || null : null,
        direito_reposicao: form.direito_reposicao,
        dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      })
      toast.success('Aluno cadastrado!')
      setForm(null)
    } catch (err) { toast.error(err.message) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      <button onClick={() => setForm(FORM_ALUNO_VAZIO)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px',
        padding: '9px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600',
      }}>
        <Plus size={14} /> Novo aluno
      </button>

      {alunos.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', textAlign: 'center', padding: '24px' }}>
          Nenhum aluno cadastrado ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alunos.map(a => (
            <button key={a.id} onClick={() => setAlunoAberto(a)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)',
              background: 'var(--color-surface-light-raised)', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)' }}>{a.nome}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                  {a.tipo_cobranca === 'fixo'
                    ? `Fixo · R$ ${Number(a.valor_fixo || 0).toFixed(2)}`
                    : `Por aula · R$ ${Number(a.valor_aula || 0).toFixed(2)}`}
                  {a.direito_reposicao ? ' · com reposição' : ' · sem reposição'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {form && (
        <Modal open onClose={() => setForm(null)} title="Novo aluno" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><div style={labelStyle}>Nome</div>
              <input style={inputStyle} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus /></div>
            <div><div style={labelStyle}>Telefone</div>
              <input style={inputStyle} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            <div>
              <div style={labelStyle}>Cobrança</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'por_aula', l: 'Por aula' }, { v: 'fixo', l: 'Fixo' }].map(o => (
                  <button key={o.v} onClick={() => setForm(f => ({ ...f, tipo_cobranca: o.v }))} style={{
                    flex: 1, padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    border: `1px solid ${form.tipo_cobranca === o.v ? 'var(--color-action-primary)' : 'var(--border)'}`,
                    background: form.tipo_cobranca === o.v ? 'rgba(165,76,46,0.12)' : 'var(--surface)',
                    color: form.tipo_cobranca === o.v ? 'var(--color-action-primary)' : 'var(--text-secondary)',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div><div style={labelStyle}>Valor (R$)</div>
              <input type="number" style={inputStyle}
                value={form.tipo_cobranca === 'fixo' ? form.valor_fixo : form.valor_aula}
                onChange={e => setForm(f => ({ ...f, [form.tipo_cobranca === 'fixo' ? 'valor_fixo' : 'valor_aula']: e.target.value }))} /></div>
            <div><div style={labelStyle}>Dia de vencimento (opcional)</div>
              <input type="number" min="1" max="31" style={inputStyle}
                value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.direito_reposicao} onChange={e => setForm(f => ({ ...f, direito_reposicao: e.target.checked }))} />
              Direito a reposição
            </label>
            <button onClick={handleSalvar} disabled={salvarAluno.isPending} style={{
              padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>{salvarAluno.isPending ? 'Salvando...' : 'Cadastrar'}</button>
          </div>
        </Modal>
      )}

      {alunoAberto && (
        <FichaAluno aluno={alunoAberto} modalidadeId={modalidadeTenisId} onFechar={() => setAlunoAberto(null)} />
      )}
    </div>
  )
}

function FichaAluno({ aluno, modalidadeId, onFechar }) {
  const [subAba, setSubAba] = useState('dados')
  const { perfil } = useAppStore()
  const { data: dimensoes } = useDimensoesModalidade(modalidadeId)
  const { data: avaliacoes, isLoading: loadingAvaliacoes } = useAvaliacoesModalidade(aluno.id, modalidadeId)
  const { data: presencas, isLoading: loadingPresencas } = useHistoricoPresencaModalidade(aluno.id, modalidadeId, 'Tênis')
  const navigate = useNavigate()

  return (
    <Modal open onClose={onFechar} title={aluno.nome} size="lg">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: 'var(--surface)', borderRadius: '10px', padding: '4px' }}>
        {[{ id: 'dados', label: 'Dados' }, { id: 'avaliacao', label: 'Avaliação' }].map(t => (
          <button key={t.id} onClick={() => setSubAba(t.id)} style={{
            flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
            background: subAba === t.id ? 'var(--color-action-primary)' : 'transparent',
            color: subAba === t.id ? 'white' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {subAba === 'dados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-primary)' }}>
          <div><b>Telefone:</b> {aluno.telefone || '—'}</div>
          <div><b>Cobrança:</b> {aluno.tipo_cobranca === 'fixo' ? `Fixo · R$ ${Number(aluno.valor_fixo || 0).toFixed(2)}` : `Por aula · R$ ${Number(aluno.valor_aula || 0).toFixed(2)}`}</div>
          <div><b>Reposição:</b> {aluno.direito_reposicao ? 'Com direito' : 'Sem direito'}</div>
          <div><b>Vencimento:</b> {aluno.dia_vencimento ? `Dia ${aluno.dia_vencimento}` : '—'}</div>
        </div>
      )}

      {subAba === 'avaliacao' && (
        loadingAvaliacoes || loadingPresencas ? <Loading /> : !modalidadeId ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Modalidade Tênis não encontrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button
              onClick={() => navigate('/avaliar-aluno', { state: { alunoId: aluno.id, alunoNome: aluno.nome, modalidadeId } })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', alignSelf: 'flex-start',
                padding: '9px 14px', borderRadius: '10px', border: '1px solid var(--color-action-primary)',
                background: 'rgba(165,76,46,0.08)', color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}
            ><Star size={13} /> Lançar avaliação</button>

            {avaliacoes?.length > 0 ? (
              <EvolucaoTecnicaTenis
                aluno={aluno} modalidadeId={modalidadeId} modalidadeNome="Tênis"
                avaliacoes={avaliacoes} presencas={presencas} definicoesDimensoes={dimensoes}
                exportarPdfFn={exportarEvolucaoTecnicaPDFParticular}
                brandingParams={{ nomeProfissional: perfil?.nome }}
              />
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                Nenhuma avaliação lançada ainda.
              </div>
            )}
          </div>
        )
      )}
    </Modal>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Aba Contratantes
// ──────────────────────────────────────────────────────────────────────

const FORM_CONTRATANTE_VAZIO = { nome: '', tipo: 'aluno', tipo_cobranca: 'por_aula', valor_hora_aula: '', valor_fixo: '' }

function AbaContratantes({ empresaId }) {
  const { data: contratantes = [], isLoading } = useContratantes(empresaId)
  const criar = useCriarContratante()
  const excluir = useExcluirContratante()
  const [form, setForm] = useState(null)

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Preencha o nome')
    try {
      await criar.mutateAsync({
        empresaId, nome: form.nome.trim(), tipo: form.tipo, tipoCobranca: form.tipo_cobranca,
        valorHoraAula: form.tipo_cobranca === 'por_aula' ? Number(form.valor_hora_aula) || null : null,
        valorFixo: form.tipo_cobranca === 'fixo' ? Number(form.valor_fixo) || null : null,
      })
      toast.success('Contratante cadastrado!')
      setForm(null)
    } catch (err) { toast.error(err.message) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      <button onClick={() => setForm(FORM_CONTRATANTE_VAZIO)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px',
        padding: '9px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'var(--color-action-primary)', color: 'white', fontSize: '13px', fontWeight: '600',
      }}>
        <Plus size={14} /> Novo contratante
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {contratantes.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)',
            background: 'var(--color-surface-light-raised)',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)' }}>{c.nome}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                {c.tipo === 'aluno' ? 'Cobra do aluno' : 'Cobra direto (terceiro)'}
                {c.tipo_cobranca && ` · ${c.tipo_cobranca === 'fixo' ? `Fixo R$ ${Number(c.valor_fixo || 0).toFixed(2)}` : `R$ ${Number(c.valor_hora_aula || 0).toFixed(2)}/aula`}`}
              </div>
            </div>
            {c.nome !== 'Particular' && (
              <button onClick={() => excluir.mutate(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-state-danger)', fontSize: '11px' }}>Remover</button>
            )}
          </div>
        ))}
      </div>

      {form && (
        <Modal open onClose={() => setForm(null)} title="Novo contratante" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><div style={labelStyle}>Nome (ex: Beyond, Clube Pinheiros)</div>
              <input style={inputStyle} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus /></div>
            <div>
              <div style={labelStyle}>Tipo</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'aluno', l: 'Cobra do aluno' }, { v: 'terceiro', l: 'Cobra direto (terceiro)' }].map(o => (
                  <button key={o.v} onClick={() => setForm(f => ({ ...f, tipo: o.v }))} style={{
                    flex: 1, padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    border: `1px solid ${form.tipo === o.v ? 'var(--color-action-primary)' : 'var(--border)'}`,
                    background: form.tipo === o.v ? 'rgba(165,76,46,0.12)' : 'var(--surface)',
                    color: form.tipo === o.v ? 'var(--color-action-primary)' : 'var(--text-secondary)',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Cobrança</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'por_aula', l: 'Por aula' }, { v: 'fixo', l: 'Fixo' }].map(o => (
                  <button key={o.v} onClick={() => setForm(f => ({ ...f, tipo_cobranca: o.v }))} style={{
                    flex: 1, padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    border: `1px solid ${form.tipo_cobranca === o.v ? 'var(--color-action-primary)' : 'var(--border)'}`,
                    background: form.tipo_cobranca === o.v ? 'rgba(165,76,46,0.12)' : 'var(--surface)',
                    color: form.tipo_cobranca === o.v ? 'var(--color-action-primary)' : 'var(--text-secondary)',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div><div style={labelStyle}>Valor (R$)</div>
              <input type="number" style={inputStyle}
                value={form.tipo_cobranca === 'fixo' ? form.valor_fixo : form.valor_hora_aula}
                onChange={e => setForm(f => ({ ...f, [form.tipo_cobranca === 'fixo' ? 'valor_fixo' : 'valor_hora_aula']: e.target.value }))} /></div>
            <button onClick={handleSalvar} disabled={criar.isPending} style={{
              padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--color-action-primary)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>{criar.isPending ? 'Salvando...' : 'Cadastrar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
