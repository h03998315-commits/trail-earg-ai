const router = require("express").Router();

let groqClient = null;

// ✅ Load Groq safely (Node 22 compatible, ESM-safe)
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

// ✅ Decide when internet is actually needed
function needsInternet(query) {
  const casualPatterns = [
    /^hi$/i,
    /^hello$/i,
    /^hey$/i,
    /^how are you/i,
    /^who are you/i,
    /^what can you do/i,
    /^thanks/i,
    /^thank you/i
  ];

  if (casualPatterns.some(p => p.test(query.trim()))) {
    return false;
  }

  return true;
}

// ✅ Tavily web search (top 3 results only)
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

// ✅ Main chat route
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let context = "";

    // 🌐 Only search when needed (HYBRID MODE)
    if (needsInternet(message)) {
      const results = await webSearch(message);
      context = results.map((r, i) => (
        `Source ${i + 1}: ${r.content}`
      )).join("\n\n");
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are EARG AI, a confident Jarvis-like assistant.
Think first like a conversational AI.
Use live internet information ONLY if provided below.
Do NOT mention training data, knowledge cutoffs, or model limitations.
Respond naturally and intelligently.
`
        },
        ...(context
          ? [{
              role: "system",
              content: `Live internet information:\n${context}`
            }]
          : []),
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

// ✅ Health check
router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
