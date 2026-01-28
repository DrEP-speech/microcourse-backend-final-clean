const mongoose = require("mongoose");

async function connectDB() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;

  if (!uri) throw new Error("Missing MONGO_URI (or MONGODB_URI/MONGO_URL/DATABASE_URL) in .env");

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose;
}

module.exports = { connectDB };
