const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

require("./db/init");

const authRoutes = require("./auth/authRoutes");
const chatRoutes = require("./chats/chatRoutes");

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);

module.exports = app;
