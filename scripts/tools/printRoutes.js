// scripts/tools/printRoutes.js
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function isRouterLayer(layer) {
  return layer && layer.name === "router" && layer.handle && layer.handle.stack;
}

function isRouteLayer(layer) {
  return layer && layer.route && layer.route.path;
}

function getMethods(route) {
  return Object.keys(route.methods || {})
    .filter((m) => route.methods[m])
    .map((m) => m.toUpperCase());
}

function cleanPrefixFromRegexp(re) {
  // Attempts to decode mounted router regex like /^\/api\/auth\/?(?=\/|$)/i
  const s = re.toString();
  // crude but works for standard express mount regex strings
  const match = s.match(/^\/\^\\\/(.+?)\\\/\?\(\?=\\\/\|\$\)\/i$/);
  if (!match) return "";
  return "/" + match[1].replace(/\\\//g, "/");
}

function walkStack(stack, prefix, out) {
  for (const layer of stack) {
    if (isRouteLayer(layer)) {
      const routePath = layer.route.path;
      const fullPath =
        (prefix + (routePath === "/" ? "" : routePath)).replace(/\/+/g, "/");
      out.push({
        path: fullPath,
        methods: getMethods(layer.route),
      });
    } else if (isRouterLayer(layer)) {
      const mount = layer.regexp ? cleanPrefixFromRegexp(layer.regexp) : "";
      walkStack(layer.handle.stack, (prefix + mount).replace(/\/+/g, "/"), out);
    }
  }
}

function loadExpressApp() {
  // Try common entry points without guessing too hard
  const candidates = ["server.js", "app.js", "server/app.js", "src/server.js"].map((p) =>
    path.join(process.cwd(), p)
  );

  let entry = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      entry = c;
      break;
    }
  }
  if (!entry) {
    throw new Error(
      "Could not find server entry (tried server.js, app.js, server/app.js, src/server.js)."
    );
  }

  // Require it and try to find an Express app object
  const mod = require(entry);

  // If module exports app directly
  if (mod && typeof mod === "function" && mod.name === "app") return mod;
  if (mod && mod.listen && mod._router) return mod;

  // Common patterns: { app }, { server }, etc.
  if (mod && mod.app && mod.app._router) return mod.app;

  throw new Error(
    `Loaded ${path.basename(entry)} but couldn't find an Express app export. Export app or module.exports = app.`
  );
}

(function main() {
  const manifestPath = path.join(process.cwd(), "routes-manifest.json");
  const result = {
    generatedAt: new Date().toISOString(),
    cwd: process.cwd(),
    routes: [],
  };

  const app = loadExpressApp();
  const stack = app._router && app._router.stack ? app._router.stack : [];
  walkStack(stack, "", result.routes);

  // sort for stable output
  result.routes.sort((a, b) => (a.path + a.methods.join(",")).localeCompare(b.path + b.methods.join(",")));

  fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`✅ Wrote ${manifestPath}`);
  console.log(`✅ Found ${result.routes.length} route entries`);
})();

