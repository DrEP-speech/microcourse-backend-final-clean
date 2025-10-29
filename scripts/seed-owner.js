"use strict";

const mongoose = require("mongoose");
const User = require("../models/User");

const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/microcourse";

(async () => {
  try {
    await mongoose.connect(MONGODB_URL, { autoIndex: true });

    await User.init(); // ensure indexes (uses uniq_email name)

    const email = "owner@example.com";
    const exists = await User.findOne({ email });
    if (!exists) {
      await User.create({ email, password: "passw0rd", role: "owner" });
      console.log("[seed] owner created:", email);
    } else {
      console.log("[seed] owner already exists:", email);
    }

    process.exit(0);
  } catch (err) {
    console.error("[seed] error:", err);
    process.exit(1);
  }
})();
