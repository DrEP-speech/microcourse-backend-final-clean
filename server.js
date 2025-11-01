"use strict";

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const PORT = Number(process.env.PORT || 10003);
const MONGO_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/microcourse";

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Auth
app.use("/api/auth", require("./routes/auth"));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` }));

// Global error handler (last)
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

// Mongo + start
(async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("[ok] Mongo connected:", MONGO_URL);
    app.listen(PORT, () => console.log(`[ok] Server listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Mongo connect failed:", err);
    process.exit(1);
  }
})();
