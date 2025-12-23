const groq = require("./groq");
const db = require("../db/init");
const { v4: uuid } = require("uuid");

async function streamResponse(chatId, messages, res) {
  let aiText = "";

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    stream: true
  });

  for await (const chunk of completion) {
    const token = chunk.choices?.[0]?.delta?.content;
    if (token) {
      aiText += token;
      res.write(`data:${token}\n\n`);
    }
  }

  // Save AI message AFTER stream completes
  db.run(
    "INSERT INTO messages VALUES (?, ?, ?, ?, ?)",
    [uuid(), chatId, "ai", aiText, new Date().toISOString()]
  );

  res.write("data:[DONE]\n\n");
  res.end();
}

module.exports = streamResponse;
