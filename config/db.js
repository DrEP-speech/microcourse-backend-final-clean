import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI; // <- accept both
  if (!uri) {
    console.error('❌ No Mongo URI found in env (MONGODB_URI or MONGO_URI).');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('✅ Mongo connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
