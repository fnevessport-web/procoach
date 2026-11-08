import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Medal, Plus, ChevronRight, CalendarDays, MapPin, Presentation, Copy, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normalizar } from '../../lib/campeonato'
import { rotuloStatusCampeonato } from './util'
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
            <button key={c.id} onClick={() => navigate(`/campeonatos/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, textAlign: 'left', cursor: 'pointer', backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)', color: 'inherit' }}>
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
          )
        })}
        {!isLoading && !error && !lista.length && <div style={{ color: 'var(--color-text-dark-muted)', fontSize: 14 }}>Nenhum campeonato ainda.</div>}
      </div>
    </div>
  )
}

function Rotulo({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dark-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{children}</div>
}
