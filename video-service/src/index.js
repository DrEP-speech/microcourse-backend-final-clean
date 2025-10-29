import express from "express";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";
import { randomUUID } from "crypto"; // <-- from crypto, not uuid
import fs from "fs";
import fetch from "node-fetch";
import multer from "multer";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// simple local storage
const STORAGE = join(__dirname, "..", "storage");
const VIDEO_DIR = join(STORAGE, "videos");
const CAPTION_DIR = join(STORAGE, "captions");
for (const p of [STORAGE, VIDEO_DIR, CAPTION_DIR]) if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });

// --- Utilities
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2), "utf8");
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const jobsIndex = () => join(STORAGE, "jobs.json");
const loadJobs = () => (fs.existsSync(jobsIndex()) ? readJson(jobsIndex()) : {});
const saveJobs = (jobs) => writeJson(jobsIndex(), jobs);

// naive VTT builder (2s per sentence)
function buildVttFromScript(script, seconds = 2) {
  const lines = script
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  let t = 0;
  const toTS = (sec) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(Math.floor(sec % 60)).padStart(2, "0");
    const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, "0");
    return `${h}:${m}:${s}.${ms}`;
  };
  const blocks = lines.map((text, i) => {
    const start = toTS(t);
    const end = toTS((t += seconds));
    return `${i + 1}\n${start} --> ${end}\n${text}\n`;
  });
  return `WEBVTT\n\n${blocks.join("\n")}`;
}

// Run ffmpeg commands (requires ffmpeg on PATH)
async function ff(cmd) {
  const { spawn } = await import("child_process");
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", cmd, { stdio: "inherit" });
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
    );
  });
}

// TTS (uses ElevenLabs if key present; else generates silent audio)
async function synthesizeAudio(script) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const tmpWav = join(STORAGE, `audio-${randomUUID()}.wav`);

  if (!key) {
    // silent audio ~ N seconds (2s per sentence)
    const nSentences = Math.max(1, script.split(/[.!?]/).filter(Boolean).length);
    const dur = 2 * nSentences;
    await ff(["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", `${dur}`, tmpWav]);
    return tmpWav;
  }

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_turbo_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  if (!resp.ok) throw new Error(`TTS failed: ${await resp.text()}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(tmpWav, buf);
  return tmpWav;
}

// Avatar provider (HeyGen) – optional
async function renderAvatarVideo({ audioPath }) {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) return null; // not configured

  // NOTE: This is a minimal-style request. In practice you’ll upload audio and request a talking-head render.
  // Refer to provider docs and update below accordingly.
  // Here we just return null to signal not implemented when no key.
  return null;
}

// Slides+voiceover render (simple, brand color + text watermark)
async function renderSlidesVideo({ audioPath, script, brandColor = "#20293c" }) {
  const out = join(VIDEO_DIR, `slides-${randomUUID()}.mp4`);
  const color = brandColor.replace("#", "0x");
  // Create a color background with subtle animation, lay the audio on top
  await ff([
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${color}:s=1280x720:r=30`,
    "-i", audioPath,
    "-shortest",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    out
  ]);
  return out;
}

// POST /api/video/jobs
app.post("/api/video/jobs", async (req, res) => {
  try {
    const { lessonId, mode = "slides", script = "", voiceId, avatar, assets = {} } = req.body || {};
    if (!script || typeof script !== "string") return res.status(400).json({ error: "script is required" });

    const id = `vj_${randomUUID()}`;
    const jobs = loadJobs();
    jobs[id] = {
      id, lessonId, mode, script, voiceId, avatar, assets,
      status: "queued", progress: 0, fileUrl: null, captionUrl: null, createdAt: Date.now(), updatedAt: Date.now(), error: null
    };
    saveJobs(jobs);

    // fire-and-forget worker
    (async () => {
      const jobs = loadJobs();
      const j = jobs[id];
      try {
        j.status = "processing"; j.progress = 10; j.updatedAt = Date.now(); saveJobs(jobs);

        const audioPath = await synthesizeAudio(j.script);
        j.progress = 40; j.updatedAt = Date.now(); saveJobs(jobs);

        let mp4Path = null;
        if (j.mode === "avatar") {
          mp4Path = await renderAvatarVideo({ audioPath, avatar: j.avatar });
          if (!mp4Path) {
            // fallback to slides if avatar provider not configured
            mp4Path = await renderSlidesVideo({ audioPath, script: j.script, brandColor: j.assets?.brandColor });
          }
        } else {
          mp4Path = await renderSlidesVideo({ audioPath, script: j.script, brandColor: j.assets?.brandColor });
        }

        j.progress = 85; j.updatedAt = Date.now(); saveJobs(jobs);

        // captions
        const vtt = buildVttFromScript(j.script, 2);
        const vttPath = join(CAPTION_DIR, `${id}.vtt`);
        fs.writeFileSync(vttPath, vtt, "utf8");

        // publish local URLs
        j.fileUrl = `/videos/${mp4Path.split("\\").pop().split("/").pop()}`;
        j.captionUrl = `/captions/${id}.vtt`;
        j.status = "done"; j.progress = 100; j.updatedAt = Date.now(); saveJobs(jobs);
      } catch (e) {
        j.status = "failed"; j.error = String(e); j.updatedAt = Date.now(); saveJobs(jobs);
      }
    })();

    res.status(202).json({ jobId: id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/video/jobs/:id
app.get("/api/video/jobs/:id", (req, res) => {
  const { id } = req.params;
  const jobs = loadJobs();
  const j = jobs[id];
  if (!j) return res.status(404).json({ error: "not found" });
  res.json(j);
});

// static serving of outputs
app.use("/videos", express.static(VIDEO_DIR));
app.use("/captions", express.static(CAPTION_DIR));

// (optional) tiny upload endpoint if you want to accept slide images later
const upload = multer({ dest: join(STORAGE, "uploads") });
app.post("/api/video/uploads", upload.array("files"), (req, res) => {
  res.json({ files: req.files?.map(f => ({ filename: f.filename, originalname: f.originalname })) || [] });
});

const PORT = process.env.PORT || 10010;
app.listen(PORT, () => {
  console.log(`video-service on http://localhost:${PORT}`);
  console.log(`POST /api/video/jobs  | GET /api/video/jobs/:id`);
});

