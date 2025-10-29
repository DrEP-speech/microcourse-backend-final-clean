// models/RefreshToken.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const mongoose = require('mongoose');

const refreshSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expAt: { type: Date, required: true, index: true },
}, { timestamps: true });

module.exports = mongoose.model('RefreshToken', refreshSchema);
const refreshTokenSchema = new Schema({
  user:   { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  tokenId:{ type: String, index: true, required: true, unique: true }, // random id we rotate
  expiresAt: { type: Date, index: true, required: true },
  revokedAt: { type: Date },
  meta: { ip:String, ua:String }
}, { timestamps:true });

export default model('RefreshToken', refreshTokenSchema);
