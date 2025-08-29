import express from "express";
import proxyHandler from "../api/proxy.js";
import fs from "fs";
import path from "path";

// Load local .env for convenience in development (simple parser, no dependency)
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        process.env[m[1]] = process.env[m[1]] || val;
      }
    });
  }
} catch (e) {
  /* ignore */
}

const app = express();
const PORT = process.env.PORT || 3000;

// simple JSON url parser middleware for convenience
app.use((req, res, next) => {
  // keep req.query compatibility by parsing ?url= on GET
  next();
});

// mount the existing handler at /api/proxy
app.get("/api/proxy", (req, res) => proxyHandler(req, res));

app.listen(PORT, () => {
  console.log(`Local proxy listening on http://localhost:${PORT}`);
});
