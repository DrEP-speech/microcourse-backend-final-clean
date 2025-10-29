const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "demoAssets.json");

function loadFile() { try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return []; } }
function saveFile(arr) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2)); }

let mode = "file";
let AssetModel = null;
let mongoReady = null;

if (process.env.MONGO_URI) {
  mongoReady = mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "microcourse" })
    .then(() => {
      const schema = new mongoose.Schema({
        lessonId: { type: String, default: "demo", index: true },
        type:     { type: String, required: true },
        url:      { type: String, required: true },
        title:    { type: String, default: null },
        createdAt:{ type: Date, default: Date.now }
      }, { versionKey: false });
      AssetModel = mongoose.models.Asset || mongoose.model("Asset", schema);
      mode = "mongo"; return true;
    })
    .catch(err => { console.error("Mongo connection failed, using file:", err.message); mode = "file"; return false; });
}

function toClient(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id || o.id || randomUUID()),
    lessonId: o.lessonId || "demo",
    type: o.type, url: o.url, title: o.title ?? null,
    createdAt: (o.createdAt instanceof Date) ? o.createdAt.toISOString() : (o.createdAt || new Date().toISOString())
  };
}

async function createAsset({ type, url, title }) {
  if (mode === "mongo" && AssetModel) {
    await mongoReady;
    const doc = await AssetModel.create({ type, url, title });
    return toClient(doc);
  }
  const all = loadFile();
  const item = { id: randomUUID(), lessonId: "demo", type, url, title: title || null, createdAt: new Date().toISOString() };
  all.push(item); saveFile(all); return item;
}

async function listAssets({ type, page, limit } = {}) {
  if (mode === "mongo" && AssetModel) {
    await mongoReady;
    const q = { lessonId: "demo" }; if (type) q.type = type;
    if (page && limit) {
      const [total, docs] = await Promise.all([
        AssetModel.countDocuments(q),
        AssetModel.find(q).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit)
      ]);
      return { items: docs.map(toClient), total, page, limit };
    } else {
      const docs = await AssetModel.find(q).sort({ createdAt: 1 });
      return { items: docs.map(toClient), total: docs.length, page: 1, limit: docs.length };
    }
  }
  let all = loadFile(); if (type) all = all.filter(a => a.type === type);
  const total = all.length;
  if (page && limit) {
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);
    return { items, total, page, limit };
  } else {
    return { items: all, total, page: 1, limit: total };
  }
}

async function updateAsset(id, fields = {}) {
  if (mode === "mongo" && AssetModel) {
    await mongoReady;
    const doc = await AssetModel.findByIdAndUpdate(id, fields, { new: true });
    return doc ? toClient(doc) : null;
  }
  const all = loadFile();
  const idx = all.findIndex(a => a.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...fields }; saveFile(all);
  return all[idx];
}

async function deleteAsset(id) {
  if (mode === "mongo" && AssetModel) {
    await mongoReady;
    const doc = await AssetModel.findByIdAndDelete(id);
    return !!doc;
  }
  const all = loadFile();
  const next = all.filter(a => a.id !== id);
  if (next.length === all.length) return false;
  saveFile(next); return true;
}

async function clearAssets() {
  if (mode === "mongo" && AssetModel) { await mongoReady; await AssetModel.deleteMany({ lessonId: "demo" }); return true; }
  saveFile([]); return true;
}

function getMode() { return mode; }

module.exports = { createAsset, listAssets, updateAsset, deleteAsset, clearAssets, getMode };
