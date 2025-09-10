// scripts/create-indexes.js
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js'; // adjust path
await mongoose.connect(process.env.MONGO_URL, { dbName: 'microcourse' });
await User.collection.createIndex({ email: 1 }, { unique: true });
console.log('✅ Indexes created');
await mongoose.disconnect();
