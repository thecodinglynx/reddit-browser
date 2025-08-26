import express from "express";
import proxyHandler from "../api/proxy.js";

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
