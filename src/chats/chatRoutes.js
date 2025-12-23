const router = require("express").Router();
const { v4: uuid } = require("uuid");
const db = require("../db/init");
const streamResponse = require("../ai/streamEngine");

router.get("/list", (req, res) => {
  const email = req.cookies.earg_session;
  db.all(
    "SELECT chats.* FROM chats JOIN users ON users.id=chats.user_id WHERE users.email=?",
    [email],
    (_, rows) => res.json(rows)
  );
});

router.post("/new", (req, res) => {
  const email = req.cookies.earg_session;
  db.get("SELECT id FROM users WHERE email=?", [email], (_, user) => {
    const chatId = uuid();
    db.run(
      "INSERT INTO chats VALUES (?, ?, ?, ?)",
      [chatId, user.id, "New Chat", new Date().toISOString()]
    );
    res.json({ chatId });
  });
});

router.get("/stream/:chatId", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  const { chatId } = req.params;

  db.all(
    "SELECT role, content FROM messages WHERE chat_id=?",
    [chatId],
    async (_, msgs) => {
      await streamResponse(msgs, res);
    }
  );
});

module.exports = router;
