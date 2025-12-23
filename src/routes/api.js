const router = require("express").Router();

let groqClient = null;

// Load Groq safely (Node 22 compatible)
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

// Tavily web search
async function webSearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      max_results: 3,
      search_depth: "basic"
    })
  });

  const data = await res.json();
  return data.results || [];
}

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    // 1️⃣ Always search the internet (B2)
    const results = await webSearch(message);

    // 2️⃣ Build clean context from top 3 results
    const context = results.map((r, i) => (
      `Source ${i + 1} (${r.url}): ${r.content}`
    )).join("\n\n");

    // 3️⃣ Send to AI
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are EARG AI, a confident Jarvis-like assistant.
You are provided with live internet information.
Use it to answer accurately and clearly.
Do NOT mention model limitations or training cutoffs.
`
        },
        {
          role: "system",
          content: `Live internet data:\n${context}`
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
