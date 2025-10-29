const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mime = require("mime-types");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const configured = process.env.UPLOAD_DIR || "public/uploads";
const UPLOAD_DIR = path.isAbsolute(configured) ? configured :
  path.join(PUBLIC_DIR, configured.replace(/^public[\\/]/, ""));

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "50", 10);
const LIMIT_BYTES = Math.max(1, MAX_UPLOAD_MB) * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function safeBasename(name) { return String(name).replace(/[^\w.\-]+/g, "_").slice(0, 200); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype) || file.originalname.split(".").pop() || "bin";
    const base = safeBasename(file.originalname.replace(/\.[^.]+$/, ""));
    cb(null, `${Date.now()}-${base}.${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const ok = file.mimetype.startsWith("video/")
         || file.mimetype.startsWith("image/")
         || file.mimetype.startsWith("audio/")
         || file.mimetype === "application/pdf";
  cb(ok ? null : new Error("Unsupported file type"), ok);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: LIMIT_BYTES } });

function publicUrlFor(filename) {
  return `/static/${path.relative(PUBLIC_DIR, path.join(UPLOAD_DIR, filename)).replace(/\\/g, "/")}`;
}

function inferAssetType(mimetype) {
  if (!mimetype) return "file";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype === "application/pdf") return "pdf";
  return "file";
}

module.exports = { upload, publicUrlFor, inferAssetType, PUBLIC_DIR };
