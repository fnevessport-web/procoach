import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const secaoStyle = { marginBottom: '28px' }
const tituloStyle = { fontSize: '15px', fontWeight: '700', color: '#F0F2F5', margin: '0 0 10px' }
const paragrafoStyle = { fontSize: '13px', color: '#aaa', lineHeight: '1.7', margin: '0 0 8px' }
const listaStyle = { fontSize: '13px', color: '#aaa', lineHeight: '1.7', margin: '0 0 8px', paddingLeft: '20px' }

function Secao({ titulo, children }) {
  return (
    <div style={secaoStyle}>
      <h2 style={tituloStyle}>{titulo}</h2>
      {children}
    </div>
  )
}

export function PoliticaPrivacidadePage() {
  const navigate = useNavigate()

  return (
    <div style={{
      height: '100vh', width: '100%', backgroundColor: '#110f0f',
      display: 'flex', justifyContent: 'center', padding: '24px 16px',
      boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ width: '100%', maxWidth: '640px' }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
          color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '20px',
        }}>
          <ChevronLeft size={16} /> Voltar
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '40px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: '0 0 4px' }}>
            Política de Privacidade
          </h1>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Última atualização: 10 de julho de 2026</p>
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: '12px', marginBottom: '28px',
          backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.25)',
        }}>
          <p style={{ fontSize: '12px', color: '#fcc825', margin: 0, lineHeight: '1.6' }}>
            ⚠️ Este documento descreve tecnicamente quais dados o sistema ProCoach coleta e como
            trata cada um deles. Recomendamos que um advogado revise o texto antes de tratá-lo
            como o documento jurídico oficial do negócio (base legal, cláusulas contratuais e
            eventuais obrigações setoriais específicas ficam a critério dessa revisão).
          </p>
        </div>

        <Secao titulo="1. Quem trata os seus dados">
          <p style={paragrafoStyle}>
            O ProCoach é o sistema de gestão utilizado pela escola esportiva para organizar
            turmas, aulas, presenças, avaliações técnicas e o relacionamento com alunos,
            professores e colaboradores. O controlador dos dados tratados neste sistema é a
            própria escola/clube que opera o ProCoach — não uma empresa terceira de tecnologia.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados coletamos">
          <p style={paragrafoStyle}><b>De alunos (e responsáveis, quando menores de idade):</b></p>
          <ul style={listaStyle}>
            <li>Nome completo, telefone/WhatsApp e e-mail</li>
            <li>CPF e data de nascimento</li>
            <li>Foto de perfil (opcional, enviada pelo próprio aluno/responsável ou pela equipe)</li>
            <li>Modalidade(s) praticada(s) e nível técnico</li>
            <li>Quando menor de idade: nome do responsável legal</li>
            <li>Vínculos familiares informados (cônjuge, filho, responsável) para organização de matrícula</li>
            <li>Histórico de presença, faltas e reposições de aula</li>
            <li>Avaliações técnicas registradas pelo professor (notas por fundamento e comentários)</li>
          </ul>
          <p style={paragrafoStyle}><b>De professores e demais colaboradores:</b></p>
          <ul style={listaStyle}>
            <li>Nome, foto, telefone, e-mail e CPF</li>
            <li>Data e local de nascimento, endereço completo</li>
            <li>Dados bancários e chave PIX, para fins de pagamento</li>
            <li>CNPJ/razão social (quando o colaborador presta serviço como pessoa jurídica)</li>
            <li>Registro profissional (CREF), quando aplicável, e contrato assinado</li>
          </ul>
          <p style={paragrafoStyle}><b>Dados de acesso e uso do sistema:</b></p>
          <ul style={listaStyle}>
            <li>CPF é usado como credencial de login (o sistema não exige um e-mail pessoal real para autenticação)</li>
            <li>Registro de auditoria de alterações feitas por cada usuário no sistema</li>
            <li>Lançamentos financeiros, comprovantes e notas fiscais anexados pela equipe</li>
          </ul>
        </Secao>

        <Secao titulo="3. Para que usamos esses dados">
          <ul style={listaStyle}>
            <li>Organizar matrículas, turmas, grade de horários e vagas</li>
            <li>Controlar presença, faltas, reposições e evolução técnica dos alunos</li>
            <li>Viabilizar o pagamento de professores e colaboradores</li>
            <li>Permitir a comunicação entre professor, coordenação e aluno/responsável</li>
            <li>Cumprir obrigações legais, contratuais, trabalhistas e fiscais da escola</li>
          </ul>
        </Secao>

        <Secao titulo="4. Com quem seus dados são compartilhados">
          <p style={paragrafoStyle}>
            Os dados ficam armazenados em provedores de infraestrutura contratados pela escola
            para operar o sistema (banco de dados e hospedagem em nuvem). Esses provedores têm
            acesso técnico à infraestrutura, mas não usam os dados para finalidade própria.
          </p>
          <p style={paragrafoStyle}>
            Não vendemos nem compartilhamos dados com terceiros para fins de marketing. Contatos
            de WhatsApp são abertos manualmente pela equipe quando necessário — o sistema não
            envia mensagens automáticas para números de terceiros.
          </p>
        </Secao>

        <Secao titulo="5. Dados de menores de idade">
          <p style={paragrafoStyle}>
            Quando o aluno é menor de idade, o cadastro é feito com o nome do responsável legal
            vinculado, e o tratamento dos dados fica restrito às finalidades educacionais e
            esportivas descritas neste documento.
          </p>
        </Secao>

        <Secao titulo="6. Segurança">
          <ul style={listaStyle}>
            <li>Conexão criptografada (HTTPS) em todo o site</li>
            <li>Acesso ao sistema controlado por login e por papel de usuário (cada pessoa só vê o que precisa pra sua função)</li>
            <li>Contas vinculadas a uma unidade específica não têm acesso aos dados financeiros/cadastrais de outra unidade</li>
            <li>Registro de auditoria das alterações feitas no sistema</li>
          </ul>
        </Secao>

        <Secao titulo="7. Seus direitos como titular dos dados">
          <p style={paragrafoStyle}>Você pode solicitar, a qualquer momento:</p>
          <ul style={listaStyle}>
            <li>Confirmação de que tratamos seus dados, e acesso a eles</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados</li>
            <li>Eliminação ou anonimização de dados tratados de forma desnecessária</li>
            <li>Portabilidade dos dados para outro fornecedor</li>
            <li>Informação sobre com quem seus dados são compartilhados</li>
            <li>Revogação de consentimento e oposição ao tratamento, quando aplicável</li>
          </ul>
          <p style={paragrafoStyle}>
            Para exercer qualquer um desses direitos, entre em contato diretamente com a
            coordenação da escola.
          </p>
        </Secao>

        <Secao titulo="8. Por quanto tempo guardamos os dados">
          <p style={paragrafoStyle}>
            Os dados são mantidos enquanto durar o vínculo do aluno ou colaborador com a escola,
            e pelo prazo adicional exigido por obrigações legais, contratuais, fiscais ou
            trabalhistas aplicáveis, mesmo após o encerramento do vínculo.
          </p>
        </Secao>

        <Secao titulo="9. Alterações desta política">
          <p style={paragrafoStyle}>
            Este documento pode ser atualizado sempre que o sistema passar a coletar ou tratar
            dados de forma diferente. A data no topo da página indica a versão mais recente.
          </p>
        </Secao>

        <Secao titulo="10. Contato">
          <p style={paragrafoStyle}>
            Dúvidas sobre este documento ou sobre o tratamento dos seus dados podem ser
            direcionadas à coordenação da escola.
          </p>
        </Secao>

        <p style={{ textAlign: 'center', fontSize: '10px', color: '#222', marginTop: '24px', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </p>
      </div>
    </div>
  )
}
