import mongoose, { Schema, Document } from 'mongoose';
import { Extrato, ItemExtrato, ResumoExtrato } from '../schemas/ExtratoSchema';

const ItemExtratoSchema = new Schema<ItemExtrato>({
  dia: { type: String, required: true },
  folha: { type: String, required: true },
  tomador: { type: String, required: true },
  pasta: { type: String, required: true },
  fun: { type: String, required: true },
  tur: { type: String, required: true },
  ter: { type: String, required: true },
  pagto: { type: String, required: true },
  baseDeCalculo: { type: Number, required: true },
  inss: { type: Number, required: true },
  impostoDeRenda: { type: Number, required: true },
  descontoJudicial: { type: Number, required: true },
  das: { type: Number, required: true },
  mensal: { type: Number, required: true },
  impostoSindical: { type: Number, required: true },
  descontosEpiCracha: { type: Number, required: true },
  liquido: { type: Number, required: true },
  ferias: { type: Number, required: true },
  decimoTerceiro: { type: Number, required: true },
  encargosDecimo: { type: Number, required: true },
  fgts: { type: Number, required: true }
});

const ResumoExtratoSchema = new Schema<ResumoExtrato>({
  baseDeCalculo: { type: Number, required: true },
  inss: { type: Number, required: true },
  impostoDeRenda: { type: Number, required: true },
  descontoJudicial: { type: Number, required: true },
  das: { type: Number, required: true },
  mensal: { type: Number, required: true },
  impostoSindical: { type: Number, required: true },
  descontosEpiCracha: { type: Number, required: true },
  liquido: { type: Number, required: true },
  ferias: { type: Number, required: true },
  decimoTerceiro: { type: Number, required: true },
  encargosDecimo: { type: Number, required: true },
  fgts: { type: Number, required: true }
});

const ExtratoSchema = new Schema<Extrato & Document>({
  matricula: { type: String, required: true },
  nome: { type: String, required: true },
  mes: { type: String, required: true },
  ano: { type: String, required: true },
  categoria: { type: String, required: true },
  itens: [ItemExtratoSchema],
  folhasComplementos: ResumoExtratoSchema,
  revisadas: ResumoExtratoSchema
}, { timestamps: true });

// Adicionando índices para otimizar consultas
ExtratoSchema.index({ matricula: 1, mes: 1, ano: 1 }, { unique: true });
ExtratoSchema.index({ nome: 1 });
ExtratoSchema.index({ categoria: 1 });

const ExtratoModel = mongoose.model<Extrato & Document>('Extrato', ExtratoSchema);

export default ExtratoModel;