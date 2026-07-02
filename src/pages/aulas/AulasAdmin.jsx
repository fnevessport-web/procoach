
</div>

        {/* Aulas do dia — iluminadas se disponível, apagadas se não */}
        {loadingDia ? <Loading /> : aulasComDisp.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#444', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
            Nenhuma aula de turma neste dia
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {aulasComDisp.map(a => {
              const isSel = slotSel?.id === a.id
              const vagas = 4 - a.ocupacao
              return (
                <button key={a.id}
                  onClick={() => a.disponivel && setSlotSel(isSel ? null : a)}
                  disabled={!a.disponivel}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', borderRadius: '12px', border: 'none', textAlign: 'left', width: '100%',
                    cursor: a.disponivel ? 'pointer' : 'default',
                    opacity: a.disponivel ? 1 : 0.3,
                    backgroundColor: isSel ? 'rgba(59,130,246,0.12)' : a.disponivel ? '#111' : '#0a0a0a',
                    outline: isSel ? '1px solid rgba(59,130,246,0.5)' : a.disponivel ? '1px solid #2a2a2a' : '1px solid #111',
                    transition: 'all 0.15s',
                  }}>
                  {/* Horário */}
                  <div style={{ minWidth: '42px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: a.disponivel ? '#fcc825' : '#333' }}>
                      {a.turmas?.horario_inicio?.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#444' }}>{a.turmas?.horario_fim?.slice(0, 5)}</div>
                  </div>
                  {/* Divisor */}
                  <div style={{ width: '1px', height: '32px', backgroundColor: a.disponivel ? '#2a2a2a' : '#1a1a1a', flexShrink: 0 }} />
                  {/* Turma + quadra */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: a.disponivel ? '#F0F2F5' : '#333' }}>
                      {a.turmas?.nome}
                    </div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                      {a.turmas?.quadras?.nome}
                      {a.turmas?.niveis?.nome && ` · ${a.turmas.niveis.nome}`}
                    </div>
                  </div>
                  {/* Vagas */}
                  {a.disponivel ? (
                    <span style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0,
                      backgroundColor: vagas >= 3 ? 'rgba(34,197,94,0.15)' : vagas === 2 ? 'rgba(252,200,37,0.15)' : 'rgba(239,68,68,0.15)',
                      color: vagas >= 3 ? '#22c55e' : vagas === 2 ? '#fcc825' : '#ef4444',
                    }}>
                      {vagas} vaga{vagas !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#2a2a2a', padding: '4px 8px', borderRadius: '20px', outline: '1px solid #1a1a1a', flexShrink: 0 }}>
                      {a.jaEsta ? 'inscrito' : 'lotada'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Botão confirmar (aparece ao selecionar slot) */}
        {slotSel && (
          <button onClick={handleConfirmar} disabled={agendar.isPending} style={{
            width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          }}>
            {agendar.isPending
              ? 'Agendando...'
              : `✓ Confirmar — ${slotSel.turmas?.nome} · ${format(new Date(dataSel + 'T12:00'), 'dd/MM', { locale: ptBR })} · ${slotSel.turmas?.horario_inicio?.slice(0,5)}`
            }
          </button>
        )}
      </div>
    </Modal>
  )
}

function ModalGerarAulas({ open, onClose }) {
  const { data: turmas } = useTurmas()
  const gerar = useGerarAulas()
  const [form, setForm] = useState({
    turma_id: '', professor_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })
  const [resultado, setResultado] = useState(null)
  const turmaSelecionada = turmas?.find(t => t.id === form.turma_id)
  const { professores } = useProfessores(turmaSelecionada?.modalidade_id)

  function handleTurmaChange(turma_id) {
    const turma = turmas?.find(t => t.id === turma_id)
    setForm(f => ({ ...f, turma_id, professor_id: turma?.professor_titular_id || '' }))
  }

  async function handleGerar() {
    try {
      const n = await gerar.mutateAsync({
        turmaId: form.turma_id, dataInicio: form.data_inicio,
        dataFim: form.data_fim, professorOverrideId: form.professor_id || null,
      })
      setResultado(n)
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={open} onClose={onClose} title="📅 Aula Mensal / Recorrente" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: '600', color: '#F0F2F5' }}>{resultado} aulas geradas!</div>
            <button onClick={() => { onClose(); setResultado(null) }} style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>Fechar</button>
          </div>
        ) : (
          <>
            <Select label="Turma" value={form.turma_id} onChange={e => handleTurmaChange(e.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
            <Select label="Professor (opcional — substitui o titular)" value={form.professor_id}
              onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
              <option value="">Professor titular da turma</option>
              {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            <Input label="Data Início" type="date" value={form.data_inicio}
              onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            <Input label="Data Fim" type="date" value={form.data_fim}
              onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            <button onClick={handleGerar} disabled={gerar.isPending || !form.turma_id} style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600',
              cursor: !form.turma_id ? 'not-allowed' : 'pointer',
              opacity: !form.turma_id ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <Calendar size={16} />
              {gerar.isPending ? 'Gerando...' : 'Gerar Aulas'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function ModalAulaAvulsa({ open, onClose, atalho }) {
  const qc = useQueryClient()
  const { data: modalidades } = useModalidades()
  const { data: todosAlunos, refetch: refetchAlunos } = useAlunos()
  const salvarAluno = useSalvarAluno()
  const { data: todasQuadras } = useQuadras(null)

  const [modalidadeId, setModalidadeId] = useState('')
  const { professores } = useProfessores(modalidadeId || null)
  const { data: quadras } = useQuadras(modalidadeId || null)
  const { data: niveis } = useNiveis(null)

  const quadraIdAtalho = atalho?.quadraNome
    ? todasQuadras?.find(q => q.nome === atalho.quadraNome)?.id || ''
    : ''

  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '',
  })

  useState(() => {
    if (atalho) {
      setForm(f => ({
        ...f,
        data: atalho.data || format(new Date(), 'yyyy-MM-dd'),
        horario: atalho.horario || '07:00',
        quadra_id: quadraIdAtalho,
      }))
    }
  })

  const [alunos, setAlunos] = useState([])
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'replicar'
  const [aulaOrigem, setAulaOrigem] = useState(null)
  const [datasSelecionadas, setDatasSelecionadas] = useState(new Set())
  const [mesCalendario, setMesCalendario] = useState(new Date())
  const [replicando, setReplicando] = useState(false)
  const [novoAluno, setNovoAluno] = useState({
    show: false, nome: '', telefone: '', nivel: '',
    menor_idade: false, nome_responsavel: '', modalidades_ids: [],
  })

  const horarios = Array.from({ length: 18 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  const alunosFiltrados = buscaAluno.length >= 1
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      )
    : []

  const sugestoesNome = novoAluno.nome.length >= 2
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(novoAluno.nome.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      ) || []
    : []

  function adicionarAluno(aluno, tipo = 'avulso') {
    setAlunos(prev => [...prev, { aluno_id: aluno.id, nome: aluno.nome, tipo }])
    setBuscaAluno('')
  }

  function removerAluno(alunoId) {
    setAlunos(prev => prev.filter(a => a.aluno_id !== alunoId))
  }

  function updateTipoAluno(alunoId, tipo) {
    setAlunos(prev => prev.map(a => a.aluno_id === alunoId ? { ...a, tipo } : a))
  }

  function toggleModalidadeNovoAluno(id) {
    setNovoAluno(n => ({
      ...n,
      modalidades_ids: n.modalidades_ids.includes(id)
        ? n.modalidades_ids.filter(m => m !== id)
        : [...n.modalidades_ids, id]
    }))
  }

  function resetNovoAluno() {
    setNovoAluno({ show: false, nome: '', telefone: '', nivel: '', menor_idade: false, nome_responsavel: '', modalidades_ids: [] })
  }

  function resetTudo() {
    setAlunos([])
    setModalidadeId('')
    setBuscaAluno('')
    setForm({ data: format(new Date(), 'yyyy-MM-dd'), horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '' })
    resetNovoAluno()
    setStep('form')
    setAulaOrigem(null)
    setDatasSelecionadas(new Set())
  }

  function resetForm() {
    setAlunos([])
    setModalidadeId('')
    setBuscaAluno('')
    setForm({ data: format(new Date(), 'yyyy-MM-dd'), horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '' })
    resetNovoAluno()
  }

  const quadraIdResolvida = atalho?.quadraNome
    ? todasQuadras?.find(q => q.nome === atalho.quadraNome)?.id || ''
    : ''

  if (open && atalho && (form.horario !== atalho.horario || form.data !== atalho.data)) {
    setForm(f => ({
      ...f,
      data: atalho.data || f.data,
      horario: atalho.horario || f.horario,
      quadra_id: quadraIdResolvida || f.quadra_id,
    }))
  }

  async function handleCadastrarAluno() {
    if (!novoAluno.nome.trim()) return toast.error('Nome obrigatório')
    if (novoAluno.menor_idade && !novoAluno.nome_responsavel.trim()) return toast.error('Nome do responsável obrigatório')
    try {
      const result = await salvarAluno.mutateAsync({
        nome: novoAluno.nome, telefone: novoAluno.telefone,
        nivel: novoAluno.nivel || null, menor_idade: novoAluno.menor_idade,
        nome_responsavel: novoAluno.menor_idade ? novoAluno.nome_responsavel : null,
        modalidade_id: novoAluno.modalidades_ids[0] || modalidadeId || null, ativo: true,
      })
      if (result?.id && novoAluno.modalidades_ids.length > 0) {
        await supabase.from('alunos_modalidades').insert(
          novoAluno.modalidades_ids.map(mid => ({ aluno_id: result.id, modalidade_id: mid }))
        )
      }
      await refetchAlunos()
      adicionarAluno({ id: result.id, nome: result.nome }, 'avulso')
      resetNovoAluno()
      toast.success('Aluno cadastrado e adicionado!')
    } catch (err) { toast.error(err.message) }
  }

  async function handleReplicar() {
    if (datasSelecionadas.size === 0) return
    setReplicando(true)
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const datas = Array.from(datasSelecionadas).sort()
    let criadas = 0
    let puladas = 0
    for (const dataStr of datas) {
      const { data: existentes } = await supabase
        .from('aulas').select('id').eq('data_aula', dataStr)
        .ilike('observacoes', `%${aulaOrigem.quadraNome}%`)
        .ilike('observacoes', `%${aulaOrigem.horario}%`)
      if (existentes?.length > 0) { puladas++; continue }
      const { data: novaAula, error } = await supabase.from('aulas').insert({
        professor_executou_id: aulaOrigem.professor_id,
        data_aula: dataStr, status: 'confirmada_coord', status_aula: 'dada',
        paga_professor: dataStr < hoje, eh_substituicao: false,
        observacoes: aulaOrigem.observacoes,
      }).select().single()
      if (error || !novaAula) { puladas++; continue }
      if (aulaOrigem.alunos.length > 0) {
        await supabase.from('presencas').insert(
          aulaOrigem.alunos.map(al => ({
            aula_id: novaAula.id, aluno_id: al.aluno_id,
            presente: true, status_presenca: 'presente', tipo_participacao: al.tipo,
          }))
        )
      }
      criadas++
    }
    qc.invalidateQueries({ queryKey: ['aulas'] })
    const msg = puladas > 0
      ? `${criadas} aula(s) replicada(s)${puladas > 0 ? `, ${puladas} ignorada(s) por conflito` : ''}`
      : `Aula replicada em ${criadas} dia(s)!`
    toast.success(msg)
    resetTudo()
    onClose()
    setReplicando(false)
  }

  async function handleSalvar() {
    if (!form.professor_id) return toast.error('Selecione um professor')
    if (!form.quadra_id) return toast.error('Selecione uma quadra')
    if (!form.data) return toast.error('Selecione uma data')
    setSalvando(true)
    try {
      const quadraNome = quadras?.find(q => q.id === form.quadra_id)?.nome
        || todasQuadras?.find(q => q.id === form.quadra_id)?.nome || ''

      const { data: aulasExistentes } = await supabase
        .from('aulas').select('id').eq('data_aula', form.data)
        .ilike('observacoes', `%${quadraNome}%`).ilike('observacoes', `%${form.horario}%`)

      if (aulasExistentes && aulasExistentes.length > 0) {
        toast.error(`⚠️ Já existe uma aula em ${quadraNome} às ${form.horario} neste dia!`)
        setSalvando(false)
        return
      }

      const nivelNome = niveis?.find(n => n.id === form.nivel_id)?.nome || ''

      const { data: aulaData, error: aulaError } = await supabase.from('aulas').insert({
        professor_executou_id: form.professor_id,
        data_aula: form.data, status: 'confirmada_coord', status_aula: 'dada',
        paga_professor: form.data < format(new Date(), 'yyyy-MM-dd'), eh_substituicao: false,
        observacoes: `⚡ Avulsa · ${quadraNome} · ${form.horario}${nivelNome ? ' · ' + nivelNome : ''}`,
      }).select().single()
      if (aulaError) throw aulaError

      if (alunos.length > 0) {
        await supabase.from('presencas').insert(
          alunos.map(al => ({
            aula_id: aulaData.id, aluno_id: al.aluno_id,
            presente: true, status_presenca: 'presente', tipo_participacao: al.tipo,
          }))
        )
      }
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula avulsa criada!')
      setAulaOrigem({
        aulaId: aulaData.id,
        professor_id: form.professor_id,
        alunos: [...alunos],
        quadraNome,
        horario: form.horario,
        nivelNome,
        observacoes: `⚡ Avulsa · ${quadraNome} · ${form.horario}${nivelNome ? ' · ' + nivelNome : ''}`,
        dataOrigem: form.data,
      })
      setMesCalendario(new Date(form.data + 'T12:00:00'))
      setStep('replicar')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { resetTudo(); onClose() }} title={step === 'replicar' ? '📅 Replicar Aula' : '⚡ Aula Avulsa'} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Step: Replicar ── */}
        {step === 'replicar' && aulaOrigem && (() => {
          const primeiroDia = startOfMonth(mesCalendario)
          const totalDias = getDaysInMonth(mesCalendario)
          const iniciaSemana = getDay(primeiroDia)
          const cells = [
            ...Array(iniciaSemana).fill(null),
            ...Array.from({ length: totalDias }, (_, i) => {
              const d = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), i + 1)
              return format(d, 'yyyy-MM-dd')
            }),
          ]
          const hoje = format(new Date(), 'yyyy-MM-dd')
          const toggleData = (ds) => setDatasSelecionadas(prev => {
            const next = new Set(prev)
            if (next.has(ds)) next.delete(ds); else next.add(ds)
            return next
          })
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', fontSize: '12px', color: '#22c55e' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>✓ Aula criada em {format(new Date(aulaOrigem.dataOrigem + 'T12:00:00'), "dd/MM", { locale: ptBR })}</div>
                <div style={{ color: '#888' }}>{aulaOrigem.quadraNome} · {aulaOrigem.horario}{aulaOrigem.nivelNome ? ' · ' + aulaOrigem.nivelNome : ''} · {aulaOrigem.alunos.length} aluno(s)</div>
              </div>

              <div style={{ fontSize: '13px', color: '#ccc', fontWeight: '500' }}>Selecione os dias para replicar:</div>

              {/* Calendário */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <button onClick={() => setMesCalendario(m => addMonths(m, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#ccc', textTransform: 'capitalize' }}>
                    {format(mesCalendario, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button onClick={() => setMesCalendario(m => addMonths(m, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', textAlign: 'center' }}>
                  {['D','S','T','Q','Q','S','S'].map((d, i) => (
                    <div key={i} style={{ fontSize: '10px', color: '#444', paddingBottom: '4px', fontWeight: '600' }}>{d}</div>
                  ))}
                  {cells.map((ds, i) => {
                    if (!ds) return <div key={i} />
                    const isOrigem = ds === aulaOrigem.dataOrigem
                    const isSel = datasSelecionadas.has(ds)
                    const isHoje = ds === hoje
                    return (
                      <button
                        key={ds}
                        disabled={isOrigem}
                        onClick={() => toggleData(ds)}
                        style={{
                          aspectRatio: '1', borderRadius: '8px', border: 'none',
                          fontSize: '11px', fontWeight: isSel || isOrigem ? '700' : '400',
                          cursor: isOrigem ? 'default' : 'pointer',
                          background: isOrigem ? 'rgba(252,200,37,0.15)'
                            : isSel ? 'linear-gradient(135deg,#fcc825,#cf1b9b)'
                            : 'transparent',
                          color: isOrigem ? '#fcc825' : isSel ? 'white' : isHoje ? '#fcc825' : '#888',
                          outline: isHoje && !isSel && !isOrigem ? '1px solid rgba(252,200,37,0.3)' : 'none',
                        }}
                      >
                        {parseInt(ds.split('-')[2])}
                      </button>
                    )
                  })}
                </div>
              </div>

              {datasSelecionadas.size > 0 && (
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
                  {datasSelecionadas.size} dia(s) selecionado(s)
                </div>
              )}

              <button
                onClick={handleReplicar}
                disabled={datasSelecionadas.size === 0 || replicando}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: datasSelecionadas.size > 0 ? 'linear-gradient(135deg,#fcc825,#cf1b9b)' : '#222',
                  color: datasSelecionadas.size > 0 ? 'white' : '#444',
                  fontSize: '14px', fontWeight: '600',
                  cursor: datasSelecionadas.size > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Copy size={15} />
                {replicando ? 'Replicando...' : `Replicar em ${datasSelecionadas.size || '—'} dia(s)`}
              </button>

              <button onClick={() => { resetTudo(); onClose() }} style={{ background: 'none', border: 'none', color: '#555', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>
                Não, finalizar sem replicar
              </button>
            </div>
          )
        })()}

        {/* ── Step: Formulário ── */}
        {step === 'form' && <>

        {atalho && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)', borderRadius: '8px', fontSize: '12px', color: '#fcc825' }}>
            ⚡ Atalho: <strong>{atalho.quadraNome}</strong> · <strong>{atalho.horario}</strong>
          </div>
        )}

        <Select label="Modalidade" value={modalidadeId} onChange={e => { setModalidadeId(e.target.value); setForm(f => ({ ...f, professor_id: '', nivel_id: '' })) }}>
          <option value="">Selecione...</option>
          {modalidades?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Select>

        <Input label="Data da Aula" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />

        <Select label="Horário" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}>
          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
        </Select>

        <Select label="Quadra" value={form.quadra_id} onChange={e => setForm(f => ({ ...f, quadra_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {(todasQuadras || quadras)?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </Select>

        <Select label="Professor" value={form.professor_id} onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>

        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Nível da Aula (opcional)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {niveis?.map(n => (
              <button key={n.id} onClick={() => setForm(f => ({ ...f, nivel_id: f.nivel_id === n.id ? '' : n.id }))} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '12px',
                background: form.nivel_id === n.id ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#110f0f',
                outline: form.nivel_id === n.id ? 'none' : '1px solid #2a2a2a',
                color: form.nivel_id === n.id ? 'white' : '#888', cursor: 'pointer',
              }}>{n.nome}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Alunos ({alunos.length})</div>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {alunos.map(al => (
                <div key={al.aluno_id} style={{ backgroundColor: '#110f0f', borderRadius: '10px', padding: '10px 12px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#F0F2F5', flex: 1 }}>{al.nome}</span>
                  <select value={al.tipo} onChange={e => updateTipoAluno(al.aluno_id, e.target.value)} style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: TIPOS_PARTICIPACAO.find(t => t.value === al.tipo)?.color || '#888', cursor: 'pointer', outline: 'none' }}>
                    {TIPOS_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button onClick={() => removerAluno(al.aluno_id)} style={{ padding: '4px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer' }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <input placeholder="Buscar aluno para adicionar..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#110f0f', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#fcc825'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
            {alunosFiltrados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                {alunosFiltrados.map(a => (
                  <button key={a.id} onClick={() => adicionarAluno(a)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >{a.nome}</button>
                ))}
              </div>
            )}
          </div>

          {!novoAluno.show ? (
            <button onClick={() => setNovoAluno(n => ({ ...n, show: true }))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <UserPlus size={13} /> Cadastrar novo aluno
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#110f0f', border: '1px solid rgba(252,200,37,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fcc825' }}>👤 Novo Aluno</div>
              <div style={{ position: 'relative' }}>
                <input placeholder="Nome completo *" value={novoAluno.nome} onChange={e => setNovoAluno(n => ({ ...n, nome: e.target.value }))} style={inputInline} />
                {sugestoesNome.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, backgroundColor: '#1a1a1a', border: '1px solid rgba(252,200,37,0.4)', borderRadius: '10px', marginTop: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '10px', color: '#fcc825', padding: '6px 12px 4px', borderBottom: '1px solid #2a2a2a' }}>⚠️ Já cadastrado — clique para adicionar direto</div>
                    {sugestoesNome.map(a => (
                      <button key={a.id} onClick={() => { adicionarAluno(a, 'avulso'); resetNovoAluno() }} style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <span>{a.nome}</span>
                        {a.nivel && <span style={{ fontSize: '10px', color: '#cf1b9b' }}>{a.nivel}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input placeholder="Telefone (WhatsApp)" value={novoAluno.telefone} onChange={e => setNovoAluno(n => ({ ...n, telefone: e.target.value }))} style={inputInline} />
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Nível do Aluno (opcional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {NIVEIS_ALUNO.map(n => (
                    <button key={n} onClick={() => setNovoAluno(na => ({ ...na, nivel: na.nivel === n ? '' : n }))} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', background: novoAluno.nivel === n ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a', outline: novoAluno.nivel === n ? 'none' : '1px solid #2a2a2a', color: novoAluno.nivel === n ? 'white' : '#888', cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setNovoAluno(n => ({ ...n, menor_idade: !n.menor_idade }))} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: novoAluno.menor_idade ? 'rgba(252,200,37,0.1)' : '#1a1a1a', outline: novoAluno.menor_idade ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a', color: novoAluno.menor_idade ? '#fcc825' : '#888', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '12px' }}>
                <span>{novoAluno.menor_idade ? '✓' : '○'}</span><span>Menor de idade</span>
              </button>
              {novoAluno.menor_idade && (
                <input placeholder="Nome do responsável *" value={novoAluno.nome_responsavel} onChange={e => setNovoAluno(n => ({ ...n, nome_responsavel: e.target.value }))} style={inputInline} />
              )}
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Modalidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {modalidades?.map(m => (
                    <button key={m.id} onClick={() => toggleModalidadeNovoAluno(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', border: 'none', background: novoAluno.modalidades_ids.includes(m.id) ? 'rgba(252,200,37,0.1)' : '#1a1a1a', outline: novoAluno.modalidades_ids.includes(m.id) ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a', color: novoAluno.modalidades_ids.includes(m.id) ? '#fcc825' : '#888', cursor: 'pointer', fontSize: '12px', width: '100%' }}>
                      <span>{m.nome}</span>
                      <span>{novoAluno.modalidades_ids.includes(m.id) ? '✓' : '+'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={resetNovoAluno} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCadastrarAluno} disabled={salvarAluno.isPending} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  {salvarAluno.isPending ? 'Salvando...' : '✓ Cadastrar e Adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSalvar} disabled={salvando} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Plus size={16} />
          {salvando ? 'Salvando...' : 'Criar Aula Avulsa'}
        </button>
        </>}
      </div>
    </Modal>
  )
}