import jwt from 'jsonwebtoken';
import { User } from '../models/UserModel';

const JWT_SECRET = process.env.JWT_SECRET || 'extratos-portuarios-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export const generateToken = (user: User): string => {
  // Criamos o payload com os dados necessários
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };
  
  // Usando uma abordagem mais simples
  try {
    // Usamos as tipagens corretas conforme esperado pelo JWT
    return jwt.sign(
      payload, 
      JWT_SECRET, 
      // Aqui é onde estava o problema - usando uma asserção de tipo 
      // para informar ao TypeScript que este valor é compatível
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    throw new Error('Falha ao gerar token');
  }
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const generateTwoFactorCode = (): string => {
  // Gerar código numérico de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getTwoFactorExpiry = (): Date => {
  // Código válido por 10 minutos
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);
  return expiry;
};