import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const BANCOS = [
  'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa Econômica',
  'Nubank', 'Inter', 'C6 Bank', 'BTG', 'Sicredi', 'Sicoob', 'Outro'
]

async function inserirProfessor(payload) {
  const { data, error } = await supabase
    .from('professores')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

async function atualizarProfessor(id, payload) {
  const { data, error } = await supabase
    .from('professores')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

async function removerProfessor(id) {
  const { error } = await supabase
    .from('professores')
    .delete()
    .eq('id', id)
  if (error) throw error
}

const FORM_VAZIO = {
  id: null, nome: '', email: '', telefone: '',
  modalidade_id: '', valor_hora_aula: '', ativo: true,
  banco: '', agencia: '', conta: '', tipo_conta: 'corrente', pix: '',
}

export default function ProfessoresPage() {
  const queryClient = useQueryClient()

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

  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  const fecharModal = useCallback(() => {
    setSalvando(false)
    setRemovendo(false)
    setModalAberto(false)
  }, [])

  function abrirCriar() {
    setSalvando(false)
    setRemovendo(false)
    setModoEdicao(false)
    setForm({ ...FORM_VAZIO })
    setModalAberto(true)
  }

  function abrirEditar(prof) {
    setSalvando(false)
    setRemovendo(false)
    setModoEdicao(true)
    setForm({
      id: prof.id,
      nome: prof.nome || '',
      email: prof.email || '',
      telefone: prof.telefone || '',
      modalidade_id: prof.modalidade_id || '',
      valor_hora_aula: prof.valor_hora_aula || '',
      ativo: prof.ativo !== false,
      banco: prof.banco || '',
      agencia: prof.agencia || '',
      conta: prof.conta || '',
      tipo_conta: prof.tipo_conta || 'corrente',
      pix: prof.pix || '',
    })
    setModalAberto(true)
  }

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function handleSalvar() {
    if (salvando || removendo) return
    if (!form.nome.trim()) {
      alert('Nome é obrigatório.')
      return
    }

    setSalvando(true)

    const payload = {
      nome: form.nome.trim(),
      email: form.email || null,
      telefone: form.telefone || null,
      modalidade_id: form.modalidade_id || null,
      valor_hora_aula: form.valor_hora_aula
        ? parseFloat(String(form.valor_hora_aula).replace(',', '.'))
        : null,
      ativo: form.ativo,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
      tipo_conta: form.tipo_conta || 'corrente',
      pix: form.pix || null,
    }

    try {
      if (modoEdicao) {
        await atualizarProfessor(form.id, payload)
      } else {
        await inserirProfessor(payload)
      }
      queryClient.invalidateQueries({ queryKey: ['professores'] })
      fecharModal()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente.'))
      setSalvando(false)
    }
  }

  async function handleRemover() {
    if (!form.id || salvando || removendo) return
    if (!confirm('Remover este professor?')) return

    setRemovendo(true)

    try {
      await removerProfessor(form.id)
      queryClient.invalidateQueries({ queryKey: ['professores'] })
      fecharModal()
    } catch (err) {
      console.error('Erro ao remover:', err)
      alert('Erro ao remover: ' + (err.message || 'Tente novamente.'))
      setRemovendo(false)
    }
  }

  const ocupado = salvando || removendo

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

      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end justify-center z-50">
          <div className="bg-gray-900 w-full max-w-lg rounded-t-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-2">
              {modoEdicao ? 'Editar Professor' : 'Novo Professor'}
            </h2>

            <input
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Nome completo *"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              disabled={ocupado}
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                placeholder="E-mail"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                disabled={ocupado}
              />
              <input
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                placeholder="Telefone"
                value={form.telefone}
                onChange={e => set('telefone', e.target.value)}
                disabled={ocupado}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                value={form.modalidade_id}
                onChange={e => set('modalidade_id', e.target.value)}
                disabled={ocupado}
              >
                <option value="">Modalidade</option>
                {modalidades.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              <input
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                placeholder="Valor Hora/Aula (R$)"
                type="number"
                value={form.valor_hora_aula}
                onChange={e => set('valor_hora_aula', e.target.value)}
                disabled={ocupado}
              />
            </div>

            <p className="text-gray-400 text-xs font-semibold pt-1">DADOS BANCÁRIOS</p>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                value={form.banco}
                onChange={e => set('banco', e.target.value)}
                disabled={ocupado}
              >
                <option value="">Banco</option>
                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                placeholder="Agência"
                value={form.agencia}
                onChange={e => set('agencia', e.target.value)}
                disabled={ocupado}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                placeholder="Conta"
                value={form.conta}
                onChange={e => set('conta', e.target.value)}
                disabled={ocupado}
              />
              <select
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                value={form.tipo_conta}
                onChange={e => set('tipo_conta', e.target.value)}
                disabled={ocupado}
              >
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </select>
            </div>

            <input
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Chave PIX"
              value={form.pix}
              onChange={e => set('pix', e.target.value)}
              disabled={ocupado}
            />

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={e => set('ativo', e.target.checked)}
                disabled={ocupado}
              />
              Professor ativo
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={fecharModal}
                disabled={ocupado}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              {modoEdicao && (
                <button
                  onClick={handleRemover}
                  disabled={ocupado}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {removendo ? 'Removendo...' : 'Remover'}
                </button>
              )}
              <button
                onClick={handleSalvar}
                disabled={ocupado || !form.nome.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}