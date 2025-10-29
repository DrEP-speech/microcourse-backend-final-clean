"use strict";

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 10003;
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/microcourse";

const app = express();

// JSON body + CORS
app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth routes (mounted under /api/auth)
app.use("/api/auth", require("./auth"));

// Connect DB and start server
mongoose
  .connect(MONGODB_URL, { autoIndex: true })
  .then(() => {
    console.log("[ok] Mongo connected:", MONGODB_URL);
    app.listen(PORT, () => console.log(`[ok] Server listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("[db] connection error", err);
    process.exit(1);
  });
