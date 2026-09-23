import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ShieldAlert, User, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInclusoesPendentes, useDecidirInclusaoPendente } from '../../hooks/useInclusoesPendentes'
import { Loading } from '../../components/ui/Loading'

const LABEL_TIPO = { mensalista: 'Mensalista', avulso: 'Avulso', cortesia: 'Cortesia', reposicao: 'Reposição' }

const toastStyle = {
  background: 'var(--surface-raised)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px',
}

const cartao = {
  backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)',
  borderRadius: '12px', boxSizing: 'border-box',
}

function CardInclusao({ item, onDecidir, decidindo }) {
  const aula = item.aulas
  const dataFmt = aula?.data_aula ? format(new Date(aula.data_aula + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR }) : ''

  return (
    <div style={{ ...cartao, padding: '14px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} /> {item.alunos?.nome || 'Aluno'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {aula?.turmas?.modalidades?.nome} · {aula?.turmas?.nome || 'turma avulsa'} · {dataFmt} {aula?.turmas?.horario_inicio?.slice(0, 5)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Professor: <strong>{aula?.professores?.nome || item.criado_por_nome || '—'}</strong> · tipo: {LABEL_TIPO[item.tipo_participacao] || item.tipo_participacao}
          </div>
        </div>
      </div>

      <div style={{
        padding: '10px 12px', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-state-warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-state-warning) 35%, transparent)', marginBottom: '10px', fontSize: '13px', color: 'var(--text-primary)',
      }}>
        <strong>Motivo:</strong> {item.motivo_inclusao || <em style={{ color: 'var(--text-secondary)' }}>não informado</em>}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onDecidir(item.id, false)} disabled={decidindo} style={{
          flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--color-state-danger) 45%, transparent)',
          background: 'none', color: 'var(--color-state-danger)', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}><X size={14} /> Não</button>
        <button onClick={() => onDecidir(item.id, true)} disabled={decidindo} style={{
          flex: 1, padding: '9px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-state-success)',
          color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}><Check size={14} /> Sim, conta no pagamento</button>
      </div>
    </div>
  )
}

export function AprovarInclusoesPage() {
  const { data: itens, isLoading } = useInclusoesPendentes()
  const decidir = useDecidirInclusaoPendente()
  const [idDecidindo, setIdDecidindo] = useState(null)

  async function decidirItem(presencaId, aprovar) {
    setIdDecidindo(presencaId)
    try {
      await decidir.mutateAsync({ presencaId, aprovar })
      toast.success(aprovar ? 'Aprovado — já conta no pagamento do professor' : 'Recusado — não conta no pagamento', { style: toastStyle })
    } catch (e) { toast.error(e.message, { style: toastStyle }) }
    finally { setIdDecidindo(null) }
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '24px', color: 'var(--text-primary)' }}>
      <div style={{ margin: '4px 0 18px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={24} /> Aprovar Inclusões
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', maxWidth: '640px', lineHeight: 1.5 }}>
          Quando um professor inclui um aluno na própria aula, essa presença fica pendente aqui e <strong>não conta no
          pagamento dele</strong> até você aprovar. Protege contra alguém inflar sozinho a quantidade de alunos da
          turma (o valor por hora-aula sobe conforme a quantidade).
        </p>
      </div>

      {isLoading && <Loading />}

      {!isLoading && (!itens || itens.length === 0) && (
        <div style={{ ...cartao, padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Nada pendente no momento.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {itens?.map(item => (
          <CardInclusao key={item.id} item={item} onDecidir={decidirItem} decidindo={decidir.isPending && idDecidindo === item.id} />
        ))}
      </div>
    </div>
  )
}
