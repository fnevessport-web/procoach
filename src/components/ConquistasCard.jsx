import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ChevronRight } from 'lucide-react'
import { useCatalogoConquistas, useConquistasDoAluno } from '../hooks/useConquistas'
import { ICONE_CONQUISTA_URL } from '../constants/conquistasIcones'
import { Modal } from './ui/Modal'

// Ordem de exibição das famílias no catálogo — mesma ordem da migration 013/conquistas_config.json.
const FAMILIAS_ORDEM = ['Início', 'Ranking & Competição', 'Assiduidade', 'Frequência & Presença', 'Volume de Aulas', 'Evolução Técnica', 'Social & Engajamento']

function progressoPct(minha) {
  if (minha?.progresso_atual == null || !minha?.progresso_alvo) return null
  return Math.min(100, Math.round((minha.progresso_atual / minha.progresso_alvo) * 100))
}

// Mini-card retangular — usado tanto no catálogo completo (A.6) quanto no modal de detalhe
// (A.7). `mostrarCheck` fica desligado na fileira de "figurinhas" do Card do Aluno (item A.5)
// e da Evolução Técnica, onde só aparecem itens já desbloqueados — o selo verde de check ali
// seria redundante (só faz sentido quando tem bloqueada do lado pra comparar, como no catálogo).
// Componente dual-contexto (usado dentro da ilha escura de ConquistasCard E direto na página
// Clara de Evolução Técnica) — usa os aliases genéricos, não tokens -dark-*/-light-* diretos.
function IconeConquista({ icone, nome, tamanho, desbloqueada, mostrarCheck = true }) {
  const url = ICONE_CONQUISTA_URL[icone]
  return (
    <div style={{ position: 'relative', width: tamanho, height: tamanho, flexShrink: 0 }}>
      {url && (
        <img
          src={url} alt={nome} width={tamanho} height={tamanho}
          style={{ borderRadius: '20%', display: 'block', filter: desbloqueada ? 'none' : 'grayscale(1)', opacity: desbloqueada ? 1 : 0.55 }}
        />
      )}
      {desbloqueada && mostrarCheck && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: '50%',
          backgroundColor: 'var(--color-state-success)', border: '2px solid var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={8} color="white" strokeWidth={3.5} />
        </span>
      )}
    </div>
  )
}

// Fileira de "figurinhas" das conquistas já desbloqueadas — ícone grande em destaque, nome
// embaixo em cinza, sem fundo/borda/check (minimalista, pedido explícito do usuário). Usada
// tanto no Card do Aluno (logo abaixo do nome) quanto dentro do detalhe de Evolução Técnica —
// dual-contexto, mesmo motivo do IconeConquista acima.
export function FileiraConquistas({ conquistas, onSelecionar }) {
  if (!conquistas?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center' }}>
      {conquistas.map(c => (
        <button
          key={c.id}
          onClick={() => onSelecionar?.(c.id)}
          title={c.nome}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
            width: 64, border: 'none', background: 'none', cursor: onSelecionar ? 'pointer' : 'default', padding: 0,
          }}
        >
          <IconeConquista icone={c.icone} nome={c.nome} tamanho={40} desbloqueada mostrarCheck={false} />
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.25' }}>
            {c.nome}
          </span>
        </button>
      ))}
    </div>
  )
}

function ModalDetalheConquista({ conquista, minha, onFechar }) {
  const desbloqueada = !!minha?.ativa
  const pct = progressoPct(minha)
  return (
    <Modal open onClose={onFechar} title="Conquista" size="sm" theme="theme-dark">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', paddingBottom: '4px' }}>
        <IconeConquista icone={conquista.icone} nome={conquista.nome} tamanho={88} desbloqueada={desbloqueada} />
        <div>
          <div style={{
            fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px',
            color: desbloqueada ? 'var(--color-state-success)' : 'var(--color-text-dark-secondary)', marginBottom: '4px',
          }}>
            {desbloqueada ? 'Conquistada' : 'Ainda bloqueada'}
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-text-dark-primary)' }}>{conquista.nome}</div>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-dark-secondary)', lineHeight: '1.6', margin: 0 }}>{conquista.descricao}</p>

        {!desbloqueada && pct != null && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', marginBottom: '6px' }}>
              Você está em {minha.progresso_atual} de {minha.progresso_alvo}
            </div>
            <div style={{ height: '6px', backgroundColor: 'var(--color-border-dark)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--color-action-primary)', borderRadius: '3px' }} />
            </div>
          </div>
        )}

        {desbloqueada && minha?.desbloqueada_em && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>
            Desde {format(new Date(minha.desbloqueada_em), 'dd/MM/yyyy', { locale: ptBR })}
          </div>
        )}
      </div>
    </Modal>
  )
}

function ModalCatalogo({ catalogo, minhasPorId, onFechar, onSelecionar }) {
  return (
    <Modal open onClose={onFechar} title="Todas as metas" size="lg" theme="theme-dark">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {FAMILIAS_ORDEM.map(familia => {
          const itens = catalogo.filter(c => c.familia === familia)
          if (!itens.length) return null
          return (
            <div key={familia}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-dark-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                {familia}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '10px' }}>
                {itens.map(c => {
                  const minha = minhasPorId[c.id]
                  const desbloqueada = !!minha?.ativa
                  const pct = progressoPct(minha)
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelecionar(c.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        padding: '10px 6px', borderRadius: '12px', cursor: 'pointer',
                        backgroundColor: 'var(--color-surface-dark-raised)', border: desbloqueada ? '1px solid var(--color-border-dark)' : '1px dashed var(--color-text-dark-muted)',
                      }}
                    >
                      <IconeConquista icone={c.icone} nome={c.nome} tamanho={44} desbloqueada={desbloqueada} />
                      <span style={{ fontSize: '9.5px', color: desbloqueada ? 'var(--color-text-dark-primary)' : 'var(--color-text-dark-muted)', textAlign: 'center', lineHeight: '1.25' }}>
                        {c.nome}
                      </span>
                      {!desbloqueada && pct != null && (
                        <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--color-border-dark)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--color-action-primary)' }} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// Bloco de Conquistas do Card do Aluno (itens A.5, A.6 e A.7 do módulo — entregues juntos
// porque são uma única experiência encadeada: mini-cards → catálogo completo → detalhe de
// cada meta). Só as conquistadas aparecem em fileira aqui; o catálogo completo (bloqueadas
// incluídas, com barra de progresso) fica atrás do botão "Ver todas as metas".
export function ConquistasCard({ alunoId }) {
  const { data: catalogo } = useCatalogoConquistas()
  const { data: minhas } = useConquistasDoAluno(alunoId)
  const [catalogoAberto, setCatalogoAberto] = useState(false)
  const [detalheId, setDetalheId] = useState(null)

  if (!catalogo?.length) return null

  const catalogoPorId = Object.fromEntries(catalogo.map(c => [c.id, c]))
  const minhasPorId = Object.fromEntries((minhas || []).map(m => [m.conquista_id, m]))
  const desbloqueadas = catalogo.filter(c => minhasPorId[c.id]?.ativa)

  return (
    <div className="theme-dark">
      {desbloqueadas.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <FileiraConquistas conquistas={desbloqueadas} onSelecionar={setDetalheId} />
        </div>
      )}

      <button
        onClick={() => setCatalogoAberto(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--color-border-dark)', backgroundColor: 'var(--color-surface-dark-raised)',
          color: 'var(--color-text-dark-secondary)', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: '600' }}>Ver todas as metas</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)' }}>{desbloqueadas.length}/{catalogo.length} metas conquistadas</span>
        </span>
        <ChevronRight size={14} color="var(--color-text-dark-secondary)" style={{ flexShrink: 0 }} />
      </button>

      {catalogoAberto && (
        <ModalCatalogo
          catalogo={catalogo}
          minhasPorId={minhasPorId}
          onFechar={() => setCatalogoAberto(false)}
          onSelecionar={id => setDetalheId(id)}
        />
      )}
      {detalheId && (
        <ModalDetalheConquista
          conquista={catalogoPorId[detalheId]}
          minha={minhasPorId[detalheId]}
          onFechar={() => setDetalheId(null)}
        />
      )}
    </div>
  )
}
