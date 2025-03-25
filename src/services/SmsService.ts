import twilio from 'twilio';

class SmsService {
  private client: twilio.Twilio;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      console.warn('Twilio credentials not configured properly');
    }
    
    this.client = twilio(accountSid, authToken);
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    try {
      // Formato internacional para o número de telefone
      const formattedNumber = this.formatPhoneNumber(to);
      
      await this.client.messages.create({
        body: `Seu código de verificação para Extratos Portuários é: ${code}. Este código é válido por 10 minutos.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedNumber,
      });
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error('Failed to send verification code SMS');
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove caracteres não numéricos
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Se o número já começa com +, retornar como está
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    // Se o número começa com 0, assumimos que é um número doméstico
    if (cleaned.startsWith('0')) {
      return `+55${cleaned.substring(1)}`;
    }
    
    // Se o número não tem código do país, assumimos Brasil (+55)
    if (cleaned.length <= 11) {
      return `+55${cleaned}`;
    }
    
    // Se já tem código de país sem o +, adicionar o +
    return `+${cleaned}`;
  }
}

export default new SmsService();