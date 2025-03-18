import * as fs from 'fs';
import * as path from 'path';
import { parseExtratoAnalitico } from '../utils/PDFParser';
import ExtratoModel from '../models/ExtratoModel';
import { Extrato } from '../schemas/ExtratoSchema';

export class PDFService {
  static async processarExtratoPDF(filePath: string): Promise<Extrato> {
    try {
      // Validar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }
      
      // Extrair dados do PDF
      const dadosExtrato = await parseExtratoAnalitico(filePath);
      
      // Verificar se o extrato já existe no banco de dados
      const extratoExistente = await ExtratoModel.findOne({
        matricula: dadosExtrato.matricula,
        mes: dadosExtrato.mes,
        ano: dadosExtrato.ano
      });
      
      if (extratoExistente) {
        // Atualizar o extrato existente
        await ExtratoModel.findByIdAndUpdate(extratoExistente._id, dadosExtrato);
        return dadosExtrato;
      } else {
        // Criar novo registro
        const novoExtrato = new ExtratoModel(dadosExtrato);
        await novoExtrato.save();
        return dadosExtrato;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao processar extrato PDF: ${error.message}`);
      }
      throw new Error('Erro desconhecido ao processar extrato PDF');
    } finally {
      // Opcional: Remover o arquivo após processamento
      // fs.unlinkSync(filePath);
    }
  }
  
  static async obterExtratos(filtros: any = {}): Promise<Extrato[]> {
    return await ExtratoModel.find(filtros);
  }
  
  static async obterExtratoPorId(id: string): Promise<Extrato | null> {
    return await ExtratoModel.findById(id);
  }
}