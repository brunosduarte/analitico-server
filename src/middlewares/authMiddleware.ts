import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/tokens';
import UserModel, { User } from '../models/UserModel';

// Extender a interface Request para incluir usuário
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar token
    const decoded = verifyToken(token);
    
    // Verificar se o usuário existe no banco de dados
    const user = await UserModel.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    // Adicionar usuário à requisição
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

export const twoFactorAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Obtenha o ID do usuário da sessão
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Acesso não autorizado' 
      });
    }
    
    // Verifique se a verificação 2FA foi concluída
    const twoFactorVerified = req.session.twoFactorVerified;
    
    if (!twoFactorVerified) {
      return res.status(403).json({
        success: false,
        message: 'Verificação em dois fatores necessária',
        requiresVerification: true
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar autenticação em dois fatores' 
    });
  }
};