Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $dir = Split-Path $Path -Parent
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

Write-Utf8NoBomFile "db.js" @"
"use strict";
const mongoose = require("mongoose");
async function connectDB(mongoUri) {
  const uri = mongoUri || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing. Set it in .env");
  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);
  return await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: true });
}
module.exports = { connectDB, mongoose };
"@

Write-Host "✔ db.js rewritten as sole DB owner" -ForegroundColor Green