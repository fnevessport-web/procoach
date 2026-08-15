import { useQuery } from '@tanstack/react-query'
import { format, endOfMonth } from 'date-fns'
import { supabase } from '../lib/supabase'

// Valor estimado (tudo que está agendado no mês, dado ou não) vs valor real (só o que já
// aconteceu — status_aula='dada') do modo Particular. Agrupa cada aula por "quem cobra": o
// aluno vinculado via presença (contratante tipo='aluno') ou o próprio contratante (tipo=
// 'terceiro', ex: Beyond). tipo_cobranca='fixo' conta o valor uma vez por grupo (não multiplica
// por aula) — é mensalidade, não avulso; 'por_aula' multiplica pela quantidade.
export function useValoresParticular({ empresaId, mes, ano }) {
  return useQuery({
    queryKey: ['valores_particular', empresaId, mes, ano],
    queryFn: async () => {
      const dataInicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd')
      const dataFim = format(endOfMonth(new Date(ano, mes - 1, 1)), 'yyyy-MM-dd')
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, status_aula, contratante_id,
          contratantes(id, nome, tipo, tipo_cobranca, valor_hora_aula, valor_fixo),
          presencas(aluno_id, alunos(id, nome, tipo_cobranca, valor_aula, valor_fixo))
        `)
        .eq('empresa_id', empresaId)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
      if (error) throw error

      const grupos = {}
      ;(aulas || []).forEach(a => {
        const contratante = a.contratantes
        if (!contratante) return
        let chave, tipoCobranca, valorAula, valorFixo, nome, tipo
        if (contratante.tipo === 'aluno') {
          const aluno = a.presencas?.[0]?.alunos
          if (!aluno) return
          chave = `aluno:${aluno.id}`
          tipoCobranca = aluno.tipo_cobranca
          valorAula = aluno.valor_aula
          valorFixo = aluno.valor_fixo
          nome = aluno.nome
          tipo = 'aluno'
        } else {
          chave = `contratante:${contratante.id}`
          tipoCobranca = contratante.tipo_cobranca
          valorAula = contratante.valor_hora_aula
          valorFixo = contratante.valor_fixo
          nome = contratante.nome
          tipo = 'contratante'
        }
        if (!grupos[chave]) grupos[chave] = { chave, id: chave.split(':')[1], tipo, nome, tipoCobranca, valorAula, valorFixo, totalAulas: 0, aulasDadas: 0 }
        grupos[chave].totalAulas++
        if (a.status_aula === 'dada') grupos[chave].aulasDadas++
      })

      let estimado = 0, real = 0
      const porGrupo = Object.values(grupos).map(g => {
        const valorEstimado = g.tipoCobranca === 'fixo'
          ? (g.totalAulas > 0 ? Number(g.valorFixo || 0) : 0)
          : Number(g.valorAula || 0) * g.totalAulas
        const valorReal = g.tipoCobranca === 'fixo'
          ? (g.aulasDadas > 0 ? Number(g.valorFixo || 0) : 0)
          : Number(g.valorAula || 0) * g.aulasDadas
        estimado += valorEstimado
        real += valorReal
        return { ...g, valorEstimado, valorReal }
      })

      return { estimado, real, porGrupo }
    },
    enabled: !!empresaId && !!mes && !!ano,
  })
}
