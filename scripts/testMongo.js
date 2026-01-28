require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ No MONGODB_URI (or MONGO_URI) found in .env");
    process.exit(1);
  }

  // redact credentials for printing
  const redacted = uri.replace(/:\/\/([^:]+):([^@]+)@/g, "://$1:***@");
  console.log("Testing URI:", redacted);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ Connected:", mongoose.connection.host);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error("❌ Mongo connect failed:", e.message);
    process.exit(1);
  }
})();
