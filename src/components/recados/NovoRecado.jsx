import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, MessageSquareText, LayoutGrid, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProfessores } from '../../hooks/useProfessores'
import { useEnviarRecado } from '../../hooks/useRecados'
import { PROFESSOR_SUBSTITUTO_ID } from '../../constants/modalidades'
import { nomeProfessor } from '../../lib/nomes'
import { FotoProfessor } from '../ui/FotoProfessor'
import { GradeRecado } from './GradeRecado'

const rotulo = { fontSize: '11px', fontWeight: 700, color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }
const cartao = { backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark)', borderRadius: '14px', padding: '14px', marginBottom: '14px' }

export function NovoRecado({ onFechar }) {
  const { professores = [] } = useProfessores(null)
  const enviar = useEnviarRecado()
  const [paraIds, setParaIds] = useState([])
  const [tipo, setTipo] = useState(null) // 'avulso' | 'turma'
  const [texto, setTexto] = useState('')
  const [dia, setDia] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aulas, setAulas] = useState([]) // aulas marcadas (podem ser de dias diferentes)

  const lista = professores
    .filter(p => p.ativo !== false && p.funcao === 'professor' && p.id !== PROFESSOR_SUBSTITUTO_ID && !/teste/i.test(p.nome))
    .sort((a, b) => nomeProfessor(a).localeCompare(nomeProfessor(b)))

  const toggleProf = id => setParaIds(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  const toggleAula = a => setAulas(v => v.some(x => x.id === a.id) ? v.filter(x => x.id !== a.id) : [...v, a])
  const dataObj = new Date(dia + 'T12:00')

  async function handleEnviar() {
    try {
      if (tipo === 'turma' && !aulas.length) throw new Error('Marque pelo menos uma turma na grade')
      await enviar.mutateAsync({ professorIds: paraIds, texto, aulas: tipo === 'turma' ? aulas : [] })
      toast.success(paraIds.length > 1 ? `Recado enviado para ${paraIds.length} professores` : 'Recado enviado')
      onFechar()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0 18px' }}>
        <button onClick={onFechar} style={{ background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}><ChevronLeft size={22} /></button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text-dark-primary)', margin: 0 }}>Novo recado</h1>
      </div>

      {/* 1. Para quem */}
      <div style={cartao}>
        <div style={rotulo}>1. Para quem {paraIds.length > 0 && <span style={{ color: 'var(--color-action-primary)' }}>· {paraIds.length} selecionado{paraIds.length > 1 ? 's' : ''}</span>}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {lista.map(p => {
            const on = paraIds.includes(p.id)
            return (
              <button key={p.id} type="button" onClick={() => toggleProf(p.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 4px', borderRadius: '999px', cursor: 'pointer',
                border: `1px solid ${on ? 'var(--color-action-primary)' : 'var(--color-border-dark)'}`,
                backgroundColor: on ? 'var(--color-action-primary)' : 'var(--color-surface-dark-overlay)',
                color: on ? 'var(--color-action-on-primary)' : 'var(--color-text-dark-primary)', fontSize: '12px', fontWeight: 600,
              }}>
                <FotoProfessor src={p.foto_url} nome={p.nome} size={22} redondo />
                {nomeProfessor(p)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Tipo */}
      <div style={cartao}>
        <div style={rotulo}>2. Sobre o quê</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { v: 'avulso', icon: MessageSquareText, t: 'Recado geral', d: 'Só texto: aviso, lembrete, combinado.' },
            { v: 'turma', icon: LayoutGrid, t: 'Sobre turmas', d: 'Marque as turmas na grade e explique a proposta.' },
          ].map(({ v, icon: Icon, t, d }) => {
            const on = tipo === v
            return (
              <button key={v} type="button" onClick={() => setTipo(v)} style={{
                textAlign: 'left', padding: '12px', borderRadius: '12px', cursor: 'pointer',
                border: `1px solid ${on ? 'var(--color-action-primary)' : 'var(--color-border-dark)'}`,
                backgroundColor: on ? 'color-mix(in srgb, var(--color-action-primary) 18%, var(--color-surface-dark-overlay))' : 'var(--color-surface-dark-overlay)',
              }}>
                <Icon size={18} color={on ? 'var(--color-action-primary)' : 'var(--color-text-dark-secondary)'} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-dark-primary)', marginTop: '6px' }}>{t}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{d}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Turmas (só no tipo turma) */}
      {tipo === 'turma' && (
        <div style={cartao}>
          <div style={rotulo}>3. Turmas envolvidas {aulas.length > 0 && <span style={{ color: 'var(--color-action-primary)' }}>· {aulas.length} marcada{aulas.length > 1 ? 's' : ''}</span>}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
            <button type="button" onClick={() => setDia(format(subDays(dataObj, 1), 'yyyy-MM-dd'))} style={navBtn}><ChevronLeft size={18} /></button>
            <label style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-dark-primary)', position: 'relative', cursor: 'pointer' }}>
              {format(dataObj, "EEEE, dd/MM", { locale: ptBR }).replace(/^./, c => c.toUpperCase())}
              <input type="date" value={dia} onChange={e => e.target.value && setDia(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </label>
            <button type="button" onClick={() => setDia(format(addDays(dataObj, 1), 'yyyy-MM-dd'))} style={navBtn}><ChevronRight size={18} /></button>
          </div>
          <GradeRecado data={dia} selecionadas={aulas.map(a => a.id)} onToggle={toggleAula} />
          {aulas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {aulas.slice().sort((a, b) => (a.data_aula + a.turmas?.horario_inicio).localeCompare(b.data_aula + b.turmas?.horario_inicio)).map(a => (
                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 6px 4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: 'color-mix(in srgb, var(--color-action-primary) 20%, var(--color-surface-dark-overlay))', color: 'var(--color-text-dark-primary)', border: '1px solid var(--color-action-primary)' }}>
                  {format(new Date(a.data_aula + 'T12:00'), 'dd/MM')} {a.turmas?.horario_inicio?.slice(0, 5)} · {a.turmas?.quadras?.nome} · {a.turmas?.niveis?.nome}
                  <button type="button" onClick={() => toggleAula(a)} style={{ background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-muted)', marginTop: '8px', lineHeight: 1.45 }}>
            Dá para marcar turmas de dias diferentes: troque o dia e continue marcando. O recado fica no painel do professor até a data da última aula marcada.
          </div>
        </div>
      )}

      {/* Texto */}
      {tipo && (
        <div style={cartao}>
          <div style={rotulo}>{tipo === 'turma' ? '4.' : '3.'} Recado</div>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5}
            placeholder={tipo === 'turma' ? 'Ex.: Proposta de juntar essas duas turmas a partir de segunda. O que acha?' : 'Escreva o recado...'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      )}

      {tipo && (
        <button type="button" onClick={handleEnviar} disabled={enviar.isPending || !paraIds.length || !texto.trim()} style={{
          width: '100%', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)',
          cursor: 'pointer', opacity: paraIds.length && texto.trim() ? 1 : 0.5,
        }}>
          <Send size={16} /> {enviar.isPending ? 'Enviando...' : 'Enviar recado'}
        </button>
      )}
    </div>
  )
}

const navBtn = { width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
