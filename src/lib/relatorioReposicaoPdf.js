// PDF "Grade de Reposição de Tênis" pra mandar no grupo dos professores — mesmo padrão do
// resto do app (html2canvas tira um print de um HTML montado na hora, jsPDF embute como
// imagem; ver src/lib/relatorioPdf.js, que já faz isso pro relatório de evolução técnica).
// Diferente daquele arquivo (intocado por regra do redesign), este é novo e específico da
// reposição extra — pode evoluir livremente.
import { format } from 'date-fns'
import { fotoProfessor, nomeProfessor, faixaHorario, rotuloDiaLongo, rotuloNivel } from '../pages/reposicao/constantes'

const SILHUETA_SVG = `<svg viewBox="0 0 24 24" width="60%" height="60%" fill="#F0EAD8"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z"/></svg>`

function corVagas(ocupadas, capacidade) {
  if (ocupadas >= capacidade) return '#B4472F'
  if (capacidade - ocupadas <= Math.max(1, Math.floor(capacidade / 3))) return '#C98A3C'
  return '#4B8B6A'
}

function cardHtml(s, professores) {
  const ocupadas = (s.extras_agendamentos || []).filter(a => a.status === 'confirmado').length
  const nome = nomeProfessor(s.professor)
  const foto = fotoProfessor(s.professor, professores)
  const indefinido = !nome || /a definir/i.test(nome)
  const fotoHtml = foto
    ? `<img src="${foto}" crossorigin="anonymous" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:1.5px solid #A54C2E;flex-shrink:0;" />`
    : `<span style="width:26px;height:26px;border-radius:50%;background:#1E2B24;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${SILHUETA_SVG}</span>`
  return `
    <div style="background:#FFFFFF;border:1px solid #E8E0CE;border-radius:10px;padding:9px 10px;display:flex;flex-direction:column;gap:5px;break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:12px;font-weight:800;color:#1E2B24;">${faixaHorario(s)}</span>
        <span style="font-size:11px;font-weight:800;color:${corVagas(ocupadas, s.capacidade)};">${ocupadas}/${s.capacidade}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;font-size:9.5px;color:#4A5850;">
        <span style="display:inline-block;width:fit-content;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;padding:2px 6px;border-radius:5px;background:#EAF1EE;color:#3D6B7A;">${s.formato === 'individual' ? 'Individual' : (rotuloNivel(s) || 'Grupo')}</span>
        <span>${s.quadra || ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:2px;padding-top:6px;border-top:1px dashed #E8E0CE;">
        ${fotoHtml}
        <span style="font-size:10.5px;font-weight:700;color:${indefinido ? '#8A8577' : '#1E2B24'};${indefinido ? 'font-style:italic;font-weight:600;' : ''}">${nome || 'A definir'}</span>
      </div>
    </div>`
}

function diaHtml(data, itens, professores) {
  const totalVagas = itens.reduce((n, s) => n + s.capacidade, 0)
  const totalOcup = itens.reduce((n, s) => n + (s.extras_agendamentos || []).filter(a => a.status === 'confirmado').length, 0)
  return `
    <section style="margin-bottom:20px; break-inside:avoid-page;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:#1E2B24;color:#F0EAD8;padding:8px 14px;border-radius:9px;margin-bottom:10px;">
        <span style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;">${rotuloDiaLongo(data)}</span>
        <span style="font-size:11px;color:#B4BFB6;">${itens.length} horários · ${totalOcup}/${totalVagas} vagas ocupadas</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
        ${itens.map(s => cardHtml(s, professores)).join('')}
      </div>
    </section>`
}

// slots: extras_slots já com extras_agendamentos embutido (mesmo formato de useExtrasAgenda).
// professores: [{ id, nome, foto_url }] (useProfessoresFotoExtra).
export async function gerarPdfGradeReposicao(slots, professores) {
  const { jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')

  const reposicaoTenis = slots.filter(s => s.tipo === 'reposicao' && s.modalidade === 'Tênis' && s.ativo !== false)
  const dias = [...new Set(reposicaoTenis.map(s => s.data_aula))].sort()
  const secoes = dias.map(d => diaHtml(d, reposicaoTenis.filter(s => s.data_aula === d)
    .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio) || (a.quadra || '').localeCompare(b.quadra || '')), professores)).join('')

  const primeiroDia = dias[0] ? format(new Date(dias[0] + 'T12:00:00'), 'dd/MM') : ''
  const ultimoDia = dias[dias.length - 1] ? format(new Date(dias[dias.length - 1] + 'T12:00:00'), 'dd/MM/yyyy') : ''

  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed; left:-9999px; top:0; width:1200px; background:#F0EAD8; padding:28px 32px; box-sizing:border-box; font-family:Inter,sans-serif; color:#1E2B24;'
  wrapper.innerHTML = `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:6px;">
      <img src="/images/logo-pc-green.png" style="height:44px;" />
      <div style="width:1px;height:34px;background:#DED5C0;"></div>
      <img src="/images/logoprocopio_preto.png" style="height:30px;" />
    </div>
    <div style="margin:14px 0 20px;">
      <h1 style="font-family:'Playfair Display',serif;font-size:26px;margin:0 0 4px;color:#1E2B24;">Grade de Reposição de Tênis</h1>
      <div style="font-size:12px;color:#4A5850;">Aulas extras · ${primeiroDia} a ${ultimoDia} · para uso interno dos professores</div>
    </div>
    ${secoes}
    <div style="margin-top:18px;font-size:10px;color:#8A8577;text-align:center;">ProCoach e Procópio. Grade sujeita a atualização conforme novos agendamentos pelo link.</div>
  `
  document.body.appendChild(wrapper)

  // espera as fotos carregarem (ou falharem) antes do print, senão saem em branco no PDF
  await Promise.all([...wrapper.querySelectorAll('img')].map(img =>
    img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res })))
  await new Promise(res => setTimeout(res, 150))

  try {
    const canvas = await html2canvas(wrapper, { backgroundColor: '#F0EAD8', scale: 2, useCORS: true })
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [canvas.width / 2, canvas.height / 2] })
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2)
    doc.save(`Grade_Reposicao_Tenis_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  } finally {
    document.body.removeChild(wrapper)
  }
}
