const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  const uri = mongoUri || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing. Set it in .env");

  mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

  await mongoose.connect(uri, {
    autoIndex: true,
  });
await mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
});

  return mongoose.connection;
}

module.exports = { connectDB };