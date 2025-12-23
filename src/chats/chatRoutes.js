const router = require("express").Router();
const { v4: uuid } = require("uuid");
const db = require("../db/init");
const generateResponse = require("../ai/streamEngine");

/**
 * List chats
 */
router.get("/list", (req, res) => {
  const email = req.cookies.earg_session;
  if (!email) return res.json([]);

  db.all(
    `SELECT chats.* FROM chats
     JOIN users ON users.id = chats.user_id
     WHERE users.email = ?
     ORDER BY created_at DESC`,
    [email],
    (_, rows) => res.json(rows || [])
  );
});

/**
 * New chat
 */
router.post("/new", (req, res) => {
  const email = req.cookies.earg_session;
  if (!email) return res.status(401).end();

  db.get("SELECT id FROM users WHERE email=?", [email], (_, user) => {
    const chatId = uuid();
    db.run(
      "INSERT INTO chats VALUES (?, ?, ?, ?)",
      [chatId, user.id, "New Chat", new Date().toISOString()],
      () => res.json({ chatId })
    );
  });
});

/**
 * Send message (NON STREAMING)
 */
router.post("/send/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { text } = req.body;

  // save user message
  db.run(
    "INSERT INTO messages VALUES (?, ?, ?, ?, ?)",
    [uuid(), chatId, "user", text, new Date().toISOString()]
  );

  db.all(
    "SELECT role, content FROM messages WHERE chat_id=? ORDER BY created_at",
    [chatId],
    async (_, rows) => {
      const messages = rows.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const reply = await generateResponse(messages);

      db.run(
        "INSERT INTO messages VALUES (?, ?, ?, ?, ?)",
        [uuid(), chatId, "ai", reply, new Date().toISOString()]
      );

      res.json({ reply });
    }
  );
});

module.exports = router;
