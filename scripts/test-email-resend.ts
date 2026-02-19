import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function testEmail() {
  console.log('🔍 Testando envio de email via Resend...\n')
  console.log('📧 SMTP_FROM:', process.env.SMTP_FROM || 'aspma@aspma-consignados.com.br')
  console.log('🔑 API Key:', process.env.RESEND_API_KEY?.substring(0, 10) + '...\n')

  try {
    const result = await resend.emails.send({
      from: process.env.SMTP_FROM || 'aspma@aspma-consignados.com.br',
      to: 'eliascordeiro@gmail.com', // Altere para seu email de teste
      subject: 'Teste de Email - ASPMA',
      html: `
        <h1>Teste de Email</h1>
        <p>Este é um email de teste do domínio aspma-consignados.com.br</p>
        <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
      `,
    })

    console.log('✅ Email enviado com sucesso!')
    console.log('📬 ID:', result.data?.id)
    console.log('📝 Resultado completo:', JSON.stringify(result, null, 2))
  } catch (error: any) {
    console.error('❌ Erro ao enviar email:')
    console.error('Mensagem:', error.message)
    console.error('Detalhes:', JSON.stringify(error, null, 2))
  }
}

testEmail()
