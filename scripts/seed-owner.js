"use strict";
const mongoose = require("mongoose");
const User = require("../models/User");

const MONGO_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/microcourse";

(async () => {
  try {
    await mongoose.connect(MONGO_URL);
    const email = "owner@example.com";
    const passw0rd = "passw0rd";

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, password: passw0rd, role: "owner", profile: { displayName: "Owner" } });
      console.log("Seeded owner:", user.email);
    } else {
      // ensure password is hashed if plain somehow slipped in
      if (user.password && !user.password.startsWith("$2")) {
        user.password = passw0rd;
        await user.save();
        console.log("Backfilled owner password hash");
      }
      console.log("Owner already exists:", user.email);
    }
    process.exit(0);
  } catch (e) {
    console.error("[seed-owner] error:", e);
    process.exit(1);
  }
})();
