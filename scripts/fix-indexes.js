"use strict";

const mongoose = require("mongoose");
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/microcourse";

(async () => {
  try {
    await mongoose.connect(MONGODB_URL, { autoIndex: true });
    const col = mongoose.connection.collection("users");

    // Drop all non-_id indexes, then recreate the single canonical one
    const idx = await col.indexes();
    for (const i of idx) {
      if (i.name !== "_id_") {
        console.log("[fix] dropping index:", i.name);
        try { await col.dropIndex(i.name); } catch (e) { console.log("  (skip)", e.message); }
      }
    }

    console.log("[fix] creating uniq_email on { email: 1 }");
    await col.createIndex({ email: 1 }, { unique: true, name: "uniq_email" });

    console.log("[fix] done");
    process.exit(0);
  } catch (err) {
    console.error("[fix] error:", err);
    process.exit(1);
  }
})();
