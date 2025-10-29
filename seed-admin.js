"use strict";
const mongoose = require("mongoose");
const User = require("./models/User");

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/microcourse";
  await mongoose.connect(uri, { dbName: process.env.MONGO_DB || undefined });

  const email = process.env.SEED_OWNER_EMAIL || "owner@example.com";
  const pass  = process.env.SEED_OWNER_PASS  || "passw0rd";
  const role  = "owner";

  const update = { email, role };
  if (pass) update.password = pass; // keep simple (your login logic already worked)

  const doc = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: update, $set: { role } },
    { upsert: true, new: true }
  ).lean();

  console.log("[seed] ensured admin:", { email: doc.email, role: doc.role });
  await mongoose.disconnect();
}
main().catch(e => { console.error("[seed] failed:", e); process.exit(1); });
