const mongoose = require("mongoose");
const config = require("../config/env");

async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.MONGODB_URI, {
    autoIndex: config.NODE_ENV !== "production",
  });
  return mongoose.connection;
}

module.exports = { connectMongo };
