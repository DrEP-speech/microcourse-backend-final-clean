// scripts/seed.js (ESM)
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js'; // adjust path/name

await mongoose.connect(process.env.MONGO_URL, { dbName: 'microcourse' });

const email = 'admin@microcourse.local';
const passwordHash = await bcrypt.hash('Admin123!', 12);

await User.updateOne(
  { email },
  { $setOnInsert: { name: 'Admin', email, password: passwordHash, role: 'admin' } },
  { upsert: true }
);

console.log('✅ Seed complete');
await mongoose.disconnect();
