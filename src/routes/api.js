const router = require("express").Router();

let groqClient = null;

// 🧠 Per-session memory store
const sessionMemory = {};
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
    const { message, sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    // Init session memory if needed
    if (!sessionMemory[sessionId]) {
      sessionMemory[sessionId] = [];
    }

    const memory = sessionMemory[sessionId];
    const groq = await getGroq();

    let context = "";
    let usedInternet = false;

    // 🌐 Internet only when needed
    if (needsInternet(message)) {
      const results = await webSearch(message);
      if (results.length) {
        usedInternet = true;
        context = results.map((r, i) => (
          `Source ${i + 1}: ${r.content}`
        )).join("\n\n");
      }
    }

    // 🧠 Build messages
    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, an assistant created and deployed by the EARG AI project.
You are not Meta AI, OpenAI, Google, or any other company.
If asked about your creator, you say you were created by the EARG AI team.
Do NOT claim to be created by Meta, OpenAI, or any model provider.
Never mention training data, internal models, or organizations behind the base model.
You remember recent parts of the conversation.
Think before answering.
Use live internet data ONLY if provided.
Respond naturally, confidently, and clearly.
`
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Live internet information:\n${context}`
      });
    }

    // 🧠 Inject per-session memory
    messages.push(...memory);

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

    // 🧠 Save to session memory
    memory.push({ role: "user", content: message });
    memory.push({ role: "assistant", content: reply });

    // Trim memory
    while (memory.length > MAX_MEMORY) {
      memory.shift();
    }

    res.json({
      reply,
      usedInternet
    });

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
