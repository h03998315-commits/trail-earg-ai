const express = require("express");
const api = require("./routes/api");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("trail-earg-ai alive");
});

app.use("/api", api);
module.exports = app;
