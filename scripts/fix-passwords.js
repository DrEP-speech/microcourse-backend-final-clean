"use strict";
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const MONGO = process.env.MONGODB_URL || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/microcourse";
const BACKFILL_PASS = process.env.DEFAULT_BACKFILL_PASS || "passw0rd";

(async () => {
  try {
    await mongoose.connect(MONGO);
    // find users where password field is missing or empty
    const candidates = await User.find({ $or: [ { password: { $exists: false } }, { password: null }, { password: "" } ] }).select("+password email");
    if (!candidates.length) {
      console.log("[fix-passwords] No users need backfill.");
      return;
    }
    console.log("[fix-passwords] backfilling", candidates.length, "user(s) ...");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(BACKFILL_PASS, salt);

    for (const u of candidates) {
      u.password = hash;        // set directly to avoid double re-hash
      await u.save({ validateBeforeSave: false });
      console.log("  ✓ backfilled:", u.email);
    }
  } catch (e) {
    console.error("[fix-passwords] error:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
