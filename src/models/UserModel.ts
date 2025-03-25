import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface User extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'desenvolvedor' | 'estivador' | 'arrumador' | 'conferente' | 'vigia';
  phoneNumber: string;
  twoFactorEnabled: boolean;
  twoFactorCode?: string;
  twoFactorCodeExpiry?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Resto do código permanece o mesmo...

const UserSchema = new Schema<User>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'desenvolvedor', 'estivador', 'arrumador', 'conferente', 'vigia'],
    default: 'estivador'
  },
  phoneNumber: { type: String, required: true },
  twoFactorEnabled: { type: Boolean, default: true },
  twoFactorCode: { type: String },
  twoFactorCodeExpiry: { type: Date }
}, { timestamps: true });

// Antes de salvar, hash da senha se foi modificada
UserSchema.pre('save', async function(next) {
  const user = this;
  
  if (!user.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error: any) {
    return next(error);
  }
});

// Método para comparar senha
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing password');
  }
};

// Criar e exportar o modelo
const UserModel = mongoose.model<User>('User', UserSchema);

export default UserModel;