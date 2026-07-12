// Edge Function: sugere um plano de treino pra turma inteira, chamando a API da Anthropic
// com Claude Haiku, a partir do resumo técnico já calculado no cliente (useResumoTecnicoTurma,
// src/hooks/useAlunos.js — média por dimensão, cobertura, gargalo coletivo). Mesmo padrão de
// narrativa-tecnica/index.ts, mas sem persistência: aqui não há uma linha "avaliação" pra
// cachear o texto, então o front-end guarda a resposta em estado local enquanto o modal da
// turma estiver aberto (regenera a cada clique no botão).
//
// Deploy (rodar localmente, uma vez, e sempre que este arquivo mudar):
//   npx supabase functions deploy plano-turma
// Usa o mesmo secret ANTHROPIC_API_KEY já configurado pra narrativa-tecnica.

const MODELO_CLAUDE = 'claude-haiku-4-5-20251001'
const MAX_TOKENS_RESPOSTA = 350

const TEXTO_FALLBACK =
  'Resumo técnico calculado com sucesso. A sugestão automática de plano de treino não pôde ser ' +
  'gerada neste momento — use as médias por dimensão acima pra decidir o foco da próxima aula.'

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

// Monta o prompt com o resumo já calculado pelo app — o modelo nunca recalcula média nem
// decide o gargalo, só sugere o que treinar em cima do número que o app já resolveu.
function montarPrompt({ turmaNome, modalidadeNome, totalAlunos, alunosAvaliados, mediaPorDimensao, gargaloColetivo }) {
  const linhasDimensoes = (mediaPorDimensao || [])
    .map(d => `${d.dimensao}: média ${d.media}/5`)
    .join(', ')

  return `Turma: ${turmaNome || 'turma'} · Modalidade: ${modalidadeNome || ''}
Cobertura: ${alunosAvaliados} de ${totalAlunos} alunos matriculados têm avaliação técnica confirmada nos últimos 90 dias.

Médias da turma por dimensão nesta cobertura (escala 1 a 5, 5 é o melhor): ${linhasDimensoes}
Gargalo coletivo (dimensão com a pior média do grupo): ${gargaloColetivo?.dimensao} (média ${gargaloColetivo?.media}).

Sugira um plano de treino objetivo pras próximas aulas dessa turma, priorizando o gargalo coletivo identificado sem ignorar as demais dimensões. Escreva em português do Brasil, em até 4 frases ou tópicos curtos, tom profissional e prático — como uma orientação direta de um treinador experiente pra outro professor. Não use markdown, títulos nem saudação.`
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
        'Você é um assistente que ajuda professores de tênis a planejar o treino de uma turma ' +
        'inteira com base no desempenho técnico coletivo dos alunos. Responda SEMPRE em ' +
        'português do Brasil, direto ao ponto, sem markdown, sem títulos, sem saudação, com no ' +
        'máximo 5 frases ou tópicos curtos.',
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

  const { turmaNome, modalidadeNome, totalAlunos, alunosAvaliados, mediaPorDimensao, gargaloColetivo } = payload || {}

  if (!mediaPorDimensao?.length) {
    return jsonResponse({ erro: 'Campo obrigatório faltando: mediaPorDimensao' }, 400)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

  let plano = TEXTO_FALLBACK
  let gerouComSucesso = false

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY não configurada nos secrets da Edge Function')
  } else {
    try {
      const prompt = montarPrompt({ turmaNome, modalidadeNome, totalAlunos, alunosAvaliados, mediaPorDimensao, gargaloColetivo })
      plano = await chamarClaude(prompt, apiKey)
      gerouComSucesso = true
    } catch (err) {
      // Nunca deixa a tela quebrar por causa disso — cai no texto neutro e segue o jogo.
      console.error('Falha ao gerar plano de turma via Anthropic:', err.message)
    }
  }

  return jsonResponse({ plano, gerouComSucesso })
})
