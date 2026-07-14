// Edge Function: gera (e cacheia) a "Análise Inteligente" em texto da evolução técnica de um
// aluno, chamando a API da Anthropic com Claude Haiku. Roda no Deno runtime do Supabase — sem
// dependência de npm, tudo via fetch direto e import por URL (esm.sh), padrão de Edge
// Functions do Supabase.
//
// Fluxo: recebe os dados já calculados da avaliação atual (o app já tem o PC Score, calculado
// por src/lib/pcScore.js) + o histórico de PC Score dos trimestres anteriores, monta um prompt
// estruturado, chama o Claude, e GRAVA o resultado direto em avaliacoes_tecnicas.narrativa_ia
// (usando a service role key, disponível automaticamente em toda Edge Function) — assim o
// cache fica garantido no mesmo lugar que gera o texto, sem depender do front-end lembrar de
// salvar depois.
//
// Deploy (rodar localmente, uma vez, e sempre que este arquivo mudar):
//   npx supabase functions deploy narrativa-tecnica
// Secret da API key (uma vez só, nunca fica no front-end):
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MODELO_CLAUDE = 'claude-haiku-4-5-20251001'
const MAX_TOKENS_RESPOSTA = 350

const TEXTO_FALLBACK =
  'Avaliação registrada com sucesso. A análise automática não pôde ser gerada neste momento — ' +
  'os números e o gráfico de evolução acima já refletem o progresso técnico do aluno.'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Monta o prompt em português, com os dados estruturados já resolvidos pelo app (nunca deixa
// o modelo "adivinhar" nível ou faixa etária — isso já vem calculado por pcScore.js).
function montarPrompt({ alunoNome, modalidadeNome, faixaEtariaLabel, dimensoes, pcScoreAtual, nivelAtualLabel, historico, comentarioProfessor }) {
  const entradasDimensoes = Object.entries(dimensoes || {})
  const ordenadas = [...entradasDimensoes].sort((a, b) => b[1] - a[1])
  const destaque = ordenadas[0]
  const deficit = ordenadas[ordenadas.length - 1]

  const linhasDimensoes = entradasDimensoes.map(([nome, nota]) => `${nome}: ${nota}/5`).join(', ')

  const linhasHistorico = (historico || []).length > 0
    ? historico.map(h => `${h.dataAvaliacao}: PC Score ${h.pcScore}`).join(' · ')
    : 'nenhuma avaliação anterior — esta é a primeira avaliação registrada.'

  const blocoObservacao = comentarioProfessor
    ? `\n\nO professor também registrou esta observação sobre o aluno nesta avaliação: "${comentarioProfessor}"`
    : ''

  return `Aluno: ${alunoNome || 'aluno'} · Modalidade: ${modalidadeNome} · Faixa etária: ${faixaEtariaLabel}

PC Score atual: ${pcScoreAtual} (nível ${nivelAtualLabel}) — lembre-se: nesta escala, QUANTO MENOR o número, melhor o nível técnico.

Notas por dimensão nesta avaliação (escala 1 a 5, 5 é o melhor): ${linhasDimensoes}
Dimensão em maior destaque: ${destaque?.[0]} (nota ${destaque?.[1]}).
Dimensão que mais precisa de atenção: ${deficit?.[0]} (nota ${deficit?.[1]}).

Histórico de PC Score em avaliações anteriores (mais recente primeiro, menor é melhor): ${linhasHistorico}${blocoObservacao}

Escreva um único parágrafo, em português do Brasil, analisando a evolução técnica desse aluno e apontando claramente qual deve ser o próximo foco de treino. Tom positivo, profissional e encorajador — mesmo se algum número tiver piorado, trate como parte natural da evolução, nunca de forma negativa ou desmotivadora.${comentarioProfessor ? ' Funda a observação do professor dentro do mesmo parágrafo, de forma natural — não cite entre aspas, não repita a frase literalmente, não trate como um bloco separado: é uma única análise, com uma única voz.' : ''}`
}

async function chamarClaude(prompt, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO_CLAUDE,
      max_tokens: MAX_TOKENS_RESPOSTA,
      system:
        'Você é um assistente que ajuda professores de tênis a comunicar a evolução técnica de ' +
        'alunos. Responda SEMPRE em português do Brasil, em um único parágrafo corrido (sem ' +
        'markdown, sem títulos, sem saudação, sem listas), com no máximo 5 frases. Vá direto ao ' +
        'texto da análise.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => '')
    throw new Error(`Anthropic API respondeu ${resp.status}: ${detalhe.slice(0, 300)}`)
  }

  const data = await resp.json()
  const texto = data?.content?.find(bloco => bloco.type === 'text')?.text?.trim()
  if (!texto) throw new Error('Resposta da Anthropic sem texto')
  return texto
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ erro: 'Método não permitido' }, 405)

  let payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ erro: 'JSON inválido' }, 400)
  }

  const {
    avaliacaoId, alunoNome, modalidadeNome, faixaEtariaLabel,
    dimensoes, pcScoreAtual, nivelAtualLabel, historico, comentarioProfessor,
  } = payload || {}

  if (!avaliacaoId || !dimensoes || pcScoreAtual == null) {
    return jsonResponse({ erro: 'Campos obrigatórios faltando: avaliacaoId, dimensoes, pcScoreAtual' }, 400)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let narrativa = TEXTO_FALLBACK
  let gerouComSucesso = false

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY não configurada nos secrets da Edge Function')
  } else {
    try {
      const prompt = montarPrompt({ alunoNome, modalidadeNome, faixaEtariaLabel, dimensoes, pcScoreAtual, nivelAtualLabel, historico, comentarioProfessor })
      narrativa = await chamarClaude(prompt, apiKey)
      gerouComSucesso = true
    } catch (err) {
      // Nunca deixa a tela quebrar por causa disso — cai no texto neutro e segue o jogo.
      console.error('Falha ao gerar narrativa via Anthropic:', err.message)
    }
  }

  // Cacheia no banco (mesmo o texto de fallback — evita ficar rechamando a API a cada
  // abertura do card só porque a última tentativa falhou; uma nova avaliação sobrescreve).
  const { error: erroUpdate } = await supabase
    .from('avaliacoes_tecnicas')
    .update({ narrativa_ia: narrativa })
    .eq('id', avaliacaoId)

  if (erroUpdate) console.error('Falha ao salvar narrativa_ia:', erroUpdate.message)

  return jsonResponse({ narrativa, gerouComSucesso })
})
