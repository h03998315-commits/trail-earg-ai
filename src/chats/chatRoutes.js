const router = require("express").Router();
const { v4: uuid } = require("uuid");
const db = require("../db/init");
const streamResponse = require("../ai/streamEngine");

/**
 * List chats
 */
router.get("/list", (req, res) => {
  const email = req.cookies.earg_session;
  if (!email) return res.status(401).json([]);

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
 * Create new chat
 */
router.post("/new", (req, res) => {
  const email = req.cookies.earg_session;
  if (!email) return res.status(401).end();

  db.get("SELECT id FROM users WHERE email=?", [email], (_, user) => {
    if (!user) return res.status(400).end();

    const chatId = uuid();
    db.run(
      "INSERT INTO chats VALUES (?, ?, ?, ?)",
      [chatId, user.id, "New Chat", new Date().toISOString()],
      () => res.json({ chatId })
    );
  });
});

/**
 * Save user message
 */
router.post("/message/:chatId", (req, res) => {
  const { chatId } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).end();

  db.run(
    "INSERT INTO messages VALUES (?, ?, ?, ?, ?)",
    [uuid(), chatId, "user", text, new Date().toISOString()],
    () => res.json({ ok: true })
  );
});

/**
 * Stream AI reply
 */
router.get("/stream/:chatId", async (req, res) => {
  const { chatId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  db.all(
    "SELECT role, content FROM messages WHERE chat_id=? ORDER BY created_at ASC",
    [chatId],
    async (_, rows) => {
      // 🔴 THIS WAS THE MISSING PIECE:
      // Convert DB rows to Groq format
      const messages = rows.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      await streamResponse(chatId, messages, res);
    }
  );
});

module.exports = router;
