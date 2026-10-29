import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AlertCircle, CalendarCheck, CalendarClock, CheckCircle2, CloudRain, ListPlus, MessageCircle, RefreshCw, Search, UserCheck,
} from 'lucide-react'
import { Pagina, Titulo, Cartao, Nota, Botao, Campo, Chip, BarraInferior, ModalAviso, AoVivo } from '../reposicao/ui'
import { estiloInput } from '../reposicao/constantes'
import { mascararTelefoneBR, apenasDigitosTelefone } from '../../lib/telefone'
import { PainelFrequenciaMeses } from '../../components/PainelFrequenciaMeses'
import { modoDemo } from './demo'
import { identificar, agendar, entrarListaEspera, atualizarTelefone, usePainel, useGrade } from './api'
import { GradeReposicao } from './GradeReposicao'
import {
  PRAZO_DIAS, WHATSAPP_EXIBIDO, linkWhats, DIAS_SEMANA, FAIXAS_HORARIO, nomeDiaSemana, ordenarTurmas,
  dataCurta, diaCurto, diaLongo, plural, primeiroNome, resumoCreditos, partesNivel,
} from './regras'

// Página pública /reposicao (sem login): link OFICIAL de reposição das aulas de Tênis canceladas
// por chuva, agendando direto na grade regular. Regras e gravação no banco (funções repo_*, ver
// scripts/2026-10-29_reposicao_link_oficial.sql).
//
// Etapas: identificar → confirmar ("Você é…?") → painel (saldo + frequência) → grade (próximos
// 7 dias) → revisar → final. Saídas pro WhatsApp sempre com a mensagem pronta.

function BotaoWhats({ texto, children = 'Falar com a Procopio no WhatsApp', variante = 'primario' }) {
  return (
    <a href={linkWhats(texto)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
      <Botao variante={variante}><MessageCircle size={17} /> {children}</Botao>
    </a>
  )
}

// ---- 1. identificação ---------------------------------------------------------------------

function EtapaIdentificar({ form, setForm, onResultado }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(e) {
    e.preventDefault()
    if (form.nome.trim().split(/\s+/).length < 2) { setErro('Digite o nome e o sobrenome do aluno.'); return }
    if (apenasDigitosTelefone(form.telefone).length < 10) { setErro('Digite o telefone com DDD.'); return }
    setErro('')
    setEnviando(true)
    try {
      onResultado(await identificar({ nome: form.nome.trim(), telefone: apenasDigitosTelefone(form.telefone) }))
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Reposição de aulas · Tênis" sub="Este é o canal oficial da Procopio para você agendar a reposição das aulas de Tênis canceladas por chuva, direto na nossa grade de aulas.">
        Agende a sua reposição
      </Titulo>

      <Cartao style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
        <Campo label="Nome completo do aluno">
          <input style={estiloInput} value={form.nome} placeholder="Nome e sobrenome" autoComplete="name"
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </Campo>
        <Campo label="Telefone (WhatsApp)" dica="Para alunos Kids, use o telefone do responsável. Se o seu número mudou, sem problema: você confirma no próximo passo.">
          <input style={estiloInput} value={mascararTelefoneBR(form.telefone)} placeholder="(11) 99999-9999" inputMode="tel" autoComplete="tel"
            onChange={e => setForm(f => ({ ...f, telefone: apenasDigitosTelefone(e.target.value) }))} />
        </Campo>
      </Cartao>

      {erro && <Nota cor="var(--color-state-danger)" icone={<AlertCircle size={16} />} style={{ marginBottom: '12px' }}>{erro}</Nota>}

      <Botao type="submit" disabled={enviando}>
        {enviando ? <><RefreshCw size={16} className="animate-spin" /> Procurando seu cadastro…</> : <><Search size={17} /> Continuar</>}
      </Botao>
    </form>
  )
}

function EtapaConfirmarNome({ candidatos, onEscolher, onNaoSou }) {
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Confirmação">{candidatos.length === 1 ? 'É você?' : 'Quem vai repor a aula?'}</Titulo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        {candidatos.map(c => (
          <button key={c.id} type="button" onClick={() => onEscolher(c)} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
            backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
          }}>
            <span style={{
              width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-brand-lima)',
            }}><UserCheck size={20} /></span>
            <span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-light-muted)' }}>{candidatos.length === 1 ? 'Você é' : 'Sou'}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>{c.nome}{candidatos.length === 1 ? '?' : ''}</span>
            </span>
          </button>
        ))}
      </div>
      {candidatos.length === 1 && <Botao onClick={() => onEscolher(candidatos[0])}>Sim, sou eu</Botao>}
      <Botao variante="suave" onClick={onNaoSou}>{candidatos.length === 1 ? 'Não sou eu' : 'Não sou nenhum desses'}</Botao>
    </div>
  )
}

// Entrou pelo nome, mas o telefone digitado não bate com o cadastro: mostra o que temos
// (mascarado) e deixa o aluno confirmar ou mandar o número novo pra equipe atualizar.
function EtapaTelefone({ candidato, form, onContinuar }) {
  const [editando, setEditando] = useState(false)
  const [novo, setNovo] = useState(apenasDigitosTelefone(form.telefone))
  const [enviando, setEnviando] = useState(false)
  const telefones = candidato.telefones || []

  async function salvar() {
    if (novo.length < 10) { toast.error('Digite o telefone com DDD.'); return }
    setEnviando(true)
    try {
      const r = await atualizarTelefone({ alunoId: candidato.id, chave: candidato.chave, telefoneNovo: novo })
      if (!r?.ok) throw new Error('Não foi possível registrar agora. Você pode seguir e avisar a gente pelo WhatsApp.')
      toast.success('Obrigado! Vamos atualizar o seu cadastro.')
      onContinuar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Seu cadastro" sub="Queremos manter o seu contato em dia para avisar sobre aulas, chuva e reposições.">
        {telefones.length ? 'Seu telefone continua o mesmo?' : 'Qual é o seu telefone?'}
      </Titulo>
      <Cartao style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {telefones.length ? (
          <>
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-light-secondary)' }}>No cadastro de {primeiroNome(candidato.nome)} temos:</div>
            {telefones.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-light-primary)', letterSpacing: '0.5px' }}>{t.mascara}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-light-muted)' }}>{t.tipo}</span>
              </div>
            ))}
          </>
        ) : (
          <div style={{ fontSize: '13.5px', color: 'var(--color-text-light-secondary)' }}>Ainda não temos nenhum telefone no cadastro de {primeiroNome(candidato.nome)}.</div>
        )}
        {(editando || !telefones.length) && (
          <Campo label="Telefone atualizado (WhatsApp)" dica="Para alunos Kids, use o telefone do responsável.">
            <input style={estiloInput} value={mascararTelefoneBR(novo)} placeholder="(11) 99999-9999" inputMode="tel" autoComplete="tel"
              onChange={e => setNovo(apenasDigitosTelefone(e.target.value))} />
          </Campo>
        )}
      </Cartao>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {editando || !telefones.length ? (
          <>
            <Botao disabled={enviando} onClick={salvar}><CheckCircle2 size={17} /> Salvar e continuar</Botao>
            <Botao variante="suave" onClick={onContinuar}>Agora não, continuar</Botao>
          </>
        ) : (
          <>
            <Botao onClick={onContinuar}><CheckCircle2 size={17} /> Sim, continua certo</Botao>
            <Botao variante="secundario" onClick={() => setEditando(true)}>Mudou, quero atualizar</Botao>
          </>
        )}
      </div>
    </div>
  )
}

function EtapaNaoEncontrado({ form, motivo, onTentarDeNovo }) {
  if (motivo === 'nome_ambiguo') {
    return (
      <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
        <Titulo kicker="Quase lá">Digite o nome completo</Titulo>
        <Cartao style={{ marginBottom: '14px', fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)' }}>
          Encontramos vários alunos com esse nome. Digite o nome completo do aluno, como está no cadastro do clube, para
          a gente achar o cadastro certo.
        </Cartao>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Botao onClick={onTentarDeNovo}>Digitar o nome completo</Botao>
          <BotaoWhats variante="secundario" texto={`Olá! Tentei agendar minha reposição de Tênis pelo link e não consegui me identificar.\nNome: ${form.nome.trim()}\nTelefone: ${mascararTelefoneBR(form.telefone)}\nMinha turma: `} />
        </div>
      </div>
    )
  }
  const texto = `Olá! Tentei agendar minha reposição de Tênis pelo link e ${motivo === 'nao_sou' ? 'o nome que apareceu não é o meu' : 'não encontrei meu cadastro'}.\n` +
    `Nome: ${form.nome.trim()}\nTelefone: ${mascararTelefoneBR(form.telefone)}\nMinha turma: `
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Vamos te ajudar">Não encontramos o seu cadastro</Titulo>
      <Cartao style={{ marginBottom: '14px', fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)' }}>
        Não conseguimos localizar o aluno com esse nome. Não se preocupe: fale com a nossa equipe pelo WhatsApp,
        a mensagem já vai pronta com os seus dados. É só completar com a sua turma (dia e horário) que resolvemos rapidinho
        para você.
      </Cartao>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <BotaoWhats texto={texto} />
        <Botao variante="secundario" onClick={onTentarDeNovo}>Corrigir nome ou telefone</Botao>
      </div>
    </div>
  )
}

// ---- 2. painel: boas-vindas, saldo e frequência --------------------------------------------

function Bloco({ titulo, icone, children }) {
  return (
    <section style={{ marginTop: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
        <span style={{ color: 'var(--color-action-primary)', display: 'flex' }}>{icone}</span>{titulo}
      </div>
      {children}
    </section>
  )
}

function diasRestantes(dataLimite) {
  if (!dataLimite) return null
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
  return Math.round((new Date(dataLimite + 'T12:00') - hoje) / 86400000)
}

function EtapaPainel({ painel, form, onEscolher }) {
  const { aluno, turmas, creditos, agendadas, frequencia, outros_pendentes: outros } = painel
  const saldo = resumoCreditos(creditos)
  const nome = primeiroNome(aluno.nome)
  const textoSemCredito = `Olá! Sou ${aluno.nome} (${mascararTelefoneBR(form.telefone)}). Entrei no link de reposição e não aparece nenhuma aula de chuva para repor. Gostaria de verificar a minha situação.`

  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Sistema de reposição">Olá, {nome}!</Titulo>
      <p style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)', margin: '-6px 0 18px' }}>
        Seja bem-vindo(a) ao sistema de reposição da Procopio. Aqui você acompanha as suas aulas e agenda a reposição
        das aulas canceladas por chuva.
      </p>

      {/* Saldo em destaque */}
      <div style={{
        borderRadius: '18px', padding: '20px', boxSizing: 'border-box', marginBottom: '12px',
        background: 'linear-gradient(140deg, var(--color-brand-verde-court), var(--color-brand-verde-card))', color: 'var(--color-text-dark-primary)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-brand-lima)', marginBottom: '10px' }}>
          Suas reposições disponíveis
        </div>
        {saldo.total > 0 ? (
          <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap' }}>
            {saldo.grupo > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', fontWeight: 700, lineHeight: 1 }}>{saldo.grupo}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', marginTop: '4px' }}>{saldo.grupo === 1 ? 'aula em grupo' : 'aulas em grupo'}</div>
              </div>
            )}
            {saldo.individual > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', fontWeight: 700, lineHeight: 1 }}>{saldo.individual}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', marginTop: '4px' }}>{saldo.individual === 1 ? 'aula individual' : 'aulas individuais'}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Nenhuma aula para repor no momento</div>
        )}
        {turmas.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-border-dark)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dark-muted)', marginBottom: '6px' }}>Sua turma</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ordenarTurmas(turmas).map((t, i) => (
                <span key={i} style={{ fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px', backgroundColor: 'var(--color-surface-dark-overlay)' }}>
                  {nomeDiaSemana(t.dia)} {t.horario} · {partesNivel(t.nivel).titulo}{t.professor ? ` · Prof. ${primeiroNome(t.professor)}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {creditos.length > 0 && (
        <Cartao style={{ padding: '6px 16px' }}>
          {creditos.map(c => {
            const dias = diasRestantes(c.data_limite)
            const urgente = dias != null && dias <= 7
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderBottom: '1px solid var(--color-border-light-subtle)' }}>
                <CloudRain size={18} style={{ color: 'var(--color-state-info)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    Aula de {diaCurto(c.data_origem)}{c.horario_origem ? ` às ${c.horario_origem}` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-light-muted)' }}>
                    {c.formato === 'individual' ? 'Individual' : 'Em grupo'} · cancelada por chuva
                    {Array.isArray(c.historico) && c.historico.length > 0 && ` · reposição de ${c.historico.map(h => dataCurta(h.data_aula)).join(', ')} também cancelada, crédito devolvido`}
                  </div>
                </div>
                {c.data_limite && (
                  <span style={{
                    fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: '999px',
                    color: urgente ? 'var(--color-state-danger)' : 'var(--color-text-light-secondary)',
                    backgroundColor: urgente ? 'color-mix(in srgb, var(--color-state-danger) 10%, transparent)' : 'var(--color-surface-light-base)',
                  }}>até {dataCurta(c.data_limite)}</span>
                )}
              </div>
            )
          })}
        </Cartao>
      )}

      {saldo.total === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Nota icone={<AlertCircle size={16} />}>
            Pelo link, a reposição vale para as aulas canceladas por chuva nos últimos {PRAZO_DIAS} dias, conforme a regra do clube.
            {outros > 0 ? ' Encontramos outras situações no seu cadastro que a nossa equipe precisa avaliar com você.' : ''}
            {' '}Se você ficou com alguma aula sem repor ou acha que algo precisa de ajuste, fale com a gente.
            Vamos olhar o seu caso com carinho e fazemos questão de ajudar.
          </Nota>
          <BotaoWhats texto={textoSemCredito} />
        </div>
      )}

      {agendadas.length > 0 && (
        <Bloco titulo="Reposições já agendadas" icone={<CalendarCheck size={18} />}>
          <Cartao style={{ padding: '6px 16px' }}>
            {agendadas.map(a => (
              <div key={a.aula_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--color-border-light-subtle)', fontSize: '13.5px' }}>
                <strong>{diaCurto(a.data)} · {a.horario}</strong>
                <span style={{ color: 'var(--color-text-light-secondary)', textAlign: 'right' }}>{partesNivel(a.nivel).titulo}{a.professor ? ` · Prof. ${primeiroNome(a.professor)}` : ''}</span>
              </div>
            ))}
          </Cartao>
        </Bloco>
      )}

      {saldo.total > 0 && (
        <Bloco titulo="Como funciona" icone={<CalendarClock size={18} />}>
          <Cartao>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', lineHeight: 1.75, color: 'var(--color-text-light-secondary)' }}>
              <li>Cada reposição vale por <strong>{PRAZO_DIAS} dias</strong> a partir da aula cancelada. Depois desse prazo, ela expira.</li>
              <li>Mostramos sempre os <strong>próximos 7 dias</strong> da grade. A cada dia que passa, um novo dia é liberado.</li>
              <li>Você pode agendar no <strong>seu nível ou em 1 nível abaixo</strong>. Turmas Kids e adulto não se misturam.</li>
              <li>O agendamento fecha <strong>2 horas antes</strong> do início da aula.</li>
              <li>Se você tem reposição individual e escolher uma aula em grupo, ela será descontada da sua reposição individual.</li>
              <li>Teve um imprevisto? Avise no nosso WhatsApp para a equipe liberar a vaga.</li>
            </ul>
            <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-light-secondary)' }}>
              Alguma aula ficou de fora ou algo não está certo? Fale com a gente no WhatsApp {WHATSAPP_EXIBIDO}.
              Fazemos questão de ajudar a resolver.
            </div>
          </Cartao>
        </Bloco>
      )}

      <Bloco titulo="Sua frequência" icone={<CheckCircle2 size={18} />}>
        <PainelFrequenciaMeses frequencia={frequencia} />
      </Bloco>

      {saldo.total > 0 && (
        <BarraInferior>
          <Botao onClick={onEscolher}><CalendarCheck size={17} /> Escolher horários de reposição</Botao>
        </BarraInferior>
      )}
    </div>
  )
}

// ---- 3. grade ---------------------------------------------------------------------------

function EtapaGrade({ painel, grade, carregando, selecionadas, setSelecionadas, onRevisar, onVoltar, onNenhum }) {
  const saldo = resumoCreditos(painel.creditos)
  const [avisoIndividual, setAvisoIndividual] = useState(null)

  const qtdInd = selecionadas.filter(s => s.formato === 'individual').length
  const qtdGrupo = selecionadas.length - qtdInd

  function motivoBloqueio(a) {
    if (selecionadas.length >= saldo.total) return `Você tem ${plural(saldo.total, 'reposição', 'reposições')} para agendar.`
    if (selecionadas.some(s => s.data_aula === a.data_aula && s.horario === a.horario)) return 'Você já escolheu uma aula neste mesmo horário.'
    if (a.formato === 'individual' && qtdInd >= saldo.individual) return 'Suas reposições individuais já foram escolhidas.'
    if (a.formato === 'grupo' && qtdGrupo >= saldo.grupo + saldo.individual - qtdInd) return 'Suas reposições já foram escolhidas.'
    return ''
  }

  function alternar(a) {
    if (selecionadas.some(s => s.aula_id === a.aula_id)) {
      setSelecionadas(selecionadas.filter(s => s.aula_id !== a.aula_id))
      return
    }
    const motivo = motivoBloqueio(a)
    if (motivo) { toast(motivo, { icon: 'ℹ️' }); return }
    if (a.formato === 'grupo' && qtdGrupo >= saldo.grupo) { setAvisoIndividual(a); return }
    setSelecionadas([...selecionadas, a])
  }

  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Próximos 7 dias" sub="Escolha a aula que combina com o seu nível. Os horários mostram o nível da turma, o professor e as vagas livres.">
        Horários disponíveis
      </Titulo>
      <div style={{ marginBottom: '14px' }}><AoVivo /></div>

      {carregando ? (
        <Cartao style={{ textAlign: 'center', color: 'var(--color-text-light-muted)', fontSize: '14px' }}>Carregando a grade…</Cartao>
      ) : grade.length === 0 ? (
        <Nota icone={<AlertCircle size={16} />}>No momento não há horários com vaga para o seu nível nos próximos 7 dias.</Nota>
      ) : (
        <GradeReposicao aulas={grade} selecionadas={selecionadas} onAlternar={alternar} motivoBloqueio={motivoBloqueio} />
      )}

      <Cartao style={{ marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>Nenhum horário te atende?</div>
        <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-light-secondary)' }}>
          Coloque seu nome na lista de espera ou fale com a gente. A Procopio vai ajudar a resolver a sua reposição.
        </div>
        <Botao variante="secundario" onClick={onNenhum}><ListPlus size={16} /> Ver opções</Botao>
      </Cartao>

      <BarraInferior>
        <Botao disabled={!selecionadas.length} onClick={onRevisar}>
          {selecionadas.length ? `Continuar com ${plural(selecionadas.length, 'aula', 'aulas')}` : `Escolha até ${plural(saldo.total, 'aula', 'aulas')}`}
        </Botao>
        <Botao variante="suave" onClick={onVoltar}>Voltar</Botao>
      </BarraInferior>

      {avisoIndividual && (
        <ModalAviso icone={<AlertCircle size={22} />} titulo="Esta é uma aula em grupo"
          acoes={<>
            <Botao onClick={() => { setSelecionadas([...selecionadas, avisoIndividual]); setAvisoIndividual(null) }}>Entendi, quero esta aula</Botao>
            <Botao variante="secundario" onClick={() => setAvisoIndividual(null)}>Escolher outra</Botao>
          </>}>
          Você pode fazer a reposição numa turma em grupo, mas será usada uma das suas <strong>reposições de aula individual</strong>.
        </ModalAviso>
      )}
    </div>
  )
}

// ---- 4. revisar e confirmar ----------------------------------------------------------------

function ListaAulas({ aulas }) {
  return (
    <Cartao style={{ padding: '4px 16px' }}>
      {[...aulas].sort((a, b) => `${a.data_aula ?? a.data}${a.horario}`.localeCompare(`${b.data_aula ?? b.data}${b.horario}`)).map(a => (
        <div key={a.aula_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-light-subtle)' }}>
          <div style={{ fontSize: '15px', fontWeight: 800 }}>{diaLongo(a.data_aula ?? a.data)} · {a.horario}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
            {a.nivel}{a.professor ? ` · Prof. ${a.professor}` : ''}{a.extra ? ' · Aula extra' : ''}
          </div>
        </div>
      ))}
    </Cartao>
  )
}

function EtapaRevisar({ selecionadas, enviando, onConfirmar, onVoltar }) {
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Revisão">Confira a sua reposição</Titulo>
      <ListaAulas aulas={selecionadas} />
      <Nota style={{ marginTop: '12px' }} icone={<CalendarClock size={16} />}>
        Ao confirmar, a vaga fica reservada no seu nome e a aula já aparece na grade do professor.
      </Nota>
      <BarraInferior>
        <Botao disabled={enviando} onClick={onConfirmar}>{enviando ? 'Confirmando…' : 'Confirmar agendamento'}</Botao>
        <Botao variante="suave" onClick={onVoltar}>Voltar e alterar</Botao>
      </BarraInferior>
    </div>
  )
}

function EtapaFinal({ aluno, agendadas, saldoRestante, onAgendarMais }) {
  const resumo = agendadas.map(a => `• ${diaCurto(a.data)} às ${a.horario} (${partesNivel(a.nivel).titulo})`).join('\n')
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'color-mix(in srgb, var(--color-state-success) 14%, transparent)', color: 'var(--color-state-success)',
        }}><CheckCircle2 size={34} /></div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700 }}>Reposição agendada!</div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-light-secondary)', marginTop: '4px' }}>{aluno.nome}</div>
      </div>
      <ListaAulas aulas={agendadas} />
      <Nota style={{ marginTop: '12px' }} icone={<CalendarCheck size={16} />}>
        <strong>Anote o dia e o horário.</strong> Se surgir algum imprevisto, avise no nosso WhatsApp para a equipe liberar a
        vaga para outro aluno.
        {saldoRestante > 0 && <> Você ainda tem <strong>{plural(saldoRestante, 'reposição disponível', 'reposições disponíveis')}</strong>.</>}
      </Nota>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        {saldoRestante > 0 && <Botao onClick={onAgendarMais}>Agendar outra reposição</Botao>}
        <BotaoWhats variante="secundario" texto={`Olá! Sou ${aluno.nome}. Agendei minha reposição pelo link:\n${resumo}`}>
          Estamos à disposição: {WHATSAPP_EXIBIDO}
        </BotaoWhats>
      </div>
    </div>
  )
}

// ---- lista de espera ----------------------------------------------------------------------

function EtapaSemHorario({ painel, form, chave, onVoltar, onListaOk }) {
  const [dias, setDias] = useState([])
  const [faixas, setFaixas] = useState([])
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const alternar = (lista, set, k) => set(lista.includes(k) ? lista.filter(x => x !== k) : [...lista, k])
  const saldo = resumoCreditos(painel.creditos)

  async function enviar() {
    setEnviando(true)
    try {
      const r = await entrarListaEspera({ alunoId: painel.aluno.id, telefone: chave, dias, faixas, observacao: obs })
      if (!r?.ok) throw new Error('Não foi possível registrar agora. Tente novamente ou fale com a gente no WhatsApp.')
      onListaOk()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out' }}>
      <Titulo kicker="Lista de espera" sub="Quando juntarmos alunos suficientes com a mesma disponibilidade, a Procopio abre uma aula extra e entra em contato com você.">
        Quando você pode repor?
      </Titulo>
      <Cartao style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
        <Campo label="Dias da semana">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
            {DIAS_SEMANA.map(d => <Chip key={d.key} ativo={dias.includes(d.key)} onClick={() => alternar(dias, setDias, d.key)} style={{ padding: '10px 0', fontSize: '12px' }}>{d.label}</Chip>)}
          </div>
        </Campo>
        <Campo label="Faixas de horário">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {FAIXAS_HORARIO.map(f => <Chip key={f.key} ativo={faixas.includes(f.key)} onClick={() => alternar(faixas, setFaixas, f.key)}>{f.label}</Chip>)}
          </div>
        </Campo>
        <Campo label="Observação (opcional)">
          <textarea style={{ ...estiloInput, minHeight: '70px', resize: 'vertical', fontFamily: 'inherit' }} value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex.: prefiro depois das 19h" />
        </Campo>
      </Cartao>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Botao disabled={!dias.length || !faixas.length || enviando} onClick={enviar}><ListPlus size={17} /> Entrar na lista de espera</Botao>
        <BotaoWhats variante="secundario" texto={`Olá! Sou ${painel.aluno.nome} (${mascararTelefoneBR(form.telefone)}). Tenho ${plural(saldo.total, 'reposição', 'reposições')} e nenhum horário dos próximos 7 dias me atendeu. Podem me ajudar?`} />
        <Botao variante="suave" onClick={onVoltar}>Voltar para a grade</Botao>
      </div>
    </div>
  )
}

function EtapaListaOk({ onVoltar }) {
  return (
    <div style={{ animation: 'repoSobe 0.25s ease-out', textAlign: 'center' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'color-mix(in srgb, var(--color-state-success) 14%, transparent)', color: 'var(--color-state-success)',
      }}><CheckCircle2 size={34} /></div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Você está na lista de espera</div>
      <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-light-secondary)', margin: '0 0 18px' }}>
        Assim que tivermos quórum para uma aula extra no seu nível e horário, a Procopio entra em contato pelo WhatsApp.
        Enquanto isso, você pode continuar agendando pela grade normalmente.
      </p>
      <Botao variante="secundario" onClick={onVoltar}>Voltar para o início</Botao>
    </div>
  )
}

// ---- página -------------------------------------------------------------------------------

const FORM_VAZIO = { nome: '', telefone: '' }

export function ReposicaoOficialPage() {
  const qc = useQueryClient()
  const [etapa, setEtapa] = useState('identificar')
  const [form, setForm] = useState(FORM_VAZIO)
  const [candidatos, setCandidatos] = useState([])
  const [motivoNaoEncontrado, setMotivoNaoEncontrado] = useState('')
  const [escolhido, setEscolhido] = useState(null)
  const [selecionadas, setSelecionadas] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  // Painel/grade só abrem depois da etapa do telefone (quando ela existe).
  const alunoId = escolhido && etapa !== 'telefone' ? escolhido.id : null
  const chave = escolhido?.chave
  const { data: painel, isLoading: carregandoPainel } = usePainel(alunoId, chave)
  const { data: gradeResp, isLoading: carregandoGrade } = useGrade(etapa === 'grade' || etapa === 'revisar' ? alunoId : null, chave)
  const grade = gradeResp?.ok ? gradeResp.aulas : []

  function aoIdentificar(r) {
    if (r?.ok && r.candidatos?.length) { setCandidatos(r.candidatos); setEtapa('confirmar'); return }
    setMotivoNaoEncontrado(r?.codigo || 'nao_encontrado')
    setEtapa('nao_encontrado')
  }

  function recarregar() {
    qc.invalidateQueries({ queryKey: ['repo-painel'] })
    qc.invalidateQueries({ queryKey: ['repo-grade'] })
  }

  async function confirmar() {
    setEnviando(true)
    try {
      const r = await agendar({ alunoId, telefone: chave, aulaIds: selecionadas.map(s => s.aula_id) })
      if (r?.ok) {
        setResultado(r)
        setSelecionadas([])
        recarregar()
        setEtapa('final')
        return
      }
      if (r?.codigo === 'esgotado') {
        const ids = r.aula_ids || []
        setSelecionadas(sel => sel.filter(s => !ids.includes(s.aula_id)))
        toast.error('Um horário acabou de lotar ou saiu do ar. Escolha outro para continuar.')
      } else if (r?.codigo === 'sem_saldo') {
        toast.error('Seu saldo de reposições mudou. Confira novamente.')
      } else {
        toast.error('Não foi possível concluir agora. Tente novamente.')
      }
      recarregar()
      setEtapa('grade')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function recomecar() {
    setForm(FORM_VAZIO); setCandidatos([]); setEscolhido(null); setSelecionadas([]); setResultado(null)
    setEtapa('identificar')
  }

  const painelOk = painel?.ok ? painel : null
  const precisaPainel = ['painel', 'grade', 'revisar', 'sem_horario', 'final'].includes(etapa)

  return (
    <Pagina resetKey={etapa} largura={640}>
      {modoDemo() && (
        <Nota cor="var(--color-state-info)" icone={<AlertCircle size={16} />} style={{ marginBottom: '14px' }}>
          <strong>Modo demonstração.</strong> Aluno fictício, nada é gravado na agenda. Digite qualquer nome; telefone
          terminado em 9999 entra direto, outro número mostra a confirmação de telefone.
        </Nota>
      )}
      {etapa === 'identificar' && <EtapaIdentificar form={form} setForm={setForm} onResultado={aoIdentificar} />}

      {etapa === 'confirmar' && (
        <EtapaConfirmarNome candidatos={candidatos}
          onEscolher={c => { setEscolhido(c); setEtapa(c.telefone_confere ? 'painel' : 'telefone') }}
          onNaoSou={() => { setMotivoNaoEncontrado('nao_sou'); setEtapa('nao_encontrado') }} />
      )}

      {etapa === 'telefone' && escolhido && (
        <EtapaTelefone candidato={escolhido} form={form} onContinuar={() => setEtapa('painel')} />
      )}

      {etapa === 'nao_encontrado' && (
        <EtapaNaoEncontrado form={form} motivo={motivoNaoEncontrado} onTentarDeNovo={() => setEtapa('identificar')} />
      )}

      {precisaPainel && !painelOk && (
        carregandoPainel
          ? <Cartao style={{ textAlign: 'center', color: 'var(--color-text-light-muted)' }}>Carregando suas aulas…</Cartao>
          : <EtapaNaoEncontrado form={form} motivo="nao_encontrado" onTentarDeNovo={recomecar} />
      )}

      {painelOk && etapa === 'painel' && <EtapaPainel painel={painelOk} form={form} onEscolher={() => setEtapa('grade')} />}

      {painelOk && etapa === 'grade' && (
        <EtapaGrade painel={painelOk} grade={grade} carregando={carregandoGrade} selecionadas={selecionadas} setSelecionadas={setSelecionadas}
          onRevisar={() => setEtapa('revisar')} onVoltar={() => setEtapa('painel')} onNenhum={() => setEtapa('sem_horario')} />
      )}

      {painelOk && etapa === 'revisar' && (
        <EtapaRevisar selecionadas={selecionadas} enviando={enviando} onConfirmar={confirmar} onVoltar={() => setEtapa('grade')} />
      )}

      {painelOk && etapa === 'sem_horario' && (
        <EtapaSemHorario painel={painelOk} form={form} chave={chave} onVoltar={() => setEtapa('grade')} onListaOk={() => setEtapa('lista_ok')} />
      )}

      {etapa === 'lista_ok' && <EtapaListaOk onVoltar={() => setEtapa('painel')} />}

      {painelOk && etapa === 'final' && resultado && (
        <EtapaFinal aluno={painelOk.aluno} agendadas={resultado.agendadas} saldoRestante={resultado.saldo}
          onAgendarMais={() => setEtapa('painel')} />
      )}
    </Pagina>
  )
}
