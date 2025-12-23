const express = require("express");
const path = require("path");
const api = require("./routes/api");

const app = express();

app.use(express.json());

// ✅ Serve frontend correctly
app.use(express.static(path.join(__dirname, "../public")));

// ✅ API routes
app.use("/api", api);

// ✅ Fallback: always return index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

module.exports = app;
