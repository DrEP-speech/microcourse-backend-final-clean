function unwrapModule(mod) {
  // Handle CommonJS vs transpiled default exports
  if (!mod) return mod;
  return mod.default && (typeof mod.default === "function" || typeof mod.default === "object")
    ? mod.default
    : mod;
}

function pickFirstFunction(name, ...candidates) {
  for (const c0 of candidates) {
    const c = unwrapModule(c0);
    if (!c) continue;

    // Direct function export (module.exports = function ...)
    if (typeof c === "function" && (name === "default" || name === c.name)) return c;

    // Named export (module.exports = { myFn })
    if (typeof c === "object" && typeof c[name] === "function") return c[name];

    // Nested common shapes: { controller: { fn } } or { handlers: { fn } }
    for (const key of ["controller", "controllers", "handler", "handlers"]) {
      if (c[key] && typeof c[key][name] === "function") return c[key][name];
    }
  }
  return undefined;
}

function must(fn, label, context) {
  if (typeof fn !== "function") {
    const keys = context && typeof context === "object" ? Object.keys(context) : [];
    const extra = keys.length ? ` keys=[${keys.join(",")}]` : "";
    throw new Error(`[routerUtils] Missing handler for "${label}". Got: ${typeof fn}.${extra}`);
  }
  return fn;
}

module.exports = { pickFirstFunction, must };