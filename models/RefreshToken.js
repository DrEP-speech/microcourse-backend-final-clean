const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true }, // JWT string
    expiresAt: { type: Date, required: true, index: true },
    userAgent: { type: String },
    ip: { type: String }
  },
  { timestamps: true, collection: 'refreshtokens' }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-purge

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
