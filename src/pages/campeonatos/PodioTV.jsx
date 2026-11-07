import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { nomeCurto, iniciais } from '../../lib/campeonato'
import { Marcas } from './componentes'

// Pódio do telão: aparece quando a final e a disputa de 3º lugar terminam. Sequência animada:
// pedestais sobem (3º, 2º, 1º), as duplas surgem com zoom sobre cada um, brilho passa pelo
// pedestal do campeão e cai confete discreto. Logos Beyond + Procopio em destaque no topo.
// Palco de 1920x1080 (a TV escala).

const CORES_CONFETE = ['var(--color-brand-lima)', 'var(--color-brand-saibro)', 'var(--color-brand-areia)']

function gerarConfete(qtd) {
  return Array.from({ length: qtd }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    atraso: 2.4 + Math.random() * 6,
    duracao: 5 + Math.random() * 4,
    tamanho: 6 + Math.random() * 8,
    cor: CORES_CONFETE[i % CORES_CONFETE.length],
    giro: Math.random() > 0.5 ? 1 : -1,
    redondo: Math.random() > 0.6,
  }))
}

function Foto({ atleta, tamanho, cor }) {
  return (
    <div style={{ width: tamanho, height: tamanho, borderRadius: '50%', padding: 4, boxSizing: 'border-box', background: cor, boxShadow: `0 0 34px color-mix(in srgb, ${cor} 35%, transparent)` }}>
      {atleta?.foto
        ? <img src={atleta.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        : <span style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface-dark-overlay)', color: 'var(--color-text-dark-secondary)', fontSize: tamanho * 0.3, fontWeight: 700 }}>{atleta ? iniciais(atleta.nome) : '?'}</span>}
    </div>
  )
}

function Lugar({ pos, dupla, altura, foto, atraso, cor, rotulo }) {
  const campeao = pos === 1
  return (
    <div style={{ width: campeao ? 520 : 440, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="cp-zoom" style={{ animationDelay: `${atraso + 0.55}s`, marginBottom: 22 }}>
        <div className="cp-flutuar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: `${atraso + 1.5}s` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: campeao ? 22 : 17, fontWeight: 800, letterSpacing: '5px', color: cor, marginBottom: 16, textTransform: 'uppercase' }}>
            {campeao && <Trophy size={28} />}{rotulo}
          </div>
          <div style={{ display: 'flex', gap: campeao ? 26 : 18 }}>
            {[dupla?.atleta1, dupla?.atleta2].map((a, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: foto + 40 }}>
                <Foto atleta={a} tamanho={foto} cor={cor} />
                <div className="cp-display" style={{ fontSize: campeao ? 30 : 23, fontWeight: 700, lineHeight: 1.15, textAlign: 'center' }}>{nomeCurto(a?.nome)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cp-subir" style={{
        animationDelay: `${atraso}s`, height: altura, width: '100%', position: 'relative', overflow: 'hidden',
        borderRadius: '22px 22px 0 0', borderTop: `3px solid ${cor}`,
        background: `linear-gradient(180deg, color-mix(in srgb, ${cor} 22%, var(--color-surface-dark-raised)), color-mix(in srgb, var(--color-surface-dark-raised) 60%, transparent))`,
        display: 'flex', justifyContent: 'center', paddingTop: 14, boxSizing: 'border-box',
      }}>
        <span className="cp-display" style={{ fontSize: campeao ? 150 : 110, fontWeight: 700, lineHeight: 1, color: cor }}>{pos}</span>
        {campeao && <span className="cp-varrer" style={{ animationDelay: `${atraso + 1.2}s` }} />}
      </div>
    </div>
  )
}

export function TelaPodio({ campeonato, jogos, duplaPorId }) {
  const [confete] = useState(() => gerarConfete(70))
  const final = jogos.find(j => j.fase === 'final')
  const terceiro = jogos.find(j => j.fase === 'terceiro')
  const campea = duplaPorId.get(final?.vencedor_id)
  const vice = final ? duplaPorId.get(final.vencedor_id === final.dupla_a_id ? final.dupla_b_id : final.dupla_a_id) : null
  const terceira = terceiro ? duplaPorId.get(terceiro.vencedor_id) : null

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {/* holofotes suaves atrás do pódio */}
      <div className="cp-holofote" style={{ position: 'absolute', left: '50%', top: -200, width: 1100, height: 1400, marginLeft: -550, background: 'radial-gradient(ellipse 35% 60% at 50% 0%, color-mix(in srgb, var(--color-brand-lima) 16%, transparent), transparent 70%)', pointerEvents: 'none' }} />

      {confete.map(c => (
        <span key={c.id} className="cp-confete" style={{
          position: 'absolute', top: -40, left: `${c.left}%`, width: c.tamanho, height: c.redondo ? c.tamanho : c.tamanho * 0.45,
          borderRadius: c.redondo ? '50%' : 2, backgroundColor: c.cor, opacity: 0.85,
          animationDelay: `${c.atraso}s`, animationDuration: `${c.duracao}s`, animationIterationCount: 'infinite', '--giro': c.giro,
        }} />
      ))}

      <div className="cp-fade-in" style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ filter: 'drop-shadow(0 0 22px color-mix(in srgb, var(--color-brand-areia) 28%, transparent))' }}>
          <Marcas altura={92} />
        </div>
        <div style={{ width: 120, height: 1, margin: '30px 0 22px', background: 'linear-gradient(to right, transparent, var(--color-brand-lima), transparent)' }} />
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '8px', color: 'var(--color-brand-lima)' }}>PÓDIO</div>
        <div className="cp-display" style={{ fontSize: 58, fontWeight: 700, marginTop: 6 }}>{campeonato.nome}</div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 28 }}>
        <Lugar pos={2} dupla={vice} altura={210} foto={128} atraso={0.9} cor="var(--color-brand-areia)" rotulo="Vice-campeões" />
        <Lugar pos={1} dupla={campea} altura={300} foto={168} atraso={1.6} cor="var(--color-brand-lima)" rotulo="Campeões" />
        <Lugar pos={3} dupla={terceira} altura={150} foto={118} atraso={0.3} cor="var(--color-brand-saibro)" rotulo="3º lugar" />
      </div>
    </div>
  )
}
