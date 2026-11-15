import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Medal, Plus, ChevronRight, CalendarDays, MapPin, Presentation, Copy, ExternalLink, MoreVertical, RotateCcw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normalizar } from '../../lib/campeonato'
import { rotuloStatusCampeonato } from './util'
import { resetarCampeonato } from './resetar'
import './campeonato.css'

// Aba CAMPEONATOS (gestão). Lista os torneios e cria novos. Cada torneio abre em
// /campeonatos/:id (CampeonatoAdminPage). Contexto escuro, como Ranking.

function gerarSlug(nome, data) {
  const base = normalizar(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base}-${(data || '').slice(0, 4) || new Date().getFullYear()}`
}

export function CampeonatosPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [criando, setCriando] = useState(false)
  const [resetando, setResetando] = useState(null)
  const [form, setForm] = useState({ nome: '', data: '', local: 'Beyond The Club', quadras: 'Quadra 3, Quadra 4', hora_inicio: '09:30' })

  const { data: lista = [], isLoading, error } = useQuery({
    queryKey: ['campeonatos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campeonatos').select('*').order('data', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const criar = async () => {
    if (!form.nome.trim()) return toast.error('Dê um nome ao campeonato')
    const ativo = lista.find(c => ['sorteio', 'em_andamento'].includes(c.status))
    if (ativo && !window.confirm(`O torneio "${ativo.nome}" ainda está ${ativo.status === 'sorteio' ? 'no sorteio' : 'em andamento'}. Criar outro torneio ao mesmo tempo?\n\nSe a ideia é recomeçar o mesmo torneio, cancele e use o menu ⋮ > Resetar torneio.`)) return
    const { data, error } = await supabase.from('campeonatos').insert({
      nome: form.nome.trim(),
      slug: gerarSlug(form.nome, form.data),
      data: form.data || null,
      local: form.local || null,
      quadras: form.quadras.split(',').map(s => s.trim()).filter(Boolean),
      hora_inicio: form.hora_inicio || '09:00',
    }).select().single()
    if (error) return toast.error(error.message.includes('duplicate') ? 'Já existe um campeonato com esse nome neste ano' : error.message)
    qc.invalidateQueries({ queryKey: ['campeonatos'] })
    navigate(`/campeonatos/${data.id}`)
  }

  const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 14 }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 4px 40px', color: 'var(--color-text-dark-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Medal size={26} color="var(--color-brand-lima)" />
        <div style={{ flex: 1 }}>
          <h1 className="cp-display" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Campeonatos</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)' }}>Sorteio ao vivo, chave, placar em tempo real, link do associado e telão.</div>
        </div>
        <button onClick={() => setCriando(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} />Novo
        </button>
      </div>

      {/* Link público da página de apresentação, para enviar a clubes e parceiros. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderRadius: 14, marginBottom: 18, border: '1px solid var(--color-brand-lima)', backgroundColor: 'color-mix(in srgb, var(--color-brand-lima) 8%, var(--color-surface-dark-raised))' }}>
        <Presentation size={22} color="var(--color-brand-lima)" />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Apresentação do sistema</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-dark-secondary)' }}>Página com vídeo, prints e tudo que a aba Campeonatos faz. Envie para quem quiser.</div>
        </div>
        <button onClick={() => window.open('/apresentacao-campeonatos', '_blank')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontWeight: 700, cursor: 'pointer' }}><ExternalLink size={15} />Abrir</button>
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apresentacao-campeonatos`); toast.success('Link copiado') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 700, cursor: 'pointer' }}><Copy size={15} />Copiar link</button>
      </div>

      {criando && (
        <div style={{ padding: 16, borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', marginBottom: 18, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ gridColumn: '1 / -1' }}><Rotulo>Nome</Rotulo><input style={input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Torneio de Simples Kids" /></label>
          <label><Rotulo>Data</Rotulo><input type="date" style={input} value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></label>
          <label><Rotulo>Local</Rotulo><input style={input} value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} /></label>
          <label><Rotulo>Quadras (separadas por vírgula)</Rotulo><input style={input} value={form.quadras} onChange={e => setForm({ ...form, quadras: e.target.value })} /></label>
          <label><Rotulo>Primeiro jogo</Rotulo><input type="time" style={input} value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} /></label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={criar} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', fontWeight: 700, cursor: 'pointer' }}>Criar campeonato</button>
          </div>
        </div>
      )}

      {isLoading && <div style={{ color: 'var(--color-text-dark-muted)' }}>Carregando...</div>}
      {error && (
        <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--color-state-warning)', color: 'var(--color-state-warning)', fontSize: 14 }}>
          Não foi possível carregar os campeonatos. Se for a primeira vez, rode o script scripts/2026-11-07_campeonatos.sql no Supabase.
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {lista.map(c => {
          const [txt, cor] = rotuloStatusCampeonato(c.status)
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'stretch', borderRadius: 14, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)' }}>
            <button onClick={() => navigate(`/campeonatos/${c.id}`)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, textAlign: 'left', cursor: 'pointer', backgroundColor: 'transparent', border: 'none', color: 'inherit' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cp-display" style={{ fontSize: 20, fontWeight: 700 }}>{c.nome}</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-text-dark-secondary)', marginTop: 4 }}>
                  {c.data && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={13} />{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  {c.local && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} />{c.local}</span>}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: cor }}>{txt}</span>
              <ChevronRight size={18} color="var(--color-text-dark-muted)" />
            </button>
            <button onClick={() => setResetando(c)} title="Mais opções" aria-label="Mais opções" style={{ width: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderLeft: '1px solid var(--color-border-dark-subtle)', background: 'none', color: 'var(--color-text-dark-secondary)', cursor: 'pointer', borderRadius: '0 14px 14px 0' }}>
              <MoreVertical size={18} />
            </button>
            </div>
          )
        })}
        {!isLoading && !error && !lista.length && <div style={{ color: 'var(--color-text-dark-muted)', fontSize: 14 }}>Nenhum campeonato ainda.</div>}
      </div>
      {resetando && <ModalResetar campeonato={resetando} onFechar={() => setResetando(null)} onFeito={() => { setResetando(null); qc.invalidateQueries({ queryKey: ['campeonatos'] }) }} />}
    </div>
  )
}

function Rotulo({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{children}</div>
}

// Pop-up do menu ⋮: recomeçar o torneio do zero, mantendo só os inscritos.
function ModalResetar({ campeonato, onFechar, onFeito }) {
  const [op, setOp] = useState({ checkins: true, fotos: true, telefones: true })
  const [texto, setTexto] = useState('')
  const [rodando, setRodando] = useState(false)
  const resetar = async () => {
    setRodando(true)
    try {
      const r = await resetarCampeonato(campeonato.id, op)
      toast.success('Torneio zerado. Só ficaram os inscritos.')
      if (op.telefones && r.semPermissao) toast('Os WhatsApps informados pelo celular não foram apagados: falta rodar o SQL 2026-11-15c_campeonato_resetar.sql.', { icon: '⚠️', duration: 7000 })
      onFeito()
    } catch (e) {
      toast.error(e.message || 'Não foi possível resetar')
    } finally {
      setRodando(false)
    }
  }
  const opcao = (k, titulo, sub) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', backgroundColor: 'var(--color-surface-dark-overlay)' }}>
      <input type="checkbox" checked={op[k]} onChange={e => setOp({ ...op, [k]: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--color-action-primary)' }} />
      <span><b style={{ fontSize: 14 }}>{titulo}</b><br /><span style={{ fontSize: 12, color: 'var(--color-text-dark-secondary)' }}>{sub}</span></span>
    </label>
  )
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'color-mix(in srgb, var(--color-surface-dark-base) 80%, transparent)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, padding: 20, borderRadius: 18, backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', color: 'var(--color-text-dark-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <RotateCcw size={20} color="var(--color-state-danger)" />
          <div className="cp-display" style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>Resetar torneio</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--color-text-dark-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-dark-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          <b>{campeonato.nome}</b> volta para o começo, como se nada tivesse acontecido. <b>Os inscritos continuam</b> (nomes e os telefones da planilha). Sempre apaga: sorteio, duplas, jogos e placares.
        </div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          {opcao('checkins', 'Check-ins', 'Todos voltam para "ainda não chegou".')}
          {opcao('fotos', 'Fotos', 'Apaga as fotos; cada atleta manda de novo pelo celular.')}
          {opcao('telefones', 'WhatsApps informados pelo celular', 'Apaga os números que os atletas digitaram no link (os da planilha ficam).')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-dark-secondary)', marginBottom: 6 }}>Para confirmar, digite <b>ZERAR</b>:</div>
        <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: 15, marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--color-border-dark)', background: 'none', color: 'var(--color-text-dark-secondary)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={resetar} disabled={texto.trim().toUpperCase() !== 'ZERAR' || rodando} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', backgroundColor: 'var(--color-state-danger)', color: 'var(--color-text-dark-primary)', fontWeight: 800, cursor: 'pointer', opacity: texto.trim().toUpperCase() !== 'ZERAR' || rodando ? 0.45 : 1 }}>
            {rodando ? 'Zerando...' : 'Zerar tudo'}
          </button>
        </div>
      </div>
    </div>
  )
}
