function isFn(x) { return typeof x === "function"; }

function pickHandler(controller, names, label) {
  for (const n of names) {
    const fn = controller && controller[n];
    if (isFn(fn)) return fn;
  }
  const got = controller ? Object.keys(controller) : null;
  const detail = got ? `keys=[${got.join(", ")}]` : "controller is null/undefined";
  throw new Error(`${label}: Expected function for one of (${names.join(" | ")}), but none found. ${detail}`);
}

module.exports = { pickHandler };