import nodemailer from 'nodemailer';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Extratos Portuários" <${process.env.EMAIL_FROM || 'noreply@extratos.com'}>`,
        to,
        subject: "Código de Verificação - Extratos Portuários",
        text: `Seu código de verificação é: ${code}. Este código é válido por 10 minutos.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verificação em Dois Fatores</h2>
            <p>Olá,</p>
            <p>Seu código de verificação para acessar o sistema de Extratos Portuários é:</p>
            <div style="background-color: #f4f4f4; padding: 12px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 4px;">
              ${code}
            </div>
            <p>Este código é válido por 10 minutos.</p>
            <p>Se você não solicitou este código, por favor ignore este email.</p>
            <p>Atenciosamente,<br>Equipe Extratos Portuários</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send verification code email');
    }
  }
}

export default new EmailService();