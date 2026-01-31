const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  const uri = mongoUri || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing. Set it in .env");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  return mongoose.connection;
}

module.exports = { connectDB };