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

// Função para extrair os dados de trabalho do PDF
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
  
  // Dividir a linha em partes para extração dos demais campos
  const parts = cleanLine.split(/\s+/);
  
  // Um trabalho válido deve ter pelo menos 12-15 partes
  if (parts.length < 12) {
    return null;
  }
  
  // Posições esperadas dos campos
  const tomadorIndex = 3; // O tomador está na posição 3
  
  // Determinando a estrutura corrigida dos campos
  // O tomador já está definido
  const tomador = parts[tomadorIndex] || '';
  
  // Depois do tomador geralmente vem o nome do navio (pasta)
  // O nome do navio pode ocupar várias posições, então precisamos identificar onde termina
  let pastaEnd = tomadorIndex + 1;
  let funIndex = -1;
  
  // Procurar pelo campo "fun" que geralmente é um número de 3 dígitos (101, 801, etc.)
  for (let i = tomadorIndex + 1; i < parts.length - 10; i++) {
    if (/^\d{3}$/.test(parts[i])) {
      funIndex = i;
      pastaEnd = i - 1;
      break;
    }
  }
  
  // Se não encontrou um campo "fun" claro, usar uma estratégia alternativa
  if (funIndex === -1) {
    // Assumir uma posição aproximada baseada na observação dos PDFs
    funIndex = Math.min(tomadorIndex + 4, parts.length - 10);
    pastaEnd = funIndex - 1;
  }
  
  // Extrair a pasta (nome do navio) juntando as partes entre o tomador e o fun
  let pasta = '';
  for (let i = tomadorIndex + 1; i <= pastaEnd; i++) {
    pasta += (pasta ? ' ' : '') + parts[i];
  }
  
  // Os demais campos estão em sequência após o fun
  const fun = parts[funIndex] || '';
  const tur = parts[funIndex + 1] || '';
  const ter = parts[funIndex + 2] || '';
  const pagto = parts[funIndex + 3] || '';
  
  // Buscar os valores numéricos no final da linha
  // A linha geralmente termina com 13 valores numéricos em sequência
  const numericValues = [];
  let numStart = -1;
  
  // Encontrar o início dos valores numéricos
  for (let i = parts.length - 1; i >= funIndex + 4; i--) {
    if (/^[\d.,]+$/.test(parts[i])) {
      if (numericValues.length === 0) {
        // Começamos do final, então este é o último número
        numStart = Math.max(i - 12, funIndex + 4); // Queremos 13 números no total
      }
      if (i >= numStart) {
        numericValues.unshift(parts[i]); // Adicionar ao início do array para manter a ordem
      }
      if (numericValues.length >= 13) {
        break;
      }
    }
  }
  
  // Garantir que temos o número correto de valores, preenchendo com zeros se necessário
  while (numericValues.length < 13) {
    numericValues.push('0');
  }
  
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
    baseDeCalculo: normalizeNumber(numericValues[0] || '0'),
    inss: normalizeNumber(numericValues[1] || '0'),
    impostoDeRenda: normalizeNumber(numericValues[2] || '0'),
    descontoJudicial: normalizeNumber(numericValues[3] || '0'),
    das: normalizeNumber(numericValues[4] || '0'),
    mensal: normalizeNumber(numericValues[5] || '0'),
    impostoSindical: normalizeNumber(numericValues[6] || '0'),
    descontosEpiCracha: normalizeNumber(numericValues[7] || '0'),
    liquido: normalizeNumber(numericValues[8] || '0'),
    ferias: normalizeNumber(numericValues[9] || '0'),
    decimoTerceiro: normalizeNumber(numericValues[10] || '0'),
    encargosDecimo: normalizeNumber(numericValues[11] || '0'),
    fgts: normalizeNumber(numericValues[12] || '0')
  };
  
  // Valide o trabalho para garantir que não há valores NaN
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

  // Primeiro, encontrar uma linha que contenha apenas números e tenha pelo menos 10 números
  // Esta provavelmente é a linha de total
  for (let i = 0; i < textContent.length; i++) {
    const line = textContent[i].trim();
    if (line) {
      const parts = line.split(/\s+/);
      // Verificar se a linha tem muitos números
      const numCount = parts.filter(part => /^[\d.,]+$/.test(part)).length;
      if (numCount >= 10 && parts.every(part => /^[\d.,]+$/.test(part) || part.trim() === '')) {
        totalLineIndex = i;
        console.log(`Possível linha de total encontrada no índice ${i}: ${line}`);
        break;
      }
    }
  }

  // Se encontrou a linha de total, as próximas linhas provavelmente são Folhas/Complementos e Revisadas
  if (totalLineIndex !== -1) {
    // Procurar nas próximas linhas por Folhas/Complementos e Revisadas
    for (let i = totalLineIndex; i < Math.min(totalLineIndex + 10, textContent.length); i++) {
      const line = textContent[i].trim();
      
      if (line.includes('Folhas/Complementos')) {
        // A linha pode ter o texto "Folhas/Complementos" seguido por números
        // ou os números podem estar na próxima linha
        const parts = line.split(/\s+/);
        const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
        
        if (numericParts.length >= 10) {
          // Os números estão na mesma linha
          folhasComplementosLine = line;
        } else if (i + 1 < textContent.length) {
          // Os números estão na próxima linha
          folhasComplementosLine = textContent[i + 1].trim();
        }
        
        console.log(`Linha Folhas/Complementos encontrada: ${folhasComplementosLine}`);
      } else if (line.includes('Revisadas')) {
        // Similar ao anterior
        const parts = line.split(/\s+/);
        const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
        
        if (numericParts.length >= 10) {
          revisadasLine = line;
        } else if (i + 1 < textContent.length) {
          revisadasLine = textContent[i + 1].trim();
        }
        
        console.log(`Linha Revisadas encontrada: ${revisadasLine}`);
      }
    }
  }

  // Se ainda não encontrou as linhas específicas, mas achou a linha de total,
  // as próximas duas linhas numéricas são provavelmente o que procuramos
  if (totalLineIndex !== -1 && (!folhasComplementosLine || !revisadasLine)) {
    let foundLines = 0;
    
    for (let i = totalLineIndex + 1; i < Math.min(totalLineIndex + 10, textContent.length) && foundLines < 2; i++) {
      const line = textContent[i].trim();
      const parts = line.split(/\s+/);
      const numericParts = parts.filter(part => /^[\d.,]+$/.test(part));
      
      if (numericParts.length >= 10) {
        if (foundLines === 0) {
          folhasComplementosLine = line;
          console.log(`Assumindo que esta é a linha Folhas/Complementos: ${line}`);
          foundLines++;
        } else {
          revisadasLine = line;
          console.log(`Assumindo que esta é a linha Revisadas: ${line}`);
          foundLines++;
        }
      }
    }
  }

  // Se não encontrou as linhas, retornar null para calcular os totais a partir dos trabalhos
  if (!folhasComplementosLine) {
    console.log('Não foi possível encontrar a linha de Folhas/Complementos. Usando valores padrão.');
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

// Função para processar o PDF e extrair texto
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
                  console.log(`Trabalho adicionado: Dia ${trabalho.dia}, Folha ${trabalho.folha}, Tomador ${trabalho.tomador}, Pasta ${trabalho.pasta}`);
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
                  const parts = line.trim().split(/\s+/);
                  
                  // Montar um objeto trabalho manualmente se tiver dados suficientes
                  if (parts.length >= 12) {
                    const trabalho = extractWorkData(line);
                    if (trabalho && !trabalhos.some(t => 
                      t.dia === trabalho.dia && 
                      t.folha === trabalho.folha
                    )) {
                      trabalhos.push(trabalho);
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