const router = require("express").Router();

let groqClient = null;

// 🧠 In-memory chat history (per server instance)
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

// Decide when internet is needed
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

  return !casualPatterns.some(p => p.test(query.trim()));
}

// Tavily web search (top 3)
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

// Main chat route
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let context = "";

    // 🌐 Internet only when needed
    if (needsInternet(message)) {
      const results = await webSearch(message);
      context = results.map((r, i) => (
        `Source ${i + 1}: ${r.content}`
      )).join("\n\n");
    }

    // 🧠 Build message list with memory
    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, a confident Jarvis-like assistant.
You remember recent parts of the conversation.
Think before answering.
Use live internet data ONLY if provided.
Never mention training data or knowledge cutoffs.
Respond naturally and intelligently.
`
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Live internet information:\n${context}`
      });
    }

    // 🧠 Inject recent memory
    messages.push(...chatMemory);

    // Current user message
    messages.push({
      role: "user",
      content: message
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages
    });

    const reply = completion.choices[0].message.content;

    // 🧠 Save to memory
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: reply });

    // Trim memory
    while (chatMemory.length > MAX_MEMORY) {
      chatMemory.shift();
    }

    res.json({ reply });

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
