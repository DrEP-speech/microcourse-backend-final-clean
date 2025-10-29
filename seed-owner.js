"use strict";
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const MONGO = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/microcourse";
(async () => {
  try {
    await mongoose.connect(MONGO);
    const email = "owner@example.com";
    const pass  = "passw0rd";
    let u = await User.findOne({ email }).select("+password");
    if (!u) {
      u = new User({ email, password: pass, role: "owner" });
      await u.save();
      console.log("created owner:", email);
    } else if (!u.password) {
      u.password = pass;
      await u.save();
      console.log("backfilled owner password");
    } else {
      console.log("owner exists");
    }
  } catch (e) {
    console.error("[seed] error:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
