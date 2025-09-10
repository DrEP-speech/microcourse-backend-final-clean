// ESM script to validate microcourse seed data
// Usage: node scripts/check-seed.js [--verbose]

import 'dotenv/config';
import mongoose from 'mongoose';

// ---- Config ----
const MONGO_URI =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/microcourse';

const VERBOSE = process.argv.includes('--verbose');

// Minimal, model-less access (works regardless of your app models)
const COLLECTIONS = [
  { name: 'users',    sampleFields: ['email', 'name', 'createdAt'] },
  { name: 'courses',  sampleFields: ['title', 'slug', 'createdAt'] },
  { name: 'quizzes',  sampleFields: ['courseId', 'title', 'items'] },
  { name: 'results',  sampleFields: ['userId', 'quizId', 'score'] },
];

// ---- Helpers ----
const ok   = (msg) => console.log(`✅ ${msg}`);
const warn = (msg) => console.warn(`⚠️  ${msg}`);
const err  = (msg) => console.error(`❌ ${msg}`);

function pick(obj, keys) {
  if (!obj) return obj;
  return Object.fromEntries(
    keys.filter(k => k in obj).map(k => [k, obj[k]])
  );
}

async function withConnection(uri, fn) {
  // Prefer direct db handle so this script is app-model agnostic
  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 4000,
  }).asPromise();

  try {
    return await fn(conn.db);
  } finally {
    await conn.close().catch(() => {});
  }
}

// ---- Main ----
(async () => {
  console.log('🔎 Checking seed data');
  console.log(`   Mongo: ${MONGO_URI.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')}`);

  const results = [];
  let failures = 0;

  await withConnection(MONGO_URI, async (db) => {
    for (const c of COLLECTIONS) {
      const col = db.collection(c.name);

      // Existence & count
      const count = await col.estimatedDocumentCount().catch(() => 0);
      const exists = count > 0;

      // Sample doc (not full dump)
      const sample = exists ? await col.find({}, { projection: { _id: 0 }, limit: 1 }).next() : null;

      // Field sanity: do a soft check on a few expected fields
      const missing = [];
      if (sample) {
        for (const f of c.sampleFields) {
          if (!(f in sample)) missing.push(f);
        }
      }

      results.push({
        collection: c.name,
        count,
        ok: exists && missing.length === 0,
        sample: sample ? pick(sample, c.sampleFields) : null,
        missingFields: missing,
      });

      if (!exists) {
        failures++;
        err(`${c.name}: 0 documents`);
      } else if (missing.length) {
        failures++;
        warn(`${c.name}: ${count} docs (missing fields in sample: ${missing.join(', ')})`);
      } else {
        ok(`${c.name}: ${count} docs`);
      }

      if (VERBOSE && sample) {
        console.log(`   sample ->`, pick(sample, c.sampleFields));
      }
    }
  });

  // Pretty summary
  console.log('\nSummary:');
  for (const r of results) {
    const status = r.ok ? 'OK' : (r.count === 0 ? 'EMPTY' : 'FIELDS?');
    console.log(
      ` - ${r.collection.padEnd(8)} : ${String(r.count).padStart(6)}  [${status}]`
    );
  }

  if (failures > 0) {
    console.log(`\n❌ Seed check failed (${failures} issue${failures > 1 ? 's' : ''} found).`);
    process.exit(1);
  } else {
    console.log('\n✅ Seed check passed.');
  }
})().catch((e) => {
  console.error('\n❌ Seed check crashed:', e?.message || e);
  process.exit(2);
});
