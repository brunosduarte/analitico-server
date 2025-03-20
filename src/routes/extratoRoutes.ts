import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { ExtratoController } from '../controllers/ExtratoController';

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Garante que o diretório de uploads existe
    const dir = path.join(__dirname, '../../uploads');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Define um nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro para aceitar apenas arquivos PDF
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF são aceitos'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const router = Router();

// Rota para upload de extrato analítico
router.post('/analitico', upload.single('arquivo'), ExtratoController.uploadExtratoAnalitico);

// Rota para listar extratos com filtros opcionais
router.get('/analitico', ExtratoController.listarExtratos);

// Rota para obter um extrato específico por ID
router.get('/analitico/:id', ExtratoController.obterExtratoPorId);

// Rota para obter trabalhos por tomador
router.get('/trabalhos/tomador/:tomador', ExtratoController.obterTrabalhosPorTomador);

// Rota para obter resumo mensal
router.get('/resumo/:mes/:ano', ExtratoController.obterResumoMensal);

export default router;