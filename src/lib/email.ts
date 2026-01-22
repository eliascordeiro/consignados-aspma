import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`

  try {
    await resend.emails.send({
      from: process.env.SMTP_FROM || 'noreply@consigexpress.com',
      to: email,
      subject: 'Redefinição de Senha - ConsigExpress',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Redefinição de Senha</h1>
              </div>
              <div class="content">
                <p>Olá,</p>
                <p>Você solicitou a redefinição de senha para sua conta no <strong>ConsigExpress</strong>.</p>
                <p>Clique no botão abaixo para criar uma nova senha:</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Redefinir Senha</a>
                </div>
                <p>Ou copie e cole este link no seu navegador:</p>
                <p style="word-break: break-all; color: #0ea5e9;">${resetUrl}</p>
                <p><strong>Este link expira em 1 hora.</strong></p>
                <p>Se você não solicitou esta redefinição, ignore este email.</p>
              </div>
              <div class="footer">
                <p>© 2026 ConsigExpress - Plataforma de Consignados</p>
              </div>
            </div>
          </body>
        </html>
      `,
    })
    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    return { success: false, error }
  }
}

export async function sendWelcomeEmail(email: string, name: string, createdBy: string) {
  const loginUrl = `${process.env.NEXTAUTH_URL}/forgot-password`

  try {
    await resend.emails.send({
      from: process.env.SMTP_FROM || 'noreply@consigexpress.com',
      to: email,
      subject: 'Bem-vindo ao ConsigExpress',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .info-box { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Bem-vindo ao ConsigExpress!</h1>
              </div>
              <div class="content">
                <p>Olá <strong>${name}</strong>,</p>
                <p>Sua conta foi criada com sucesso por <strong>${createdBy}</strong>.</p>
                
                <div class="info-box">
                  <p style="margin: 0;"><strong>📧 Seu email de acesso:</strong></p>
                  <p style="margin: 5px 0 0 0; color: #0ea5e9; font-size: 16px;">${email}</p>
                </div>

                <p>Para começar a usar o sistema, você precisa criar sua senha:</p>

                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">Criar Minha Senha</a>
                </div>

                <p>Ou acesse diretamente:</p>
                <p style="word-break: break-all; color: #0ea5e9;">${loginUrl}</p>

                <p><strong>Próximos passos:</strong></p>
                <ol>
                  <li>Clique no botão acima ou acesse o link</li>
                  <li>Digite seu email: <strong>${email}</strong></li>
                  <li>Crie sua senha seguindo as instruções</li>
                  <li>Faça login e comece a usar o sistema</li>
                </ol>

                <p>Qualquer dúvida, entre em contato com o administrador do sistema.</p>
              </div>
              <div class="footer">
                <p>© 2026 ConsigExpress - Plataforma de Consignados</p>
              </div>
            </div>
          </body>
        </html>
      `,
    })
    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error)
    return { success: false, error }
  }
}
