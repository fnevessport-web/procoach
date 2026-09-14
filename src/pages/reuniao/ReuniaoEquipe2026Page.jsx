import { useEffect, useRef, useState } from 'react'
import { CORES_CLUBE } from '../../constants/coresClube'

const C = CORES_CLUBE

// ────────────────────────────────────────────────────────────────────────────
// Reveal-on-scroll: observa quando a seção entra na viewport e liga a classe
// "in" (opacity/translateY definidos no <style> global lá embaixo). Root fica
// null (viewport do navegador) de propósito — mesmo a página tendo seu próprio
// contêiner com overflow-y:auto (ver FundoBeyond), o layout dos elementos ainda
// é relativo à viewport, então o IntersectionObserver padrão funciona igual.
function Reveal({ children, delay = 0, style }) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisivel(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal${visivel ? ' in' : ''}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

function Secao({ id, corFundo, corTexto = C.tinta, children, style }) {
  return (
    <section id={id} style={{ background: corFundo, color: corTexto, padding: '72px 20px', position: 'relative', ...style }}>
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>{children}</div>
    </section>
  )
}

function Kicker({ children, cor = C.laranja }) {
  return (
    <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2.5px', textTransform: 'uppercase', color: cor, marginBottom: '10px' }}>
      {children}
    </div>
  )
}

function Titulo({ children, cor }) {
  return (
    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, margin: '0 0 16px', lineHeight: 1.15, color: cor }}>
      {children}
    </h2>
  )
}

function StatGrande({ valor, label, cor = C.laranja }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: 'clamp(36px, 8vw, 56px)', color: cor, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: C.textoSuave, marginTop: '8px', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function Barra({ label, valor, max = 5, cor }) {
  const pct = (valor / max) * 100
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', marginBottom: '5px' }}>
        <span style={{ color: C.tinta, minWidth: 0 }}>{label}</span>
        <span style={{ fontWeight: 800, color: cor, flexShrink: 0, whiteSpace: 'nowrap' }}>{valor.toFixed(2).replace('.', ',')}</span>
      </div>
      <div style={{ height: '10px', borderRadius: '5px', background: '#E4DFD5', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '5px', background: cor }} />
      </div>
    </div>
  )
}

function corPorNota(valor, limiar1 = 4.0, limiar2 = 4.3) {
  if (valor < limiar1) return C.vinho
  if (valor < limiar2) return C.laranja
  return '#3F835B'
}

function CardTema({ titulo, badge, badgeCor, children }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '14px', padding: '18px 20px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '14px', color: C.tinta }}>{titulo}</b>
        {badge && <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', background: badgeCor || C.marinho, padding: '2px 9px', borderRadius: '20px' }}>{badge}</span>}
      </div>
      <div style={{ fontSize: '12.5px', color: C.textoSuave, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

// Trecho literal de uma resposta da pesquisa (sem nome de quem escreveu — anônimo mesmo
// aqui na reunião, pra não expor ninguém na frente do time todo).
function Citacao({ children }) {
  return (
    <div style={{ fontSize: '12px', fontStyle: 'italic', color: C.tinta, lineHeight: 1.55, background: `${C.laranja}0d`, borderLeft: `3px solid ${C.laranja}`, borderRadius: '4px', padding: '8px 12px', marginTop: '8px' }}>
      "{children}"
    </div>
  )
}

// Frase de sócio, na íntegra — sem nome de quem respondeu (a pesquisa já é anônima) e sem
// nome de professor citado no meio do texto (substituído por XXX antes de chegar aqui).
function FraseSocio({ children, tipo }) {
  const cor = tipo === 'elogio' ? '#3F835B' : C.vinho
  return (
    <div style={{
      background: tipo === 'elogio' ? 'rgba(63,131,91,0.07)' : 'rgba(107,27,39,0.06)',
      borderLeft: `4px solid ${cor}`, borderRadius: '10px', padding: '16px 20px', marginBottom: '12px',
      display: 'flex', gap: '12px', alignItems: 'flex-start',
    }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', color: cor, lineHeight: 1, flexShrink: 0 }}>"</div>
      <div style={{ fontSize: '13.5px', color: C.tinta, lineHeight: 1.55, fontStyle: 'italic', paddingTop: '6px' }}>{children}</div>
    </div>
  )
}

function FotoProf({ url, nome, tamanho = 120, cor, corTexto = C.tinta }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <img src={url} alt={nome} style={{ width: `${tamanho}px`, height: `${tamanho}px`, borderRadius: '50%', objectFit: 'cover', border: `4px solid ${cor || C.laranja}`, display: 'block', margin: '0 auto 12px', boxShadow: '0 8px 20px rgba(0,0,0,0.18)' }} />
      <div style={{ fontSize: '14px', fontWeight: 700, color: corTexto }}>{nome}</div>
    </div>
  )
}

const FOTO = {
  eric: 'https://xmntwdppiflfwoaccknd.supabase.co/storage/v1/object/public/uploads/professores/25533874-4b7b-4585-b6c5-7676d2b09ee9/foto_1785274119159.png',
  guedes: 'https://xmntwdppiflfwoaccknd.supabase.co/storage/v1/object/public/uploads/professores/e0ed20c3-8b40-437e-a156-bb4bc10ba2d9/foto_1785274167577.png',
  joao: 'https://xmntwdppiflfwoaccknd.supabase.co/storage/v1/object/public/uploads/professores/f0d17c44-6967-4cef-a21a-a04d9123f6f2/foto_1785275342529.png',
  lucas: 'https://xmntwdppiflfwoaccknd.supabase.co/storage/v1/object/public/uploads/professores/ac1b0483-2d6a-413e-b909-fe9dec54f9e1/foto_1785276844301.png',
  marceloRocha: 'https://xmntwdppiflfwoaccknd.supabase.co/storage/v1/object/public/uploads/professores/d423db9d-262c-4d6b-97d4-ce301fe715eb/foto_1785274155621.png',
}

export function ReuniaoEquipe2026Page() {
  // Navegador não sabe pular pro #id certo sozinho aqui: no primeiro load, o HTML
  // inicial vem vazio (SPA renderiza no cliente) — quando o fragmento da URL é lido,
  // o elemento com aquele id ainda não existe no DOM, então o "pulo nativo" do
  // navegador não acontece. Refaz esse pulo manualmente depois que tudo montou.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }))
  }, [])

  return (
    <div style={{ height: '100vh', width: '100%', overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', background: C.creme }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Playfair+Display:wght@600;700&display=swap');
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal.in { opacity: 1; transform: translateY(0); }
        p, span, div, li { overflow-wrap: anywhere; }
        .grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .grid3 { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .grid5 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px 12px; justify-items: center; }
        @media (min-width: 720px) {
          .grid2 { grid-template-columns: 1fr 1fr; }
          .grid3 { grid-template-columns: repeat(3, 1fr); }
          .grid5 { grid-template-columns: repeat(5, 1fr); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal { transition: none; opacity: 1; transform: none; }
        }
      `}</style>

      {/* ============ HERO ============ */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg, ${C.tinta} 0%, ${C.marinho} 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px', marginBottom: '46px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <img src="/images/logobeyond.png" alt="Beyond The Club" style={{ height: '38px', width: 'auto' }} />
          <div style={{ width: '1px', height: '34px', background: 'rgba(255,255,255,0.4)' }} />
          <img src="/images/logoprocopio.png" alt="Procópio" style={{ height: '52px', width: 'auto' }} />
        </div>
        <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '3px', textTransform: 'uppercase', color: C.laranja, marginBottom: '14px' }}>
          Reunião de Equipe
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(40px, 9vw, 76px)', color: '#fff', margin: 0, lineHeight: 1.05, fontWeight: 700 }}>
          2026
        </h1>
        <div style={{ fontSize: 'clamp(16px, 3vw, 22px)', color: 'rgba(255,255,255,0.88)', marginTop: '18px', letterSpacing: '0.5px' }}>
          90 dias de operação
        </div>
        <div style={{ position: 'absolute', bottom: '32px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          role pra continuar ↓
        </div>
      </section>

      {/* ============ PARTE 1 — PESQUISA INTERNA ============ */}
      <Secao id="parte1" corFundo={C.creme}>
        <Reveal><Titulo cor={C.tinta}>O que vocês disseram — pesquisa interna</Titulo></Reveal>
        <Reveal><p style={{ color: C.textoSuave, fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>13 professores responderam de forma anônima uma pesquisa sobre o dia a dia de trabalho aqui. Isso é o retrato de vocês mesmos — e a base de boa parte do que vem a seguir.</p></Reveal>

        <Reveal delay={100}>
          <div className="grid3" style={{ marginBottom: '40px' }}>
            <StatGrande valor="13" label="Respostas · 59% da equipe" />
            <StatGrande valor="69" label="NPS de recomendação" cor="#3F835B" />
            <StatGrande valor="4,33" label="Média geral (de 5)" />
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '26px 24px', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '18px', color: C.tinta }}>Como vocês avaliam o dia a dia</div>
            <Barra label="Processos do dia a dia funcionam bem" valor={3.62} cor={corPorNota(3.62)} />
            <Barra label="Tenho o material necessário" valor={3.92} cor={corPorNota(3.92)} />
            <Barra label="Apoio técnico dos Head Coaches" valor={4.23} cor={corPorNota(4.23)} />
            <Barra label="Suporte da gestão no dia a dia" valor={4.38} cor={corPorNota(4.38)} />
            <Barra label="Retorno regular sobre meu trabalho" valor={4.38} cor={corPorNota(4.38)} />
            <Barra label="Trabalho reconhecido e valorizado" valor={4.46} cor={corPorNota(4.46)} />
            <Barra label="Sinto que pertenço a um time" valor={4.46} cor={corPorNota(4.46)} />
            <Barra label="Posso falar sem medo de retaliação" valor={4.54} cor={corPorNota(4.54)} />
            <Barra label="Incentivo pra me capacitar" valor={4.54} cor={corPorNota(4.54)} />
            <Barra label="Oportunidades de aprender e crescer" valor={4.77} cor={corPorNota(4.77)} />
          </div>
        </Reveal>

        <div className="grid2">
          <Reveal delay={200}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#3F835B', marginBottom: '12px', textTransform: 'uppercase' }}>✓ Pontos fortes</div>
              <CardTema titulo="Sentimento de time" badge="4,46/5">Ambiente, equipe unida, companheirismo — o tema mais citado como motivo de nota alta.</CardTema>
              <CardTema titulo="Espaço pra falar sem medo" badge="4,54/5">Vocês sentem que dá pra levar problema e sugestão pra gestão sem receio.</CardTema>
              <CardTema titulo="Crescimento e capacitação" badge="4,77/5">A maior nota do questionário inteiro.</CardTema>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: C.vinho, marginBottom: '12px', textTransform: 'uppercase' }}>⚠ Pontos de atenção</div>
              <CardTema titulo="Política de reposição" badge="9 de 13" badgeCor={C.vinho}>
                O assunto mais recorrente. Pedido de critérios objetivos e um teto mensal.
                <Citacao>Tentaria brigar com o clube para vermos referente a reposições, visto que não conseguimos repor essas aulas quase nunca, saímos perdendo. Acho que a política de reposição poderia ser mudada, todos os professores estão insatisfeitos com essa política de reposição.</Citacao>
                <Citacao>Hoje, há possibilidades de reposição por praticamente qualquer motivo, o que acaba gerando um volume elevado de remarcações e impactando diretamente a organização da agenda e a previsibilidade da remuneração dos professores.</Citacao>
              </CardTema>
              <CardTema titulo="Dias de chuva" badge={null}>
                Falta um protocolo claro de aviso e remuneração garantida.
                <Citacao>Minha ideia é que o professor receba as aulas da chuva. E em contrapartida se comprometa a ministrar aulas de reposição se receber a mais por isso. Afinal somos um time.</Citacao>
                <Citacao>O professor mantém aquele horário reservado para a aula e, quando já possui a agenda cheia, muitas vezes não tem disponibilidade para realizar a reposição posteriormente, gerando perda de renda por uma situação que foge do seu controle.</Citacao>
              </CardTema>
              <CardTema titulo="Material de trabalho" badge="3,92/5" badgeCor={C.laranja}>
                Mais bolas de qualidade e mais pegadores de bola nas aulas.
                <Citacao>Já recebi uma quantia considerável de reclamações sobre bolas.</Citacao>
                <Citacao>Colocaria 2 quadras cobertas, e mais 2 pegadores de bola para melhoria das aulas!</Citacao>
              </CardTema>
              <CardTema titulo="Apoio da liderança técnica" badge="4,23/5" badgeCor={C.laranja}>Pedido de mais suporte técnico/pedagógico dos Head Coaches no dia a dia.</CardTema>
            </div>
          </Reveal>
        </div>
      </Secao>

      {/* ============ PARTE 2 — VAMOS OUVIR VOCÊS ============ */}
      <Secao id="parte2" corFundo={C.marinho} corTexto="#fff" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <Reveal><Titulo cor="#fff">Agora é a vez de vocês</Titulo></Reveal>
          <Reveal delay={150}>
            <p style={{ fontSize: 'clamp(15px,2.4vw,19px)', color: 'rgba(255,255,255,0.75)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
              Espaço aberto para discussão.
            </p>
          </Reveal>
        </div>
      </Secao>

      {/* ============ PARTE 3 — NÚMEROS ============ */}
      <Secao id="parte3" corFundo={C.creme}>
        <Reveal><Titulo cor={C.tinta}>Números da operação — julho e agosto</Titulo></Reveal>
        <Reveal><p style={{ color: C.textoSuave, fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>A realidade financeira por trás das aulas em grupo, direto do sistema.</p></Reveal>

        <Reveal delay={100}>
          <div className="grid2" style={{ marginBottom: '18px' }}>
            <StatGrande valor="155" label="Turmas deficitárias no período (71 em julho + 84 em agosto)" cor={C.vinho} />
            <StatGrande valor="R$ 23.760" label="Pagos a professores em aulas 100% falta (julho + agosto)" cor={C.vinho} />
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div style={{ height: '1px', background: `${C.textoSuave}30`, margin: '40px 0 32px' }} />
          <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px', color: C.tinta, textAlign: 'center' }}>
            Valores atuais das aulas no Beyond
          </div>
          <div className="grid3" style={{ marginBottom: '36px' }}>
            <StatGrande valor="R$ 1.049" label="Individual / mês" cor={C.marinho} />
            <StatGrande valor="R$ 419" label="Grupo 1x por semana / mês" cor={C.marinho} />
            <StatGrande valor="R$ 683" label="Grupo 2x por semana / mês" cor={C.marinho} />
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '18px', color: C.tinta, textAlign: 'center' }}>
            Quanto isso vale por aula, na prática
          </div>
          <div className="grid3" style={{ marginBottom: '10px' }}>
            <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '14px', padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.textoSuave, marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase' }}>2x por semana · 9 aulas/mês</div>
              <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: '38px', color: C.laranja }}>R$ 75,89</div>
              <div style={{ fontSize: '11px', color: C.textoSuave, marginTop: '4px' }}>por aula</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '14px', padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.textoSuave, marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase' }}>1x por semana · 5 ou 4 aulas/mês</div>
              <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: '38px', color: C.laranja }}>R$ 83,80</div>
              <div style={{ fontSize: '11px', color: C.textoSuave, marginTop: '4px' }}>a R$ 104,75 por aula</div>
            </div>
            <div style={{ background: C.marinho, borderRadius: '14px', padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Professor recebe, por aula</div>
              <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: '38px', color: '#fff' }}>R$ 120,00</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>valor fixo atual</div>
            </div>
          </div>
        </Reveal>
      </Secao>

      {/* ============ PARTE 4 — PESQUISA DOS SÓCIOS ============ */}
      <Secao id="parte4" corFundo={C.creme}>
        <Reveal><Titulo cor={C.tinta}>O que os sócios disseram</Titulo></Reveal>
        <Reveal><p style={{ color: C.textoSuave, fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>Pesquisa anônima do lado do sócio. Nomes de quem respondeu não existem no sistema — e nas frases abaixo, qualquer professor citado nominalmente foi substituído por XXXX, pra não expor ninguém aqui. Individualmente, cada um de vocês vai receber sua própria pesquisa depois.</p></Reveal>

        <Reveal delay={100}>
          <div className="grid3" style={{ marginBottom: '20px' }}>
            <StatGrande valor="58" label="Respostas" />
            <StatGrande valor="45" label="NPS geral" cor="#3F835B" />
            <StatGrande valor="8,57" label="Média das notas (de 10)" />
          </div>
        </Reveal>

        <Reveal delay={130}>
          <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '22px 24px', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', color: C.tinta }}>Perfil geral do corpo docente</div>
            <Barra label="Respeito" valor={4.75} cor="#3F835B" />
            <Barra label="Pontualidade" valor={4.61} cor="#3F835B" />
            <Barra label="Técnica" valor={4.37} cor="#3F835B" />
            <Barra label="Didática" valor={4.35} cor="#3F835B" />
            <Barra label="Evolução do aluno" valor={4.31} cor="#3F835B" />
          </div>
        </Reveal>

        <div className="grid2" style={{ marginBottom: '40px' }}>
          <Reveal delay={180}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#3F835B', marginBottom: '12px', textTransform: 'uppercase' }}>✓ Elogios</div>
              <CardTema titulo="Qualidade geral dos professores">O elogio mais frequente de longe — "professores excelentes", "amo os professores".</CardTema>
              <CardTema titulo="Estrutura e melhorias recentes">Irrigação automática, o novo app de agendamento e o gandula nas aulas foram citados como avanços reais.</CardTema>
              <CardTema titulo="Coordenação e atendimento">Elogio espontâneo à gestão como atenciosa e presente no dia a dia.</CardTema>
            </div>
          </Reveal>
          <Reveal delay={220}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: C.vinho, marginBottom: '12px', textTransform: 'uppercase' }}>⚠ Pontos de atenção</div>
              <CardTema titulo="Reposição / rigidez de horário" badge="12 de 58" badgeCor={C.vinho}>
                O assunto mais citado — mesmo tema apontado por vocês na pesquisa interna.
                <Citacao>Gostaria de mais opções de horários 1x na semana, esta obrigação de 2x está horrível.</Citacao>
                <Citacao>A rigidez do clube para marcar aulas na conveniência dos horários dos associados é péssima.</Citacao>
              </CardTema>
              <CardTema titulo="Dias de chuva" badge="9 de 58" badgeCor={C.vinho}>
                Pedido recorrente de liberar uma quadra coberta.
                <Citacao>Não podemos usar as quadras cobertas se os alunos também são sócios? Nem que seja uma quadra só e os professores se ajustem.</Citacao>
              </CardTema>
              <CardTema titulo="Qualidade das bolas" badge="7 de 58" badgeCor={C.laranja}>
                <Citacao>As bolinhas têm deixado muito a desejar.</Citacao>
                <Citacao>Coloquem uma compra fixa mensal de reposição de bolas, pq pra quem joga tênis sabe o quanto as bolas gastam rápido.</Citacao>
              </CardTema>
              <CardTema titulo="Duração da aula, comunicação e preço" badge="4 + 4 + 4" badgeCor={C.laranja}>
                Sensação de aula curta (50 min), demora no Concierge, e valor comparado a outras escolas.
                <Citacao>As aulas são de 50 minutos. Não entendo porque não são de 1 hora.</Citacao>
                <Citacao>Ainda continua muito ruim a parte de comunicação com o Concierge. Às vezes demora 2, 3, 4 horas para conseguir um simples retorno.</Citacao>
              </CardTema>
            </div>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div style={{ height: '1px', background: `${C.textoSuave}30`, margin: '32px 0' }} />
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(20px,3.5vw,26px)', color: C.tinta, textAlign: 'center', margin: '0 0 6px' }}>Na voz dos sócios</h3>
          <p style={{ fontSize: '12px', color: C.textoSuave, textAlign: 'center', maxWidth: '520px', margin: '0 auto 24px' }}>
            Trecho exatamente como foi escrito. Nome de sócio não existe no sistema; nome de professor citado no texto foi trocado por XXX.
          </p>
        </Reveal>

        <Reveal delay={130}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#3F835B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>✓ Elogios</div>
          <FraseSocio tipo="elogio">Já fiz aulas em 5 academias de tênis, e a do Beyond é, de longe, a melhor.</FraseSocio>
          <FraseSocio tipo="elogio">Amo os professores e toda coordenação da Procópio.</FraseSocio>
          <FraseSocio tipo="elogio">A estrutura do clube é fantástica. Não tenho nada a reclamar, igual um monte de gente azeda que tem no clube.</FraseSocio>
          <FraseSocio tipo="elogio">O professor XXX é muito bom.</FraseSocio>
          <FraseSocio tipo="elogio">Professor XXX é muito esforçado e domina bem a técnica do esporte.</FraseSocio>
          <FraseSocio tipo="elogio">O XXX é muito comprometido como treinador.</FraseSocio>
          <FraseSocio tipo="elogio">A professora XXX!</FraseSocio>
          <FraseSocio tipo="elogio">Empresa séria, acredito que é a mais organizada dentre as outras. Me atendem muito bem, super educados e prestativos.</FraseSocio>
          <FraseSocio tipo="elogio">Inclusão de um gandula durante as aulas foi um grande acerto. Melhorou bastante a interface do app para contratação das aulas.</FraseSocio>
        </Reveal>

        <Reveal delay={160}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: C.vinho, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '28px 0 12px' }}>⚠ Críticas gerais sobre a operação</div>
          <FraseSocio tipo="critica">As aulas são de 50 minutos. Não entendo porque não são de 1 hora.</FraseSocio>
          <FraseSocio tipo="critica">A rigidez do clube para marcar aulas na conveniência dos horários dos associados é péssima.</FraseSocio>
          <FraseSocio tipo="critica">Os professores são ótimos, a gerência não muito. A reposição das aulas é desorganizada.</FraseSocio>
          <FraseSocio tipo="critica">Único ponto negativo está sendo a marcação de reposição de aulas! Sempre uma novela conseguir fazer a aula.</FraseSocio>
          <FraseSocio tipo="critica">Não tem mais zelador lá, fica péssimo pra saber onde vai ser a minha aula, temos que ficar caçando.</FraseSocio>
          <FraseSocio tipo="critica">Quadras de saibro estão muito mal cuidadas. Quadras largadas, sendo que são novas.</FraseSocio>
          <FraseSocio tipo="critica">Material, precisa ter diversidade de material e bolas novas pelo amor de Deus!!!</FraseSocio>
          <FraseSocio tipo="critica">Já tive aula com 3 professores diferentes e cada um fala uma coisa — pra quem está começando, fica confuso.</FraseSocio>
          <FraseSocio tipo="critica">Os professores não têm ensinado "tecnicamente". As aulas parecem mais um bate-bola.</FraseSocio>
        </Reveal>

        <Reveal delay={180}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: C.vinho, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '28px 0 6px' }}>⚠ Críticas sobre as aulas — direto de cada professor avaliado</div>
          <p style={{ fontSize: '11.5px', color: C.textoSuave, marginBottom: '14px' }}>Uma crítica real por professor que recebeu alguma, na íntegra. Se o comentário citava outro professor, o nome também virou XXX.</p>
          <FraseSocio tipo="critica">É mais duro, cobra mais — minha esposa já fez aula com ele e não curtiu o jeito dele.</FraseSocio>
          <FraseSocio tipo="critica">Reduzi a nota de pontualidade só pelo fato da aula terminar antes. A aula precisa terminar com 1 hora de treino, no máximo 2 minutos antes. Não dá pra terminar 7 minutos antes.</FraseSocio>
          <FraseSocio tipo="critica">Bom professor, gosto dele, mas ele é muito bom pra bater bola, não corrige com tanta maestria igual XXX e XXX, profs que eu já tive aula.</FraseSocio>
          <FraseSocio tipo="critica">Bom professor, faz o feijão com arroz bem feito, nada de extraordinário. Precisa ser mais dinâmico, aulas diferentes.</FraseSocio>
          <FraseSocio tipo="critica">Sinto falta de aulas mais dinâmicas — já tive com outro prof e achei a outra aula mais dinâmica, com mais repertório.</FraseSocio>
          <FraseSocio tipo="critica">Senti que poderia ter um olhar mais detalhado para correção de erros e aprimoramento da técnica dos alunos.</FraseSocio>
          <FraseSocio tipo="critica">Acho meio lento nas explicações, ou eu sou muito acelerada, não sei. Bom professor, mas acho que falta algo para deixar a aula mais empolgante.</FraseSocio>
          <FraseSocio tipo="critica">Para o meu nível (avançado) eu acho fraco para esse nível.</FraseSocio>
          <FraseSocio tipo="critica">Meus filhos gostam, mas não vejo uma aula dinâmica para o aprendizado deles — acho que é muita brincadeira e pouca parte técnica.</FraseSocio>
          <FraseSocio tipo="critica">Confesso que, entre 5 professores que já tive, foi quem mais me decepcionou. Não corrige, aulas repetidas, não vejo mudanças — teve aula em que ficava muito no celular. Precisa melhorar muito no horário de início.</FraseSocio>
          <FraseSocio tipo="critica">Bate bola bem, mas ensinar ainda é muito "cozido" — falta paciência para ensinar.</FraseSocio>
          <FraseSocio tipo="critica">Já fiz aula com outro prof e senti muita diferença. Fiz poucas aulas, nada demais.</FraseSocio>
          <FraseSocio tipo="critica">Não gostei muito da aula dele, não vejo repertório diferente, aulas sempre iguais. Falta ter aulas mais diferentes, com mais materiais para motivar.</FraseSocio>
        </Reveal>

        <Reveal delay={100}>
          <div style={{ height: '1px', background: `${C.textoSuave}30`, margin: '32px 0' }} />
          <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', color: C.tinta, textAlign: 'center' }}>
            Top 5 mais bem avaliados
          </div>
          <div style={{ fontSize: '11.5px', color: C.textoSuave, textAlign: 'center', marginBottom: '24px' }}>em ordem alfabética — não é ranking de 1º a 5º</div>
          <div className="grid5" style={{ marginBottom: '64px' }}>
            <FotoProf url={FOTO.eric} nome="Eric" />
            <FotoProf url={FOTO.guedes} nome="Guedes" />
            <FotoProf url={FOTO.joao} nome="João" />
            <FotoProf url={FOTO.lucas} nome="Lucas" />
            <FotoProf url={FOTO.marceloRocha} nome="Marcelo Rocha" />
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div style={{ height: '1px', background: `${C.textoSuave}30`, margin: '0 0 48px' }} />
          <div style={{ background: `linear-gradient(135deg, ${C.laranja}, ${C.vinho})`, borderRadius: '18px', padding: '36px 26px', textAlign: 'center', color: '#fff', marginBottom: '32px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '22px', opacity: 0.9 }}>Premiação do mês</div>
            <div className="grid3" style={{ maxWidth: '480px', margin: '0 auto 26px' }}>
              <FotoProf url={FOTO.eric} nome="Eric" tamanho={110} cor="#fff" corTexto="#fff" />
              <FotoProf url={FOTO.guedes} nome="Guedes" tamanho={110} cor="#fff" corTexto="#fff" />
              <FotoProf url={FOTO.marceloRocha} nome="Marcelo Rocha" tamanho={110} cor="#fff" corTexto="#fff" />
            </div>
            <div style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>
              Os 3 primeiros colocados ganham R$ 500,00 no mês que vem
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(18px,3vw,24px)', fontStyle: 'italic', textAlign: 'center', color: C.tinta, lineHeight: 1.5, maxWidth: '680px', margin: '0 auto' }}>
            "O sócio Beyond já frequentou os melhores clubes de São Paulo — ele sabe reconhecer excelência, e não aceita menos que isso. Pra esse aluno, cada detalhe da aula é o produto inteiro."
          </p>
        </Reveal>
      </Secao>

      {/* ============ PARTE 5 — NOVOS VALORES ============ */}
      <Secao id="parte5" corFundo={C.marinho} corTexto="#fff">
        <Reveal><Titulo cor="#fff">Novos valores — pagamento por aula</Titulo></Reveal>
        <Reveal><p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>Veja como fica o valor por aula a partir de agora.</p></Reveal>

        <Reveal delay={100}>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '26px 24px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Aula Individual</div>
            <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: '46px', color: C.salvia }}>R$ 120,00</div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '18px', textAlign: 'center' }}>Aulas em Grupo</div>
          <div className="grid3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {[['1 aluno', '80'], ['2 alunos', '100'], ['3 alunos', '120'], ['4 alunos', '140']].map(([label, valor]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '20px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>{label}</div>
                <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: '34px', color: '#fff' }}>R$ {valor},00</div>
              </div>
            ))}
          </div>
        </Reveal>
      </Secao>

      {/* ============ PARTE 6 — REGRAS ============ */}
      <Secao id="parte6" corFundo={C.creme}>
        <Reveal><Titulo cor={C.tinta}>Novas regras e condutas</Titulo></Reveal>

        <Reveal delay={100}>
          <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '22px 24px', marginBottom: '20px' }}>
            <b style={{ fontSize: '15px', color: C.tinta }}>O aluno é do clube, não do professor</b>
            <p style={{ fontSize: '13px', color: C.textoSuave, lineHeight: 1.6, margin: '8px 0 0' }}>O professor ganha por aula dada, não por aluno fixo.</p>
          </div>
        </Reveal>

        <Reveal delay={130}>
          <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '22px 24px', marginBottom: '20px' }}>
            <b style={{ fontSize: '15px', color: C.tinta }}>Reposição</b>
            <p style={{ fontSize: '13px', color: C.textoSuave, lineHeight: 1.6, margin: '8px 0 0' }}>
              Dadas durante a semana, aproveitando horários e turmas ainda inativos. Outra possibilidade é abrir dias e horários que hoje não existem, esporadicamente, pra atender uma demanda grande de reposição — principalmente um domingo inteiro.
            </p>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '22px 24px', marginBottom: '20px' }}>
            <b style={{ fontSize: '15px', color: C.tinta }}>Faltas</b>
            <p style={{ fontSize: '13px', color: C.textoSuave, lineHeight: 1.6, margin: '8px 0 12px' }}>
              Se o aluno faltou, o professor ganha normalmente pela aula. O professor que ficar sem aula naquele horário permanece na quadra junto com o colega que está em atividade.
            </p>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: C.textoSuave, marginBottom: '8px' }}>Benefícios</div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: C.textoSuave, lineHeight: 1.8 }}>
              <li>Melhor experiência para os alunos</li>
              <li>Mais um olhar técnico para correções e ajustes</li>
              <li>Aprimoramento entre professores</li>
              <li>Metodologia cada vez mais alinhada entre a equipe</li>
            </ul>
          </div>
        </Reveal>

        <Reveal delay={190}>
          <div style={{ background: '#3F835B', borderRadius: '16px', padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Direto da pesquisa dos sócios</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(20px,3.5vw,28px)', color: '#fff', fontWeight: 700 }}>Aulas voltam a ser de 1 hora — não mais 50 minutos</div>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <div style={{ background: '#fff', border: `2px solid ${C.vinho}`, borderRadius: '16px', padding: '22px 24px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: C.vinho, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Atenção especial — apareceu forte na pesquisa</div>
            <div style={{ fontFamily: "'Anton', Arial, sans-serif", fontSize: 'clamp(28px,5vw,38px)', color: C.vinho }}>SEJAM PONTUAIS</div>
            <p style={{ fontSize: '13px', color: C.textoSuave, marginTop: '8px', lineHeight: 1.6 }}>Vários sócios notaram professor chegando em cima da hora ou atrasado, e aula terminando antes do horário. Isso não pode continuar.</p>
          </div>
        </Reveal>

        <Reveal delay={250}>
          <div className="grid2">
            <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '20px 22px' }}>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: C.textoSuave, lineHeight: 2 }}>
                <li>Recepcionar os alunos</li>
                <li>Preencher as chamadas</li>
                <li>Usem os auxiliares de quadra para ajuda e suporte</li>
              </ul>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${C.textoSuave}30`, borderRadius: '16px', padding: '20px 22px' }}>
              <b style={{ fontSize: '14px', color: C.tinta, display: 'block', marginBottom: '8px' }}>Sejam criativos</b>
              <p style={{ fontSize: '13px', color: C.textoSuave, lineHeight: 1.6, margin: 0 }}>Aulas mais dinâmicas, diferentes, materiais diferentes.</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={280}>
          <div style={{ marginTop: '32px', background: C.marinho, borderRadius: '18px', padding: '30px 26px', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: C.salvia, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Por último — Capacitação</div>
            <p style={{ fontSize: 'clamp(14px,2.2vw,17px)', lineHeight: 1.7, maxWidth: '620px', margin: '0 auto' }}>
              Se preocupem com capacitação. Cada vez mais seremos exigidos — e ao mesmo tempo, seremos mais exigentes com a equipe que ficar com a gente. Todos têm as mesmas oportunidades: cabe a cada um conquistar seu espaço e crescer cada vez mais.
            </p>
          </div>
        </Reveal>
      </Secao>

      {/* ============ VÍDEO FINAL ============ */}
      <Secao id="video" corFundo="#000" corTexto="#fff" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <Kicker cor={C.laranja}>Pra fechar</Kicker>
              <Titulo cor="#fff">Vamos juntos</Titulo>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <video
              controls
              playsInline
              style={{ width: '100%', maxWidth: '820px', display: 'block', margin: '0 auto', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              poster="/images/capa-relatorio-procopio.jpg"
            >
              <source src="/videos/reuniao-2026-encerramento.mp4" type="video/mp4" />
            </video>
          </Reveal>
        </div>
      </Secao>
    </div>
  )
}
