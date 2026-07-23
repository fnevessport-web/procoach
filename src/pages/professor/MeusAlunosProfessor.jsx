import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, Search, StickyNote } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useNiveis } from '../../hooks/useNiveis'
import useAppStore from '../../store/useAppStore'
import { Loading } from '../../components/ui/Loading'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

function useMeusAlunos(professorId) {
  return useQuery({
    queryKey: ['meus_alunos_professor', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas_alunos')
        .select(`
          aluno_id,
          alunos(id, nome, nivel, alerta_nivel, nivel_avaliado_prof, obs_nivel_prof),
          turmas!inner(nome, professor_titular_id, niveis(nome))
        `)
        .eq('ativo', true)
        .eq('turmas.professor_titular_id', professorId)
      if (error) throw error

      const porAluno = {}
      data?.forEach(row => {
        if (!row.alunos) return
        if (!porAluno[row.aluno_id]) porAluno[row.aluno_id] = { ...row.alunos, turmas: [] }
        const turmaNome = row.turmas?.niveis?.nome || row.turmas?.nome
        if (turmaNome && !porAluno[row.aluno_id].turmas.includes(turmaNome)) {
          porAluno[row.aluno_id].turmas.push(turmaNome)
        }
      })
      return Object.values(porAluno).sort((a, b) => a.nome.localeCompare(b.nome))
    },
  })
}

export function MeusAlunosProfessor() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { perfil } = useAppStore()
  const professorId = perfil?.professor_id
  const { data: alunos = [], isLoading } = useMeusAlunos(professorId)
  const { data: todosNiveis } = useNiveis()

  const [busca, setBusca] = useState('')
  const [classificando, setClassificando] = useState(null)
  const [form, setForm] = useState({ nivel: '', obs: '' })
  const [salvando, setSalvando] = useState(false)

  const filtrados = alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))

  function abrirClassificacao(aluno) {
    setClassificando(aluno.id)
    setForm({ nivel: aluno.nivel_avaliado_prof || '', obs: aluno.obs_nivel_prof || '' })
  }

  async function salvarNivel(alunoId) {
    if (!form.nivel) return
    setSalvando(true)
    try {
      const { error } = await supabase.from('alunos').update({
        alerta_nivel: true, nivel_avaliado_prof: form.nivel, obs_nivel_prof: form.obs,
      }).eq('id', alunoId)
      if (error) throw error
      setClassificando(null)
      qc.invalidateQueries({ queryKey: ['meus_alunos_professor', professorId] })
    } finally {
      setSalvando(false)
    }
  }

  async function removerNivel(alunoId) {
    setSalvando(true)
    try {
      await supabase.from('alunos').update({
        alerta_nivel: false, nivel_avaliado_prof: null, obs_nivel_prof: null,
      }).eq('id', alunoId)
      setClassificando(null)
      qc.invalidateQueries({ queryKey: ['meus_alunos_professor', professorId] })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: '16px 0' }}>Meus Alunos</h1>

      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <Search size={14} color="var(--color-text-light-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          style={{ ...inputStyle, paddingLeft: '34px' }}
          placeholder="Buscar aluno..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {isLoading ? <Loading /> : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-light-secondary)', fontSize: '13px' }}>
          {busca ? 'Nenhum aluno encontrado.' : 'Nenhum aluno matriculado nas suas turmas ainda.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(aluno => (
            <div key={aluno.id} style={{
              backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px', padding: '12px 14px',
              border: aluno.alerta_nivel ? '1px solid rgba(165,76,46,0.25)' : '1px solid rgba(30,43,36,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <button
                  onClick={() => navigate(`/cadastros/alunos/${aluno.id}`)}
                  style={{ minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-light-primary)' }}>{aluno.nome}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>{aluno.turmas.join(' · ')}</div>
                </button>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => navigate('/avaliar-aluno', { state: { alunoId: aluno.id, alunoNome: aluno.nome } })}
                    title="Avaliar tecnicamente"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      backgroundColor: 'var(--color-surface-light-overlay)', color: 'var(--color-text-light-secondary)', fontSize: '11px', fontWeight: '600',
                    }}
                  >
                    <ClipboardList size={12} /> Avaliar
                  </button>
                  <button onClick={() => (classificando === aluno.id ? setClassificando(null) : abrirClassificacao(aluno))} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    backgroundColor: aluno.alerta_nivel ? 'rgba(165,76,46,0.15)' : 'var(--color-surface-light-overlay)',
                    color: aluno.alerta_nivel ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)', fontSize: '11px', fontWeight: '600',
                  }}>
                    <AlertTriangle size={12} />
                    {aluno.alerta_nivel ? aluno.nivel_avaliado_prof : 'Classificar nível'}
                  </button>
                </div>
              </div>

              {classificando === aluno.id && (
                <div style={{ marginTop: '10px', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '10px', border: '1px solid var(--color-border-light)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginBottom: '4px' }}>Nível real avaliado</div>
                    <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))} style={inputStyle}>
                      <option value="">Selecione o nível...</option>
                      {todosNiveis?.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginBottom: '4px' }}>Observação (opcional)</div>
                    <textarea
                      placeholder="Ex: Aluno está evoluindo bem, pode subir de turma..."
                      value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                      rows={3} style={{ ...inputStyle, resize: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {aluno.alerta_nivel && (
                      <button onClick={() => removerNivel(aluno.id)} disabled={salvando} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(180,71,47,0.3)',
                        background: 'none', color: 'var(--color-state-danger)', fontSize: '11px', cursor: 'pointer',
                      }}>Remover</button>
                    )}
                    <button onClick={() => setClassificando(null)} style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border-light)',
                      background: 'none', color: 'var(--color-text-light-secondary)', fontSize: '11px', cursor: 'pointer',
                    }}>Cancelar</button>
                    <button onClick={() => salvarNivel(aluno.id)} disabled={salvando || !form.nivel} style={{
                      flex: 2, padding: '8px', borderRadius: '8px', border: 'none',
                      background: 'var(--color-action-primary)', color: 'white',
                      fontSize: '11px', fontWeight: '600', cursor: 'pointer', opacity: !form.nivel ? 0.6 : 1,
                    }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </div>
              )}

              {aluno.alerta_nivel && aluno.obs_nivel_prof && classificando !== aluno.id && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '11px', color: 'var(--color-text-light-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                  <StickyNote size={11} style={{ flexShrink: 0, marginTop: '2px' }} />
                  {aluno.obs_nivel_prof}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
