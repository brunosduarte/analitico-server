import { Request, Response } from 'express';
import { PDFService } from '../services/PDFService';
import { z } from 'zod';

export class ExtratoController {
  static async uploadExtratoAnalitico(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
      }
      
      const filePath = req.file.path;
      
      // Processa o arquivo PDF
      const dadosExtrato = await PDFService.processarExtratoPDF(filePath);
      
      return res.status(200).json({
        success: true,
        message: 'Extrato analítico processado com sucesso',
        data: {
          matricula: dadosExtrato.matricula,
          nome: dadosExtrato.nome,
          mes: dadosExtrato.mes,
          ano: dadosExtrato.ano,
          categoria: dadosExtrato.categoria,
          totalItens: dadosExtrato.itens.length
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Erro desconhecido ao processar o arquivo' });
    }
  }
  
  static async listarExtratos(req: Request, res: Response) {
    try {
      // Esquema de validação para os parâmetros de consulta
      const querySchema = z.object({
        matricula: z.string().optional(),
        nome: z.string().optional(),
        mes: z.string().optional(),
        ano: z.string().optional(),
        categoria: z.string().optional()
      });
      
      // Validar parâmetros de consulta
      const validQuery = querySchema.safeParse(req.query);
      if (!validQuery.success) {
        return res.status(400).json({ success: false, message: 'Parâmetros de consulta inválidos', errors: validQuery.error });
      }
      
      // Aplicar filtros
      const filtros = validQuery.data;
      const extratos = await PDFService.obterExtratos(filtros);
      
      return res.status(200).json({
        success: true,
        data: extratos.map(extrato => ({
          id: (extrato as any)._id,
          matricula: extrato.matricula,
          nome: extrato.nome,
          mes: extrato.mes,
          ano: extrato.ano,
          categoria: extrato.categoria,
          totalItens: extrato.itens.length
        }))
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Erro desconhecido ao listar extratos' });
    }
  }
  
  static async obterExtratoPorId(req: Request, res: Response) {
    try {
      const id = req.params.id;
      
      const extrato = await PDFService.obterExtratoPorId(id);
      
      if (!extrato) {
        return res.status(404).json({ success: false, message: 'Extrato não encontrado' });
      }
      
      return res.status(200).json({
        success: true,
        data: extrato
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Erro desconhecido ao obter extrato' });
    }
  }
}