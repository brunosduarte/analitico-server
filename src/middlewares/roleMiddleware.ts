import { Request, Response, NextFunction } from 'express';

export const roleMiddleware = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Verificar se o middleware de autenticação já foi executado
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
    }
    
    const userRole = req.user.role;
    
    // Verificar se o papel do usuário está na lista de papéis permitidos
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Você não tem permissão para acessar este recurso' 
      });
    }
    
    next();
  };
};

// Middleware para admin
export const isAdmin = roleMiddleware(['admin']);

// Middleware para desenvolvedor
export const isDeveloper = roleMiddleware(['admin', 'desenvolvedor']);

// Middleware para trabalhadores portuários
export const isPortWorker = roleMiddleware(['estivador', 'arrumador', 'conferente', 'vigia']);

// Middleware para verificar acesso a extratos específicos
export const canAccessExtrato = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
  }
  
  const userRole = req.user.role;
  
  // Administradores e desenvolvedores podem acessar qualquer extrato
  if (userRole === 'admin' || userRole === 'desenvolvedor') {
    return next();
  }
  
  // Para trabalhadores portuários, verificar a categoria
  const extratoCategoria = req.params.categoria || '';
  
  // Verificar se a categoria do extrato corresponde ao papel do usuário
  const categoriaMap: Record<string, string> = {
    'estivador': 'ESTIVADOR',
    'arrumador': 'ARRUMADOR',
    'conferente': 'CONFERENTE',
    'vigia': 'VIGIA'
  };
  
  if (extratoCategoria && extratoCategoria !== categoriaMap[userRole]) {
    return res.status(403).json({ 
      success: false, 
      message: 'Você não tem permissão para acessar extratos desta categoria' 
    });
  }
  
  next();
};