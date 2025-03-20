import * as fs from 'fs';
import PDFParser from 'pdf2json';
import { Extrato, Trabalho, ResumoExtrato } from '../schemas/ExtratoSchema';

export class PDFParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFParserError';
  }
}

// Função melhorada para normalizar valores numéricos e evitar NaN
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

// Função corrigida para extrair cabeçalho
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
      
      // Extrair apenas o nome, convertendo para minúsculas e depois formatando com iniciais maiúsculas
      nome = matriculaNomeMatch[2].trim().toLowerCase();
      // Formatar com iniciais maiúsculas (opcional)
      nome = nome.replace(/\b\w/g, c => c.toUpperCase());
    }
    
    // Padrão para mês/ano: "MMM/AAAA"
    const mesAnoMatch = line.match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/);
    if (mesAnoMatch) {
      mes = mesAnoMatch[1];
      ano = mesAnoMatch[2];
    }
    
    // Categoria do trabalhador - extrair apenas "estivador", "arrumador", etc.
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

// Função aprimorada para extrair os dados de trabalho do PDF
const extractWorkData = (line: string): Trabalho | null => {
  // Remover excesso de espaços e caracteres problemáticos
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  // Log para debug
  console.log(`Tentando extrair trabalho da linha: "${cleanLine.substring(0, Math.min(100, cleanLine.length))}..."`);
  
  // Padrão básico: dia e começo da folha são os primeiros elementos e devem ser números
  const diaFolhaMatch = cleanLine.match(/^(\d{1,2})\s+(\d+)\s+(\d{2})/);
  
  if (!diaFolhaMatch) {
    return null; // Não é uma linha de trabalho
  }
  
  const dia = diaFolhaMatch[1];
  // Folha agora inclui o número de 6 dígitos, um hífen e o número de 2 dígitos
  const folha = `${diaFolhaMatch[2]}-${diaFolhaMatch[3]}`;
  
  // Depois de extrair dia e folha, obtemos o tomador (que está após o número de 2 dígitos)
  // Dividir a linha em partes
  const parts = cleanLine.split(/\s+/);
  
  // Um trabalho válido deve ter pelo menos 12-15 partes
  if (parts.length < 12) {
    console.log(`Linha com menos campos que o esperado (${parts.length}): "${cleanLine}"`);
    return null;
  }
  
  // Reorganizamos os índices devido à nova interpretação de "folha"
  // O tomador agora está na posição 3
  const tomadorIndex = 3;
  let pastaIndex = -1;
  
  // Procurar índice da pasta (geralmente um número de 3 dígitos como 801, 802, etc.)
  for (let i = 4; i < Math.min(12, parts.length); i++) {
    if (/^\d{3}$/.test(parts[i])) {
      pastaIndex = i;
      break;
    }
  }
  
  if (pastaIndex === -1) {
    console.log(`Não foi possível identificar a pasta na linha: "${cleanLine}"`);
    // Fazer uma tentativa adicional com um padrão diferente
    // Em alguns layouts, a pasta pode estar em uma posição fixa
    pastaIndex = 5; // Assumir que está na 6ª posição, devido à nova interpretação da folha
  }
  
  // Extrair dados com base nas posições identificadas
  const tomador = parts[tomadorIndex];
  const pasta = parts[pastaIndex];
  const fun = parts[pastaIndex + 1];
  const tur = parts[pastaIndex + 2];
  const ter = parts[pastaIndex + 3];
  const pagto = parts[pastaIndex + 4];
  
  // Se chegou até aqui, é uma linha de trabalho, mas precisamos identificar os valores numéricos
  // Vamos procurar pelos valores financeiros que geralmente estão no final da linha
  
  // Encontrar os valores numéricos na linha
  // Primeiro, vamos remover os dados já identificados para evitar confusão
  let remainingText = cleanLine;
  const identifiedParts = [dia, parts[1], parts[2], tomador, pasta, fun, tur, ter, pagto]; // Ajustado para a nova interpretação
  
  for (const part of identifiedParts) {
    remainingText = remainingText.replace(part, '');
  }
  
  // Limpar novamente
  remainingText = remainingText.replace(/\s+/g, ' ').trim();
  
  // Extrair os valores numéricos que restaram
  const numericValues = remainingText.split(/\s+/)
    .map(v => v.trim())
    .filter(v => /[\d.,]+/.test(v) && v !== '');
  
  // Log para debug
  console.log(`Valores numéricos encontrados (${numericValues.length}): ${numericValues}`);
  
  // Mapear os valores numéricos para os campos correspondentes
  // Usando normalizeNumber para garantir que não temos NaN
  const baseDeCalculo = normalizeNumber(numericValues[0] || '0');
  const inss = normalizeNumber(numericValues[1] || '0');
  const impostoDeRenda = normalizeNumber(numericValues[2] || '0');
  const descontoJudicial = normalizeNumber(numericValues[3] || '0');
  const das = normalizeNumber(numericValues[4] || '0');
  const mensal = normalizeNumber(numericValues[5] || '0');
  const impostoSindical = normalizeNumber(numericValues[6] || '0');
  const descontosEpiCracha = normalizeNumber(numericValues[7] || '0');
  const liquido = normalizeNumber(numericValues[8] || '0');
  const ferias = normalizeNumber(numericValues[9] || '0');
  const decimoTerceiro = normalizeNumber(numericValues[10] || '0');
  const encargosDecimo = normalizeNumber(numericValues[11] || '0');
  const fgts = normalizeNumber(numericValues[12] || '0');
  
  // Identificar o nome do tomador
  let tomadorNome = '';
  // Tentar encontrar o nome do tomador no texto entre o código e a pasta
  const tomadorStartIndex = cleanLine.indexOf(tomador) + tomador.length;
  const tomadorEndIndex = cleanLine.indexOf(pasta);
  
  if (tomadorStartIndex < tomadorEndIndex) {
    tomadorNome = cleanLine.substring(tomadorStartIndex, tomadorEndIndex).trim();
  }
  
  // Se não encontrou ou é vazio, usar o mapeamento
  if (!tomadorNome && tomadoresMap[tomador]) {
    tomadorNome = tomadoresMap[tomador];
  }
  
  // Construir e retornar o objeto trabalho
  const trabalho: Trabalho = {
    dia,
    folha,
    tomador,
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
  
  // Valide o trabalho para garantir que não há valores NaN
  const trabalhoValidado = validateTrabalho(trabalho);
  
  console.log(`Trabalho extraído com sucesso: Dia ${dia}, Folha ${folha}, Valor ${trabalhoValidado.liquido}`);
  return trabalhoValidado;
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
      
      // Validar para garantir que não há valores NaN
      return { 
        folhasComplementos: validateResumoExtrato(folhasComplementos), 
        revisadas: defaultResumo 
      };
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

  // Validar para garantir que não há valores NaN
  return { 
    folhasComplementos: validateResumoExtrato(folhasComplementos), 
    revisadas: validateResumoExtrato(revisadas) 
  };
};

// Função melhorada para processar o PDF e extrair texto mais precisamente
export const parseExtratoAnalitico = (filePath: string): Promise<Extrato> => {
  return new Promise((resolve, reject) => {
    // Configuração do parser com opções específicas
    const pdfParser = new PDFParser(null, true); // CORREÇÃO: true em vez de 1
    
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
        
        // Extrair informações do cabeçalho
        const { matricula, nome, mes, ano, categoria } = extractHeader(textContent);
        
        console.log(`Dados de cabeçalho: ${matricula}, ${nome}, ${mes}/${ano}, ${categoria}`);
        
        // Extrair dados de trabalho
        const trabalhos: Trabalho[] = [];
        
        // Processar cada linha para identificar trabalhos
        for (const line of textContent) {
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
                  console.log(`Trabalho adicionado: Dia ${trabalho.dia}, Folha ${trabalho.folha}`);
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
        
        // Se não encontrou trabalhos, tentar abordagem alternativa
        if (trabalhos.length === 0) {
          console.log(`Nenhum trabalho encontrado com o método padrão. Tentando abordagem alternativa...`);
          
          // Extrair trabalhos a partir do texto bruto
          for (const pageText of rawTextByPage) {
            const lines = pageText.split('\n');
            
            for (const line of lines) {
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
          
          // Se ainda não encontrou trabalhos, usar uma abordagem ainda mais manual
          if (trabalhos.length === 0) {
            console.log(`Ainda sem trabalhos. Tentando abordagem manual...`);
            
            // Em alguns PDFs, os dados podem estar em uma estrutura de tabela
            // Vamos tentar identificar linhas de tabela pelo padrão de números e espaços
            for (let i = 0; i < textContent.length; i++) {
              const line = textContent[i];
              
              // Linhas de trabalho geralmente têm vários números separados por espaços
              const numCount = (line.match(/\d+/g) || []).length;
              
              if (numCount >= 8 && /^\d+/.test(line.trim())) {
                console.log(`Possível linha de trabalho (contém ${numCount} números): ${line}`);
                
                try {
                  // Forçar extração mesmo de linhas que podem não seguir exatamente o padrão
                  const parts = line.trim().split(/\s+/);
                  
                  // Montar um objeto trabalho manualmente se tiver dados suficientes
                  if (parts.length >= 12) {
                    // Ajustado para considerar nova interpretação do campo folha
                    const dia = parts[0];
                    const folha = parts.length > 3 ? `${parts[1]}-${parts[2]}` : parts[1];
                    
                    const pastaCandidate = parts.find((p, idx) => idx > 3 && /^\d{3}$/.test(p)) || '000';
                    const pastaIndex = parts.indexOf(pastaCandidate);
                    
                    const trabalho: Trabalho = {
                      dia,
                      folha,
                      tomador: parts[3] || '',
                      tomadorNome: tomadoresMap[parts[3] || ''] || '',
                      pasta: pastaCandidate,
                      fun: pastaIndex > 0 ? parts[pastaIndex + 1] || 'A' : 'A',
                      tur: pastaIndex > 0 ? parts[pastaIndex + 2] || '1' : '1',
                      ter: pastaIndex > 0 ? parts[pastaIndex + 3] || '00/00' : '00/00',
                      pagto: pastaIndex > 0 ? parts[pastaIndex + 4] || '00/00' : '00/00',
                      baseDeCalculo: normalizeNumber(parts[parts.length - 13] || '0'),
                      inss: normalizeNumber(parts[parts.length - 12] || '0'),
                      impostoDeRenda: normalizeNumber(parts[parts.length - 11] || '0'),
                      descontoJudicial: normalizeNumber(parts[parts.length - 10] || '0'),
                      das: normalizeNumber(parts[parts.length - 9] || '0'),
                      mensal: normalizeNumber(parts[parts.length - 8] || '0'),
                      impostoSindical: normalizeNumber(parts[parts.length - 7] || '0'),
                      descontosEpiCracha: normalizeNumber(parts[parts.length - 6] || '0'),
                      liquido: normalizeNumber(parts[parts.length - 5] || '0'),
                      ferias: normalizeNumber(parts[parts.length - 4] || '0'),
                      decimoTerceiro: normalizeNumber(parts[parts.length - 3] || '0'),
                      encargosDecimo: normalizeNumber(parts[parts.length - 2] || '0'),
                      fgts: normalizeNumber(parts[parts.length - 1] || '0')
                    };
                    
                    // Validar para garantir que não há valores NaN
                    const trabalhoValidado = validateTrabalho(trabalho);
                    
                    if (trabalhoValidado.baseDeCalculo > 0 || trabalhoValidado.liquido > 0) {
                      trabalhos.push(trabalhoValidado);
                    }
                  }
                } catch (err) {
                  // Ignorar e continuar
                }
              }
            }
          }
        }
        
        // Extrair dados de resumo ou calculá-los a partir dos trabalhos
        let folhasComplementos: ResumoExtrato;
        let revisadas: ResumoExtrato;
        
        const summaryData = extractSummary(textContent);
        
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