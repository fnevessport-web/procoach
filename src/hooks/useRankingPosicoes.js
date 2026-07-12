import { supabase } from '../lib/supabase'
import { calcularPontuacaoBeyond } from '../lib/pontuacaoBeyond'
import { nomeCategoriaPorNivel, cicloAtual } from '../constants/rankingCategorias'

// ranking_posicoes.categoria_id é NULL no ranking Geral (ver migration 012) — os dois índices
// únicos de lá são PARCIAIS (um só pra categoria_id null, outro só pra categoria_id not null),
// e o Postgres só usa índice parcial como alvo de ON CONFLICT quando o predicado é citado
// explicitamente na cláusula, o que a lib do Supabase não expõe. Por isso o upsert aqui é
// manual (busca o que já existe pro ciclo e decide update/insert linha a linha) em vez de usar
// .upsert({onConflict}) — mantém categoria_id genuinamente NULL no geral, sem precisar de
// linha "placeholder" só pra contornar a limitação.
async function upsertPosicoes(linhas) {
  if (!linhas.length) return
  const modalidadeId = linhas[0].modalidade_id
  const ciclo = linhas[0].ciclo
  const chave = l => `${l.aluno_id}|${l.tipo_ranking}|${l.categoria_id || '-'}|${l.genero}`

  const { data: existentes } = await supabase
    .from('ranking_posicoes')
    .select('id, aluno_id, tipo_ranking, categoria_id, genero')
    .eq('modalidade_id', modalidadeId)
    .eq('ciclo', ciclo)
  const idPorChave = Object.fromEntries((existentes || []).map(e => [chave(e), e.id]))

  const paraInserir = []
  for (const linha of linhas) {
    const idExistente = idPorChave[chave(linha)]
    if (idExistente) {
      const { error } = await supabase.from('ranking_posicoes').update(linha).eq('id', idExistente)
      if (error) throw error
    } else {
      paraInserir.push(linha)
    }
  }
  if (paraInserir.length) {
    const { error } = await supabase.from('ranking_posicoes').insert(paraInserir)
    if (error) throw error
  }
}

// Recalcula a coluna `posicao` de cada grupo (tipo_ranking + categoria + gênero) do ciclo —
// só entram linhas com pontuacao_beyond calculada (quem ainda não bateu o mínimo de 5 jogos
// fica sem posição, mesmo tendo linha registrada).
async function atualizarPosicoes({ modalidadeId, ciclo }) {
  const { data: linhas } = await supabase
    .from('ranking_posicoes')
    .select('id, tipo_ranking, categoria_id, genero, pontuacao_beyond')
    .eq('modalidade_id', modalidadeId)
    .eq('ciclo', ciclo)
    .not('pontuacao_beyond', 'is', null)

  const grupos = {}
  ;(linhas || []).forEach(l => {
    const chaveGrupo = `${l.tipo_ranking}|${l.categoria_id || '-'}|${l.genero}`
    ;(grupos[chaveGrupo] ||= []).push(l)
  })

  for (const grupo of Object.values(grupos)) {
    grupo.sort((a, b) => b.pontuacao_beyond - a.pontuacao_beyond)
    for (let i = 0; i < grupo.length; i++) {
      await supabase.from('ranking_posicoes').update({ posicao: i + 1 }).eq('id', grupo[i].id)
    }
  }
}

// Recalcula (upsert) a Pontuação Beyond de todo aluno com gênero cadastrado, gravando SEMPRE
// nos dois rankings (Geral + Categoria) simultaneamente — os dois usam o mesmo cálculo, só
// mudam de "gaveta" de classificação. Roda sobre a janela deslizante de 90 dias (nunca o
// total histórico, ver pontuacaoBeyond.js) e sempre regrava mesmo quem não tem jogo nenhum
// na janela, pra um aluno que parou de jogar sair do ranking no próximo recálculo em vez de
// ficar com uma posição congelada de semanas atrás.
export async function recalcularPosicoesRanking({ modalidadeId, dataReferencia } = {}) {
  if (!modalidadeId) return
  const ciclo = cicloAtual(dataReferencia)

  const { data: modalidade } = await supabase.from('modalidades').select('nome').eq('id', modalidadeId).single()
  if (!modalidade) return

  const { data: categorias } = await supabase
    .from('ranking_categorias').select('id, nome').eq('modalidade_id', modalidadeId)
  const categoriaIdPorNome = Object.fromEntries((categorias || []).map(c => [c.nome, c.id]))

  const { data: alunos } = await supabase
    .from('alunos').select('id, genero, nivel, nivel_avaliado_prof').eq('ativo', true).not('genero', 'is', null)
  if (!alunos?.length) return

  const { data: niveisAtivos } = await supabase
    .from('aluno_modalidade_nivel').select('aluno_id, nivel').eq('modalidade_id', modalidadeId).eq('ativo', true)
  const nivelAtivoPorAluno = Object.fromEntries((niveisAtivos || []).map(n => [n.aluno_id, n.nivel]))

  const { data: participacoes } = await supabase
    .from('ranking_jogo_participantes')
    .select('aluno_id, pontos_calculados, ranking_jogos!inner(modalidade_id, data_jogo, status)')
    .eq('ranking_jogos.modalidade_id', modalidadeId)
    .eq('ranking_jogos.status', 'aprovado')

  const jogosPorAluno = {}
  ;(participacoes || []).forEach(p => {
    (jogosPorAluno[p.aluno_id] ||= []).push({ dataJogo: p.ranking_jogos.data_jogo, pontos: p.pontos_calculados })
  })

  const linhas = []
  for (const aluno of alunos) {
    const nivelNome = nivelAtivoPorAluno[aluno.id] || aluno.nivel_avaliado_prof || aluno.nivel
    const categoriaNome = nomeCategoriaPorNivel(nivelNome, modalidade.nome)
    if (!categoriaNome) continue // fora das 3 categorias adultas (Kids, Damas, Senior...) — fora do ranking por enquanto

    const resultado = calcularPontuacaoBeyond({ jogos: jogosPorAluno[aluno.id] || [], dataReferencia })
    const base = {
      aluno_id: aluno.id, modalidade_id: modalidadeId, genero: aluno.genero, ciclo,
      pontuacao_beyond: resultado.pontuacao_beyond, media: resultado.media,
      num_jogos: resultado.num_jogos, nivel: resultado.nivel, atualizado_em: new Date().toISOString(),
    }
    linhas.push({ ...base, tipo_ranking: 'geral', categoria_id: null })
    linhas.push({ ...base, tipo_ranking: 'categoria', categoria_id: categoriaIdPorNome[categoriaNome] || null })
  }
  if (!linhas.length) return

  await upsertPosicoes(linhas)
  await atualizarPosicoes({ modalidadeId, ciclo })
}
