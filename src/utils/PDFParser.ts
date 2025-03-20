import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { Extrato, Trabalho, ResumoExtrato } from '../schemas/ExtratoSchema';

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
const extractHeader = (textContent: string[]): { matricula: string, nome: string, mes: string, ano: string, categoria: string } => {
  let matricula = '';
  let nome = '';
  let mes = '';
  let ano = '';
  let categoria = '';

  // Procura por padrões nos textos do PDF
  for (const line of textContent) {
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

// Mapeamento de códigos de tomadores para nomes (conforme identificado nos extratos)
const tomadoresMap: Record<string, string> = {
  'AGM': 'AGM Operações Portuárias',
  'SAGRES': 'Sagres Agenciamentos Marítimos',
  'TECON': 'Tecon Rio Grande',
  'ROCHA RS': 'Rocha Terminal Portuário',
  'TERMASA': 'Terminal Marítimo Luiz Fogliatto',
  'LIVENPORT': 'Liven Port Serviços Portuários',
  'RGLP': 'Rio Grande Logistics Park',
  'ORION': 'Orion Terminais e Serviços Portuários',
  'SERRA MOR': 'Serra Morena Operadora Portuária',
  'BIANCHINI': 'Bianchini S.A',
  'CTIL': 'CTIL Logística'
  // Adicionar mais mapeamentos conforme necessário
};

// Função corrigida para extrair dados de trabalho
const extractWorkData = (line: string): Trabalho | null => {
  console.log(`Analisando linha para extração de trabalho: "${line.substring(0, 50)}..."`);
  
  // Remover caracteres problemáticos e espaços extras
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  // Diferentes padrões de expressão regular para tentar extrair os dados
  const patterns = [
    // Padrão 1: Mais restritivo, com valores em colunas específicas
    /^(\d{1,2})\s+(\d+)\s+(\d{2})\s+(\S+.*?)\s+(\d{3})\s+(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/,
    
    // Padrão 2: Mais flexível, capturando números em sequência
    /^(\d{1,2})\s+(\d+)\s+(\d{2})\s+(\S+.*?)\s+(\d{3})\s+(\S+)\s+(\d+)\s+(\S+)\s+(\d{2}\/\d{2})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/,
    
    // Padrão 3: Ainda mais flexível, para PDFs com layout diferente
    /^(\d{1,2})\s+(\d+)\s+(\d{2})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/
  ];
  
  let match = null;
  let matchPattern = -1;
  
  // Tentar cada padrão até encontrar um que funcione
  for (let i = 0; i < patterns.length; i++) {
    match = cleanLine.match(patterns[i]);
    if (match) {
      matchPattern = i;
      break;
    }
  }
  
  if (!match) {
    console.log('Linha não corresponde a nenhum padrão de trabalho');
    return null;
  }
  
  console.log(`Padrão ${matchPattern + 1} funcionou para a linha`);
  
  // Extrai dados com base no padrão que funcionou
  let tomadorCodigo = '';
  let tomadorNome = '';
  let pasta = '';
  let fun = '';
  let tur = '';
  let ter = '';
  let pagto = '';
  let baseDeCalculo = 0;
  let inss = 0;
  let impostoDeRenda = 0;
  let descontoJudicial = 0;
  let das = 0;
  let mensal = 0;
  let impostoSindical = 0;
  let descontosEpiCracha = 0;
  let liquido = 0;
  let ferias = 0;
  let decimoTerceiro = 0;
  let encargosDecimo = 0;
  let fgts = 0;
  
  // Determinar o índice de cada campo com base no padrão usado
  const dia = match[1];
  const folha = match[2];
  tomadorCodigo = match[3];
  
  if (matchPattern === 0) {
    // Para o padrão 1, extrair o nome do tomador da parte variável
    const tomadorInfo = match[4].trim();
    // Tentar separar o código do tomador e o nome
    const tomadorMatch = tomadorInfo.match(/^(\S+)\s+(.*)/);
    
    if (tomadorMatch) {
      tomadorNome = tomadorMatch[2].trim();
    } else {
      tomadorNome = tomadorInfo;
    }
    
    pasta = match[5];
    fun = match[6];
    tur = match[7];
    ter = match[8];
    pagto = match[9];
    
    // Valores financeiros
    baseDeCalculo = normalizeNumber(match[10]);
    inss = normalizeNumber(match[11]);
    impostoDeRenda = normalizeNumber(match[12]);
    descontoJudicial = normalizeNumber(match[13]);
    das = normalizeNumber(match[14]);
    mensal = normalizeNumber(match[15]);
    impostoSindical = normalizeNumber(match[16]);
    descontosEpiCracha = normalizeNumber(match[17]);
    liquido = normalizeNumber(match[18]);
    ferias = normalizeNumber(match[19]);
    decimoTerceiro = normalizeNumber(match[20]);
    encargosDecimo = normalizeNumber(match[21]);
    fgts = normalizeNumber(match[22]);
  } else if (matchPattern === 1) {
    // Para o padrão 2, processar os campos de acordo
    const tomadorInfo = match[4].trim();
    tomadorNome = tomadorInfo;
    
    pasta = match[5];
    fun = match[6];
    tur = match[7];
    ter = match[8];
    pagto = match[9];
    
    // Valores financeiros
    baseDeCalculo = normalizeNumber(match[10]);
    inss = normalizeNumber(match[11]);
    impostoDeRenda = normalizeNumber(match[12]);
    descontoJudicial = normalizeNumber(match[13]);
    das = normalizeNumber(match[14]);
    mensal = normalizeNumber(match[15]);
    impostoSindical = normalizeNumber(match[16]);
    descontosEpiCracha = normalizeNumber(match[17]);
    liquido = normalizeNumber(match[18]);
    ferias = normalizeNumber(match[19]);
    decimoTerceiro = normalizeNumber(match[20]);
    encargosDecimo = normalizeNumber(match[21]);
    fgts = normalizeNumber(match[22]);
  } else {
    // Para o padrão 3, processar os campos de acordo
    pasta = match[4];
    fun = match[5];
    tur = match[6];
    ter = match[7];
    pagto = match[8];
    
    // Valores financeiros
    baseDeCalculo = normalizeNumber(match[9]);
    inss = normalizeNumber(match[10]);
    impostoDeRenda = normalizeNumber(match[11]);
    descontoJudicial = normalizeNumber(match[12]);
    das = normalizeNumber(match[13]);
    mensal = normalizeNumber(match[14]);
    impostoSindical = normalizeNumber(match[15]);
    descontosEpiCracha = normalizeNumber(match[16]);
    liquido = normalizeNumber(match[17]);
    ferias = normalizeNumber(match[18]);
    decimoTerceiro = normalizeNumber(match[19]);
    encargosDecimo = normalizeNumber(match[20]);
    fgts = normalizeNumber(match[21]);
  }
  
  // Se o nome do tomador não foi encontrado, tentar mapeá-lo pelo código
  if (!tomadorNome && tomadoresMap[tomadorCodigo]) {
    tomadorNome = tomadoresMap[tomadorCodigo];
  }
  
  console.log(`Trabalho extraído: Dia ${dia}, Folha ${folha}, Tomador ${tomadorCodigo} - ${tomadorNome}, Valor ${liquido}`);
  
  return {
    dia,
    folha,
    tomador: tomadorCodigo,
    tomadorNome,
    pasta,
    fun,
    tur,
    ter,
    pagto,
    baseDeCalculo,
    inss,
    impostoDeRenda,
    descontoJudicial,
    das,
    mensal,
    impostoSindical,
    descontosEpiCracha,
    liquido,
    ferias,
    decimoTerceiro,
    encargosDecimo,
    fgts
  };
};

// Função corrigida para extrair resumo (Folhas/Complementos e Revisadas)
const extractSummary = (textContent: string[]): { folhasComplementos: ResumoExtrato, revisadas: ResumoExtrato } | null => {
  // Valores padrão para o caso de não encontrar os dados de resumo
  const defaultResumo: ResumoExtrato = {
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

  // Procurar linhas de resumo no conteúdo completo
  let folhasComplementosIndex = -1;
  let revisadasIndex = -1;

  // Primeiro, encontrar os índices das linhas com os identificadores
  for (let i = 0; i < textContent.length; i++) {
    const line = textContent[i].trim();
    
    if (line.includes('Folhas/Complementos') || line === 'Folhas/Complementos') {
      folhasComplementosIndex = i;
    } else if (line.includes('Revisadas') || line === 'Revisadas') {
      revisadasIndex = i;
    }
  }

  console.log(`Índice Folhas/Complementos: ${folhasComplementosIndex}, Índice Revisadas: ${revisadasIndex}`);

  // Se não encontrou nenhuma referência, tentar abordagem alternativa
  if (folhasComplementosIndex === -1) {
    // Procurar pelos totais diretamente
    // Muitas vezes os totais aparecem como uma linha numérica após as linhas de itens
    let totalLine = '';
    
    // Procurar linha que tem muitos números e parece um total
    for (let i = textContent.length - 30; i < textContent.length; i++) {
      if (i >= 0 && textContent[i]) {
        const line = textContent[i].trim();
        const numbersInLine = line.split(/\s+/).filter(part => 
          /^[\d.,]+$/.test(part) && part.length > 1
        ).length;
        
        // Se a linha contém pelo menos 10 números, é provavelmente uma linha de total
        if (numbersInLine >= 10) {
          totalLine = line;
          console.log(`Possível linha de total encontrada: ${totalLine}`);
          break;
        }
      }
    }
    
    // Se encontrou uma linha com números suficientes, usar essa linha
    if (totalLine) {
      const values = totalLine.split(/\s+/).filter(v => v.trim() !== '');
      
      // Criar o resumo a partir dos valores encontrados
      const folhasComplementos: ResumoExtrato = {
        baseDeCalculo: normalizeNumber(values[0] || '0'),
        inss: normalizeNumber(values[1] || '0'),
        impostoDeRenda: normalizeNumber(values[2] || '0'),
        descontoJudicial: normalizeNumber(values[3] || '0'),
        das: normalizeNumber(values[4] || '0'),
        mensal: normalizeNumber(values[5] || '0'),
        impostoSindical: normalizeNumber(values[6] || '0'),
        descontosEpiCracha: normalizeNumber(values[7] || '0'),
        liquido: normalizeNumber(values[8] || '0'),
        ferias: normalizeNumber(values[9] || '0'),
        decimoTerceiro: normalizeNumber(values[10] || '0'),
        encargosDecimo: normalizeNumber(values[11] || '0'),
        fgts: normalizeNumber(values[12] || '0')
      };
      
      return { folhasComplementos, revisadas: defaultResumo };
    }
    
    // Se ainda não conseguiu extrair, usar abordagem de último recurso:
    // Somar todos os valores dos trabalhos individuais
    console.log('Usando abordagem de último recurso: somando valores dos trabalhos');
    return null; // Retornar null para que a camada superior saiba que precisa calcular os totais
  }

  // Se encontrou o índice, procurar a linha com os valores (geralmente está próxima)
  let folhasComplementosLine = '';
  let revisadasLine = '';

  // Procurar valores nas próximas linhas após os identificadores
  for (let i = folhasComplementosIndex + 1; i < folhasComplementosIndex + 5 && i < textContent.length; i++) {
    const line = textContent[i].trim();
    // Verificar se a linha contém vários números
    if (/[\d.,]+\s+[\d.,]+/.test(line)) {
      folhasComplementosLine = line;
      break;
    }
  }

  if (revisadasIndex !== -1) {
    for (let i = revisadasIndex + 1; i < revisadasIndex + 5 && i < textContent.length; i++) {
      const line = textContent[i].trim();
      if (/[\d.,]+\s+[\d.,]+/.test(line)) {
        revisadasLine = line;
        break;
      }
    }
  }

  console.log(`Linha Folhas/Complementos: "${folhasComplementosLine}"`);
  console.log(`Linha Revisadas: "${revisadasLine}"`);

  // Se não encontrou a linha com valores, usar o texto completo para buscar
  if (!folhasComplementosLine) {
    // Buscar no texto completo por linhas que possam conter os totais
    for (let i = 0; i < textContent.length; i++) {
      const line = textContent[i].trim();
      // Procurar por linhas com números que parecem totais
      if (line.includes('Folhas/Complementos') && i + 1 < textContent.length) {
        folhasComplementosLine = textContent[i + 1].trim();
      } else if (line.includes('Revisadas') && i + 1 < textContent.length) {
        revisadasLine = textContent[i + 1].trim();
      }
    }
  }

  // Se ainda não encontrou, fazer uma última tentativa procurando por padrões específicos
  if (!folhasComplementosLine) {
    for (let i = textContent.length - 30; i < textContent.length; i++) {
      if (i >= 0) {
        const line = textContent[i].trim();
        // Procurar linhas com muitos números que podem ser os totais
        const parts = line.split(/\s+/);
        if (parts.length >= 10 && parts.every(part => /^[\d.,]+$/.test(part) || part === '')) {
          folhasComplementosLine = line;
          break;
        }
      }
    }
  }

  // Se ainda não conseguiu encontrar, montar um resumo zerado
  if (!folhasComplementosLine) {
    console.log('Não foi possível encontrar a linha de totais. Usando valores padrão.');
    return { 
      folhasComplementos: defaultResumo, 
      revisadas: defaultResumo 
    };
  }

  // Extrair os valores da linha de Folhas/Complementos
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
  let revisadas = defaultResumo;
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

// Função corrigida para processar todo o conteúdo do PDF
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
        const pageTexts: string[] = [];
        
        // Percorre todas as páginas do PDF
        for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
          const page = pdfData.Pages[pageIndex];
          
          // Texto completo da página
          let pageText = '';
          
          // Percorre todos os textos da página
          for (let textIndex = 0; textIndex < page.Texts.length; textIndex++) {
            const textItem = page.Texts[textIndex];
            if (textItem.R && textItem.R.length > 0) {
              const text = decodeURIComponent(textItem.R[0].T);
              textContent.push(text);
              pageText += text + ' ';
            }
          }
          
          pageTexts.push(pageText);
        }
        
        console.log(`Total de páginas processadas: ${pdfData.Pages.length}`);
        console.log(`Total de itens de texto extraídos: ${textContent.length}`);
        
        // Extrai informações do cabeçalho
        const { matricula, nome, mes, ano, categoria } = extractHeader(textContent);
        
        console.log(`Dados de cabeçalho: ${matricula}, ${nome}, ${mes}/${ano}, ${categoria}`);
        
        // Extrai dados de trabalho
        const trabalhos: Trabalho[] = [];

        // Primeiramente, reconstruir as linhas para extrair trabalhos
        // Algumas vezes o PDF quebra textos em várias partes
        const reconstructedLines: string[] = [];
        
        // Adicionar todas as linhas dos textos das páginas
        for (const pageText of pageTexts) {
            const lines = pageText.split('\n');
            reconstructedLines.push(...lines);
        }
        
        // Adicionar também as linhas originais do texto
        reconstructedLines.push(...textContent);
        
        console.log(`Total de linhas para processamento: ${reconstructedLines.length}`);
        
        // Filtrar e processar as linhas que parecem ser de trabalho
        for (const line of reconstructedLines) {
            // Verifica se a linha começa com um número (dia) seguido de outro número (folha)
            if (/^\d{1,2}\s+\d+/.test(line)) {
                const trabalho = extractWorkData(line);
                if (trabalho) {
                    // Verificar se esse trabalho já existe (para evitar duplicatas)
                    const exists = trabalhos.some(t => 
                        t.dia === trabalho.dia && 
                        t.folha === trabalho.folha && 
                        t.baseDeCalculo === trabalho.baseDeCalculo
                    );
                    
                    if (!exists) {
                        trabalhos.push(trabalho);
                    }
                }
            }
        }
        
        console.log(`Total de trabalhos extraídos: ${trabalhos.length}`);
        
        // Extrai dados de resumo
        const summaryData = extractSummary(reconstructedLines);
        
        let folhasComplementos: ResumoExtrato;
        let revisadas: ResumoExtrato;
        
        if (!summaryData) {
            console.log('Não foi possível extrair dados de resumo. Calculando a partir dos trabalhos...');
            
            // Calcular totais com base nos trabalhos encontrados
            folhasComplementos = {
                baseDeCalculo: trabalhos.reduce((sum, t) => sum + t.baseDeCalculo, 0),
                inss: trabalhos.reduce((sum, t) => sum + t.inss, 0),
                impostoDeRenda: trabalhos.reduce((sum, t) => sum + t.impostoDeRenda, 0),
                descontoJudicial: trabalhos.reduce((sum, t) => sum + t.descontoJudicial, 0),
                das: trabalhos.reduce((sum, t) => sum + t.das, 0),
                mensal: trabalhos.reduce((sum, t) => sum + t.mensal, 0),
                impostoSindical: trabalhos.reduce((sum, t) => sum + t.impostoSindical, 0),
                descontosEpiCracha: trabalhos.reduce((sum, t) => sum + t.descontosEpiCracha, 0),
                liquido: trabalhos.reduce((sum, t) => sum + t.liquido, 0),
                ferias: trabalhos.reduce((sum, t) => sum + t.ferias, 0),
                decimoTerceiro: trabalhos.reduce((sum, t) => sum + t.decimoTerceiro, 0),
                encargosDecimo: trabalhos.reduce((sum, t) => sum + t.encargosDecimo, 0),
                fgts: trabalhos.reduce((sum, t) => sum + t.fgts, 0)
            };
            
            // Revisadas geralmente são zeros quando não encontradas
            revisadas = {
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
        } else {
            console.log('Dados de resumo extraídos com sucesso');
            folhasComplementos = summaryData.folhasComplementos;
            revisadas = summaryData.revisadas;
        }
        
        // Monta o objeto final
        const extrato: Extrato = {
            matricula,
            nome,
            mes,
            ano,
            categoria,
            trabalhos,
            folhasComplementos,
            revisadas
        };
        
        console.log(`Extrato processado com sucesso para ${nome}, ${mes}/${ano}, com ${trabalhos.length} trabalhos`);
        
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
    try {
      pdfParser.loadPDF(filePath);
    } catch (error) {
      reject(new PDFParserError(`Erro ao carregar o arquivo PDF: ${error}`));
    }
  });
};