import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { Extrato, Trabalho, ResumoExtrato } from '../schemas/ExtratoSchema';

export class PDFParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFParserError';
  }
}

// Lista de tomadores conhecidos para melhorar a identificação
const TOMADORES_CONHECIDOS = [
  'AGM', 'SAGRES', 'TECON', 'TERMASA', 'ROCHA RS', 'LIVENPORT', 'BIANCHINI',
  'SERRA MOR', 'RGLP', 'ORION', 'CTIL'
];

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
  
  // Abordagem específica para formato padrão:
  // Linha 1: "EXTRATO ANALÍTICO"
  // Linha 2: "MATRÍCULA-DÍGITO NOME COMPLETO"
  // Linha 3: "MÊS/ANO"
  // Linha 4: "CATEGORIA"
  for (let i = 0; i < textContent.length; i++) {
    if (textContent[i].trim() === "EXTRATO ANALÍTICO") {
      // Checar a segunda linha para matrícula e nome
      if (i + 1 < textContent.length) {
        const matriculaNomeMatch = textContent[i + 1].match(/^(\d{3}-\d+)\s+(.+)$/);
        if (matriculaNomeMatch) {
          matricula = matriculaNomeMatch[1];
          nome = matriculaNomeMatch[2];
          console.log(`Encontrado padrão padrão: matricula=${matricula}, nome=${nome}`);
        }
      }
      
      // Checar a terceira linha para mês/ano
      if (i + 2 < textContent.length) {
        const mesAnoMatch = textContent[i + 2].match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/);
        if (mesAnoMatch) {
          mes = mesAnoMatch[1];
          ano = mesAnoMatch[2];
          console.log(`Encontrado padrão padrão: mês=${mes}, ano=${ano}`);
        }
      }
      
      // Checar a quarta linha para categoria
      if (i + 3 < textContent.length) {
        const cat = textContent[i + 3].trim();
        if (cat === "ESTIVADOR" || cat === "ARRUMADOR" || cat === "VIGIA" || cat === "CONFERENTE") {
          categoria = cat;
          console.log(`Encontrado padrão padrão: categoria=${categoria}`);
        }
      }
      
      // Se encontramos tudo no formato esperado, podemos retornar
      if (matricula && nome && mes && ano && categoria) {
        return { matricula, nome, mes, ano, categoria };
      }
      
      // Se encontramos pelo menos o início do padrão, não precisamos continuar procurando
      break;
    }
  }
  
  // Se não encontramos o padrão completo, buscar cada elemento individualmente
  console.log("Buscando elementos de cabeçalho individualmente...");
  
  // Buscar matrícula (padrão XXX-X)
  for (const line of textContent) {
    if (!matricula) {
      const match = line.match(/\b(\d{3}-\d+)\b/);
      if (match) {
        matricula = match[1];
        
        // Se encontramos a matrícula, o nome geralmente está na mesma linha
        const afterMatricula = line.substring(line.indexOf(match[1]) + match[1].length).trim();
        if (afterMatricula && afterMatricula.length > 5) {
          nome = afterMatricula;
          // Remover categoria se presente
          ["ESTIVADOR", "ARRUMADOR", "VIGIA", "CONFERENTE"].forEach(cat => {
            if (nome.includes(cat)) {
              nome = nome.replace(cat, "").trim();
              if (!categoria) categoria = cat;
            }
          });
        }
        
        console.log(`Encontrado individual: matricula=${matricula}, possível nome=${nome}`);
      }
    }
    
    // Buscar mês/ano
    if (!mes || !ano) {
      const match = line.match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/);
      if (match) {
        mes = match[1];
        ano = match[2];
        console.log(`Encontrado individual: mês=${mes}, ano=${ano}`);
      }
    }
    
    // Buscar categoria
    if (!categoria) {
      const upperLine = line.toUpperCase().trim();
      if (upperLine === "ESTIVADOR") categoria = "ESTIVADOR";
      else if (upperLine === "ARRUMADOR") categoria = "ARRUMADOR";
      else if (upperLine === "VIGIA") categoria = "VIGIA";
      else if (upperLine === "CONFERENTE") categoria = "CONFERENTE";
      
      if (categoria) console.log(`Encontrado individual: categoria=${categoria}`);
    }
    
    // Se encontramos todos os dados, podemos parar
    if (matricula && nome && mes && ano && categoria) break;
  }
  
  // Buscar nome se ainda não encontramos
  if (!nome && matricula) {
    // Procurar linhas longas que podem conter nomes
    for (const line of textContent) {
      if (line.length > 5 && /^[A-Z\s]+$/.test(line) && 
          !line.includes("EXTRATO") && !line.includes("OGMO")) {
        nome = line.trim();
        console.log(`Possível nome encontrado: ${nome}`);
        break;
      }
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
    if (!mes) mes = "MES"; // Valor padrão
    if (!ano) ano = "0000"; // Valor padrão
    if (!categoria) categoria = "CATEGORIA"; // Valor padrão
  }

  return { matricula, nome, mes, ano, categoria };
};

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
  summaryLines?: string[]; // Adicionado para armazenar as linhas de resumo
}

// Função para identificar a coluna onde os nomes dos navios estão localizados
const identifyShipNameColumn = (lines: TextElement[][]): {start: number, end: number} | null => {
  if (lines.length === 0) return null;
  
  // Tentar encontrar o padrão de colunas típico
  // Dia, Folha, Tomador, Pasta, Fun, Tur, Ter, etc.
  let tomadorColumn = -1;
  let funColumn = -1;
  
  // Procurar por padrões nos textos
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const text = line[i].text.trim().toUpperCase();
      
      // Procurar por possíveis operadores portuários (palavras curtas, em maiúsculas)
      if (text.length <= 5 && /^[A-Z]+$/.test(text) && TOMADORES_CONHECIDOS.includes(text)) {
        tomadorColumn = i;
      }
      
      // Procurar por códigos de função conhecidos
      for (const fun of FUNCOES_VALIDAS) {
        if (text === fun) {
          funColumn = i;
          break;
        }
      }
      
      if (tomadorColumn !== -1 && funColumn !== -1) break;
    }
    if (tomadorColumn !== -1 && funColumn !== -1) break;
  }
  
  // Se encontramos o tomador e a função, a coluna da pasta está entre eles
  if (tomadorColumn !== -1 && funColumn !== -1 && tomadorColumn < funColumn - 1) {
    // Determinar as coordenadas X aproximadas
    const startX = lines[0][tomadorColumn].x + 3; // Um pouco à direita do tomador
    const endX = lines[0][funColumn].x - 0.5;     // Um pouco à esquerda da função
    
    return { start: startX, end: endX };
  }
  
  // Se não conseguimos determinar pelas posições, usar uma estimativa
  if (lines[0].length >= 4) {
    // Assumir que a 4ª coluna (índice 3) é a pasta
    const pastaX = lines[0][3].x;
    return { start: pastaX - 0.5, end: pastaX + 10 }; // Ajustar conforme necessário
  }
  
  return null;
};

// Função para extrair texto da coluna do nome do navio
const extractTextFromShipColumn = (line: TextElement[], column: {start: number, end: number}): string => {
  let text = '';
  for (const element of line) {
    if (element.x >= column.start && element.x <= column.end) {
      text += (text ? ' ' : '') + element.text;
    }
  }
  return text;
};

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
  
  // 3. Extrair textos completos de todas as linhas
  const allTextLines: string[] = allLines.map(line => 
    line.map(item => item.text).join(' ').trim()
  ).filter(line => line.length > 0);
  
  // 4. Identificar os cabeçalhos e principais seções do documento
  let headerEndIndex = -1;
  let summaryStartIndex = -1;
  
  // Procurar pelo início dos dados (primeiro registro que começa com dia)
  for (let i = 0; i < allTextLines.length; i++) {
    const line = allTextLines[i];
    
    // Verificar se a linha começa com um padrão de dia (1-31) seguido de folha (6 dígitos)
    if (/^(0?[1-9]|[12][0-9]|3[01])\s+\d{6}/.test(line)) {
      headerEndIndex = i;
      break;
    }
  }
  
  // Procurar pelo início da seção de resumo
  for (let i = allTextLines.length - 1; i >= 0; i--) {
    const line = allTextLines[i];
    
    // Verificar se a linha contém "Folhas/Complementos"
    if (line.includes("Folhas/Complementos")) {
      // A linha de resumo geralmente está uma linha acima
      summaryStartIndex = Math.max(0, i - 1);
      break;
    }
  }
  
  // Se não encontrou por "Folhas/Complementos", procurar por linhas com muitos valores numéricos
  if (summaryStartIndex === -1) {
    for (let i = allTextLines.length - 10; i < allTextLines.length; i++) {
      if (i < 0) continue;
      
      const line = allTextLines[i];
      if (!line.includes("OGMO") && !line.includes("EMAIL") && 
          !line.includes("PORTUÁRIO") && !line.includes("SETOR DE")) {
        
        const parts = line.split(/\s+/);
        const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
        
        // Se a linha tem muitos valores numéricos consecutivos, é provavelmente uma linha de resumo
        if (numericParts.length >= 10 && numericParts.length / parts.length >= 0.8) {
          summaryStartIndex = i;
          break;
        }
      }
    }
  }
  
  // Definir os índices padrão se não foram encontrados
  if (headerEndIndex === -1) headerEndIndex = 5; // Assumir que o cabeçalho tem cerca de 5 linhas
  if (summaryStartIndex === -1) summaryStartIndex = allTextLines.length - 10; // Assumir que o resumo está nas últimas 10 linhas
  
  // 5. Separar as diferentes seções do documento
  const headerLines = allTextLines.slice(0, headerEndIndex);
  const dataLines = allTextLines.slice(headerEndIndex, summaryStartIndex);
  const summaryLines = allTextLines.slice(summaryStartIndex);
  
  console.log(`Seções identificadas: header=${headerLines.length}, data=${dataLines.length}, summary=${summaryLines.length}`);
  
  // Armazenar as linhas de cabeçalho
  result.headers = headerLines;
  
  // Armazenar as linhas de resumo para uso posterior
  result.summaryLines = summaryLines;
  
  // 6. Agrupar linhas de dados em registros
  let currentRecord: StructuredRecord | null = null;
  
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const lineText = line.map(item => item.text).join(' ').trim();
    
    // Se a linha está na seção de cabeçalho ou resumo, ignorar
    if (i < headerEndIndex || i >= summaryStartIndex) continue;
    
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
        const isLastLineOfRecord = (i + 1 < allLines.length) && 
                                  /^(0?[1-9]|[12][0-9]|3[01])\s+\d{6}/.test(
                                    allLines[i + 1].map(item => item.text).join(' ').trim()
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
  
  console.log(`Total de registros identificados: ${result.records.length}`);
  
  return result;
};

// Função para extrair o tomador correto de um registro
const extractTomador = (record: StructuredRecord): string => {
  // Combinar todas as linhas do registro
  const combinedText = record.rawText.join(' ');
  
  // Procurar por tomadores conhecidos nas linhas do registro
  for (const tomador of TOMADORES_CONHECIDOS) {
    const index = combinedText.indexOf(tomador);
    if (index !== -1) {
      return tomador;
    }
  }
  
  // Se não encontrar um tomador conhecido, usar a lógica original
  const firstLine = record.rawText[0];
  const parts = firstLine.split(/\s+/);
  
  if (parts.length > 3) {
    // Geralmente o tomador está na posição 3 (após dia e folha)
    return parts[3];
  }
  
  return "TOMADOR DESCONHECIDO";
};

// Função para limpar nomes de navios específica para os problemas encontrados
const cleanShipName = (text: string): string => {
  // Não queremos perder os sufixos "(PORTO NOVO)" ou "(ESTALEIRO)"
  const hasPortoNovo = text.includes("(PORTO NOVO)");
  const hasEstaleiro = text.includes("(ESTALEIRO)");
  
  // Remover códigos de função, turnos, etc.
  let cleaned = text;
  
  // Remover os tomadores conhecidos
  for (const tomador of TOMADORES_CONHECIDOS) {
    cleaned = cleaned.replace(new RegExp(`\\b${tomador}\\b`, 'g'), ' ');
  }
  
  // Remover códigos de função
  for (const fun of FUNCOES_VALIDAS) {
    cleaned = cleaned.replace(new RegExp(`\\b${fun}\\b`, 'g'), ' ');
  }
  
  // Remover turnos
  for (const tur of TURNOS_VALIDOS) {
    cleaned = cleaned.replace(new RegExp(`\\b${tur}\\b`, 'g'), ' ');
  }
  
  // Remover ternos (1, 2, 3)
  cleaned = cleaned.replace(/\b[1-3]\b/g, ' ');
  
  // Remover datas de pagamento (DD/MM)
  cleaned = cleaned.replace(/\b\d{2}\/\d{2}\b/g, ' ');
  
  // Remover o código "00" que aparece após a folha
  cleaned = cleaned.replace(/\b00\b/g, ' ');
  
  // Remover múltiplos espaços
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Garantir que os sufixos importantes estão presentes se estavam no texto original
  if (hasPortoNovo && !cleaned.includes("(PORTO NOVO)")) {
    cleaned += " (PORTO NOVO)";
  } else if (hasEstaleiro && !cleaned.includes("(ESTALEIRO)")) {
    cleaned += " (ESTALEIRO)";
  }
  
  return cleaned;
};

// Função simplificada para extrair o nome do navio
const extractShipName = (record: StructuredRecord): string => {
  // Texto completo do registro
  const allText = record.rawText.join(' ');
  
  // 1. Padrão específico: NOME (PORTO NOVO) ou NOME (ESTALEIRO)
  const portNovoMatch = /\b([A-Z][A-Z\s]+)\s+\(PORTO\s+NOVO\)/i.exec(allText);
  if (portNovoMatch && portNovoMatch[1].length > 2) {
    return cleanShipName(portNovoMatch[0]);
  }
  
  const estaleiroMatch = /\b([A-Z][A-Z\s]+)\s+\(ESTALEIRO\)/i.exec(allText);
  if (estaleiroMatch && estaleiroMatch[1].length > 2) {
    return cleanShipName(estaleiroMatch[0]);
  }
  
  // 2. Se o texto contém "(PORTO NOVO)" sem o nome antes
  if (allText.includes("(PORTO NOVO)")) {
    // Examinar cada linha individualmente
    for (const line of record.rawText) {
      // Se a linha tem "(PORTO NOVO)"
      if (line.includes("(PORTO NOVO)")) {
        const portoNovoIndex = line.indexOf("(PORTO NOVO)");
        if (portoNovoIndex > 0) {
          // Pegar tudo antes de "(PORTO NOVO)" na mesma linha
          const beforeText = line.substring(0, portoNovoIndex).trim();
          // Extrair a última palavra substantiva
          const lastWord = beforeText.split(/\s+/).filter(w => 
            w.length > 2 && /^[A-Z]/.test(w) && 
            !FUNCOES_VALIDAS.includes(w) && 
            !TURNOS_VALIDOS.includes(w)
          ).pop();
          
          if (lastWord) {
            return cleanShipName(`${lastWord} (PORTO NOVO)`);
          }
        }
      } else {
        // Procurar por potenciais nomes de navios nas outras linhas
        const words = line.split(/\s+/).filter(w => 
          w.length > 2 && /^[A-Z]/.test(w) && 
          !FUNCOES_VALIDAS.includes(w) && 
          !TURNOS_VALIDOS.includes(w) &&
          !TOMADORES_CONHECIDOS.includes(w)
        );
        
        if (words.length > 0) {
          const potentialName = words.join(' ');
          if (potentialName.length > 3) {
            return cleanShipName(`${potentialName} (PORTO NOVO)`);
          }
        }
      }
    }
    
    // Se não encontrou nome, retorna apenas o sufixo
    return "(PORTO NOVO)";
  }
  
  // 3. Similar para "(ESTALEIRO)"
  if (allText.includes("(ESTALEIRO)")) {
    // Examinar cada linha individualmente
    for (const line of record.rawText) {
      // Se a linha tem "(ESTALEIRO)"
      if (line.includes("(ESTALEIRO)")) {
        const estaleiroIndex = line.indexOf("(ESTALEIRO)");
        if (estaleiroIndex > 0) {
          // Pegar tudo antes de "(ESTALEIRO)" na mesma linha
          const beforeText = line.substring(0, estaleiroIndex).trim();
          // Extrair a última palavra substantiva
          const lastWord = beforeText.split(/\s+/).filter(w => 
            w.length > 2 && /^[A-Z]/.test(w) && 
            !FUNCOES_VALIDAS.includes(w) && 
            !TURNOS_VALIDOS.includes(w)
          ).pop();
          
          if (lastWord) {
            return cleanShipName(`${lastWord} (ESTALEIRO)`);
          }
        }
      } else {
        // Procurar por potenciais nomes de navios nas outras linhas
        const words = line.split(/\s+/).filter(w => 
          w.length > 2 && /^[A-Z]/.test(w) && 
          !FUNCOES_VALIDAS.includes(w) && 
          !TURNOS_VALIDOS.includes(w) &&
          !TOMADORES_CONHECIDOS.includes(w)
        );
        
        if (words.length > 0) {
          const potentialName = words.join(' ');
          if (potentialName.length > 3) {
            return cleanShipName(`${potentialName} (ESTALEIRO)`);
          }
        }
      }
    }
    
    // Se não encontrou nome, retorna apenas o sufixo
    return "(ESTALEIRO)";
  }
  
  // 4. Abordagem baseada em posição de linha
  if (record.lines.length > 1) {
    // Na maioria dos layouts, o nome do navio está entre o tomador e a função
    // Tentar extrair das linhas do meio (não a primeira nem a última)
    for (let i = 1; i < record.lines.length - 1; i++) {
      const line = record.lines[i];
      // Filtrar elementos que parecem nomes (não números, não códigos, etc.)
      const nameElements = line.filter(el => 
        el.text.length > 2 && 
        /^[A-Z]/.test(el.text) && 
        !/^\d+/.test(el.text) && 
        !FUNCOES_VALIDAS.includes(el.text) && 
        !TURNOS_VALIDOS.includes(el.text) &&
        !TOMADORES_CONHECIDOS.includes(el.text)
      );
      
      if (nameElements.length > 0) {
        return cleanShipName(nameElements.map(el => el.text).join(' '));
      }
    }
  }
  
  // 5. Tentar extrair de forma mais genérica
  // Procurar palavras que parecem nomes de navios
  for (const line of record.rawText) {
    const navioCandidatos = line.split(/\s+/).filter(word => 
      word.length > 2 && 
      /^[A-Z]/.test(word) && 
      !/^\d+/.test(word) && 
      !TOMADORES_CONHECIDOS.includes(word) &&
      !FUNCOES_VALIDAS.includes(word) &&
      !TURNOS_VALIDOS.includes(word) &&
      word !== "00"
    );
    
    if (navioCandidatos.length >= 1) {
      return cleanShipName(navioCandidatos.join(' '));
    }
  }
  
  // Se todas as abordagens falharem
  return "NAVIO NÃO IDENTIFICADO";
};

// Versão modificada de processStructuredRecord que implementa a extração de navio simplificada
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
  
  // Extrair tomador usando a função melhorada
  const tomador = extractTomador(record);
  
  // Extrair o nome do navio com a abordagem simplificada
  const pasta = extractShipName(record);
  
  // Combinar todas as linhas em um único texto para processamento
  const combinedText = record.rawText.join(' ');
  const parts = combinedText.split(/\s+/);
  
  // Verificar se temos partes suficientes
  if (parts.length < 15) {
    console.log(`Registro muito curto para ser um trabalho válido para dia ${dia}, folha ${folha}`);
    return null;
  }
  
  // Identificar a posição da função, turno, terno e data de pagamento
  let funIndex = -1;
  
  // Estratégia A: Procurar a sequência completa de fun, tur, ter, pagto
  for (let i = 0; i < parts.length - 3; i++) {
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
    for (let i = 0; i < parts.length - 1; i++) {
      if (FUNCOES_VALIDAS.includes(parts[i]) && 
          i + 1 < parts.length && TURNOS_VALIDOS.includes(parts[i + 1])) {
        
        funIndex = i;
        break;
      }
    }
  }
  
  // Estratégia C: Procurar a data de pagamento e trabalhar de trás para frente
  if (funIndex === -1) {
    for (let i = parts.length - 1; i > 3; i--) {
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
  
  // Se ainda não encontramos, usar uma abordagem de busca direta de funções
  if (funIndex === -1) {
    for (let i = 0; i < parts.length; i++) {
      if (FUNCOES_VALIDAS.includes(parts[i])) {
        funIndex = i;
        break;
      }
    }
  }
  
  // Se ainda não encontramos, usar uma estimativa com base no tamanho
  if (funIndex === -1) {
    funIndex = Math.min(5, parts.length - 17); // Deixar espaço para fun, tur, ter, pagto e 13 valores
  }
  
  // Garantir que funIndex está dentro dos limites
  funIndex = Math.max(4, Math.min(funIndex, parts.length - 4));
  
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
const extractSummary = (summaryLines: string[]): { folhasComplementos: ResumoExtrato, revisadas: ResumoExtrato } | null => {
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

  // Variáveis para armazenar as linhas encontradas
  let totalLine = ''; // Linha de soma (somente valores)
  let folhasComplementosLine = ''; // Linha Folhas/Complementos
  let revisadasLine = ''; // Linha Revisadas

  console.log(`Analisando ${summaryLines.length} linhas de resumo...`);
  
  // Primeira busca: encontrar as linhas explicitamente marcadas
  for (const line of summaryLines) {
    const trimmedLine = line.trim();
    
    // Ignorar linhas de rodapé
    if (trimmedLine.includes("OGMO") || trimmedLine.includes("EMAIL") || 
        trimmedLine.includes("PORTUÁRIO") || trimmedLine.includes("SETOR DE") ||
        /^\d{2}\/\d{2}\/\d{4}/.test(trimmedLine) || /^\d{2}:\d{2}:\d{2}/.test(trimmedLine)) {
      continue;
    }
    
    // Verificar por linha explícita com "Folhas/Complementos"
    if (trimmedLine.includes("Folhas/Complementos")) {
      folhasComplementosLine = trimmedLine;
      console.log(`Encontrada linha explícita Folhas/Complementos: "${trimmedLine}"`);
    }
    
    // Verificar por linha explícita com "Revisadas"
    if (trimmedLine.includes("Revisadas")) {
      revisadasLine = trimmedLine;
      console.log(`Encontrada linha explícita Revisadas: "${trimmedLine}"`);
    }
    
    // Procurar por possível linha de total (muitos valores numéricos, sem texto identificador)
    if (!totalLine && !trimmedLine.includes("Folhas/Complementos") && !trimmedLine.includes("Revisadas")) {
      const parts = trimmedLine.split(/\s+/);
      const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
      
      // Se a linha contém apenas ou quase apenas valores numéricos
      if (numericParts.length >= 10 && numericParts.length / parts.length >= 0.9) {
        totalLine = trimmedLine;
        console.log(`Encontrada possível linha de total (apenas valores): "${trimmedLine}"`);
      }
    }
  }
  
  // Segunda busca: se não encontramos as linhas explícitas, buscar padrões nos dados
  // Geralmente: total (somente números) -> Folhas/Complementos -> Revisadas
  if (!folhasComplementosLine || !revisadasLine) {
    // Extrair linhas com muitos valores numéricos
    const numericLines = [];
    
    for (const line of summaryLines) {
      const trimmedLine = line.trim();
      
      // Ignorar linhas de rodapé
      if (trimmedLine.includes("OGMO") || trimmedLine.includes("EMAIL") || 
          trimmedLine.includes("PORTUÁRIO") || trimmedLine.includes("SETOR DE") ||
          /^\d{2}\/\d{2}\/\d{4}/.test(trimmedLine) || /^\d{2}:\d{2}:\d{2}/.test(trimmedLine)) {
        continue;
      }
      
      const parts = trimmedLine.split(/\s+/);
      const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
      
      // Se a linha tem pelo menos 10 valores numéricos
      if (numericParts.length >= 10) {
        numericLines.push(trimmedLine);
      }
    }
    
    console.log(`Encontradas ${numericLines.length} linhas com muitos valores numéricos`);
    
    // Se encontramos pelo menos uma linha com muitos valores numéricos
    if (numericLines.length >= 1) {
      // Se não temos a linha de total, usar a primeira linha numérica
      if (!totalLine) {
        totalLine = numericLines[0];
        console.log(`Definindo primeira linha numérica como total: "${totalLine}"`);
      }
      
      // Se não temos a linha de Folhas/Complementos e temos pelo menos 2 linhas numéricas
      if (!folhasComplementosLine && numericLines.length >= 2) {
        folhasComplementosLine = numericLines[1];
        console.log(`Definindo segunda linha numérica como Folhas/Complementos: "${folhasComplementosLine}"`);
      } 
      // Se não temos mais de uma linha numérica, usar a linha de total como Folhas/Complementos
      else if (!folhasComplementosLine) {
        folhasComplementosLine = totalLine;
        console.log(`Usando linha de total como Folhas/Complementos: "${folhasComplementosLine}"`);
      }
      
      // Se não temos a linha de Revisadas e temos pelo menos 3 linhas numéricas
      if (!revisadasLine && numericLines.length >= 3) {
        revisadasLine = numericLines[2];
        console.log(`Definindo terceira linha numérica como Revisadas: "${revisadasLine}"`);
      }
      // Se não temos a linha de Revisadas mas precisamos de uma
      else if (!revisadasLine) {
        // Criar uma linha de zeros se não temos uma linha de revisadas
        const zeros = "0,00 ".repeat(13).trim();
        revisadasLine = `Revisadas ${zeros}`;
        console.log(`Criando linha de Revisadas com zeros: "${revisadasLine}"`);
      }
    }
  }
  
  // Se não foi possível encontrar as linhas, retornar null para calcular os totais a partir dos trabalhos
  if (!folhasComplementosLine) {
    console.log('Não foi possível encontrar a linha de Folhas/Complementos. Usando valores calculados.');
    return null;
  }

  // Extrair os valores numéricos das linhas
  const extractValues = (line: string): number[] => {
    // Remover texto não numérico como "Folhas/Complementos" ou "Revisadas"
    const numericPart = line.replace(/Folhas\/Complementos|Revisadas/g, '').trim();
    
    return numericPart.split(/\s+/)
      .filter(part => /^[\d.,]+$/.test(part))
      .map(normalizeNumber);
  };

  const folhasValues = extractValues(folhasComplementosLine);
  const revisadasValues = revisadasLine ? extractValues(revisadasLine) : Array(13).fill(0);

  console.log(`Valores extraídos - Folhas/Complementos: ${folhasValues.length} valores, Revisadas: ${revisadasValues.length} valores`);
  
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
        console.log(`PDF carregado, iniciando extração usando abordagem estruturada baseada em seções...`);
        
        // Extrair dados estruturados do PDF
        const structuredData = extractStructuredData(pdfData);
        
        // Extrair informações do cabeçalho
        const { matricula, nome, mes, ano, categoria } = extractHeader(structuredData.headers);
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
        
        // Extrair dados de resumo ou calculá-los a partir dos trabalhos
        let folhasComplementos: ResumoExtrato;
        let revisadas: ResumoExtrato;
        
        // Usar as linhas de resumo extraídas da seção específica
        const summaryData = structuredData.summaryLines ? 
                            extractSummary(structuredData.summaryLines) : null;
        
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