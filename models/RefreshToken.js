import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  jti: { type: String, index: true, unique: true, required: true },
  hashed: { type: String, required: true }, // hash of the token, never store raw
  expiresAt: { type: Date, index: true, required: true },
  revokedAt: { type: Date },
  replacedBy: { type: String }, // jti of the next token
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
export default mongoose.model('RefreshToken', refreshTokenSchema);
