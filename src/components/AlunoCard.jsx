import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Camera, MessageCircle, ChevronRight, ClipboardList } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  useAlunoCompleto, useHistoricoNivel,
  useDimensoesModalidade, useAvaliacoesModalidade, useHistoricoPresencaModalidade,
} from '../hooks/useAlunos'
import { useReposicoesDoAluno } from '../hooks/useAulas'
import { calcStatusPorPrazo } from '../constants/reposicao'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Loading, EmptyState } from './ui/Loading'
import { PainelReposicoesAluno } from './PainelReposicoesAluno'
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

const BADGES = {
  primeira_aula: { emoji: '🎉', label: 'Primeira aula' },
  '10_aulas': { emoji: '🔟', label: '10 aulas' },
  evoluiu_nivel: { emoji: '📈', label: 'Evoluiu de nível' },
  '3_meses_sem_falta': { emoji: '🏆', label: '3 meses sem falta' },
}

const STATUS_PRESENCA_LABEL = {
  presente: { label: 'Presente', cor: '#22c55e' },
  falta: { label: 'Falta', cor: '#EF4444' },
  falta_justificada: { label: 'Falta Just.', cor: '#f97316' },
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
            {aluno.menor_idade && (
              <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '5px', backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825', fontWeight: '600' }}>
                menor de idade
              </span>
            )}
            {aluno.badges.map(b => {
              const info = BADGES[b.tipo_badge]
              if (!info) return null
              return (
                <span key={b.id} title={info.label} style={{
                  fontSize: '10px', padding: '2px 7px', borderRadius: '5px',
                  backgroundColor: 'rgba(255,255,255,0.06)', color: '#F0F2F5', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '3px',
                }}>
                  {info.emoji} {info.label}
                </span>
              )
            })}
          </div>
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

      {/* Minhas Reposições */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: '700' }}>
          Minhas Reposições
        </div>
        <PainelReposicoesAluno alunoId={alunoId} alunoNome={aluno.nome} />
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

function SecaoTitulo({ children }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
      {children}
    </div>
  )
}

function CardVazio({ texto }) {
  return (
    <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#111', border: '1px dashed #2a2a2a', textAlign: 'center', fontSize: '12px', color: '#555' }}>
      {texto}
    </div>
  )
}

function ModalDetalheModalidade({ aluno, modalidade, onClose }) {
  const navigate = useNavigate()
  const cor = modalidade.cor_hex || '#fcc825'

  const { data: historicoNivel, isLoading: loadingNivel } = useHistoricoNivel(aluno.id, modalidade.id)
  const { data: dimensoes } = useDimensoesModalidade(modalidade.id)
  const { data: avaliacoes, isLoading: loadingAvaliacoes } = useAvaliacoesModalidade(aluno.id, modalidade.id)
  const { data: presencas, isLoading: loadingPresencas } = useHistoricoPresencaModalidade(aluno.id, modalidade.id, modalidade.nome)
  const { data: reposicoesTodas } = useReposicoesDoAluno(aluno.id)

  const ultimaAvaliacao = avaliacoes?.length ? avaliacoes[avaliacoes.length - 1] : null
  const reposicoesModalidade = (reposicoesTodas || []).filter(r => r.modalidades?.id === modalidade.id)

  const radarData = (dimensoes || []).map(d => ({
    dimensao: d.nome_dimensao,
    valor: ultimaAvaliacao?.dimensoes?.[d.nome_dimensao] ?? 0,
  }))

  const evolucaoData = (avaliacoes || []).map(a => ({
    data: format(new Date(a.data_avaliacao + 'T12:00'), 'dd/MM', { locale: ptBR }),
    nota: a.nota_geral,
  }))

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

        <button
          onClick={() => navigate('/avaliar-aluno', { state: { alunoId: aluno.id, alunoNome: aluno.nome, modalidadeId: modalidade.id } })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '11px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          <ClipboardList size={15} /> Avaliar aluno
        </button>

        {/* Perfil técnico — radar da última avaliação */}
        <div>
          <SecaoTitulo>Perfil técnico</SecaoTitulo>
          {loadingAvaliacoes ? <Loading /> : !ultimaAvaliacao ? (
            <CardVazio texto="Nenhuma avaliação técnica ainda nesta modalidade" />
          ) : (
            <div style={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid #2a2a2a', padding: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 10px' }}>
                <span style={{ fontSize: '11px', color: '#555' }}>{fmtData(ultimaAvaliacao.data_avaliacao)}</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: cor }}>
                  {ultimaAvaliacao.nota_geral != null ? Number(ultimaAvaliacao.nota_geral).toFixed(1) : '—'}
                </span>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="#2a2a2a" />
                    <PolarAngleAxis dataKey="dimensao" tick={{ fill: '#888', fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#444', fontSize: 9 }} axisLine={false} />
                    <Radar dataKey="valor" stroke={cor} fill={cor} fillOpacity={0.35} strokeWidth={2} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#F0F2F5' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              {ultimaAvaliacao.comentario && (
                <div style={{ marginTop: '4px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#1a1a1a', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
                  "{ultimaAvaliacao.comentario}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Evolução da nota geral */}
        {evolucaoData.length > 1 && (
          <div>
            <SecaoTitulo>Evolução da nota geral</SecaoTitulo>
            <div style={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid #2a2a2a', padding: '10px', width: '100%', height: 160 }}>
              <ResponsiveContainer>
                <LineChart data={evolucaoData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="data" tick={{ fill: '#555', fontSize: 10 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#F0F2F5' }} />
                  <Line type="monotone" dataKey="nota" stroke={cor} strokeWidth={2} dot={{ r: 4, fill: cor }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Histórico de nível */}
        <div>
          <SecaoTitulo>Histórico de nível</SecaoTitulo>
          {loadingNivel ? <Loading /> : !historicoNivel?.length ? (
            <CardVazio texto="Nenhum registro de nível ainda nesta modalidade" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {historicoNivel.map((h, i) => (
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

        {/* Histórico de presença */}
        <div>
          <SecaoTitulo>Histórico de presença</SecaoTitulo>
          {loadingPresencas ? <Loading /> : !presencas?.length ? (
            <CardVazio texto="Nenhuma presença registrada ainda nesta modalidade" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
              {presencas.map(p => {
                const info = STATUS_PRESENCA_LABEL[p.status_presenca] || { label: p.status_presenca || '—', cor: '#555' }
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '8px', backgroundColor: '#111', border: '1px solid #2a2a2a',
                  }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{fmtData(p.aulas?.data_aula)}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: info.cor }}>{info.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reposições da modalidade */}
        <div>
          <SecaoTitulo>Reposições</SecaoTitulo>
          {reposicoesModalidade.length === 0 ? (
            <CardVazio texto="Nenhuma reposição registrada nesta modalidade" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {reposicoesModalidade.map(r => {
                const status = calcStatusPorPrazo(r.data_limite)
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '8px', backgroundColor: '#111', border: '1px solid #2a2a2a',
                  }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{fmtData(r.aula_origem?.data_aula)}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: r.status === 'expirada' ? '#555' : r.status === 'agendada' ? '#22c55e' : status.cor, textTransform: 'uppercase' }}>
                      {r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
