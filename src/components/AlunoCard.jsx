import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Camera, MessageCircle, ChevronRight } from 'lucide-react'
import { useAlunoCompleto, useHistoricoNivel } from '../hooks/useAlunos'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Loading, EmptyState } from './ui/Loading'
import toast from 'react-hot-toast'

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const TIPO_VINCULO_LABEL = {
  conjuge: 'Cônjuge',
  filho: 'Filho(a)',
  responsavel: 'Responsável',
}

// Silhueta padrão quando o aluno não tem foto — mesmo círculo com anel gradiente
// usado no card do professor, só que com um ícone de pessoa no lugar das iniciais.
function SilhuetaAluno({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#0d0d0d">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M12 13.5c-5.2 0-8.8 2.9-8.8 6.4V21h17.6v-1.1c0-3.5-3.6-6.4-8.8-6.4z" />
    </svg>
  )
}

function fmtData(d) {
  return d ? format(new Date(d + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

export function AlunoCard({ alunoId }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: aluno, isLoading } = useAlunoCompleto(alunoId)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const [modalidadeSel, setModalidadeSel] = useState(null)
  const fotoInputRef = useRef(null)

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !alunoId) return
    setUploadandoFoto(true)
    e.target.value = ''
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `alunos/${alunoId}/foto_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
      const { error } = await supabase.from('alunos').update({ foto_url: publicUrl }).eq('id', alunoId)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['aluno_completo', alunoId] })
      qc.invalidateQueries({ queryKey: ['alunos'] })
      toast.success('Foto atualizada!', { style: toastStyle })
    } catch (err) {
      toast.error('Erro ao subir foto: ' + err.message, { style: toastStyle })
    } finally {
      setUploadandoFoto(false)
    }
  }

  function abrirWhatsApp(telefone) {
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank')
  }

  if (isLoading) return <Loading />
  if (!aluno) return <EmptyState icon="🤷" title="Aluno não encontrado" />

  return (
    <div className="fade-in">
      {/* Foto + dados básicos */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
          <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadFoto} />
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', padding: '2px', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#1a1a1a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {aluno.foto_url
                ? <img src={aluno.foto_url} alt={aluno.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <SilhuetaAluno size={40} />
              }
            </div>
          </div>
          <button onClick={() => fotoInputRef.current?.click()} style={{
            position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%',
            border: 'none', backgroundColor: '#fcc825', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {uploadandoFoto ? '...' : <Camera size={13} color="#110f0f" />}
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#F0F2F5', lineHeight: 1.25 }}>
            {aluno.nome}
          </div>
          {aluno.menor_idade && (
            <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', padding: '2px 7px', borderRadius: '5px', backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825', fontWeight: '600' }}>
              menor de idade
            </span>
          )}
          {aluno.telefone && (
            <button onClick={() => abrirWhatsApp(aluno.telefone)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px',
              padding: '5px 10px', borderRadius: '8px', border: 'none',
              backgroundColor: 'rgba(37,211,102,0.12)', color: '#25D166', cursor: 'pointer', fontSize: '12px',
            }}>
              <MessageCircle size={13} /> {aluno.telefone}
            </button>
          )}
        </div>
      </div>

      {/* Dados pessoais */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '14px', border: '1px solid #2a2a2a', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: '700' }}>
          Dados pessoais
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <DadoLinha label="CPF" valor={aluno.cpf} />
          <DadoLinha label="Data de nascimento" valor={fmtData(aluno.data_nascimento)} placeholder="—" mostrarSempre={!!aluno.data_nascimento} />
          <DadoLinha label="E-mail" valor={aluno.email} />
          {aluno.menor_idade && <DadoLinha label="Responsável" valor={aluno.nome_responsavel} />}
        </div>
      </div>

      {/* Família */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: '700' }}>
          Família
        </div>
        {aluno.familia.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#444' }}>Nenhum vínculo cadastrado</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {aluno.familia.map(v => {
              const clicavel = !!v.vinculo_aluno_id
              const conteudo = (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>{v.nome_vinculo}</span>
                    <span style={{ fontSize: '11px', color: '#555', marginLeft: '8px' }}>{TIPO_VINCULO_LABEL[v.tipo_vinculo] || v.tipo_vinculo}</span>
                  </div>
                  {clicavel && <ChevronRight size={16} color="#555" />}
                </>
              )
              return clicavel ? (
                <button key={v.id} onClick={() => navigate(`/cadastros/alunos/${v.vinculo_aluno_id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px',
                  padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  {conteudo}
                </button>
              ) : (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 12px',
                }}>
                  {conteudo}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modalidades */}
      <div>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: '700' }}>
          Modalidades
        </div>
        {aluno.modalidadesDetalhe.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#444' }}>Nenhuma modalidade matriculada</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aluno.modalidadesDetalhe.map(m => {
              const cor = m.cor_hex || '#fcc825'
              return (
                <button key={m.id} onClick={() => setModalidadeSel(m)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  backgroundColor: '#1a1a1a', border: `1px solid ${cor}33`, borderRadius: '12px',
                  padding: '12px 14px', cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                    backgroundColor: `${cor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
                  }}>
                    {m.icone_emoji || '🏅'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: cor, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {m.nome}
                    </div>
                    <div style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600', marginTop: '2px' }}>
                      {m.nivelAtual || 'Nível não definido'}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#555" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {modalidadeSel && (
        <ModalDetalheModalidade
          aluno={aluno}
          modalidade={modalidadeSel}
          onClose={() => setModalidadeSel(null)}
        />
      )}
    </div>
  )
}

function DadoLinha({ label, valor, placeholder = 'Não informado', mostrarSempre }) {
  const temValor = mostrarSempre || (valor && valor !== '—')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: temValor ? '#F0F2F5' : '#444', textAlign: 'right' }}>
        {temValor ? valor : placeholder}
      </span>
    </div>
  )
}

function ModalDetalheModalidade({ aluno, modalidade, onClose }) {
  const { data: historico, isLoading } = useHistoricoNivel(aluno.id, modalidade.id)
  const cor = modalidade.cor_hex || '#fcc825'

  return (
    <Modal open onClose={onClose} title={modalidade.nome} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* Nível atual em destaque */}
        <div style={{
          textAlign: 'center', padding: '20px', borderRadius: '14px',
          backgroundColor: `${cor}12`, border: `1px solid ${cor}33`,
        }}>
          <div style={{ fontSize: '10px', color: cor, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '6px' }}>
            Nível atual
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#F0F2F5' }}>
            {modalidade.nivelAtual || 'Não definido'}
          </div>
          {!modalidade.nivelRegistrado && modalidade.nivelAtual && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
              (estimado a partir do nível geral do aluno — ainda sem histórico próprio desta modalidade)
            </div>
          )}
        </div>

        <DadoLinha label="Data de entrada na modalidade" valor={fmtData(modalidade.dataEntrada?.slice(0, 10))} mostrarSempre={!!modalidade.dataEntrada} />

        {/* Placeholder: histórico de presença (Fase 2/3) */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Histórico de presença
          </div>
          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#111', border: '1px dashed #2a2a2a', textAlign: 'center', fontSize: '12px', color: '#555' }}>
            Em breve: histórico completo de presença
          </div>
        </div>

        {/* Histórico de nível — já funciona de verdade */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Histórico de nível
          </div>
          {isLoading ? <Loading /> : !historico?.length ? (
            <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#111', border: '1px dashed #2a2a2a', textAlign: 'center', fontSize: '12px', color: '#555' }}>
              Nenhum registro de nível ainda nesta modalidade
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {historico.map((h, i) => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '10px',
                  backgroundColor: '#111', border: i === 0 && h.ativo ? `1px solid ${cor}44` : '1px solid #2a2a2a',
                }}>
                  <span style={{ fontSize: '13px', color: '#F0F2F5', fontWeight: '600' }}>{h.nivel}</span>
                  <span style={{ fontSize: '11px', color: '#555' }}>desde {fmtData(h.data_inicio)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
