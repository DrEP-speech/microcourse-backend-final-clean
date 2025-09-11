import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String }
 role:         { type: String, enum: ['user', 'admin'], default: 'user', index: true }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);

