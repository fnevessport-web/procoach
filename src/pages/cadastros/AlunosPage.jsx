import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, MessageCircle, Pencil, Camera, X, Search, Users, UserRound } from 'lucide-react'
import {
  useAlunos, useSalvarAluno, useExcluirAluno,
  useFamiliaAluno, useSalvarVinculoFamilia, useExcluirVinculoFamilia,
} from '../../hooks/useAlunos'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const NIVEIS_ALUNO = [
  'Iniciante 1', 'Iniciante 2',
  'Intermediário 1', 'Intermediário 2',
  'Avançado',
  'Kids Iniciante', 'Kids Intermediário', 'Kids Avançado',
]

const TIPOS_VINCULO = [
  { value: 'conjuge', label: 'Cônjuge' },
  { value: 'filho', label: 'Filho(a)' },
  { value: 'responsavel', label: 'Responsável' },
]

const FORM_VAZIO = {
  nome: '', telefone: '', multiclubes_id: '',
  menor_idade: false, nome_responsavel: '', nivel: '',
  cpf: '', data_nascimento: '', email: '', foto_url: '',
}

export function AlunosPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { modalidadeSelecionada } = useAppStore()
  const { data: alunos, isLoading, refetch } = useAlunos(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const salvar = useSalvarAluno()
  const excluir = useExcluirAluno()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [modalidadesSelecionadas, setModalidadesSelecionadas] = useState([])
  const [salvandoMods, setSalvandoMods] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const fotoInputRef = useRef(null)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function toggleModalidade(id) {
    setModalidadesSelecionadas(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function abrirCriar() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalidadesSelecionadas([])
    setModal(true)
  }

  async function abrirEditar(aluno) {
    setEditando(aluno)
    setForm({
      nome: aluno.nome || '',
      telefone: aluno.telefone || '',
      multiclubes_id: aluno.multiclubes_id || '',
      menor_idade: aluno.menor_idade || false,
      nome_responsavel: aluno.nome_responsavel || '',
      nivel: aluno.nivel || '',
      cpf: aluno.cpf || '',
      data_nascimento: aluno.data_nascimento || '',
      email: aluno.email || '',
      foto_url: aluno.foto_url || '',
    })
    const { data } = await supabase
      .from('alunos_modalidades')
      .select('modalidade_id')
      .eq('aluno_id', aluno.id)
    setModalidadesSelecionadas(data?.map(m => m.modalidade_id) || [])
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (form.menor_idade && !form.nome_responsavel.trim()) return toast.error('Nome do responsável é obrigatório')
    setSalvandoMods(true)
    try {
      const result = await salvar.mutateAsync({
        id: editando?.id,
        nome: form.nome,
        telefone: form.telefone,
        multiclubes_id: form.multiclubes_id,
        menor_idade: form.menor_idade,
        nome_responsavel: form.menor_idade ? form.nome_responsavel : null,
        nivel: form.nivel || null,
        cpf: form.cpf || null,
        data_nascimento: form.data_nascimento || null,
        email: form.email || null,
        modalidade_id: modalidadesSelecionadas[0] || null,
      })

      const alunoId = result?.id || editando?.id

      if (alunoId && modalidadesSelecionadas.length > 0) {
        await supabase.from('alunos_modalidades').delete().eq('aluno_id', alunoId)
        await supabase.from('alunos_modalidades').insert(
          modalidadesSelecionadas.map(mid => ({ aluno_id: alunoId, modalidade_id: mid }))
        )
      }

      toast.success(editando ? 'Aluno atualizado!' : 'Aluno cadastrado!')
      setModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvandoMods(false)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este aluno?')) return
    try {
      await excluir.mutateAsync(id)
      toast.success('Aluno removido')
    } catch (err) { toast.error(err.message) }
  }

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !editando?.id) return
    setUploadandoFoto(true)
    e.target.value = ''
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `alunos/${editando.id}/foto_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      const { error } = await supabase.from('alunos').update({ foto_url: publicUrl }).eq('id', editando.id)
      if (error) throw error
      update('foto_url', publicUrl)
      qc.invalidateQueries({ queryKey: ['alunos'] })
      qc.invalidateQueries({ queryKey: ['aluno_completo', editando.id] })
      toast.success('Foto atualizada!')
    } catch (err) {
      toast.error('Erro ao subir foto: ' + err.message)
    } finally {
      setUploadandoFoto(false)
    }
  }

  function abrirWhatsApp(telefone) {
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank')
  }

  const filtrados = alunos?.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{ ...inputStyle, paddingLeft: '36px' }}
            placeholder="Buscar aluno..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <Search size={14} color="var(--color-text-light-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
        <button onClick={abrirCriar} style={{
          padding: '10px 16px', borderRadius: '10px', border: 'none',
          background: 'var(--color-action-primary)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Novo</button>
      </div>

      {isLoading ? <Loading /> : !filtrados?.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Users size={40} color="var(--color-text-light-secondary)" style={{ marginBottom: '8px' }} />
          <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px', marginBottom: '16px' }}>Nenhum aluno cadastrado</p>
          <button onClick={abrirCriar} style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>+ Adicionar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(aluno => (
            <div key={aluno.id} style={{
              backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px',
              border: '1px solid rgba(30,43,36,0.06)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div onClick={() => navigate(`/cadastros/alunos/${aluno.id}`)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '8px', flexShrink: 0, overflow: 'hidden',
                  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {aluno.foto_url
                    ? <img src={aluno.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light-secondary)' }}>{aluno.nome?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-text-light-primary)', fontSize: '14px' }}>{aluno.nome}</span>
                    {aluno.menor_idade && (
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(165,76,46,0.15)', color: 'var(--color-action-primary)' }}>menor</span>
                    )}
                    {aluno.nivel && (
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(61,107,122,0.15)', color: 'var(--color-state-info)' }}>{aluno.nivel}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                    {aluno.modalidades?.nome || '—'}
                    {aluno.menor_idade && aluno.nome_responsavel && (
                      <span style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <UserRound size={11} /> {aluno.nome_responsavel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {aluno.telefone && (
                  <button onClick={() => abrirWhatsApp(aluno.telefone)} style={{
                    padding: '6px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'rgba(37,211,102,0.15)', color: '#25D166', cursor: 'pointer',
                  }}>
                    <MessageCircle size={14} />
                  </button>
                )}
                <button onClick={() => abrirEditar(aluno)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(165,76,46,0.12)', color: 'var(--color-action-primary)', cursor: 'pointer',
                }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleExcluir(aluno.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer',
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Aluno' : 'Novo Aluno'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {editando && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <div style={{ position: 'relative', width: 76, height: 76 }}>
                <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadFoto} />
                <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--color-action-primary)', padding: '2px', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--color-surface-light-overlay)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {form.foto_url
                      ? <img src={form.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <SilhuetaAlunoPequena />
                    }
                  </div>
                </div>
                <button onClick={() => fotoInputRef.current?.click()} style={{
                  position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%',
                  border: 'none', backgroundColor: 'var(--color-action-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {uploadandoFoto ? '...' : <Camera size={12} color="var(--color-surface-light-overlay)" />}
                </button>
              </div>
            </div>
          )}

          <Input label="Nome completo *" placeholder="Nome do aluno"
            value={form.nome} onChange={e => update('nome', e.target.value)} />

          <Input label="Telefone (WhatsApp)" placeholder="(11) 99999-9999"
            value={form.telefone} onChange={e => update('telefone', e.target.value)} />

          <Input label="E-mail" placeholder="email@exemplo.com" type="email"
            value={form.email} onChange={e => update('email', e.target.value)} />

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Input label="CPF" placeholder="000.000.000-00"
                value={form.cpf} onChange={e => update('cpf', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Data de nascimento" type="date"
                value={form.data_nascimento} onChange={e => update('data_nascimento', e.target.value)} />
            </div>
          </div>

          <Input label="ID MultiClubes (opcional)" placeholder="ID da plataforma"
            value={form.multiclubes_id} onChange={e => update('multiclubes_id', e.target.value)} />

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '8px' }}>Nível (opcional)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {NIVEIS_ALUNO.map(n => (
                <button key={n} onClick={() => update('nivel', form.nivel === n ? '' : n)} style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                  background: form.nivel === n ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
                  outline: form.nivel === n ? 'none' : '1px solid var(--color-border-light)',
                  color: form.nivel === n ? 'white' : 'var(--color-text-light-secondary)',
                  fontSize: '12px', cursor: 'pointer', fontWeight: form.nivel === n ? '600' : '400',
                }}>{n}</button>
              ))}
            </div>
          </div>

          <button onClick={() => update('menor_idade', !form.menor_idade)} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '10px', border: 'none',
            background: form.menor_idade ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-overlay)',
            outline: form.menor_idade ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)',
            color: form.menor_idade ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
            cursor: 'pointer', width: '100%', boxSizing: 'border-box', textAlign: 'left',
          }}>
            <span style={{ fontSize: '16px' }}>{form.menor_idade ? '✓' : '○'}</span>
            <span style={{ fontSize: '13px' }}>Menor de idade</span>
          </button>

          {form.menor_idade && (
            <Input label="Nome do responsável *" placeholder="Nome do pai/mãe/responsável"
              value={form.nome_responsavel} onChange={e => update('nome_responsavel', e.target.value)} />
          )}

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '8px' }}>
              Modalidades ({modalidadesSelecionadas.length} selecionadas)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {modalidades?.map(m => (
                <button key={m.id} onClick={() => toggleModalidade(m.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '10px', border: 'none',
                  background: modalidadesSelecionadas.includes(m.id) ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-overlay)',
                  outline: modalidadesSelecionadas.includes(m.id) ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)',
                  color: modalidadesSelecionadas.includes(m.id) ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
                  cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                }}>
                  <span style={{ fontSize: '13px' }}>{m.nome}</span>
                  <span style={{ fontSize: '16px' }}>{modalidadesSelecionadas.includes(m.id) ? '✓' : '+'}</span>
                </button>
              ))}
            </div>
          </div>

          {editando && <SecaoFamilia alunoId={editando.id} alunos={alunos} />}

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setModal(false)} style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
              color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvar.isPending || salvandoMods} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>{salvar.isPending || salvandoMods ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SilhuetaAlunoPequena() {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" fill="var(--color-text-light-muted)">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M12 13.5c-5.2 0-8.8 2.9-8.8 6.4V21h17.6v-1.1c0-3.5-3.6-6.4-8.8-6.4z" />
    </svg>
  )
}

// Seção "Vínculos familiares" dentro do formulário de edição — lista os vínculos já
// cadastrados (com opção de remover) e um mini-formulário pra adicionar um novo.
// A busca por aluno cadastrado é opcional: se o admin escolher um resultado, o vínculo
// fica navegável no card; se não escolher, salva só o nome digitado.
function SecaoFamilia({ alunoId, alunos }) {
  const { data: vinculos, isLoading } = useFamiliaAluno(alunoId)
  const salvarVinculo = useSalvarVinculoFamilia()
  const excluirVinculo = useExcluirVinculoFamilia()

  const [nomeVinculo, setNomeVinculo] = useState('')
  const [tipoVinculo, setTipoVinculo] = useState('conjuge')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [alunoVinculado, setAlunoVinculado] = useState(null)

  const sugestoes = buscaAluno.length >= 2
    ? (alunos || []).filter(a => a.id !== alunoId && a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 6)
    : []

  function selecionarAlunoVinculado(aluno) {
    setAlunoVinculado(aluno)
    setBuscaAluno(aluno.nome)
    if (!nomeVinculo.trim()) setNomeVinculo(aluno.nome)
  }

  async function handleAdicionar() {
    if (!nomeVinculo.trim()) return toast.error('Informe o nome do vínculo')
    try {
      await salvarVinculo.mutateAsync({
        alunoId,
        vinculoAlunoId: alunoVinculado?.id || null,
        nomeVinculo: nomeVinculo.trim(),
        tipoVinculo,
      })
      setNomeVinculo('')
      setBuscaAluno('')
      setAlunoVinculado(null)
      toast.success('Vínculo adicionado!')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleRemover(id) {
    try {
      await excluirVinculo.mutateAsync({ id, alunoId })
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginBottom: '8px' }}>Família</div>

      {isLoading ? <Loading /> : vinculos?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {vinculos.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
            }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-light-primary)' }}>
                {v.nome_vinculo}
                <span style={{ fontSize: '11px', color: 'var(--color-text-light-secondary)', marginLeft: '8px' }}>
                  {TIPOS_VINCULO.find(t => t.value === v.tipo_vinculo)?.label || v.tipo_vinculo}
                  {v.vinculo_aluno_id && ' · vinculado a aluno'}
                </span>
              </div>
              <button onClick={() => handleRemover(v.id)} style={{
                padding: '4px', borderRadius: '6px', border: 'none', background: 'none', color: 'var(--color-state-danger)', cursor: 'pointer',
              }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '10px', borderRadius: '10px', border: '1px dashed var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Input placeholder="Nome" value={nomeVinculo} onChange={e => setNomeVinculo(e.target.value)} />

        <Select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)}>
          {TIPOS_VINCULO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>

        <div style={{ position: 'relative' }}>
          <Input
            placeholder="Buscar aluno cadastrado (opcional)"
            value={buscaAluno}
            onChange={e => { setBuscaAluno(e.target.value); setAlunoVinculado(null) }}
          />
          {sugestoes.length > 0 && !alunoVinculado && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', zIndex: 10,
              backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', borderRadius: '10px',
              maxHeight: '160px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {sugestoes.map(a => (
                <button key={a.id} onClick={() => selecionarAlunoVinculado(a)} style={{
                  display: 'block', width: '100%', padding: '8px 10px', border: 'none',
                  background: 'none', color: 'var(--color-text-light-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                }}>
                  {a.nome}
                </button>
              ))}
            </div>
          )}
          {alunoVinculado && (
            <div style={{ fontSize: '11px', color: 'var(--color-state-success)', marginTop: '4px' }}>
              ✓ Vinculado a {alunoVinculado.nome} — vai aparecer clicável no card
            </div>
          )}
        </div>

        <button onClick={handleAdicionar} disabled={salvarVinculo.isPending} style={{
          padding: '9px', borderRadius: '8px', border: 'none',
          background: 'rgba(165,76,46,0.12)', color: 'var(--color-action-primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
        }}>
          {salvarVinculo.isPending ? 'Adicionando...' : '+ Adicionar vínculo'}
        </button>
      </div>
    </div>
  )
}
