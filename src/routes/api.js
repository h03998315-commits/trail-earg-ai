const router = require("express").Router();

let groqClient = null;

/**
 * Safe Groq loader for Node 22 (ESM-only SDK)
 */
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are EARG AI, a confident Jarvis-like assistant.
Do not mention training data, knowledge cutoffs, or model limitations.
Answer clearly, naturally, and helpfully.
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    res.json({
      reply: completion.choices[0].message.content
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
