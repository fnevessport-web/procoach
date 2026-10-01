// PDF da tela Organizar Grade: uma página A4 deitada por dia (seg a sáb), no formato da agenda
// (horários nas linhas, quadras nas colunas). Cada turma sai com nível e ocupação; onde o cenário
// ainda não tem professor, sai uma linha em branco pra preencher à mão. Mesmo padrão dos outros
// PDFs do app: html2canvas tira o print de um HTML montado na hora e o jsPDF embute como imagem.
import { format, parseISO } from 'date-fns'

const C = { fundo: '#F7F3E8', texto: '#1E2B24', sec: '#4A5850', muted: '#8A8577', borda: '#DED5C0', cabecalho: '#1E2B24', cabTexto: '#F0EAD8', vazio: '#FFFFFF', saibro: '#A54C2E' }
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function cartao({ nivel, ocup, cap, prof, livre }) {
  const linhaProf = prof
    ? `<div style="display:flex;align-items:center;gap:5px;margin-top:4px;font-size:11px;font-weight:600;color:${C.texto};">
         <span style="width:8px;height:8px;border-radius:50%;background:${prof.cor};flex-shrink:0;"></span>${esc(prof.nome)}</div>`
    : `<div style="margin-top:6px;border-bottom:1px solid ${C.muted};height:20px;display:flex;align-items:flex-end;font-size:8px;color:${C.muted};">prof.</div>`
  return `
    <div style="border:1px solid ${C.borda};border-left:3px solid ${prof ? prof.cor : C.borda};border-radius:6px;background:${C.vazio};padding:4px 6px 5px;margin-bottom:3px;">
      <div style="display:flex;justify-content:space-between;gap:6px;font-size:10px;">
        <span style="color:${livre ? C.muted : C.sec};${livre ? 'font-style:italic;' : ''}overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(nivel)}</span>
        ${livre ? '' : `<strong style="color:${C.texto};flex-shrink:0;">${ocup}/${cap}</strong>`}
      </div>
      ${linhaProf}
    </div>`
}

function htmlDia({ dia, itens, semana }) {
  const quadras = [...new Set(itens.map(i => i.quadra))].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }))
  const horas = [...new Set(itens.map(i => i.hora))].sort()
  const comProf = itens.filter(i => i.prof).length
  const reais = itens.filter(i => !i.livre).length
  const colunas = `56px repeat(${quadras.length}, 1fr)`
  const cab = quadras.map(q => `<div style="background:${C.cabecalho};color:${C.cabTexto};font-size:11px;font-weight:700;text-align:center;padding:6px;border-radius:6px;">${esc(q)}</div>`).join('')
  const linhas = horas.map(h => {
    const celulas = quadras.map(q => {
      const doCanto = itens.filter(i => i.hora === h && i.quadra === q)
      return `<div style="border:1px dashed ${C.borda};border-radius:6px;padding:3px;min-height:26px;">${doCanto.map(cartao).join('')}</div>`
    }).join('')
    return `<div style="font-size:12px;font-weight:800;color:${C.sec};text-align:right;padding:6px 6px 0 0;">${h}</div>${celulas}`
  }).join('')
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="/images/logo-pc-green.png" style="height:34px;" />
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:${C.texto};">Organização da Grade · ${esc(dia.longo)}</div>
          <div style="font-size:11px;color:${C.sec};">Tênis · ${reais} turmas com aluno · ${itens.length - reais} horários livres · ${comProf} com professor · alunos da semana ${esc(semana)}</div>
        </div>
      </div>
      <div style="font-size:10px;color:${C.muted};">Rascunho interno · ${format(new Date(), 'dd/MM/yyyy')}</div>
    </div>
    <div style="display:grid;grid-template-columns:${colunas};gap:5px;">
      <div></div>${cab}
      ${linhas}
    </div>
    <div style="margin-top:8px;font-size:9px;color:${C.muted};">Número = alunos na lista da aula na semana de referência / vagas (individual 1, grupo 4). Livre = vaga sem turma na semana. Linha em branco = professor a definir.</div>`
}

// itens: [{ dia: 'segunda', hora: '07:00', quadra: 'Quadra 4', nivel, ocup, cap, prof: {nome, cor} | null }]
export async function gerarPdfOrganizarGrade({ itens, dias, semanaInicio, semanaFim }) {
  const { jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const semana = `${format(parseISO(semanaInicio), 'dd/MM')} a ${format(parseISO(semanaFim), 'dd/MM')}`
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const larg = 841.89, alt = 595.28, margem = 18
  let primeira = true

  for (const dia of dias) {
    const doDia = itens.filter(i => i.dia === dia.chave)
    if (!doDia.length) continue
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:1123px;background:${C.fundo};padding:20px 22px;box-sizing:border-box;font-family:Inter,sans-serif;color:${C.texto};`
    wrapper.innerHTML = htmlDia({ dia, itens: doDia, semana })
    document.body.appendChild(wrapper)
    await Promise.all([...wrapper.querySelectorAll('img')].map(img =>
      img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res })))
    try {
      const canvas = await html2canvas(wrapper, { backgroundColor: C.fundo, scale: 2, useCORS: true })
      // Encaixa a página inteira do dia numa folha (reduz se o dia tiver muita turma).
      const escala = Math.min((larg - margem * 2) / canvas.width, (alt - margem * 2) / canvas.height)
      const w = canvas.width * escala, h = canvas.height * escala
      if (!primeira) doc.addPage()
      primeira = false
      doc.setFillColor(C.fundo)
      doc.rect(0, 0, larg, alt, 'F')
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (larg - w) / 2, margem, w, h)
    } finally {
      document.body.removeChild(wrapper)
    }
  }
  doc.save(`Organizacao_Grade_Tenis_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
