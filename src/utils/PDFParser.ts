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

  // Procura por padrões nos textos do PDF
  for (const line of textContent) {
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
    }
    
    // Padrão para mês/ano: "MMM/AAAA"
    const mesAnoMatch = line.match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/);
    if (mesAnoMatch) {
      mes = mesAnoMatch[1];
      ano = mesAnoMatch[2];
    }
    
    // Categoria do trabalhador
    if (line.toUpperCase().includes('ESTIVADOR')) {
      categoria = 'ESTIVADOR';
    } else if (line.toUpperCase().includes('ARRUMADOR')) {
      categoria = 'ARRUMADOR';
    } else if (line.toUpperCase().includes('VIGIA')) {
      categoria = 'VIGIA';
    } else if (line.toUpperCase().includes('CONFERENTE')) {
      categoria = 'CONFERENTE';
    }
  }

  if (!matricula || !nome || !mes || !ano || !categoria) {
    throw new PDFParserError('Não foi possível extrair informações de cabeçalho completas');
  }

  return { matricula, nome, mes, ano, categoria };
};

// Lista de operadores portuários conhecidos (pode ser expandida conforme necessário)
const OPERADORES_PORTUARIOS = [
  'AGM', 'SAGRES', 'TECON', 'TERMASA', 'ROCHA RS', 'LIVENPORT', 'BIANCHINI', 'CTIL',
  'SERRA MOR', 'RGLP', 'ORION'
];

// Lista de padrões comuns que indicam onde um nome de navio pode ser quebrado
const SHIP_NAME_PATTERNS = [
  '(PORTO NOVO)',
  '(ESTALEIRO)',
  '(ERG)',
  'EXPRESS',
  'ARROW',
  'OCEAN',
  'BULKER',
  'WISDOM',
  'ETERNITY',
  'MATTERHORN',
  'ENDEAVOUR'
];

// Lista de códigos de função válidos
const FUNCOES_VALIDAS = [
  '101', '103', '104', '431', '521', '527', '801', '802', '803'
];

// Lista de turnos válidos
const TURNOS_VALIDOS = ['A', 'B', 'C', 'D'];

// Função para reconstruir as linhas do PDF, combinando aquelas que pertencem ao mesmo trabalho
const reconstructLines = (textContent: string[]): string[] => {
  const result: string[] = [];
  
  for (let i = 0; i < textContent.length; i++) {
    const currentLine = textContent[i].trim();
    
    // Verificar se a linha parece o início de um registro de trabalho (começa com número seguido de outro número)
    if (/^\d{1,2}\s+\d+/.test(currentLine)) {
      
      // Verificar se a linha tem o número esperado de valores numéricos
      const parts = currentLine.split(/\s+/);
      const numericalValues = parts.filter(part => /^[\d.,]+$/.test(part));
      
      // Um registro completo deve ter pelo menos 13 valores numéricos no final
      // Se tem menos, pode estar quebrado em duas linhas
      if (numericalValues.length < 13) {
        
        // Verificar se a próxima linha NÃO começa com um número (o que indicaria que é uma continuação)
        if (i + 1 < textContent.length && !/^\d{1,2}\s+\d+/.test(textContent[i + 1].trim())) {
          // Combinar as linhas
          const combinedLine = currentLine + ' ' + textContent[i + 1].trim();
          result.push(combinedLine);
          i++; // Avançar o índice para pular a linha que já foi combinada
          continue;
        }
      }
      
      // Verificar se a linha tem 13 valores numéricos mas ainda está faltando informações (como o código da função)
      const hasFun = FUNCOES_VALIDAS.some(fun => parts.includes(fun));
      const hasTurno = TURNOS_VALIDOS.some(turno => parts.includes(turno));
      
      if (!hasFun || !hasTurno) {
        // Pode estar faltando informações do navio ou da função
        if (i + 1 < textContent.length && !/^\d{1,2}\s+\d+/.test(textContent[i + 1].trim())) {
          const combinedLine = currentLine + ' ' + textContent[i + 1].trim();
          result.push(combinedLine);
          i++;
          continue;
        }
      }

      // MELHORIA: Verificar se há um parêntese aberto mas não fechado
      const openParens = (currentLine.match(/\(/g) || []).length;
      const closeParens = (currentLine.match(/\)/g) || []).length;
      
      if (openParens > closeParens) {
        // Há parênteses que não foram fechados, provavelmente continuam na próxima linha
        if (i + 1 < textContent.length && !/^\d{1,2}\s+\d+/.test(textContent[i + 1].trim())) {
          const combinedLine = currentLine + ' ' + textContent[i + 1].trim();
          result.push(combinedLine);
          i++;
          continue;
        }
      }
      
      // MELHORIA: Verificar se temos padrões conhecidos que podem indicar um nome de navio quebrado
      let hasShipNamePattern = false;
      for (const pattern of SHIP_NAME_PATTERNS) {
        if (currentLine.includes(pattern)) {
          hasShipNamePattern = true;
          break;
        }
      }
      
      // Se encontramos um padrão de nome de navio e a próxima linha não parece ser um novo registro,
      // é possível que o nome do navio continue na próxima linha
      if (hasShipNamePattern && i + 1 < textContent.length && !/^\d{1,2}\s+\d+/.test(textContent[i + 1].trim())) {
        const combinedLine = currentLine + ' ' + textContent[i + 1].trim();
        result.push(combinedLine);
        i++;
        continue;
      }
    }
    
    // Se não é um caso especial, adicionar a linha normalmente
    result.push(currentLine);
  }
  
  return result;
};

// Função para extrair os dados de trabalho do PDF
// Esta função foi melhorada para lidar melhor com nomes de navio quebrados
const extractWorkData = (line: string): Trabalho | null => {
  // Remover excesso de espaços e caracteres problemáticos
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  // Padrão básico: dia e começo da folha são os primeiros elementos e devem ser números
  const diaFolhaMatch = cleanLine.match(/^(\d{1,2})\s+(\d+)\s+(\d{2})/);
  
  if (!diaFolhaMatch) {
    return null; // Não é uma linha de trabalho
  }
  
  const dia = diaFolhaMatch[1];
  // Folha inclui o número de 6 dígitos, um hífen e o número de 2 dígitos
  const folha = `${diaFolhaMatch[2]}-${diaFolhaMatch[3]}`;
  
  // Dividir a linha em partes para extração
  const parts = cleanLine.split(/\s+/);
  
  // Um trabalho válido deve ter pelo menos 15-20 partes
  if (parts.length < 15) {
    console.log(`Linha muito curta para ser um trabalho válido: ${cleanLine}`);
    return null;
  }
  
  // Identificar o operador portuário (tomador)
  let tomador = '';
  let tomadorIndex = 3; // Posição inicial esperada
  let tomadorEnd = 3;
  
  // Verificar se o tomador é composto (ex: "SERRA MOR", "ROCHA RS")
  for (const op of OPERADORES_PORTUARIOS) {
    const opParts = op.split(/\s+/);
    if (opParts.length > 1) {
      // Verificar se todas as partes do operador estão presentes na linha
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
    } else if (parts[tomadorIndex] === op) {
      tomador = op;
      break;
    }
  }
  
  // Se não identificou um operador conhecido, usar a abordagem padrão
  if (!tomador) {
    tomador = parts[tomadorIndex];
    tomadorEnd = tomadorIndex;
  }
  
  // MELHORIA: Melhor detecção do campo "fun" com atenção especial para nomes de navios quebrados
  let funIndex = -1;
  
  // Estratégia 1: Procurar sequência completa fun, tur, ter, pagto
  for (let i = tomadorEnd + 1; i < parts.length - 4; i++) {
    if (FUNCOES_VALIDAS.includes(parts[i]) && 
        i + 1 < parts.length && TURNOS_VALIDOS.includes(parts[i + 1]) && 
        i + 2 < parts.length && /^[1-3]$/.test(parts[i + 2]) && 
        i + 3 < parts.length && /^\d{2}\/\d{2}$/.test(parts[i + 3])) {
      
      funIndex = i;
      break;
    }
  }
  
  // Estratégia 2: Buscar por parênteses em nomes de navios seguidos por função
  if (funIndex === -1) {
    for (let i = tomadorEnd + 1; i < parts.length - 4; i++) {
      // Verificar se esta parte contém um parêntese fechado
      if (parts[i].includes(')')) {
        // Verificar se as próximas partes parecem ser fun, tur, ter, pagto
        if (i + 1 < parts.length && FUNCOES_VALIDAS.includes(parts[i + 1]) && 
            i + 2 < parts.length && TURNOS_VALIDOS.includes(parts[i + 2])) {
          funIndex = i + 1;
          break;
        }
      }
      
      // Verificar padrões conhecidos de nomes de navios
      for (const pattern of SHIP_NAME_PATTERNS) {
        if (parts[i].includes(pattern) || 
            (parts[i].endsWith('(') && i + 1 < parts.length && parts[i + 1].startsWith('PORTO'))) {
          
          // Verificar se após este padrão temos o que parece ser uma função
          if (i + 2 < parts.length && FUNCOES_VALIDAS.includes(parts[i + 2])) {
            funIndex = i + 2;
            break;
          } else if (i + 3 < parts.length && FUNCOES_VALIDAS.includes(parts[i + 3])) {
            funIndex = i + 3;
            break;
          }
        }
      }
      
      if (funIndex !== -1) break;
    }
  }
  
  // Estratégia 3: Buscar por sequências específicas conhecidas
  // Por exemplo, buscar por "(PORTO NOVO)" seguido pelo código de função
  if (funIndex === -1) {
    const portoNovoPattern = /\(PORTO NOVO\)\s+(\d{3})/;
    const portoNovoMatch = cleanLine.match(portoNovoPattern);
    
    if (portoNovoMatch && FUNCOES_VALIDAS.includes(portoNovoMatch[1])) {
      // Encontrar a posição deste código de função
      for (let i = tomadorEnd + 1; i < parts.length; i++) {
        if (parts[i] === portoNovoMatch[1]) {
          funIndex = i;
          break;
        }
      }
    }
  }
  
  // Estratégia 4: Análise reversa a partir dos valores numéricos
  if (funIndex === -1) {
    // Encontrar onde começam os valores numéricos (geralmente são os últimos 13 valores)
    let numericIndices: number[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (/^[\d.,]+$/.test(parts[i])) {
        numericIndices.push(i);
      }
    }
    
    if (numericIndices.length >= 13) {
      // Pegar o índice do primeiro valor numérico dos últimos 13
      const firstNumericIndex = numericIndices[numericIndices.length - 13];
      
      // A sequência fun, tur, ter, pagto deve estar logo antes dos valores numéricos
      if (firstNumericIndex > tomadorEnd + 4) {
        // Verificar se antes do primeiro valor numérico temos o formato de data de pagamento (DD/MM)
        for (let i = firstNumericIndex - 1; i >= tomadorEnd + 3; i--) {
          if (/^\d{2}\/\d{2}$/.test(parts[i])) {
            // Verificar se antes temos o padrão de terno (1-3)
            if (i - 1 >= tomadorEnd + 2 && /^[1-3]$/.test(parts[i - 1])) {
              // Verificar se antes temos um turno válido
              if (i - 2 >= tomadorEnd + 1 && TURNOS_VALIDOS.includes(parts[i - 2])) {
                // Verificar se antes temos um código de função válido
                if (i - 3 >= tomadorEnd && FUNCOES_VALIDAS.includes(parts[i - 3])) {
                  funIndex = i - 3;
                  break;
                }
              }
            }
          }
        }
      }
    }
  }
  
  // MELHORIA: Detecção especial para casos onde o nome do navio contém "(PORTO NOVO)"
  if (funIndex === -1) {
    const fullText = parts.join(' ');
    const portoNovoIndex = fullText.indexOf("(PORTO NOVO)");
    
    if (portoNovoIndex !== -1) {
      // Procurar pelo código de função após "(PORTO NOVO)"
      const afterPortoNovo = fullText.substring(portoNovoIndex + 12).trim(); // 12 = "(PORTO NOVO)".length
      const funMatch = afterPortoNovo.match(/^\s*(\d{3})\s+([A-D])\s+([1-3])\s+(\d{2}\/\d{2})/);
      
      if (funMatch && FUNCOES_VALIDAS.includes(funMatch[1])) {
        // Contar quantas palavras tem até "(PORTO NOVO)"
        const beforePortoNovo = fullText.substring(0, portoNovoIndex).trim();
        const wordCount = beforePortoNovo.split(/\s+/).length;
        
        // O índice da função deve ser logo após as palavras até "(PORTO NOVO)" + as palavras de "(PORTO NOVO)"
        funIndex = wordCount + 2; // +2 para "PORTO" e "NOVO)"
      }
    }
  }
  
  // Se ainda não encontramos, usar uma abordagem heurística
  if (funIndex === -1) {
    // Geralmente a função está depois do nome do navio e antes dos valores numéricos
    // Vamos estimar com base na posição dos valores numéricos
    const numericPositions: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (/^[\d.,]+$/.test(parts[i])) {
        numericPositions.push(i);
      }
    }
    
    if (numericPositions.length >= 13) {
      // O primeiro valor numérico dos últimos 13 é uma boa referência
      const firstNumericIndex = numericPositions[numericPositions.length - 13];
      
      // A sequência fun, tur, ter, pagto deve estar antes
      funIndex = Math.max(tomadorEnd + 1, firstNumericIndex - 4);
    } else {
      // Se não temos valores numéricos suficientes, usar uma estimativa conservadora
      funIndex = Math.min(parts.length - 10, Math.max(tomadorEnd + 2, parts.length / 2));
    }
  }
  
  // Garantir que o funIndex é válido (não muito próximo do início nem do fim)
  funIndex = Math.max(tomadorEnd + 1, Math.min(funIndex, parts.length - 4));
  
  // Extrair o nome do navio (pasta)
  let pasta = '';
  for (let i = tomadorEnd + 1; i < funIndex; i++) {
    pasta += (pasta ? ' ' : '') + parts[i];
  }
  
  // MELHORIA: Para nomes com "(PORTO NOVO)", garantir que todo o texto está capturado
  if (pasta.includes('(PORTO') && !pasta.includes('NOVO)')) {
    pasta += ' NOVO)';
  }
  
  // Se o pasta está vazio (o que não deveria acontecer), usar um valor padrão
  if (!pasta) {
    pasta = "NAVIO NÃO IDENTIFICADO";
    console.log(`AVISO: Nome do navio não identificado para o trabalho dia ${dia}, folha ${folha}`);
  }
  
  // Extrair fun, tur, ter, pagto
  const fun = funIndex < parts.length ? parts[funIndex] : '';
  const tur = funIndex + 1 < parts.length ? parts[funIndex + 1] : '';
  const ter = funIndex + 2 < parts.length ? parts[funIndex + 2] : '';
  const pagto = funIndex + 3 < parts.length ? parts[funIndex + 3] : '';
  
  // Extrair os valores numéricos
  // Identificar todos os valores numéricos após o campo pagto
  const numericValues = [];
  for (let i = funIndex + 4; i < parts.length; i++) {
    if (/^[\d.,]+$/.test(parts[i])) {
      numericValues.push(parts[i]);
    }
  }
  
  // Se não temos 13 valores, pegar os últimos 13 valores da linha
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
  
  // Verificação adicional: se os valores estão muito pequenos, algo pode estar errado
  const valorTotal = trabalho.baseDeCalculo + trabalho.liquido;
  if (valorTotal < 10 && parts.length > 20) {
    console.log(`AVISO: Valores muito baixos para dia ${dia}, folha ${folha}. Possível erro na extração.`);
  }
  
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

// Função auxiliar para verificar se uma linha é um registro de trabalho completo
const isCompleteWorkRecord = (line: string): boolean => {
  const parts = line.split(/\s+/);
  
  // Verificar se começa com dia e folha
  if (!/^\d{1,2}\s+\d+\s+\d{2}/.test(line)) {
    return false;
  }
  
  // Verificar se tem algum código de função válido
  const hasFun = FUNCOES_VALIDAS.some(fun => parts.includes(fun));
  
  // Verificar se tem algum turno válido
  const hasTurno = TURNOS_VALIDOS.some(turno => parts.includes(turno));
  
  // Verificar se tem um formato de data para pagamento
  const hasDataPagto = parts.some(part => /^\d{2}\/\d{2}$/.test(part));
  
  // Verificar quantidade de valores numéricos
  const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
  
  // Um registro completo típico tem: dia, folha, 13 valores numéricos, um código de função,
  // um turno, um terno e uma data de pagamento
  return hasFun && hasTurno && hasDataPagto && numericParts.length >= 15;
};

// Função auxiliar para verificar se uma linha pode ser uma continuação de um registro
const isContinuationLine = (line: string): boolean => {
  // Verificar se não começa com um dia e folha
  if (/^\d{1,2}\s+\d+\s+\d{2}/.test(line)) {
    return false;
  }
  
  // Se não começa com número mas contém valores numéricos, pode ser uma continuação
  const parts = line.split(/\s+/);
  const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
  
  return numericParts.length > 0;
};

// Função para verificar e lidar com fragmentos ou partes de um registro de trabalho
const analyzeLineFragments = (lines: string[]): string[] => {
  const result: string[] = [];
  let possibleContinuationIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    
    // Se a linha parece o início de um registro de trabalho
    if (/^\d{1,2}\s+\d+\s+\d{2}/.test(currentLine)) {
      
      // Verificar se o registro está completo
      if (isCompleteWorkRecord(currentLine)) {
        result.push(currentLine);
        possibleContinuationIndex = -1;
      } else {
        // Registro incompleto, verificar próximas linhas por continuações
        let combinedLine = currentLine;
        let j = i + 1;
        
        while (j < lines.length && isContinuationLine(lines[j])) {
          combinedLine += ' ' + lines[j].trim();
          j++;
        }
        
        result.push(combinedLine);
        i = j - 1; // Ajustar o índice para continuar a partir da próxima linha não processada
      }
    } else {
      // Se não começa com dia e folha, verificar se pode ser uma continuação de um registro anterior
      if (possibleContinuationIndex !== -1) {
        // Combinar com a linha anterior se parecer uma continuação
        result[possibleContinuationIndex] += ' ' + currentLine;
      } else {
        // Caso não seja continuação, adicionar a linha normalmente
        result.push(currentLine);
        possibleContinuationIndex = -1;
      }
    }
  }
  
  return result;
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
        console.log(`PDF carregado, iniciando extração...`);
        
        // Extrair texto do PDF considerando a estrutura do documento
        const textContent: string[] = [];
        const rawTextByPage: string[] = [];
        
        // Processar todas as páginas
        for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
          const page = pdfData.Pages[pageIndex];
          
          console.log(`Processando página ${pageIndex + 1} de ${pdfData.Pages.length}`);
          
          let pageRawText = '';
          let currentY = -1;
          let currentLine = '';
          
          // Ordenar os textos por posição Y para agrupar por linhas
          const sortedTexts = [...page.Texts].sort((a, b) => a.y - b.y);
          
          // Processar textos agrupando por linha (mesma coordenada Y)
          for (const textItem of sortedTexts) {
            if (!textItem.R || textItem.R.length === 0) continue;
            
            const text = decodeURIComponent(textItem.R[0].T);
            const y = Math.round(textItem.y * 10) / 10; // Arredondar para evitar diferenças mínimas
            
            if (currentY === -1) {
              // Primeira linha
              currentY = y;
              currentLine = text;
            } else if (Math.abs(y - currentY) < 0.5) {
              // Mesmo Y (mesma linha)
              currentLine += ' ' + text;
            } else {
              // Nova linha
              textContent.push(currentLine.trim());
              pageRawText += currentLine.trim() + '\n';
              currentY = y;
              currentLine = text;
            }
          }
          
          // Última linha da página
          if (currentLine) {
            textContent.push(currentLine.trim());
            pageRawText += currentLine.trim() + '\n';
          }
          
          rawTextByPage.push(pageRawText);
        }
        
        console.log(`Total de linhas extraídas: ${textContent.length}`);
        
        // Pré-processamento do texto para combinar linhas quebradas
        // Esta é a fase crítica para resolver o problema das quebras de linha em nomes de navios
        console.log("Reconstruindo linhas quebradas...");
        const processedLines = reconstructLines(textContent);
        
        // Análise adicional para detectar fragmentos e continuações
        console.log("Analisando fragmentos de linhas...");
        const analyzedLines = analyzeLineFragments(processedLines);
        
        console.log(`Linhas processadas: ${analyzedLines.length}`);
        
        // Extrair informações do cabeçalho
        const { matricula, nome, mes, ano, categoria } = extractHeader(analyzedLines);
        
        console.log(`Dados de cabeçalho: ${matricula}, ${nome}, ${mes}/${ano}, ${categoria}`);
        
        // Extrair dados de trabalho
        const trabalhos: Trabalho[] = [];
        
        // Processar cada linha para identificar trabalhos
        for (const line of analyzedLines) {
          // Verificar se a linha parece ser um registro de trabalho (começa com número)
          if (/^\d{1,2}\s+\d+/.test(line)) {
            try {
              const trabalho = extractWorkData(line);
              if (trabalho) {
                // Validação adicional - evitar duplicatas e entradas inválidas
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
              console.log(`Erro ao processar linha de trabalho: ${err}`);
              // Continuar com a próxima linha mesmo se houver erro
            }
          }
        }
        
        console.log(`Total de trabalhos extraídos: ${trabalhos.length}`);
        
        // Verificar por trabalhos possivelmente perdidos
        if (trabalhos.length === 0) {
          console.log("ALERTA: Nenhum trabalho extraído! Tentando abordagem alternativa...");
          
          // Abordagem alternativa - analisar o texto bruto linha por linha
          for (const pageText of rawTextByPage) {
            const lines = pageText.split('\n');
            
            // Pré-processar para combinar linhas quebradas
            const processedLines = reconstructLines(lines);
            
            for (const line of processedLines) {
              if (/^\d{1,2}\s+\d+/.test(line)) {
                try {
                  const trabalho = extractWorkData(line);
                  if (trabalho && !trabalhos.some(t => 
                    t.dia === trabalho.dia && 
                    t.folha === trabalho.folha
                  )) {
                    trabalhos.push(trabalho);
                  }
                } catch (err) {
                  // Ignorar erros e continuar
                }
              }
            }
          }
          
          console.log(`Após abordagem alternativa: ${trabalhos.length} trabalhos`);
        }
        
        // Extrair dados de resumo ou calculá-los a partir dos trabalhos
        let folhasComplementos: ResumoExtrato;
        let revisadas: ResumoExtrato;
        
        const summaryData = extractSummary(analyzedLines);
        
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