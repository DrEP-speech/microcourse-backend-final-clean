import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    badges: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
