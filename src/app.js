const express = require("express");
const path = require("path");
const api = require("./routes/api");

const app = express();
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api", api);

module.exports = app;
