async function health(req, res) {
  return res.json({
    ok: true,
    service: "microcourse-backend",
    time: new Date().toISOString(),
  });
}

module.exports = { health };
