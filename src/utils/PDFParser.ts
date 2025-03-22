import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { Extrato, Trabalho, ResumoExtrato } from '../schemas/ExtratoSchema';

export class PDFParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFParserError';
  }
}

// Função para normalizar valores numéricos e evitar NaN
const normalizeNumber = (value: string | number): number => {
  // Se o valor já for um número, verificar se é NaN ou válido
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  // Se for string vazia ou undefined, retorna 0
  if (!value || value.trim() === '') return 0;
  
  // Substitui vírgula por ponto para converter corretamente para número
  const normalizedValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
  
  // Verifica se o resultado é NaN e, se for, retorna 0
  return isNaN(normalizedValue) ? 0 : normalizedValue;
};

// Função para garantir que um objeto ResumoExtrato não tenha valores NaN
const validateResumoExtrato = (resumo: ResumoExtrato): ResumoExtrato => {
  return {
    baseDeCalculo: isNaN(resumo.baseDeCalculo) ? 0 : resumo.baseDeCalculo,
    inss: isNaN(resumo.inss) ? 0 : resumo.inss,
    impostoDeRenda: isNaN(resumo.impostoDeRenda) ? 0 : resumo.impostoDeRenda,
    descontoJudicial: isNaN(resumo.descontoJudicial) ? 0 : resumo.descontoJudicial,
    das: isNaN(resumo.das) ? 0 : resumo.das,
    mensal: isNaN(resumo.mensal) ? 0 : resumo.mensal,
    impostoSindical: isNaN(resumo.impostoSindical) ? 0 : resumo.impostoSindical,
    descontosEpiCracha: isNaN(resumo.descontosEpiCracha) ? 0 : resumo.descontosEpiCracha,
    liquido: isNaN(resumo.liquido) ? 0 : resumo.liquido,
    ferias: isNaN(resumo.ferias) ? 0 : resumo.ferias,
    decimoTerceiro: isNaN(resumo.decimoTerceiro) ? 0 : resumo.decimoTerceiro,
    encargosDecimo: isNaN(resumo.encargosDecimo) ? 0 : resumo.encargosDecimo,
    fgts: isNaN(resumo.fgts) ? 0 : resumo.fgts
  };
};

// Função para validar um trabalho individual
const validateTrabalho = (trabalho: Trabalho): Trabalho => {
  return {
    ...trabalho,
    baseDeCalculo: isNaN(trabalho.baseDeCalculo) ? 0 : trabalho.baseDeCalculo,
    inss: isNaN(trabalho.inss) ? 0 : trabalho.inss,
    impostoDeRenda: isNaN(trabalho.impostoDeRenda) ? 0 : trabalho.impostoDeRenda,
    descontoJudicial: isNaN(trabalho.descontoJudicial) ? 0 : trabalho.descontoJudicial,
    das: isNaN(trabalho.das) ? 0 : trabalho.das,
    mensal: isNaN(trabalho.mensal) ? 0 : trabalho.mensal,
    impostoSindical: isNaN(trabalho.impostoSindical) ? 0 : trabalho.impostoSindical,
    descontosEpiCracha: isNaN(trabalho.descontosEpiCracha) ? 0 : trabalho.descontosEpiCracha,
    liquido: isNaN(trabalho.liquido) ? 0 : trabalho.liquido,
    ferias: isNaN(trabalho.ferias) ? 0 : trabalho.ferias,
    decimoTerceiro: isNaN(trabalho.decimoTerceiro) ? 0 : trabalho.decimoTerceiro,
    encargosDecimo: isNaN(trabalho.encargosDecimo) ? 0 : trabalho.encargosDecimo,
    fgts: isNaN(trabalho.fgts) ? 0 : trabalho.fgts
  };
};

// Função para extrair cabeçalho
const extractHeader = (textContent: string[]): { matricula: string, nome: string, mes: string, ano: string, categoria: string } => {
  let matricula = '';
  let nome = '';
  let mes = '';
  let ano = '';
  let categoria = '';

  console.log("Extraindo cabeçalho a partir de", textContent.length, "linhas");
  
  // Procura por padrões nos textos do PDF
  for (const line of textContent) {
    console.log("Analisando linha de cabeçalho:", line);
    
    // Padrão para matrícula e nome: "XXX-X NOME SOBRENOME"
    const matriculaNomeMatch = line.match(/(\d+-\d+)\s+(.+)/);
    if (matriculaNomeMatch) {
      matricula = matriculaNomeMatch[1].trim();
      
      // Extrair o nome sem incluir a categoria (que pode vir a seguir)
      nome = matriculaNomeMatch[2].trim();
      // Remover a categoria se estiver junto ao nome
      const categorias = ['ESTIVADOR', 'ARRUMADOR', 'VIGIA', 'CONFERENTE'];
      for (const cat of categorias) {
        if (nome.toUpperCase().includes(cat)) {
          nome = nome.replace(new RegExp(cat, 'i'), '').trim();
        }
      }
      
      console.log(`Encontrado matrícula: ${matricula}, nome: ${nome}`);
    }
    
    // Padrão para mês/ano: "MMM/AAAA"
    const mesAnoMatch = line.match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/);
    if (mesAnoMatch) {
      mes = mesAnoMatch[1];
      ano = mesAnoMatch[2];
      console.log(`Encontrado mês: ${mes}, ano: ${ano}`);
    }
    
    // Categoria do trabalhador
    if (line.toUpperCase().includes('ESTIVADOR')) {
      categoria = 'ESTIVADOR';
      console.log(`Encontrada categoria: ${categoria}`);
    } else if (line.toUpperCase().includes('ARRUMADOR')) {
      categoria = 'ARRUMADOR';
      console.log(`Encontrada categoria: ${categoria}`);
    } else if (line.toUpperCase().includes('VIGIA')) {
      categoria = 'VIGIA';
      console.log(`Encontrada categoria: ${categoria}`);
    } else if (line.toUpperCase().includes('CONFERENTE')) {
      categoria = 'CONFERENTE';
      console.log(`Encontrada categoria: ${categoria}`);
    }
  }

  // Verificar os campos obrigatórios e adicionar mensagens de debug
  console.log(`Resumo do cabeçalho encontrado: Matrícula=${matricula}, Nome=${nome}, Mês=${mes}, Ano=${ano}, Categoria=${categoria}`);
  
  if (!matricula) {
    console.log("ERRO: Matrícula não encontrada no cabeçalho");
  }
  if (!nome) {
    console.log("ERRO: Nome não encontrado no cabeçalho");
  }
  if (!mes) {
    console.log("ERRO: Mês não encontrado no cabeçalho");
  }
  if (!ano) {
    console.log("ERRO: Ano não encontrado no cabeçalho");
  }
  if (!categoria) {
    console.log("ERRO: Categoria não encontrada no cabeçalho");
  }
  
  if (!matricula || !nome || !mes || !ano || !categoria) {
    // Vamos tentar uma abordagem alternativa para o cabeçalho se os campos estiverem faltando
    console.log("Tentando abordagem alternativa para encontrar informações de cabeçalho...");
    
    // Combinar todas as linhas em um único texto para análise mais ampla
    const combinedText = textContent.join(' ');
    
    // Tentar encontrar a matrícula em formato mais flexível
    if (!matricula) {
      const flexMatriculaMatch = combinedText.match(/\b(\d{3}-\d{1,2})\b/);
      if (flexMatriculaMatch) {
        matricula = flexMatriculaMatch[1];
        console.log(`Encontrada matrícula (flex): ${matricula}`);
      }
    }
    
    // Tentar encontrar o nome com padrão mais flexível
    if (!nome && matricula) {
      // Buscar o texto que aparece após a matrícula até cerca de 30 caracteres
      const afterMatricula = combinedText.substring(combinedText.indexOf(matricula) + matricula.length).trim();
      const possibleName = afterMatricula.split(/\s+/).slice(0, 4).join(' '); // Pegar as primeiras 4 palavras
      if (possibleName.length > 3) {
        nome = possibleName;
        console.log(`Encontrado nome (flex): ${nome}`);
      }
    }
    
    // Tentar encontrar mês/ano com padrão mais flexível
    if (!mes || !ano) {
      // Meses abreviados em português
      const mesesAbrev = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
      
      for (const mesAbrev of mesesAbrev) {
        if (combinedText.includes(mesAbrev)) {
          // Encontrar o ano próximo ao mês
          const mesIndex = combinedText.indexOf(mesAbrev);
          const textAroundMonth = combinedText.substring(Math.max(0, mesIndex - 5), Math.min(combinedText.length, mesIndex + 10));
          
          const yearMatch = textAroundMonth.match(/\b(20\d{2})\b/);
          if (yearMatch) {
            mes = mesAbrev;
            ano = yearMatch[1];
            console.log(`Encontrado mês (flex): ${mes}, ano: ${ano}`);
            break;
          }
        }
      }
    }
    
    // Tentar encontrar categoria com padrão mais flexível
    if (!categoria) {
      const categorias = ['ESTIVADOR', 'ARRUMADOR', 'VIGIA', 'CONFERENTE'];
      for (const cat of categorias) {
        if (combinedText.toUpperCase().includes(cat)) {
          categoria = cat;
          console.log(`Encontrada categoria (flex): ${categoria}`);
          break;
        }
      }
    }
    
    // Segunda verificação após a abordagem alternativa
    console.log(`Resumo final do cabeçalho: Matrícula=${matricula}, Nome=${nome}, Mês=${mes}, Ano=${ano}, Categoria=${categoria}`);
  }
  
  // Terceira tentativa com valores default para testes
  if (!matricula || !nome || !mes || !ano || !categoria) {
    console.log("AVISO: Usando valores padrão para campos de cabeçalho faltantes");
    
    if (!matricula) matricula = "000-0"; // Valor padrão
    if (!nome) nome = "NOME NÃO ENCONTRADO";
    if (!mes) mes = "JAN"; // Valor padrão
    if (!ano) ano = "2023"; // Valor padrão
    if (!categoria) categoria = "ESTIVADOR"; // Valor padrão
  }

  return { matricula, nome, mes, ano, categoria };
};

// Lista de operadores portuários conhecidos (pode ser expandida conforme necessário)
const OPERADORES_PORTUARIOS = [
  'AGM', 'SAGRES', 'TECON', 'TERMASA', 'ROCHA RS', 'LIVENPORT', 'BIANCHINI', 'CTIL',
  'SERRA MOR', 'RGLP', 'ORION'
];

// Lista de códigos de função válidos
const FUNCOES_VALIDAS = [
  '101', '103', '104', '431', '521', '527', '801', '802', '803'
];

// Lista de turnos válidos
const TURNOS_VALIDOS = ['A', 'B', 'C', 'D'];

// Definição de tipos para estrutura de dados extraída do PDF
interface TextElement {
  text: string;
  x: number;
  y: number;
}

interface StructuredRecord {
  lines: TextElement[][];
  rawText: string[];
}

interface StructuredData {
  headers: string[];
  records: StructuredRecord[];
}

/**
 * NOVA FUNÇÃO: Extração baseada em estrutura de colunas real do PDF
 * Esta função extrai a estrutura exata de linhas/colunas do PDF preservando posições X e Y
 */
const extractStructuredData = (pdfData: any): StructuredData => {
  const result: StructuredData = {
    headers: [],
    records: []
  };
  
  // Extrair todos os textos para usar na extração de cabeçalho
  const allRawTexts: string[] = [];
  
  // 1. Extrair todas as linhas do PDF preservando suas posições X,Y
  const pageItems: TextElement[][] = [];
  
  for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
    const page = pdfData.Pages[pageIndex];
    const items: TextElement[] = [];
    
    // Extrair todos os itens de texto com suas posições originais
    for (const textItem of page.Texts) {
      if (textItem.R && textItem.R.length > 0) {
        const text = decodeURIComponent(textItem.R[0].T);
        const x = textItem.x;
        const y = textItem.y;
        
        items.push({ text, x, y });
        allRawTexts.push(text); // Adicionar à lista completa de textos
      }
    }
    
    pageItems.push(items);
  }
  
  // 2. Agrupar itens por linhas (mesma coordenada Y)
  const allLines: TextElement[][] = [];
  
  for (const pageItem of pageItems) {
    const linesByY: {[key: number]: TextElement[]} = {};
    
    // Agrupar por coordenada Y aproximada
    for (const item of pageItem) {
      // Arredondar Y para agrupar linhas próximas
      const roundedY = Math.round(item.y * 10) / 10;
      
      if (!linesByY[roundedY]) {
        linesByY[roundedY] = [];
      }
      
      linesByY[roundedY].push(item);
    }
    
    // Ordenar linhas por coordenada Y e adicionar a allLines
    const sortedYValues = Object.keys(linesByY)
      .map(y => parseFloat(y))
      .sort((a, b) => a - b);
    
    for (const y of sortedYValues) {
      // Ordenar itens dentro da linha por coordenada X
      const lineItems = linesByY[y].sort((a, b) => a.x - b.x);
      allLines.push(lineItems);
    }
  }
  
  // 3. Identificar faixas de colunas (coordenadas X comuns)
  const allXPositions: number[] = [];
  
  for (const line of allLines) {
    for (const item of line) {
      allXPositions.push(item.x);
    }
  }
  
  // Agrupar posições X próximas
  const columnRanges: {start: number, end: number, center: number}[] = [];
  allXPositions.sort((a, b) => a - b);
  
  let currentStart = allXPositions[0];
  let currentEnd = currentStart;
  
  for (let i = 1; i < allXPositions.length; i++) {
    if (allXPositions[i] - currentEnd > 0.5) {
      // Nova coluna
      columnRanges.push({
        start: currentStart,
        end: currentEnd,
        center: (currentStart + currentEnd) / 2
      });
      
      currentStart = allXPositions[i];
    }
    
    currentEnd = allXPositions[i];
  }
  
  // Adicionar a última coluna
  columnRanges.push({
    start: currentStart,
    end: currentEnd,
    center: (currentStart + currentEnd) / 2
  });
  
  // 4. Identificar os cabeçalhos
  let headerLines: TextElement[][] = [];
  let dataStartIndex = -1;
  
  // Encontrar onde começam os dados (primeiro registro que começa com número de dia)
  for (let i = 0; i < allLines.length; i++) {
    const lineText = allLines[i].map(item => item.text).join(' ');
    
    // Verificar se a linha começa com um número que pode ser um dia (1-31)
    if (/^(0?[1-9]|[12][0-9]|3[01])(\s|\d)/.test(lineText)) {
      dataStartIndex = i;
      break;
    }
  }
  
  // Os cabeçalhos são todas as linhas antes dos dados
  if (dataStartIndex > 0) {
    headerLines = allLines.slice(0, dataStartIndex);
    
    // Extrair texto dos cabeçalhos
    for (const line of headerLines) {
      const headerText = line.map(item => item.text).join(' ').trim();
      if (headerText) {
        result.headers.push(headerText);
      }
    }
  }
  
  // Se não encontramos cabeçalhos pelo método acima, usar todos os textos brutos
  if (result.headers.length === 0) {
    // Usar os primeiros textos brutos como cabeçalho
    result.headers = allRawTexts.slice(0, Math.min(20, allRawTexts.length));
  }
  
  // 5. Agrupar linhas em registros de trabalho
  if (dataStartIndex >= 0) {
    const dataLines = allLines.slice(dataStartIndex);
    let currentRecord: StructuredRecord | null = null;
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const lineText = line.map(item => item.text).join(' ').trim();
      
      // Verificar se esta linha inicia um novo registro (começa com dia e folha)
      if (/^(0?[1-9]|[12][0-9]|3[01])\s+\d{6}/.test(lineText)) {
        // Se já temos um registro em processamento, finalizá-lo
        if (currentRecord) {
          result.records.push(currentRecord);
        }
        
        // Iniciar novo registro
        currentRecord = {
          lines: [line],
          rawText: [lineText]
        };
      } 
      else if (currentRecord) {
        // Esta linha pode ser continuação do registro atual
        
        // Verificar se a linha está próxima o suficiente da linha anterior
        const prevLineY = currentRecord.lines[currentRecord.lines.length - 1][0].y;
        const currentLineY = line[0].y;
        
        // Se as linhas estão próximas e esta não é uma linha de rodapé ou cabeçalho
        if (currentLineY - prevLineY < 3 && 
            !lineText.includes('EXTRATO ANALÍTICO') && 
            !lineText.includes('OGMO') &&
            !lineText.includes('Folhas/Complementos') &&
            !lineText.includes('Revisadas')) {
          
          // Verificar se a próxima linha (se existir) inicia um novo registro
          const isLastLineOfRecord = (i + 1 < dataLines.length) && 
                                   /^(0?[1-9]|[12][0-9]|3[01])\s+\d{6}/.test(
                                     dataLines[i + 1].map(item => item.text).join(' ').trim()
                                   );
          
          // Se a linha não está vazia e não tem muitos números (isso seria mais provavelmente os valores numéricos)
          const numericCount = lineText.split(/\s+/).filter(word => /^[\d.,]+$/.test(word)).length;
          
          // Se parece parte do registro atual, adicionar
          if (lineText && (numericCount < 10 || isLastLineOfRecord)) {
            currentRecord.lines.push(line);
            currentRecord.rawText.push(lineText);
          }
        }
      }
    }
    
    // Adicionar o último registro em processamento
    if (currentRecord) {
      result.records.push(currentRecord);
    }
  }
  
  return result;
};

/**
 * NOVA FUNÇÃO: Processar um registro completo (todas as linhas que pertencem a um trabalho)
 * Esta função lida com casos onde o nome do navio ocupa múltiplas linhas
 */
const processStructuredRecord = (record: StructuredRecord): Trabalho | null => {
  // Obter o texto completo da primeira linha (onde estão dia, folha, tomador)
  const firstLineText = record.rawText[0];
  
  // Verificar se é um registro de trabalho válido (começa com dia e folha)
  const diaFolhaMatch = firstLineText.match(/^(\d{1,2})\s+(\d+)\s+(\d{2})/);
  
  if (!diaFolhaMatch) {
    return null; // Não é uma linha de trabalho
  }
  
  const dia = diaFolhaMatch[1];
  const folha = `${diaFolhaMatch[2]}-${diaFolhaMatch[3]}`;
  
  // Combinar todas as linhas em um único texto para processamento
  const combinedText = record.rawText.join(' ');
  const parts = combinedText.split(/\s+/);
  
  // Verificar se temos partes suficientes
  if (parts.length < 15) {
    console.log(`Registro muito curto para ser um trabalho válido para dia ${dia}, folha ${folha}`);
    return null;
  }
  
  // 1. Identificar o tomador (operador portuário)
  let tomador = '';
  let tomadorIndex = 3; // Posição esperada após dia e folha
  let tomadorEnd = 3;
  
  // Verificar todos os operadores conhecidos, incluindo os compostos
  for (const op of OPERADORES_PORTUARIOS) {
    const opParts = op.split(/\s+/);
    if (opParts.length > 1) {
      // Verificar operadores compostos como "ROCHA RS"
      let match = true;
      for (let i = 0; i < opParts.length && match; i++) {
        if (i + tomadorIndex >= parts.length || parts[i + tomadorIndex].toUpperCase() !== opParts[i].toUpperCase()) {
          match = false;
        }
      }
      
      if (match) {
        tomador = op;
        tomadorEnd = tomadorIndex + opParts.length - 1;
        break;
      }
    } else if (tomadorIndex < parts.length && parts[tomadorIndex] === op) {
      tomador = op;
      break;
    }
  }
  
  // Se não identificou um operador conhecido, usar o que estiver na posição esperada
  if (!tomador && tomadorIndex < parts.length) {
    tomador = parts[tomadorIndex];
  }
  
  // 2. Identificar a posição da função, turno, terno e data de pagamento
  // Estes campos têm formatos reconhecíveis:
  // - Função: código numérico de 3 dígitos (101, 103, 802, etc.)
  // - Turno: uma letra de A-D
  // - Terno: um número de 1-3
  // - Pagto: no formato DD/MM
  
  let funIndex = -1;
  
  // Estratégia A: Procurar a sequência completa de fun, tur, ter, pagto
  for (let i = tomadorEnd + 1; i < parts.length - 3; i++) {
    if (FUNCOES_VALIDAS.includes(parts[i]) && 
        i + 1 < parts.length && TURNOS_VALIDOS.includes(parts[i + 1]) && 
        i + 2 < parts.length && /^[1-3]$/.test(parts[i + 2]) && 
        i + 3 < parts.length && /^\d{2}\/\d{2}$/.test(parts[i + 3])) {
      
      funIndex = i;
      break;
    }
  }
  
  // Estratégia B: Procurar somente a função e turno
  if (funIndex === -1) {
    for (let i = tomadorEnd + 1; i < parts.length - 1; i++) {
      if (FUNCOES_VALIDAS.includes(parts[i]) && 
          i + 1 < parts.length && TURNOS_VALIDOS.includes(parts[i + 1])) {
        
        funIndex = i;
        break;
      }
    }
  }
  
  // Estratégia C: Procurar a data de pagamento e trabalhar de trás para frente
  if (funIndex === -1) {
    for (let i = parts.length - 1; i > tomadorEnd + 3; i--) {
      if (/^\d{2}\/\d{2}$/.test(parts[i])) {
        // Verificar se antes temos terno, turno e função
        if (i - 1 >= 0 && /^[1-3]$/.test(parts[i - 1]) && 
            i - 2 >= 0 && TURNOS_VALIDOS.includes(parts[i - 2]) && 
            i - 3 >= 0 && FUNCOES_VALIDAS.includes(parts[i - 3])) {
          
          funIndex = i - 3;
          break;
        }
      }
    }
  }
  
  // Estratégia D: Usar a posição dos valores numéricos para estimar
  if (funIndex === -1) {
    // Identificar onde começam os valores numéricos (geralmente são 13 valores)
    const numericIndices: number[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (/^[\d.,]+$/.test(parts[i])) {
        numericIndices.push(i);
      }
    }
    
    // Os 13 últimos valores numéricos devem ser os campos de valores
    if (numericIndices.length >= 13) {
      // Pegar o índice do primeiro valor dos últimos 13
      const firstNumericIndex = numericIndices[numericIndices.length - 13];
      
      // A sequência fun, tur, ter, pagto deve estar antes
      if (firstNumericIndex > tomadorEnd + 4) {
        funIndex = firstNumericIndex - 4; // 4 posições antes dos valores
      }
    }
  }
  
  // Estratégia E: Se todas as outras falharem, fazer uma estimativa
  if (funIndex === -1) {
    const textWithoutHeader = parts.slice(tomadorEnd + 1).join(' ');
    
    // Procurar por padrões conhecidos
    for (const fun of FUNCOES_VALIDAS) {
      const funPos = textWithoutHeader.indexOf(` ${fun} `);
      if (funPos !== -1) {
        // Contar palavras até esta posição
        const wordsBefore = textWithoutHeader.substring(0, funPos).split(/\s+/).filter(w => w.length > 0).length;
        funIndex = tomadorEnd + 1 + wordsBefore;
        break;
      }
    }
  }
  
  // Se ainda não encontramos, usar uma estimativa com base no tamanho
  if (funIndex === -1) {
    funIndex = Math.min(tomadorEnd + 5, parts.length - 17); // Deixar espaço para fun, tur, ter, pagto e 13 valores
  }
  
  // Garantir que funIndex está dentro dos limites
  funIndex = Math.max(tomadorEnd + 1, Math.min(funIndex, parts.length - 4));
  
  // 3. Extrair o nome do navio (tudo entre o tomador e a função)
  let pasta = '';
  for (let i = tomadorEnd + 1; i < funIndex; i++) {
    pasta += (pasta ? ' ' : '') + parts[i];
  }
  
  // Se o pasta está vazio, usar um valor padrão
  if (!pasta) {
    pasta = "NAVIO NÃO IDENTIFICADO";
    console.log(`AVISO: Nome do navio não identificado para o trabalho dia ${dia}, folha ${folha}`);
  }
  
  // 4. Extrair fun, tur, ter, pagto
  const fun = funIndex < parts.length ? parts[funIndex] : '';
  const tur = funIndex + 1 < parts.length ? parts[funIndex + 1] : '';
  const ter = funIndex + 2 < parts.length ? parts[funIndex + 2] : '';
  const pagto = funIndex + 3 < parts.length ? parts[funIndex + 3] : '';
  
  // 5. Extrair os valores numéricos
  const numericValues = [];
  for (let i = funIndex + 4; i < parts.length; i++) {
    if (/^[\d.,]+$/.test(parts[i])) {
      numericValues.push(parts[i]);
    }
  }
  
  // Se não temos 13 valores, pegar os últimos 13 valores numéricos da linha
  if (numericValues.length < 13) {
    const allNumeric = parts.filter(part => /^[\d.,]+$/.test(part));
    const lastThirteen = allNumeric.slice(-13);
    if (lastThirteen.length === 13) {
      console.log(`Usando os últimos 13 valores numéricos para dia ${dia}, folha ${folha}`);
      for (let i = 0; i < 13; i++) {
        numericValues[i] = lastThirteen[i];
      }
    }
  }
  
  // Garantir que temos 13 valores, preenchendo com zeros se necessário
  while (numericValues.length < 13) {
    numericValues.push('0');
  }
  
  // Limitar a 13 valores no máximo
  const finalNumericValues = numericValues.slice(0, 13);
  
  // Log para debug
  console.log(`Extração de trabalho: dia=${dia}, folha=${folha}, tomador=${tomador}, pasta="${pasta}", fun=${fun}, tur=${tur}, ter=${ter}, pagto=${pagto}`);
  
  // Mapear os valores numéricos para os campos correspondentes
  const trabalho: Trabalho = {
    dia,
    folha,
    tomador,
    pasta,
    fun,
    tur,
    ter,
    pagto,
    baseDeCalculo: normalizeNumber(finalNumericValues[0] || '0'),
    inss: normalizeNumber(finalNumericValues[1] || '0'),
    impostoDeRenda: normalizeNumber(finalNumericValues[2] || '0'),
    descontoJudicial: normalizeNumber(finalNumericValues[3] || '0'),
    das: normalizeNumber(finalNumericValues[4] || '0'),
    mensal: normalizeNumber(finalNumericValues[5] || '0'),
    impostoSindical: normalizeNumber(finalNumericValues[6] || '0'),
    descontosEpiCracha: normalizeNumber(finalNumericValues[7] || '0'),
    liquido: normalizeNumber(finalNumericValues[8] || '0'),
    ferias: normalizeNumber(finalNumericValues[9] || '0'),
    decimoTerceiro: normalizeNumber(finalNumericValues[10] || '0'),
    encargosDecimo: normalizeNumber(finalNumericValues[11] || '0'),
    fgts: normalizeNumber(finalNumericValues[12] || '0')
  };
  
  // Validar o trabalho para garantir que não há valores NaN
  return validateTrabalho(trabalho);
};

// Função para extrair resumo (Folhas/Complementos e Revisadas)
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

  // Procurar pela linha de total (linha com valores em negrito após a lista de trabalhos)
  let totalLineIndex = -1;
  let folhasComplementosLine = '';
  let revisadasLine = '';

  // Primeiro, encontrar uma linha com "Folhas/Complementos"
  for (let i = 0; i < textContent.length; i++) {
    const line = textContent[i].trim();
    if (line.includes('Folhas/Complementos')) {
      // Verificar se a linha também contém valores numéricos
      const parts = line.split(/\s+/);
      const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
      
      if (numericParts.length >= 10) {
        // A linha já contém os valores
        folhasComplementosLine = line;
      } else if (i + 1 < textContent.length) {
        // Verificar se a próxima linha contém os valores
        const nextLine = textContent[i + 1].trim();
        const nextParts = nextLine.split(/\s+/);
        const nextNumericParts = nextParts.filter(part => /^[\d.,]+$/.test(part));
        
        if (nextNumericParts.length >= 10) {
          folhasComplementosLine = nextLine;
        }
      }
      
      // Se encontramos a linha Folhas/Complementos, procurar por Revisadas nas linhas seguintes
      for (let j = i + 1; j < Math.min(i + 5, textContent.length); j++) {
        const revisadasCandidate = textContent[j].trim();
        
        if (revisadasCandidate.includes('Revisadas')) {
          // Verificar se a linha também contém valores numéricos
          const revParts = revisadasCandidate.split(/\s+/);
          const revNumericParts = revParts.filter(part => /^[\d.,]+$/.test(part));
          
          if (revNumericParts.length >= 10) {
            // A linha já contém os valores
            revisadasLine = revisadasCandidate;
          } else if (j + 1 < textContent.length) {
            // Verificar se a próxima linha contém os valores
            const nextRevLine = textContent[j + 1].trim();
            const nextRevParts = nextRevLine.split(/\s+/);
            const nextRevNumericParts = nextRevParts.filter(part => /^[\d.,]+$/.test(part));
            
            if (nextRevNumericParts.length >= 10) {
              revisadasLine = nextRevLine;
            }
          }
          
          break;
        }
      }
      
      break;
    }
  }
  
  // Se não encontrou através da abordagem de texto, procurar linhas numéricas
  if (!folhasComplementosLine) {
    // Procurar linhas que contêm apenas números (geralmente são os totais)
    for (let i = 0; i < textContent.length; i++) {
      const line = textContent[i].trim();
      
      if (line) {
        const parts = line.split(/\s+/);
        // Verificar se a linha tem muitos números
        const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
        
        if (numericParts.length >= 12 && parts.every(part => /^[\d.,]+$/.test(part) || part.trim() === '')) {
          // Esta linha parece ser um total
          if (totalLineIndex === -1) {
            totalLineIndex = i;
            
            // Verificar as próximas duas linhas
            if (i + 1 < textContent.length) {
              const nextLine = textContent[i + 1].trim();
              const nextParts = nextLine.split(/\s+/);
              
              if (nextLine.includes('Folhas/Complementos') || 
                  nextParts.filter(part => /^[\d.,]+$/.test(part)).length >= 12) {
                folhasComplementosLine = nextLine;
              }
            }
            
            if (i + 2 < textContent.length) {
              const nextNextLine = textContent[i + 2].trim();
              const nextNextParts = nextNextLine.split(/\s+/);
              
              if (nextNextLine.includes('Revisadas') || 
                  nextNextParts.filter(part => /^[\d.,]+$/.test(part)).length >= 12) {
                revisadasLine = nextNextLine;
              }
            }
            
            break;
          }
        }
      }
    }
  }
  
  // Se ainda não encontramos uma linha específica para Folhas/Complementos,
  // vamos procurar pelo último conjunto de linhas numéricas no documento
  if (!folhasComplementosLine) {
    let lastNumericLineIndex = -1;
    
    // Procurar da última linha para a primeira
    for (let i = textContent.length - 1; i >= 0; i--) {
      const line = textContent[i].trim();
      
      if (line) {
        const parts = line.split(/\s+/);
        const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
        
        if (numericParts.length >= 10) {
          lastNumericLineIndex = i;
          break;
        }
      }
    }
    
    // Se encontramos uma linha numérica, verificar as linhas ao redor
    if (lastNumericLineIndex !== -1) {
      // Verificar as linhas adjacentes para ver se contêm "Folhas/Complementos" ou "Revisadas"
      for (let i = Math.max(0, lastNumericLineIndex - 3); i <= Math.min(textContent.length - 1, lastNumericLineIndex + 3); i++) {
        const line = textContent[i].trim();
        
        if (line.includes('Folhas/Complementos')) {
          // Verificar se a próxima linha contém valores numéricos
          if (i + 1 < textContent.length) {
            const nextLine = textContent[i + 1].trim();
            const nextParts = nextLine.split(/\s+/);
            
            if (nextParts.filter(part => /^[\d.,]+$/.test(part)).length >= 10) {
              folhasComplementosLine = nextLine;
            }
          }
        } else if (line.includes('Revisadas')) {
          // Verificar se a próxima linha contém valores numéricos
          if (i + 1 < textContent.length) {
            const nextLine = textContent[i + 1].trim();
            const nextParts = nextLine.split(/\s+/);
            
            if (nextParts.filter(part => /^[\d.,]+$/.test(part)).length >= 10) {
              revisadasLine = nextLine;
            }
          }
        }
      }
      
      // Se ainda não temos linhas específicas, usar as últimas linhas numéricas
      if (!folhasComplementosLine) {
        // Encontrar as últimas 3 linhas com muitos valores numéricos
        const numericLines = [];
        
        for (let i = textContent.length - 1; i >= 0 && numericLines.length < 3; i--) {
          const line = textContent[i].trim();
          
          if (line) {
            const parts = line.split(/\s+/);
            const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
            
            if (numericParts.length >= 10) {
              numericLines.unshift(line); // Adicionar ao início para manter a ordem
            }
          }
        }
        
        // Se temos pelo menos duas linhas, assumir que são total e Folhas/Complementos
        if (numericLines.length >= 2) {
          folhasComplementosLine = numericLines[1]; // Segunda linha numérica de baixo para cima
          
          if (numericLines.length >= 3) {
            revisadasLine = numericLines[2]; // Terceira linha numérica de baixo para cima
          }
        }
      }
    }
  }
  
  // Se não encontrou as linhas, retornar null para calcular os totais a partir dos trabalhos
  if (!folhasComplementosLine) {
    console.log('Não foi possível encontrar a linha de Folhas/Complementos. Usando valores calculados.');
    return null;
  }

  // Extrair os valores numéricos das linhas
  const extractValues = (line: string): number[] => {
    return line.split(/\s+/)
      .filter(part => /^[\d.,]+$/.test(part))
      .map(normalizeNumber);
  };

  const folhasValues = extractValues(folhasComplementosLine);
  const revisadasValues = revisadasLine ? extractValues(revisadasLine) : Array(13).fill(0);

  // Garantir que temos o número correto de valores
  while (folhasValues.length < 13) folhasValues.push(0);
  while (revisadasValues.length < 13) revisadasValues.push(0);

  // Criar os objetos de resumo
  const folhasComplementos: ResumoExtrato = {
    baseDeCalculo: folhasValues[0] || 0,
    inss: folhasValues[1] || 0,
    impostoDeRenda: folhasValues[2] || 0,
    descontoJudicial: folhasValues[3] || 0,
    das: folhasValues[4] || 0,
    mensal: folhasValues[5] || 0,
    impostoSindical: folhasValues[6] || 0,
    descontosEpiCracha: folhasValues[7] || 0,
    liquido: folhasValues[8] || 0,
    ferias: folhasValues[9] || 0,
    decimoTerceiro: folhasValues[10] || 0,
    encargosDecimo: folhasValues[11] || 0,
    fgts: folhasValues[12] || 0
  };

  const revisadas: ResumoExtrato = {
    baseDeCalculo: revisadasValues[0] || 0,
    inss: revisadasValues[1] || 0,
    impostoDeRenda: revisadasValues[2] || 0,
    descontoJudicial: revisadasValues[3] || 0,
    das: revisadasValues[4] || 0,
    mensal: revisadasValues[5] || 0,
    impostoSindical: revisadasValues[6] || 0,
    descontosEpiCracha: revisadasValues[7] || 0,
    liquido: revisadasValues[8] || 0,
    ferias: revisadasValues[9] || 0,
    decimoTerceiro: revisadasValues[10] || 0,
    encargosDecimo: revisadasValues[11] || 0,
    fgts: revisadasValues[12] || 0
  };

  // Validar para garantir que não há valores NaN
  return { 
    folhasComplementos: validateResumoExtrato(folhasComplementos), 
    revisadas: validateResumoExtrato(revisadas) 
  };
};

// Função principal para processar o PDF e extrair texto
export const parseExtratoAnalitico = (filePath: string): Promise<Extrato> => {
  return new Promise((resolve, reject) => {
    // Configuração do parser com opções específicas
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new PDFParserError(`Erro ao analisar PDF: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        console.log(`PDF carregado, iniciando extração usando nova abordagem estruturada...`);
        
        // Extrair dados estruturados do PDF
        const structuredData = extractStructuredData(pdfData);
        
        // Unir cabeçalhos em um array de strings para o extractHeader
        const headerTexts = structuredData.headers;
        console.log(`Identificados ${headerTexts.length} linhas de cabeçalho`);
        
        // Extrair informações do cabeçalho
        const { matricula, nome, mes, ano, categoria } = extractHeader(headerTexts);
        console.log(`Dados de cabeçalho: ${matricula}, ${nome}, ${mes}/${ano}, ${categoria}`);
        
        // Extrair dados de trabalho de cada registro
        const trabalhos: Trabalho[] = [];
        
        for (const record of structuredData.records) {
          try {
            const trabalho = processStructuredRecord(record);
            if (trabalho) {
              // Verificar se já existe um trabalho com o mesmo dia e folha
              const isDuplicate = trabalhos.some(t => 
                t.dia === trabalho.dia && 
                t.folha === trabalho.folha
              );
              
              if (!isDuplicate) {
                trabalhos.push(trabalho);
                console.log(`Trabalho adicionado: Dia ${trabalho.dia}, Folha ${trabalho.folha}, Tomador ${trabalho.tomador}, Pasta "${trabalho.pasta}"`);
              } else {
                console.log(`Trabalho duplicado ignorado: Dia ${trabalho.dia}, Folha ${trabalho.folha}`);
              }
            }
          } catch (err) {
            console.log(`Erro ao processar registro: ${err}`);
            // Continuar com o próximo registro
          }
        }
        
        console.log(`Total de trabalhos extraídos: ${trabalhos.length}`);
        
        // Converter os registros em linhas de texto para o extractSummary
        const allLines = structuredData.records.flatMap(record => record.rawText);
        
        // Extrair dados de resumo ou calculá-los a partir dos trabalhos
        let folhasComplementos: ResumoExtrato;
        let revisadas: ResumoExtrato;
        
        const summaryData = extractSummary(allLines);
        
        if (!summaryData) {
          console.log('Calculando valores de resumo a partir dos trabalhos...');
          
          // Calcular totais com base nos trabalhos encontrados
          folhasComplementos = {
            baseDeCalculo: trabalhos.reduce((sum, t) => sum + (isNaN(t.baseDeCalculo) ? 0 : t.baseDeCalculo), 0),
            inss: trabalhos.reduce((sum, t) => sum + (isNaN(t.inss) ? 0 : t.inss), 0),
            impostoDeRenda: trabalhos.reduce((sum, t) => sum + (isNaN(t.impostoDeRenda) ? 0 : t.impostoDeRenda), 0),
            descontoJudicial: trabalhos.reduce((sum, t) => sum + (isNaN(t.descontoJudicial) ? 0 : t.descontoJudicial), 0),
            das: trabalhos.reduce((sum, t) => sum + (isNaN(t.das) ? 0 : t.das), 0),
            mensal: trabalhos.reduce((sum, t) => sum + (isNaN(t.mensal) ? 0 : t.mensal), 0),
            impostoSindical: trabalhos.reduce((sum, t) => sum + (isNaN(t.impostoSindical) ? 0 : t.impostoSindical), 0),
            descontosEpiCracha: trabalhos.reduce((sum, t) => sum + (isNaN(t.descontosEpiCracha) ? 0 : t.descontosEpiCracha), 0),
            liquido: trabalhos.reduce((sum, t) => sum + (isNaN(t.liquido) ? 0 : t.liquido), 0),
            ferias: trabalhos.reduce((sum, t) => sum + (isNaN(t.ferias) ? 0 : t.ferias), 0),
            decimoTerceiro: trabalhos.reduce((sum, t) => sum + (isNaN(t.decimoTerceiro) ? 0 : t.decimoTerceiro), 0),
            encargosDecimo: trabalhos.reduce((sum, t) => sum + (isNaN(t.encargosDecimo) ? 0 : t.encargosDecimo), 0),
            fgts: trabalhos.reduce((sum, t) => sum + (isNaN(t.fgts) ? 0 : t.fgts), 0)
          };
          
          // Validar para garantir que não há valores NaN
          folhasComplementos = validateResumoExtrato(folhasComplementos);
          
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
          revisadas = validateResumoExtrato(revisadas);
        } else {
          folhasComplementos = summaryData.folhasComplementos;
          revisadas = summaryData.revisadas;
        }
        
        // Montar o objeto extrato e garantir que não há valores NaN
        const extrato: Extrato = {
          matricula,
          nome,
          mes,
          ano,
          categoria,
          trabalhos: trabalhos.map(validateTrabalho), // Validar todos os trabalhos novamente
          folhasComplementos: validateResumoExtrato(folhasComplementos),
          revisadas: validateResumoExtrato(revisadas)
        };
        
        console.log(`Extrato processado com sucesso. Total de trabalhos: ${trabalhos.length}`);
        console.log(`Resumo - Base de Cálculo: ${folhasComplementos.baseDeCalculo}, Líquido: ${folhasComplementos.liquido}`);
        
        // Comparar totais calculados com os extraídos para validação
        if (trabalhos.length > 0) {
          const calculatedTotal = trabalhos.reduce((sum, t) => sum + (isNaN(t.baseDeCalculo) ? 0 : t.baseDeCalculo), 0);
          const extractedTotal = folhasComplementos.baseDeCalculo;
          
          console.log(`Validação: Total calculado=${calculatedTotal}, Total extraído=${extractedTotal}`);
          
          // Se houver uma grande discrepância, pode indicar que a extração não está correta
          const difference = Math.abs(calculatedTotal - extractedTotal);
          const percentDifference = extractedTotal > 0 ? (difference / extractedTotal) * 100 : 0;
          
          if (percentDifference > 10 && extractedTotal > 0) {
            console.log(`Aviso: Diferença significativa (${percentDifference.toFixed(2)}%) entre total calculado e extraído`);
          }
        }
        
        resolve(extrato);
      } catch (error) {
        if (error instanceof Error) {
          reject(new PDFParserError(`Erro ao processar dados do PDF: ${error.message}`));
        } else {
          reject(new PDFParserError('Erro desconhecido ao processar dados do PDF'));
        }
      }
    });
    
    try {
      // Carregar o PDF com configurações otimizadas
      pdfParser.loadPDF(filePath);
    } catch (error) {
      reject(new PDFParserError(`Erro ao carregar o arquivo PDF: ${error}`));
    }
  });
};