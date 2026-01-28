function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name, fallback = "") {
  const v = process.env[name];
  return v !== undefined ? v : fallback;
}

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI_DEV ||
    process.env.MONGODB_URI_PROD ||
    ""
  );
}

module.exports = { required, optional, getMongoUri };
