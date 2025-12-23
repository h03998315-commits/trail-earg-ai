const router = require("express").Router();

let groqClient = null;

// 🧠 In-memory session memory (per server instance)
const chatMemory = [];
const MAX_MEMORY = 6;

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

/*
🧠 REASON-FIRST / INTERNET-LAST LOGIC

Rules:
- Default = NO internet
- Internet ONLY when question is explicitly time-sensitive
- NEVER for identity, memory, names, personal statements
*/

// ❌ Never search for personal / memory statements
function isBlockedFromInternet(text) {
  return /my name is|i am |i'm |call me|remember|what did we|who am i/i.test(
    text.toLowerCase()
  );
}

// ✅ Only allow internet for explicit real-time intent
function needsInternet(query) {
  const q = query.toLowerCase();

  if (isBlockedFromInternet(q)) return false;

  const realtimeTriggers = [
    "today",
    "latest",
    "current",
    "right now",
    "news",
    "price",
    "weather",
    "stock",
    "election",
    "score",
    "live"
  ];

  return realtimeTriggers.some(word => q.includes(word));
}

// 🌐 Tavily search (strict, small)
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

// 💬 Main chat route
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let context = "";
    let usedInternet = false;

    // 🌐 Internet ONLY if explicitly required
    if (needsInternet(message)) {
      const results = await webSearch(message);
      if (results.length) {
        usedInternet = true;
        context = results
          .map((r, i) => `Source ${i + 1}: ${r.content}`)
          .join("\n\n");
      }
    }

    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, created by the EARG AI project.
You are NOT Meta AI, OpenAI, Google, or any other company.

CRITICAL RULES:
- Always attempt to answer using your own reasoning first.
- Use live internet information ONLY if it is explicitly provided.
- Never infer personal details about the user.
- If a user shares their name, acknowledge politely and stop.
- You have short-term memory ONLY for this session.
- If recalling something, say "from this session".

If no live data is provided, do NOT invent external facts.
Respond clearly, safely, and confidently.
        `.trim()
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Live internet information:\n${context}`
      });
    }

    // 🧠 Inject session memory
    messages.push(...chatMemory);

    messages.push({
      role: "user",
      content: message
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages
    });

    const reply = completion.choices[0].message.content;

    // 🧠 Save memory (session only)
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: reply });

    while (chatMemory.length > MAX_MEMORY) {
      chatMemory.shift();
    }

    res.json({ reply, usedInternet });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

// Health check
router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
