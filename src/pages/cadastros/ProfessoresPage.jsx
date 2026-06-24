import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const MODALIDADES = [
  { id: null, nome: 'Todas' },
]

export default function ProfessoresPage() {
  const queryClient = useQueryClient()

  // Lista
  const { data: professores = [], isLoading } = useQuery({
    queryKey: ['professores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('*, modalidades(nome)')
        .order('nome')
      if (error) throw error
      return data || []
    },
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalidades')
        .select('*')
        .order('nome')
      if (error) throw error
      return data || []
    },
  })

  // Modal state
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [form, setForm] = useState({
    id: null,
    nome: '',
    email: '',
    telefone: '',
    modalidade_id: '',
    valor_hora: '',
    ativo: true,
  })

  function abrirCriar() {
    setForm({ id: null, nome: '', email: '', telefone: '', modalidade_id: '', valor_hora: '', ativo: true })
    setModoEdicao(false)
    setSalvando(false)
    setRemovendo(false)
    setModalAberto(true)
  }

  function abrirEditar(prof) {
    setForm({
      id: prof.id,
      nome: prof.nome || '',
      email: prof.email || '',
      telefone: prof.telefone || '',
      modalidade_id: prof.modalidade_id || '',
      valor_hora: prof.valor_hora || '',
      ativo: prof.ativo !== false,
    })
    setModoEdicao(true)
    setSalvando(false)
    setRemovendo(false)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setSalvando(false)
    setRemovendo(false)
  }

  async function handleSalvar() {
    if (salvando) return
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome,
        email: form.email || null,
        telefone: form.telefone || null,
        modalidade_id: form.modalidade_id || null,
        valor_hora: form.valor_hora ? parseFloat(form.valor_hora) : null,
        ativo: form.ativo,
      }

      if (modoEdicao) {
        const { error } = await supabase
          .from('professores')
          .update(payload)
          .eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('professores')
          .insert(payload)
        if (error) throw error
      }

      await queryClient.invalidateQueries({ queryKey: ['professores'] })
      fecharModal()
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover() {
    if (!form.id || removendo) return
    if (!confirm('Remover este professor?')) return
    setRemovendo(true)
    try {
      const { error } = await supabase
        .from('professores')
        .delete()
        .eq('id', form.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['professores'] })
      fecharModal()
    } catch (err) {
      alert('Erro ao remover: ' + err.message)
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-white">Professores</h1>
        <button
          onClick={abrirCriar}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Novo Professor
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : professores.length === 0 ? (
        <p className="text-gray-400">Nenhum professor cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {professores.map((prof) => (
            <div
              key={prof.id}
              onClick={() => abrirEditar(prof)}
              className="bg-gray-800 rounded-lg p-3 flex justify-between items-center cursor-pointer hover:bg-gray-700"
            >
              <div>
                <p className="text-white font-medium">{prof.nome}</p>
                <p className="text-gray-400 text-sm">{prof.modalidades?.nome || '—'}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${prof.ativo ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {prof.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end justify-center z-50">
          <div className="bg-gray-900 w-full max-w-lg rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white">
              {modoEdicao ? 'Editar Professor' : 'Novo Professor'}
            </h2>

            <input
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Nome *"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
            <input
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
            <select
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              value={form.modalidade_id}
              onChange={(e) => setForm({ ...form, modalidade_id: e.target.value })}
            >
              <option value="">Modalidade (opcional)</option>
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <input
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Valor por hora (R$)"
              type="number"
              value={form.valor_hora}
              onChange={(e) => setForm({ ...form, valor_hora: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Professor ativo
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={fecharModal}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
              {modoEdicao && (
                <button
                  onClick={handleRemover}
                  disabled={removendo}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {removendo ? 'Removendo...' : 'Remover'}
                </button>
              )}
              <button
                onClick={handleSalvar}
                disabled={salvando || !form.nome}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}