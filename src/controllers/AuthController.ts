import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import UserModel from '../models/UserModel';
import { generateToken, generateTwoFactorCode, getTwoFactorExpiry } from '../utils/tokens';
import EmailService from '../services/EmailService';
import SmsService from '../services/SmsService';

export class AuthController {
  // Registro de novo usuário
  static async register(req: Request, res: Response) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      const { name, email, password, role, phoneNumber } = req.body;
      
      // Verificar se o email já está em uso
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email já está em uso' 
        });
      }
      
      // Criar novo usuário
      const user = new UserModel({
        name,
        email,
        password,
        role,
        phoneNumber,
        twoFactorEnabled: true
      });
      
      await user.save();
      
      res.status(201).json({
        success: true,
        message: 'Usuário registrado com sucesso',
        userId: user._id
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao registrar usuário' 
      });
    }
  }
  
// Login de usuário
static async login(req: Request, res: Response) {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    // Buscar usuário pelo email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciais inválidas' 
      });
    }
    
    // Verificar senha
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciais inválidas' 
      });
    }
    
    // Verificar se 2FA está ativado
    if (user.twoFactorEnabled) {
      // Gerar código de verificação
      const code = generateTwoFactorCode();
      const expiry = getTwoFactorExpiry();
      
      // Salvar código e expiração no usuário
      user.twoFactorCode = code;
      user.twoFactorCodeExpiry = expiry;
      await user.save();
      
      // Enviar código por email e SMS
      try {
        await EmailService.sendVerificationCode(user.email, code);
        await SmsService.sendVerificationCode(user.phoneNumber, code);
      } catch (error) {
        console.error('Erro ao enviar código de verificação:', error);
      }
      
      // Armazenar ID do usuário na sessão para verificação 2FA
      if (req.session) {
        // Converter o ObjectId para string
        req.session.userId = user._id.toString();
        req.session.twoFactorVerified = false;
      }
      
      return res.status(200).json({
        success: true,
        message: 'Verificação em dois fatores necessária',
        requiresVerification: true
      });
    }
    
    // Se 2FA não estiver ativado, gerar token JWT
    const token = generateToken(user);
    
    // Definir token como cookie HTTP-only
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 dia
    });
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao fazer login' 
    });
  }
}
  
  // Verificação de código 2FA
  static async verifyTwoFactor(req: Request, res: Response) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      const { code } = req.body;
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sessão inválida, faça login novamente' 
        });
      }
      
      // Buscar usuário
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }
      
      // Verificar código
      if (!user.twoFactorCode || !user.twoFactorCodeExpiry) {
        return res.status(400).json({ 
          success: false, 
          message: 'Código de verificação não gerado' 
        });
      }
      
      // Verificar expiração
      if (new Date() > user.twoFactorCodeExpiry) {
        return res.status(400).json({ 
          success: false, 
          message: 'Código expirado, faça login novamente' 
        });
      }
      
      // Verificar código
      if (user.twoFactorCode !== code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Código inválido' 
        });
      }
      
      // Limpar código e expiração
      user.twoFactorCode = undefined;
      user.twoFactorCodeExpiry = undefined;
      await user.save();
      
      // Marcar verificação como concluída
      req.session.twoFactorVerified = true;
      
      // Gerar token JWT
      const token = generateToken(user);
      
      // Definir token como cookie HTTP-only
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 dia
      });
      
      res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Erro na verificação 2FA:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao verificar código' 
      });
    }
  }
  
  // Reenviar código 2FA
  static async resendTwoFactorCode(req: Request, res: Response) {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sessão inválida, faça login novamente' 
        });
      }
      
      // Buscar usuário
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }
      
      // Gerar novo código
      const code = generateTwoFactorCode();
      const expiry = getTwoFactorExpiry();
      
      // Salvar código e expiração
      user.twoFactorCode = code;
      user.twoFactorCodeExpiry = expiry;
      await user.save();
      
      // Enviar código por email e SMS
      try {
        await EmailService.sendVerificationCode(user.email, code);
        await SmsService.sendVerificationCode(user.phoneNumber, code);
      } catch (error) {
        console.error('Erro ao reenviar código de verificação:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Erro ao enviar código de verificação' 
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Código de verificação reenviado'
      });
    } catch (error) {
      console.error('Erro ao reenviar código 2FA:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao reenviar código' 
      });
    }
  }
  
  // Logout
  static async logout(req: Request, res: Response) {
    try {
      // Limpar sessão
      req.session.destroy((err) => {
        if (err) {
          console.error('Erro ao destruir sessão:', err);
        }
      });
      
      // Limpar cookie
      res.clearCookie('token');
      
      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      console.error('Erro no logout:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao fazer logout' 
      });
    }
  }
  
  // Obter usuário atual
  static async getCurrentUser(req: Request, res: Response) {
    try {
      // O middleware de autenticação já adiciona o usuário à requisição
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Acesso não autorizado' 
        });
      }
      
      res.status(200).json({
        success: true,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          phoneNumber: req.user.phoneNumber,
          twoFactorEnabled: req.user.twoFactorEnabled
        }
      });
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao obter usuário' 
      });
    }
  }
  
  // Atualizar perfil do usuário
  static async updateProfile(req: Request, res: Response) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Acesso não autorizado' 
        });
      }
      
      const { name, email, password, phoneNumber, twoFactorEnabled } = req.body;
      
      // Verificar se já existe um usuário com este email
      if (email && email !== req.user.email) {
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ 
            success: false, 
            message: 'Email já está em uso' 
          });
        }
      }
      
      // Atualizar campos
      if (name) req.user.name = name;
      if (email) req.user.email = email;
      if (password) req.user.password = password;
      if (phoneNumber) req.user.phoneNumber = phoneNumber;
      if (twoFactorEnabled !== undefined) req.user.twoFactorEnabled = twoFactorEnabled;
      
      await req.user.save();
      
      res.status(200).json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          phoneNumber: req.user.phoneNumber,
          twoFactorEnabled: req.user.twoFactorEnabled
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao atualizar perfil' 
      });
    }
  }
}