import { useAtualizarFaixaEtariaManual } from '../hooks/useAlunos'
import { FAIXAS_ETARIAS } from '../lib/pcScore'
import toast from 'react-hot-toast'

const toastStyle = {
  background: 'var(--color-surface-light-raised)', color: 'var(--color-text-light-primary)',
  border: '1px solid rgba(165,76,46,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

// Seletor de faixa etária manual (kids/infantil/adulto) — só pra professor/gestor, nunca
// aparece pro aluno (que não tem login no ProCoach). Usado tanto nos Dados Pessoais do
// Card do Aluno quanto, inline, na tela de avaliação quando falta faixa pra calcular o
// PC Score. `compacto` deixa os botões menores pra caber dentro de um aviso inline.
export function SeletorFaixaEtariaManual({ alunoId, valorAtual, compacto, temDataNascimento }) {
  const atualizar = useAtualizarFaixaEtariaManual()

  async function selecionar(chave) {
    try {
      await atualizar.mutateAsync({ alunoId, faixaEtariaManual: chave })
      toast.success('Faixa etária atualizada!', { style: toastStyle })
    } catch (err) {
      toast.error(err.message, { style: toastStyle })
    }
  }

  return (
    <div>
      {temDataNascimento && (
        <div style={{ fontSize: '10px', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>
          Data de nascimento já cadastrada — ela sempre tem prioridade sobre essa escolha.
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {FAIXAS_ETARIAS.map(f => {
          const ativo = valorAtual === f.chave
          return (
            <button
              key={f.chave}
              onClick={() => selecionar(f.chave)}
              disabled={atualizar.isPending}
              title={f.faixaIdade}
              style={{
                padding: compacto ? '5px 10px' : '7px 12px',
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: ativo ? 'var(--color-action-primary)' : 'var(--color-surface-light-raised)',
                outline: ativo ? 'none' : '1px solid var(--color-border-light)',
                color: ativo ? 'white' : 'var(--color-text-light-secondary)',
                fontSize: compacto ? '11px' : '12px', fontWeight: ativo ? '600' : '400',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
