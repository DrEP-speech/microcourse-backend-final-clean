const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI missing");

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri, {
    autoIndex: true
  });

  console.log("DB connected");
}

module.exports = { connectDB };
