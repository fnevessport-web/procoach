import { useState } from 'react'
import { Edit2, Trash2, Clock } from 'lucide-react'
import { useHorariosGrade, useHorariosGradeActions } from '../../hooks/useHorariosGrade'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import toast from 'react-hot-toast'

const DIAS = [
  { v: 'segunda', l: 'Seg' }, { v: 'terca', l: 'Ter' }, { v: 'quarta', l: 'Qua' },
  { v: 'quinta', l: 'Qui' }, { v: 'sexta', l: 'Sex' }, { v: 'sabado', l: 'Sáb' }, { v: 'domingo', l: 'Dom' },
]
const TODOS_OS_DIAS = DIAS.map(d => d.v)
const FORM_VAZIO = { horario: '', dias_semana: TODOS_OS_DIAS }

// Cadastro do clube > Horários — a grade de linhas que aparece em Aulas (AulasCoordenador.jsx)
// vem daqui agora, em vez de um array fixo no código. Cada horário tem os dias da semana em que
// aparece como célula clicável na grade (por padrão, todos).
export function HorariosPage() {
  const { data: horarios, isLoading } = useHorariosGrade()
  const { salvar, excluir } = useHorariosGradeActions()

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  function abrirCriar() {
    setEditando(null); setForm(FORM_VAZIO)
    setSalvando(false); setModal(true)
  }

  function abrirEditar(h) {
    setEditando(h)
    setForm({ horario: h.horario?.slice(0, 5) || '', dias_semana: h.dias_semana || TODOS_OS_DIAS })
    setSalvando(false); setModal(true)
  }

  function toggleDia(dia) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(dia) ? f.dias_semana.filter(d => d !== dia) : [...f.dias_semana, dia],
    }))
  }

  async function handleSalvar() {
    if (!form.horario) return toast.error('Escolha um horário')
    if (form.dias_semana.length === 0) return toast.error('Marque pelo menos um dia da semana')
    if (salvando) return
    setSalvando(true)
    try {
      await salvar({ id: editando?.id, horario: form.horario, dias_semana: form.dias_semana })
      toast.success(editando ? 'Horário atualizado!' : 'Horário cadastrado!')
      setModal(false)
    } catch (err) { toast.error('Erro: ' + err.message) }
    finally { setSalvando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este horário da grade?')) return
    try { await excluir(id); toast.success('Horário removido') }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button onClick={abrirCriar} style={{
          padding: '10px 16px', borderRadius: '10px', border: 'none',
          background: 'var(--color-action-primary)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Novo horário</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Carregando...</p>
      ) : !horarios?.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Clock size={40} color="var(--color-text-light-secondary)" style={{ marginBottom: '8px' }} />
          <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Nenhum horário cadastrado</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {horarios.map(h => (
            <div key={h.id} style={{
              backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px',
              border: '1px solid rgba(30,43,36,0.06)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--color-text-light-primary)', fontSize: '14px' }}>{h.horario?.slice(0, 5)}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                  {h.dias_semana?.length === 7 ? 'Todos os dias' : DIAS.filter(d => h.dias_semana?.includes(d.v)).map(d => d.l).join(', ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => abrirEditar(h)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(30,43,36,0.05)', color: 'var(--color-text-light-secondary)', cursor: 'pointer',
                }}><Edit2 size={14} /></button>
                <button onClick={() => handleExcluir(h.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer',
                }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Horário' : 'Novo Horário'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Horário *" type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Dias da semana</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {DIAS.map(d => (
                <button key={d.v} onClick={() => toggleDia(d.v)} style={{
                  padding: '8px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  border: `1px solid ${form.dias_semana.includes(d.v) ? 'var(--color-action-primary)' : 'var(--color-border-light)'}`,
                  background: form.dias_semana.includes(d.v) ? 'rgba(165,76,46,0.12)' : 'transparent',
                  color: form.dias_semana.includes(d.v) ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
                }}>{d.l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setModal(false)} style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
              color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>{salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
