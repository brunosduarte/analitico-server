import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { 
  registerValidation, 
  loginValidation, 
  verifyCodeValidation,
  updateUserValidation
} from '../utils/validations';
import { authMiddleware, twoFactorAuth } from '../middlewares/authMiddleware';

const router = Router();

// Rotas públicas
router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.post('/verify-2fa', verifyCodeValidation, AuthController.verifyTwoFactor);
router.post('/resend-code', AuthController.resendTwoFactorCode);
router.post('/logout', AuthController.logout);

// Rotas protegidas
router.get('/me', authMiddleware, twoFactorAuth, AuthController.getCurrentUser);
router.put('/profile', authMiddleware, twoFactorAuth, updateUserValidation, AuthController.updateProfile);

export default router;