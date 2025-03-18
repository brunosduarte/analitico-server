import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { Extrato, ItemExtrato, ResumoExtrato } from '../schemas/ExtratoSchema';

export class PDFParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFParserError';
  }
}

// Função para normalizar valores numéricos
const normalizeNumber = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  
  // Substitui vírgula por ponto para converter corretamente para número
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
};

// Função para extrair cabeçalho
const extractHeader = (text: string[]): { matricula: string, nome: string, mes: string, ano: string, categoria: string } => {
  let matricula = '';
  let nome = '';
  let mes = '';
  let ano = '';
  let categoria = '';

  // Procura por padrões nos primeiros 10 textos do PDF
  for (let i = 0; i < Math.min(10, text.length); i++) {
    const line = text[i];
    
    // Padrão para matrícula e nome: "XXX-X NOME SOBRENOME"
    const matriculaNomeMatch = line.match(/(\d+-\d+)\s+(.+)/);
    if (matriculaNomeMatch) {
      matricula = matriculaNomeMatch[1].trim();
      nome = matriculaNomeMatch[2].trim();
    }
    
    // Padrão para mês/ano: "MMM/AAAA"
    const mesAnoMatch = line.match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/);
    if (mesAnoMatch) {
      mes = mesAnoMatch[1];
      ano = mesAnoMatch[2];
    }
    
    // Categoria do trabalhador
    if (line.includes('ESTIVADOR') || line.includes('ARRUMADOR') || 
        line.includes('VIGIA') || line.includes('CONFERENTE')) {
      categoria = line.trim();
    }
  }

  if (!matricula || !nome || !mes || !ano || !categoria) {
    throw new PDFParserError('Não foi possível extrair informações de cabeçalho completas');
  }

  return { matricula, nome, mes, ano, categoria };
};

// Função para identificar linhas de dados
const isDataLine = (line: string): boolean => {
  // Uma linha de dados normalmente começa com um número de 1 ou 2 dígitos representando o dia
  const dataLineRegex = /^\d{1,2}\s+\d+\s+\d{2}\s+/;
  return dataLineRegex.test(line);
};

// Função para extrair dados das linhas
const extractLineData = (line: string): ItemExtrato | null => {
  // Expressão regular para extrair cada coluna de dados
  // Ajustando para capturar os dados corretamente
  const dataMatch = line.match(/^(\d{1,2})\s+(\d+)\s+(\d{2})\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\d{2}\/\d{2})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);

  if (!dataMatch) return null;

  return {
    dia: dataMatch[1],
    folha: dataMatch[2],
    tomador: dataMatch[3],
    pasta: dataMatch[5],
    fun: dataMatch[6],
    tur: dataMatch[7],
    ter: dataMatch[8],
    pagto: dataMatch[9],
    baseDeCalculo: normalizeNumber(dataMatch[10]),
    inss: normalizeNumber(dataMatch[11]),
    impostoDeRenda: normalizeNumber(dataMatch[12]),
    descontoJudicial: normalizeNumber(dataMatch[13]),
    das: normalizeNumber(dataMatch[14]),
    mensal: normalizeNumber(dataMatch[15]),
    impostoSindical: normalizeNumber(dataMatch[16]),
    descontosEpiCracha: normalizeNumber(dataMatch[17]),
    liquido: normalizeNumber(dataMatch[18]),
    ferias: normalizeNumber(dataMatch[19]),
    decimoTerceiro: normalizeNumber(dataMatch[20]),
    encargosDecimo: normalizeNumber(dataMatch[21]),
    fgts: normalizeNumber(dataMatch[22])
  };
};

// Função para extrair resumo (Folhas/Complementos e Revisadas)
const extractSummary = (text: string[]): { folhasComplementos: ResumoExtrato, revisadas: ResumoExtrato } | null => {
  // Localiza as linhas de resumo
  let folhasComplementosLine = '';
  let revisadasLine = '';

  for (let i = 0; i < text.length; i++) {
    if (text[i].includes('Folhas/Complementos')) {
      folhasComplementosLine = text[i+1] || '';
    } else if (text[i].includes('Revisadas')) {
      revisadasLine = text[i+1] || '';
    }
  }

  if (!folhasComplementosLine) {
    return null;
  }

  // Se não encontrou a linha de revisadas, assume valores zerados
  const defaultRevisadas: ResumoExtrato = {
    baseDeCalculo: 0,
    inss: 0,
    impostoDeRenda: 0,
    descontoJudicial: 0,
    das: 0,
    mensal: 0,
    impostoSindical: 0,
    descontosEpiCracha: 0,
    liquido: 0,
    ferias: 0,
    decimoTerceiro: 0,
    encargosDecimo: 0,
    fgts: 0
  };

  // Extrai os valores da linha de Folhas/Complementos
  const folhasValues = folhasComplementosLine.split(/\s+/).filter(val => val.trim() !== '');
  
  const folhasComplementos: ResumoExtrato = {
    baseDeCalculo: normalizeNumber(folhasValues[0] || '0'),
    inss: normalizeNumber(folhasValues[1] || '0'),
    impostoDeRenda: normalizeNumber(folhasValues[2] || '0'),
    descontoJudicial: normalizeNumber(folhasValues[3] || '0'),
    das: normalizeNumber(folhasValues[4] || '0'),
    mensal: normalizeNumber(folhasValues[5] || '0'),
    impostoSindical: normalizeNumber(folhasValues[6] || '0'),
    descontosEpiCracha: normalizeNumber(folhasValues[7] || '0'),
    liquido: normalizeNumber(folhasValues[8] || '0'),
    ferias: normalizeNumber(folhasValues[9] || '0'),
    decimoTerceiro: normalizeNumber(folhasValues[10] || '0'),
    encargosDecimo: normalizeNumber(folhasValues[11] || '0'),
    fgts: normalizeNumber(folhasValues[12] || '0')
  };

  // Se tem linha de revisadas, extrai os valores
  let revisadas = defaultRevisadas;
  if (revisadasLine) {
    const revisadasValues = revisadasLine.split(/\s+/).filter(val => val.trim() !== '');
    revisadas = {
      baseDeCalculo: normalizeNumber(revisadasValues[0] || '0'),
      inss: normalizeNumber(revisadasValues[1] || '0'),
      impostoDeRenda: normalizeNumber(revisadasValues[2] || '0'),
      descontoJudicial: normalizeNumber(revisadasValues[3] || '0'),
      das: normalizeNumber(revisadasValues[4] || '0'),
      mensal: normalizeNumber(revisadasValues[5] || '0'),
      impostoSindical: normalizeNumber(revisadasValues[6] || '0'),
      descontosEpiCracha: normalizeNumber(revisadasValues[7] || '0'),
      liquido: normalizeNumber(revisadasValues[8] || '0'),
      ferias: normalizeNumber(revisadasValues[9] || '0'),
      decimoTerceiro: normalizeNumber(revisadasValues[10] || '0'),
      encargosDecimo: normalizeNumber(revisadasValues[11] || '0'),
      fgts: normalizeNumber(revisadasValues[12] || '0')
    };
  }

  return { folhasComplementos, revisadas };
};

export const parseExtratoAnalitico = (filePath: string): Promise<Extrato> => {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new PDFParserError(`Erro ao analisar PDF: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        // Extrai o texto completo do PDF
        const textContent: string[] = [];
        
        // Percorre todas as páginas do PDF
        for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
          const page = pdfData.Pages[pageIndex];
          
          // Percorre todos os textos da página
          for (let textIndex = 0; textIndex < page.Texts.length; textIndex++) {
            const textItem = page.Texts[textIndex];
            const text = decodeURIComponent(textItem.R[0].T);
            textContent.push(text);
          }
        }
        
        // Extrai informações do cabeçalho
        const { matricula, nome, mes, ano, categoria } = extractHeader(textContent);
        
        // Extrai dados das linhas
        const itens: ItemExtrato[] = [];
        for (const line of textContent) {
          if (isDataLine(line)) {
            const itemData = extractLineData(line);
            if (itemData) {
              itens.push(itemData);
            }
          }
        }
        
        // Extrai dados de resumo
        const summaryData = extractSummary(textContent);
        if (!summaryData) {
          throw new PDFParserError('Não foi possível extrair dados de resumo');
        }
        
        const { folhasComplementos, revisadas } = summaryData;
        
        // Monta o objeto final
        const extrato: Extrato = {
          matricula,
          nome,
          mes,
          ano,
          categoria,
          itens,
          folhasComplementos,
          revisadas
        };
        
        resolve(extrato);
      } catch (error) {
        if (error instanceof Error) {
          reject(new PDFParserError(`Erro ao processar dados do PDF: ${error.message}`));
        } else {
          reject(new PDFParserError('Erro desconhecido ao processar dados do PDF'));
        }
      }
    });
    
    // Carrega o arquivo PDF
    pdfParser.loadPDF(filePath);
  });
};
