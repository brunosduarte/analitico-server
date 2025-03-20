import { z } from 'zod';

// Esquema para cada trabalho individual realizado
export const TrabalhoSchema = z.object({
  dia: z.string(),
  folha: z.string(),
  tomador: z.string(),
  tomadorNome: z.string().optional(), // Nome da empresa tomadora do serviço
  pasta: z.string(),
  fun: z.string(),
  tur: z.string(),
  ter: z.string(),
  pagto: z.string(),
  baseDeCalculo: z.number(),
  inss: z.number(),
  impostoDeRenda: z.number(),
  descontoJudicial: z.number(),
  das: z.number(),
  mensal: z.number(),
  impostoSindical: z.number(),
  descontosEpiCracha: z.number(),
  liquido: z.number(),
  ferias: z.number(),
  decimoTerceiro: z.number(),
  encargosDecimo: z.number(),
  fgts: z.number()
});

export const ResumoExtratoSchema = z.object({
  baseDeCalculo: z.number(),
  inss: z.number(),
  impostoDeRenda: z.number(),
  descontoJudicial: z.number(),
  das: z.number(),
  mensal: z.number(),
  impostoSindical: z.number(),
  descontosEpiCracha: z.number(),
  liquido: z.number(),
  ferias: z.number(),
  decimoTerceiro: z.number(),
  encargosDecimo: z.number(),
  fgts: z.number()
});

export const ExtratoSchema = z.object({
  matricula: z.string(),
  nome: z.string(),
  mes: z.string(),
  ano: z.string(),
  categoria: z.string(),
  trabalhos: z.array(TrabalhoSchema), // Lista de todos os trabalhos realizados
  folhasComplementos: ResumoExtratoSchema,
  revisadas: ResumoExtratoSchema
});

export type Trabalho = z.infer<typeof TrabalhoSchema>;
export type ResumoExtrato = z.infer<typeof ResumoExtratoSchema>;
export type Extrato = z.infer<typeof ExtratoSchema>;