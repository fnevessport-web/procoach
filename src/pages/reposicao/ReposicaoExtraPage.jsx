import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pagina } from './ui'
import { EtapaCadastro } from './EtapaCadastro'
import { EtapaReposicao } from './EtapaReposicao'
import { EtapaSemHorario } from './EtapaSemHorario'
import { EtapaConfirmarReposicao } from './EtapaConfirmarReposicao'
import { EtapaPresente } from './EtapaPresente'
import { EtapaResumoPresente } from './EtapaResumoPresente'
import { EtapaFinal } from './EtapaFinal'

const DADOS_VAZIOS = { nome: '', telefone: '', turmas: [] }

// Página pública /reposicao (sem login) — aulas extras por causa da chuva: reposição de Tênis
// (até 2 por pessoa) + 1 aula de presente em cada uma das outras modalidades. Isolada da agenda
// oficial: tudo grava em extras_* (ver scripts/2026-09-20_reposicao_extra_publica.sql).
//
// Etapas: cadastro → reposicao (grade) → confirmar (declaração; grava a inscrição e reserva as
// vagas) → presente → resumo (grava o presente) → final. Pular o presente vai direto pro final.
// "Nenhum horário me atende" passa por sem_horario (orienta a falar com a equipe) e segue pro
// confirmar sem reposição e depois pro presente.
export function ReposicaoExtraPage() {
  const qc = useQueryClient()
  const [etapa, setEtapa] = useState('cadastro')
  const [dados, setDados] = useState(DADOS_VAZIOS)
  const [reposicoes, setReposicoes] = useState([])
  const [presentes, setPresentes] = useState([])
  const [inscricaoId, setInscricaoId] = useState(null)

  const atualizarVagas = () => qc.invalidateQueries({ queryKey: ['extras-vagas'] })

  // Um horário lotou (ou saiu do ar) entre a escolha e a confirmação: tira os lotados da seleção
  // (se o servidor não disse quais — horário inválido/passado —, limpa a seleção toda pra não
  // reenviar o mesmo pedido) e devolve pra escolha com um aviso.
  function voltarPorEsgotado(ids, setLista, etapaDestino) {
    setLista(lista => (ids.length ? lista.filter(s => !ids.includes(s.slot_id)) : []))
    atualizarVagas()
    toast.error('Um horário acabou de lotar. Escolha outro para continuar.')
    setEtapa(etapaDestino)
  }

  function recomecar() {
    setDados(DADOS_VAZIOS)
    setReposicoes([])
    setPresentes([])
    setInscricaoId(null)
    setEtapa('cadastro')
  }

  return (
    <Pagina resetKey={etapa}>
      {etapa === 'cadastro' && (
        <EtapaCadastro dados={dados} setDados={setDados} onContinuar={() => setEtapa('reposicao')} />
      )}

      {etapa === 'reposicao' && (
        <EtapaReposicao dados={dados} selecionados={reposicoes} setSelecionados={setReposicoes}
          onVoltar={() => setEtapa('cadastro')}
          onProsseguir={() => setEtapa('confirmar')}
          onNenhumHorario={() => setEtapa('sem_horario')} />
      )}

      {etapa === 'sem_horario' && (
        <EtapaSemHorario onVoltar={() => setEtapa('reposicao')} onContinuar={() => setEtapa('confirmar')} />
      )}

      {etapa === 'confirmar' && (
        <EtapaConfirmarReposicao dados={dados} selecionados={reposicoes}
          onVoltar={() => setEtapa(reposicoes.length ? 'reposicao' : 'sem_horario')}
          onConfirmado={id => { setInscricaoId(id); atualizarVagas(); setEtapa('presente') }}
          onSlotsEsgotados={ids => voltarPorEsgotado(ids, setReposicoes, 'reposicao')} />
      )}

      {etapa === 'presente' && (
        <EtapaPresente dados={dados} reposicoes={reposicoes} presentes={presentes} setPresentes={setPresentes}
          onResumo={() => setEtapa('resumo')}
          onPular={() => setEtapa('final')} />
      )}

      {etapa === 'resumo' && (
        <EtapaResumoPresente presentes={presentes} inscricaoId={inscricaoId}
          onVoltar={() => setEtapa('presente')}
          onConfirmado={() => { atualizarVagas(); setEtapa('final') }}
          onSlotsEsgotados={ids => voltarPorEsgotado(ids, setPresentes, 'presente')} />
      )}

      {etapa === 'final' && (
        <EtapaFinal dados={dados} reposicoes={reposicoes} presentes={presentes} onNovo={recomecar} />
      )}
    </Pagina>
  )
}
