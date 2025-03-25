import { body } from 'express-validator';

export const registerValidation = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('role')
    .isIn(['admin', 'desenvolvedor', 'estivador', 'arrumador', 'conferente', 'vigia'])
    .withMessage('Papel inválido'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Número de telefone é obrigatório')
    .matches(/^\+?[0-9]{10,15}$|^\(\d{2}\)\s\d{4,5}-\d{4}$/)
    .withMessage('Formato de telefone inválido'),
];

export const loginValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
];

export const verifyCodeValidation = [
  body('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Código inválido. Deve ser um número de 6 dígitos'),
];

export const updateUserValidation = [
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[0-9]{10,15}$|^\(\d{2}\)\s\d{4,5}-\d{4}$/)
    .withMessage('Formato de telefone inválido'),
];